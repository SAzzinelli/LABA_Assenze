const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');
const { sendEmail, sendEmailToAdmins } = require('./emailService');
const emailScheduler = require('./emailScheduler');
const { calculateExpectedHoursForSchedule, calculateRealTimeHours } = require('./utils/hoursCalculation');
const AttendanceScheduler = require('./attendanceScheduler');
const http = require('http');
const WebSocketManager = require('./websocket');
const cron = require('node-cron');
require('dotenv').config();

// Rate limiting rimosso per facilitare i test

const app = express();
const server = http.createServer(app);
const wsManager = new WebSocketManager(server);
const PORT = process.env.PORT || 3000;

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL || 'https://gojhljczpwbjxbbrtrlq.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || 'sb_secret_s7Vzh0AtPEaEv3f3VmkIEg_3ZqBhGsS';
const supabase = createClient(supabaseUrl, supabaseKey);

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key_here_change_in_production';

// Helper function per ottenere data/ora corrente
async function getCurrentDateTime() {
  const now = new Date();
  const timeZone = 'Europe/Rome';

  const dateFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });

  const timeFormatter = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });

  const formattedDate = dateFormatter.format(now); // e.g. 2025-11-07
  const formattedTime = timeFormatter.format(now); // e.g. 09:45

  const [year, month, day] = formattedDate.split('-').map(Number);
  const [hour, minute] = formattedTime.split(':').map(Number);

  // Crea un oggetto Date coerente con l'orario italiano
  const zonedDate = new Date(Date.UTC(year, month - 1, day, hour, minute));

  return {
    date: formattedDate,
    time: formattedTime,
    dateTime: zonedDate,
    isTestMode: false
  };
}

// Admin middleware
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin' && req.user.role !== 'Amministratore' && req.user.role !== 'supervisor') {
    return res.status(403).json({ error: 'Accesso negato. Richiesti privilegi di amministratore.' });
  }
  next();
};

// Middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

// CORS configuration
const corsOrigin = process.env.NODE_ENV === 'production' 
  ? (process.env.FRONTEND_URL || 'https://hr.laba.biz')
  : ['http://localhost:5173', 'http://127.0.0.1:5173'];

app.use(cors({
  origin: corsOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(session({
  secret: JWT_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '2.0.0'
  });
});

// Static files will be served later after API routes

// Auth middleware
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token di accesso richiesto' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Verifica che l'utente esista ancora nel database
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, role, first_name, last_name, is_active')
      .eq('id', decoded.id)
      .eq('is_active', true)
      .single();

    if (error || !user) {
      return res.status(401).json({ error: 'Token non valido' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token non valido' });
  }
};

// ==================== AUTH ENDPOINTS ====================

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email e password sono obbligatorie' });
    }

    // Trova l'utente nel database
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .eq('is_active', true)
      .single();

    if (error || !user) {
      return res.status(401).json({ error: 'Credenziali non valide' });
    }

    // Verifica password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Credenziali non valide' });
    }

    // Genera JWT token
    const token = jwt.sign(
      { 
        id: user.id, 
        email: user.email, 
        role: user.role 
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.first_name,
        lastName: user.last_name
      },
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Logout endpoint
app.post('/api/auth/logout', authenticateToken, (req, res) => {
  // Con JWT, il logout è gestito lato client semplicemente rimuovendo il token
  res.json({ message: 'Logout effettuato con successo' });
});

// Refresh token endpoint
app.post('/api/auth/refresh', authenticateToken, async (req, res) => {
  try {
    // Genera un nuovo token per l'utente autenticato
    const newToken = jwt.sign(
      { 
        id: req.user.id, 
        email: req.user.email, 
        role: req.user.role 
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      token: newToken,
      user: req.user
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({ error: 'Errore nel refresh del token' });
  }
});

// Get current user data
app.get('/api/user', authenticateToken, async (req, res) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', req.user.id)
      .single();

    if (error || !user) {
      return res.status(404).json({ error: 'Utente non trovato' });
    }

    // Rimuovi la password dalla risposta
    delete user.password;

    res.json(user);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Update current user data
app.put('/api/user', authenticateToken, async (req, res) => {
  try {
    const updateData = {};
    
    // Aggiungi solo i campi che esistono nel database
    if (req.body.phone !== undefined) updateData.phone = req.body.phone;
    if (req.body.position !== undefined) updateData.position = req.body.position;
    if (req.body.department !== undefined) updateData.department = req.body.department;
    if (req.body.hire_date !== undefined) updateData.hire_date = req.body.hire_date;
    if (req.body.workplace !== undefined) updateData.workplace = req.body.workplace;
    if (req.body.contract_type !== undefined) updateData.contract_type = req.body.contract_type;
    if (req.body.birth_date !== undefined) updateData.birth_date = req.body.birth_date;
    if (req.body.has_104 !== undefined) updateData.has_104 = req.body.has_104;
    
    // Se non ci sono dati da aggiornare, restituisci successo
    if (Object.keys(updateData).length === 0) {
      return res.json({ message: 'Nessun dato da aggiornare' });
    }
    
    const { data: updatedUser, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', req.user.id)
      .select();

    if (error) {
      console.error('Update user error:', error);
      return res.status(500).json({ error: 'Errore nell\'aggiornamento utente' });
    }

    // Rimuovi la password dalla risposta
    delete updatedUser[0].password;

    res.json(updatedUser[0]);
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Registration
app.post('/api/auth/register', async (req, res) => {
  try {
    const { 
      email, 
      password, 
      firstName, 
      lastName, 
      birthDate, 
      phone, 
      department, 
      position,
      hireDate,
      workplace,
      contractType,
      has104 = false,
      workSchedules = null
    } = req.body;
    
    // Validazione email dominio
    if (!email.endsWith('@labafirenze.com')) {
      return res.status(400).json({ error: 'Solo email @labafirenze.com sono accettate' });
    }
    
    // Validazione dipartimento protetto
    if (department === 'System Owner') {
      return res.status(400).json({ error: 'Dipartimento "System Owner" non assegnabile' });
    }
    
    // Validazione campi obbligatori
    if (!email || !password || !firstName || !lastName || !birthDate || !phone || !department || !position || !hireDate || !workplace || !contractType) {
      return res.status(400).json({ error: 'Tutti i campi sono obbligatori' });
    }

    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser) {
      return res.status(400).json({ error: 'Utente già esistente' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Ruolo employee per tutti (admin si crea manualmente)
    const role = 'employee';
    
    const { data: newUser, error } = await supabase
      .from('users')
      .insert([
        {
          email,
          password: hashedPassword,
          role: role,
          first_name: firstName,
          last_name: lastName,
          is_active: true,
          has_104: has104,
          phone: phone,
          position: position,
          hire_date: hireDate,
          workplace: workplace,
          contract_type: contractType,
          department: department,
          birth_date: birthDate
        }
      ])
      .select()
      .single();
    
    if (error) {
      console.error('Registration error:', error);
      return res.status(500).json({ error: 'Errore durante la registrazione' });
    }

    // Crea anche il record employee
    const employeeNumber = `EMP${Date.now()}`;
    const { error: employeeError } = await supabase
      .from('employees')
      .insert([
        {
          user_id: newUser.id,
          employee_number: employeeNumber,
          department: department,
          position: 'Dipendente',
          hire_date: new Date().toISOString(),
          status: 'active',
          has_104: has104,
          personal_info: {
            birth_date: birthDate,
            phone: phone
          }
        }
      ]);

    if (employeeError) {
      console.error('Employee creation error:', employeeError);
    }

    // Crea orari di lavoro per il nuovo dipendente
    let workSchedulesToCreate = [];
    
    if (workSchedules) {
      // Usa gli orari forniti dall'utente
      const dayMapping = {
        monday: 1, tuesday: 2, wednesday: 3, thursday: 4, 
        friday: 5, saturday: 6, sunday: 0
      };
      
      workSchedulesToCreate = Object.entries(workSchedules).map(([day, schedule]) => {
        // Calcola automaticamente break_start_time a metà della giornata lavorativa
        let breakStartTime = null;
        if (schedule.isWorking && schedule.breakDuration > 0) {
          const [startH, startM] = schedule.startTime.split(':').map(Number);
          const [endH, endM] = schedule.endTime.split(':').map(Number);
          const totalMinutes = (endH * 60 + endM) - (startH * 60 + startM);
          const workMinutes = totalMinutes - schedule.breakDuration;
          const halfWorkMinutes = workMinutes / 2;
          const breakStartMinutes = (startH * 60 + startM) + halfWorkMinutes;
          const breakStartH = Math.floor(breakStartMinutes / 60);
          const breakStartM = Math.round(breakStartMinutes % 60);
          breakStartTime = `${breakStartH.toString().padStart(2, '0')}:${breakStartM.toString().padStart(2, '0')}`;
        }
        
        return {
          user_id: newUser.id,
          day_of_week: dayMapping[day],
          is_working_day: schedule.isWorking,
          work_type: 'full_day',
          start_time: schedule.isWorking ? schedule.startTime : null,
          end_time: schedule.isWorking ? schedule.endTime : null,
          break_duration: schedule.isWorking ? schedule.breakDuration : 0,
          break_start_time: breakStartTime
        };
      });
    } else {
      // Fallback: orari di default se non forniti
      workSchedulesToCreate = [
        { user_id: newUser.id, day_of_week: 1, is_working_day: true, work_type: 'full_day', start_time: '09:00', end_time: '18:00', break_duration: 60, break_start_time: '13:00' },
        { user_id: newUser.id, day_of_week: 2, is_working_day: true, work_type: 'full_day', start_time: '09:00', end_time: '18:00', break_duration: 60, break_start_time: '13:00' },
        { user_id: newUser.id, day_of_week: 3, is_working_day: true, work_type: 'full_day', start_time: '09:00', end_time: '18:00', break_duration: 60, break_start_time: '13:00' },
        { user_id: newUser.id, day_of_week: 4, is_working_day: true, work_type: 'full_day', start_time: '09:00', end_time: '18:00', break_duration: 60, break_start_time: '13:00' },
        { user_id: newUser.id, day_of_week: 5, is_working_day: true, work_type: 'full_day', start_time: '09:00', end_time: '18:00', break_duration: 60, break_start_time: '13:00' },
        { user_id: newUser.id, day_of_week: 6, is_working_day: false, work_type: 'full_day', start_time: null, end_time: null, break_duration: 0, break_start_time: null },
        { user_id: newUser.id, day_of_week: 0, is_working_day: false, work_type: 'full_day', start_time: null, end_time: null, break_duration: 0, break_start_time: null }
      ];
    }

    const { error: schedulesError } = await supabase
      .from('work_schedules')
      .insert(workSchedulesToCreate);

    if (schedulesError) {
      console.error('Work schedules creation error:', schedulesError);
    } else {
      console.log(`✅ Orari di lavoro creati per ${newUser.email} (${workSchedules ? 'personalizzati' : 'default'})`);
    }

    // Invia notifica agli admin per nuovo dipendente
    try {
      const { data: admins } = await supabase
        .from('users')
        .select('id')
        .eq('role', 'admin')
        .eq('is_active', true);

      if (admins && admins.length > 0) {
        for (const admin of admins) {
          await supabase
            .from('notifications')
            .insert([
              {
                user_id: admin.id,
                title: 'Nuovo Dipendente Registrato',
                message: `${firstName} ${lastName} si è registrato nel sistema`,
                type: 'info',
                is_read: false,
                created_at: new Date().toISOString()
              }
            ]);
        }
      }
    } catch (notificationError) {
      console.error('Notification error:', notificationError);
    }

    res.status(201).json({
      success: true,
      message: 'Utente registrato con successo',
      user: {
        id: newUser.id,
        email: newUser.email,
        role: newUser.role,
        firstName: newUser.first_name,
        lastName: newUser.last_name
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: "Errore interno del server" });
  }
});

// ==================== EMPLOYEES ENDPOINTS ====================

// Get all employees
app.get('/api/employees', authenticateToken, async (req, res) => {
  try {
    console.log('🔍 Fetching employees for user:', req.user.id, 'role:', req.user.role);
    
    const { data: employees, error } = await supabase
      .from('users')
      .select(`
        *,
        work_patterns!left(*),
        work_schedules!left(*)
      `)
      .neq('role', 'admin') // Escludi tutti gli admin
      .order('last_name');

    console.log('📋 Raw employees from DB:', employees?.length || 0, 'employees');

    if (error) {
      console.error('❌ Employees fetch error:', error);
      return res.status(500).json({ error: 'Errore nel recupero dei dipendenti' });
    }

    const formattedEmployees = employees.map(emp => {
      // Trova il work pattern attivo più recente
      const activeWorkPattern = emp.work_patterns?.find(pattern => pattern.is_active) || 
                               emp.work_patterns?.[0] || null;

      // Formatta gli orari dettagliati
      const detailedWorkSchedule = {};
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      
      if (emp.work_schedules && emp.work_schedules.length > 0) {
        emp.work_schedules.forEach(schedule => {
          const dayName = dayNames[schedule.day_of_week];
          if (dayName) {
            detailedWorkSchedule[dayName] = {
              active: schedule.is_working_day,
              workType: schedule.work_type,
              startTime: schedule.start_time,
              endTime: schedule.end_time,
              breakDuration: schedule.break_duration,
              // Calcola ore totali per il giorno
              totalHours: schedule.is_working_day ? 
                (schedule.start_time && schedule.end_time ? 
                  Math.abs(new Date(`2000-01-01T${schedule.end_time}`) - new Date(`2000-01-01T${schedule.start_time}`)) / (1000 * 60 * 60) - (schedule.break_duration || 0) / 60 : 0) : 0
            };
          }
        });
      }

      return {
        id: emp.id,
        first_name: emp.first_name,
        last_name: emp.last_name,
        name: `${emp.first_name} ${emp.last_name}`,
        email: emp.email,
        department: emp.department || 'Amministrazione',
        position: emp.position || 'Dipendente',
        hireDate: emp.hire_date || emp.created_at?.split('T')[0],
        status: emp.is_active ? 'active' : 'inactive',
        has104: emp.has_104,
        phone: emp.phone || '',
        birthDate: emp.birth_date || '',
        // Aggiungi dati orario di lavoro dettagliati
        workSchedule: Object.keys(detailedWorkSchedule).length > 0 ? detailedWorkSchedule : 
          (activeWorkPattern ? {
            monday: { hours: activeWorkPattern.monday_hours, active: activeWorkPattern.monday_hours > 0 },
            tuesday: { hours: activeWorkPattern.tuesday_hours, active: activeWorkPattern.tuesday_hours > 0 },
            wednesday: { hours: activeWorkPattern.wednesday_hours, active: activeWorkPattern.wednesday_hours > 0 },
            thursday: { hours: activeWorkPattern.thursday_hours, active: activeWorkPattern.thursday_hours > 0 },
            friday: { hours: activeWorkPattern.friday_hours, active: activeWorkPattern.friday_hours > 0 },
            saturday: { hours: activeWorkPattern.saturday_hours, active: activeWorkPattern.saturday_hours > 0 },
            sunday: { hours: activeWorkPattern.sunday_hours, active: activeWorkPattern.sunday_hours > 0 }
          } : null),
        contractType: activeWorkPattern?.contract_type || 'full_time',
        weeklyHours: Object.keys(detailedWorkSchedule).length > 0 ? 
          Object.values(detailedWorkSchedule).reduce((total, day) => total + (day.totalHours || 0), 0) :
          (activeWorkPattern ? 
            (activeWorkPattern.monday_hours + activeWorkPattern.tuesday_hours + 
             activeWorkPattern.wednesday_hours + activeWorkPattern.thursday_hours + 
             activeWorkPattern.friday_hours + activeWorkPattern.saturday_hours + 
             activeWorkPattern.sunday_hours) : emp.weekly_hours || 0),
        // Dati ferie (per ora placeholder)
        usedVacationDays: 0,
        totalVacationDays: 26
      };
    });

    console.log('✅ Formatted employees:', formattedEmployees.length, 'employees');
    console.log('📋 First employee:', formattedEmployees[0] ? `${formattedEmployees[0].firstName} ${formattedEmployees[0].lastName}` : 'none');

    res.json(formattedEmployees);
  } catch (error) {
    console.error('❌ Employees fetch error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// List admin users (for admin dashboard)
app.get('/api/admins', authenticateToken, requireAdmin, async (req, res) => {
  try {
    console.log('🔍 Fetching admins for user:', req.user.id);

    const { data: admins, error } = await supabase
      .from('users')
      .select('id, first_name, last_name, email, department, position, created_at')
      .eq('role', 'admin')
      .order('last_name');

    if (error) {
      console.error('❌ Admins fetch error:', error);
      return res.status(500).json({ error: 'Errore nel recupero degli amministratori' });
    }

    const formattedAdmins = admins.map(admin => ({
      id: admin.id,
      first_name: admin.first_name,
      last_name: admin.last_name,
      name: `${admin.first_name} ${admin.last_name}`,
      email: admin.email,
      department: admin.department || 'Amministrazione',
      position: admin.position || 'Amministratore',
      created_at: admin.created_at
    }));

    res.json(formattedAdmins);
  } catch (error) {
    console.error('❌ Admins fetch error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Auto-approve new employee (Admin only)
app.post('/api/employees/approve/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const { data: updatedEmployee, error } = await supabase
      .from('users')
      .update({
        is_active: true,
        approved_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('role', 'employee')
      .select()
      .single();

    if (error) {
      console.error('Employee approval error:', error);
      return res.status(500).json({ error: 'Errore nell\'approvazione del dipendente' });
    }

    // Invia email di benvenuto se ha email personale
    if (updatedEmployee.personal_email) {
      try {
        await sendEmail(updatedEmployee.personal_email, 'welcome', [
          `${updatedEmployee.first_name} ${updatedEmployee.last_name}`,
          updatedEmployee.department || 'Ufficio'
        ]);
      } catch (emailError) {
        console.error('Welcome email error:', emailError);
      }
    }

    res.json({
      success: true,
      message: 'Dipendente approvato con successo',
      employee: updatedEmployee
    });
  } catch (error) {
    console.error('Employee approval error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Update employee personal email
app.put('/api/employees/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { personalEmail } = req.body;

    if (!personalEmail) {
      return res.status(400).json({ error: 'Email personale richiesta' });
    }

    const { data: updatedEmployee, error } = await supabase
      .from('users')
      .update({
        personal_email: personalEmail
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Employee update error:', error);
      return res.status(500).json({ error: 'Errore nell\'aggiornamento del dipendente' });
    }

    res.json({
      success: true,
      message: 'Email personale aggiornata con successo',
      employee: updatedEmployee
    });
  } catch (error) {
    console.error('Employee update error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Add new employee (Admin only)
app.post('/api/employees', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Accesso negato' });
    }

    const { 
      firstName, 
      lastName, 
      email, 
      department, 
      position, 
      phone, 
      birthDate, 
      hireDate, 
      workplace, 
      contractType, 
      has104 = false,
      role = 'employee', // Nuovo campo per il ruolo
      workSchedules // Aggiunto per gestire l'orario di lavoro
    } = req.body;
    
    // Validazione dipartimento protetto
    if (department === 'System Owner') {
      return res.status(400).json({ error: 'Dipartimento "System Owner" non assegnabile' });
    }

    // Validazione
    if (!firstName || !lastName || !email || !department) {
      return res.status(400).json({ error: 'Campi obbligatori mancanti' });
    }

    // Crea utente
    const tempPassword = 'temp123';
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    const { data: newUser, error: userError } = await supabase
      .from('users')
      .insert([
        {
          email,
          password: hashedPassword,
          role: role, // Usa il ruolo specificato (employee o supervisor)
          first_name: firstName,
          last_name: lastName,
          is_active: true,
          has_104: has104
        }
      ])
      .select()
      .single();

    if (userError) {
      console.error('User creation error:', userError);
      return res.status(500).json({ error: 'Errore nella creazione dell\'utente' });
    }

    // Crea employee
    const employeeNumber = `EMP${Date.now()}`;
    const { data: newEmployee, error: employeeError } = await supabase
      .from('employees')
      .insert([
        {
          user_id: newUser.id,
          employee_number: employeeNumber,
          department: department,
          position: position || 'Dipendente',
          hire_date: new Date().toISOString(),
          status: 'active',
          has_104: has104,
          personal_info: {
            birth_date: birthDate,
            phone: phone
          }
        }
      ])
      .select()
      .single();

    if (employeeError) {
      console.error('Employee creation error:', employeeError);
      return res.status(500).json({ error: 'Errore nella creazione del dipendente' });
    }

    // Crea work_schedules se forniti
    if (workSchedules) {
      const scheduleEntries = Object.entries(workSchedules).map(([day, schedule]) => ({
        user_id: newUser.id,
        day_of_week: day,
        is_working: schedule.isWorking,
        start_time: schedule.startTime,
        end_time: schedule.endTime,
        break_duration: schedule.breakDuration
      }));

      const { error: scheduleError } = await supabase
        .from('work_schedules')
        .insert(scheduleEntries);

      if (scheduleError) {
        console.error('Work schedule creation error:', scheduleError);
        // Non bloccare la creazione del dipendente se fallisce la creazione degli orari
        console.log('⚠️ Dipendente creato ma orari non salvati');
      }
    } else {
      // Crea orari di default se non forniti
      const defaultSchedules = [
        { user_id: newUser.id, day_of_week: 'monday', is_working: true, start_time: '09:00', end_time: '18:00', break_duration: 60 },
        { user_id: newUser.id, day_of_week: 'tuesday', is_working: true, start_time: '09:00', end_time: '18:00', break_duration: 60 },
        { user_id: newUser.id, day_of_week: 'wednesday', is_working: true, start_time: '09:00', end_time: '18:00', break_duration: 60 },
        { user_id: newUser.id, day_of_week: 'thursday', is_working: true, start_time: '09:00', end_time: '18:00', break_duration: 60 },
        { user_id: newUser.id, day_of_week: 'friday', is_working: true, start_time: '09:00', end_time: '18:00', break_duration: 60 },
        { user_id: newUser.id, day_of_week: 'saturday', is_working: false, start_time: '09:00', end_time: '18:00', break_duration: 60 },
        { user_id: newUser.id, day_of_week: 'sunday', is_working: false, start_time: '09:00', end_time: '18:00', break_duration: 60 }
      ];

      const { error: defaultScheduleError } = await supabase
        .from('work_schedules')
        .insert(defaultSchedules);

      if (defaultScheduleError) {
        console.error('Default work schedule creation error:', defaultScheduleError);
        console.log('⚠️ Dipendente creato ma orari di default non salvati');
      }
    }

    res.status(201).json({
      success: true,
      message: 'Dipendente aggiunto con successo',
      employee: {
        id: newEmployee.id,
        employeeNumber: newEmployee.employee_number,
        firstName: newUser.first_name,
        lastName: newUser.last_name,
        email: newUser.email,
        department: newEmployee.department,
        position: newEmployee.position
      }
    });
  } catch (error) {
    console.error('Add employee error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Delete employee (Admin only)
app.delete('/api/employees/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Accesso negato' });
    }

    const { id } = req.params;

    // Verifica che l'utente esista e non sia un admin
    const { data: employee, error: fetchError } = await supabase
      .from('users')
      .select('id, role, first_name, last_name')
      .eq('id', id)
      .single();

    if (fetchError || !employee) {
      return res.status(404).json({ error: 'Utente non trovato' });
    }

    // Non permettere l'eliminazione di admin
    if (employee.role === 'admin') {
      return res.status(403).json({ error: 'Non è possibile eliminare un amministratore' });
    }

    // Non permettere l'eliminazione dell'admin corrente
    if (id === req.user.id) {
      return res.status(400).json({ error: 'Non puoi eliminare te stesso' });
    }

    // Elimina prima i record correlati (attendance, requests, etc.)
    const tablesToClean = [
      'attendance',
      'leave_requests', 
      'sick_leave_requests',
      'vacation_requests',
      'business_trips',
      'work_patterns',
      'work_schedules'
    ];

    for (const table of tablesToClean) {
      const { error: deleteError } = await supabase
        .from(table)
        .delete()
        .eq('user_id', id);
      
      if (deleteError) {
        console.warn(`Warning: Could not clean ${table} for user ${id}:`, deleteError);
      }
    }

    // Elimina il record dalla tabella employees se esiste
    const { error: employeeDeleteError } = await supabase
      .from('employees')
      .delete()
      .eq('user_id', id);

    if (employeeDeleteError) {
      console.warn('Warning: Could not delete from employees table:', employeeDeleteError);
    }

    // Infine elimina l'utente
    const { error: userDeleteError } = await supabase
      .from('users')
      .delete()
      .eq('id', id);

    if (userDeleteError) {
      console.error('User deletion error:', userDeleteError);
      return res.status(500).json({ error: 'Errore nell\'eliminazione del dipendente' });
    }

    console.log(`✅ Employee ${employee.first_name} ${employee.last_name} (${id}) deleted successfully`);

    res.json({
      success: true,
      message: `Dipendente ${employee.first_name} ${employee.last_name} eliminato con successo`
    });

  } catch (error) {
    console.error('Delete employee error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// ==================== ATTENDANCE ENDPOINTS (NUOVO SISTEMA SENZA TIMBRATURA) ====================

// Get attendance records
app.get('/api/attendance', authenticateToken, async (req, res) => {
  try {
    const { date, userId, month, year } = req.query;
    
    // IMPORTANTE: Leggi SEMPRE da attendance (dati reali)
    // La modalità test viene usata solo per i calcoli real-time (orario simulato)
    // I dati di test vengono salvati in test_attendance, ma per la visualizzazione usiamo sempre i dati reali
    let query = supabase
      .from('attendance')
      .select(`
        *,
        users(first_name, last_name, email)
      `)
      .order('date', { ascending: false });

    // Filtra per utente se è un employee
    if (req.user.role === 'employee') {
      query = query.eq('user_id', req.user.id);
    }
    
    if (date) {
      query = query.eq('date', date);
    } else if (month && year) {
      // Filtra per mese e anno specifici
      const monthNum = parseInt(month, 10);
      const yearNum = parseInt(year, 10);
      const monthStr = String(monthNum).padStart(2, '0');
      const startDate = `${yearNum}-${monthStr}-01`;
      const endDate = new Date(yearNum, monthNum, 0).toISOString().split('T')[0];
      query = query.gte('date', startDate).lte('date', endDate);
    }
    
    if (userId) {
      query = query.eq('user_id', userId);
    } else if (req.user.role === 'employee') {
      query = query.eq('user_id', req.user.id);
    }

    const { data: attendance, error } = await query;

    if (error) {
      console.error('Attendance fetch error:', error);
      return res.status(500).json({ error: 'Errore nel recupero delle presenze' });
    }

    // Recupera le leave requests approvate per controllare assenze giustificate
    // IMPORTANTE: Leggi SEMPRE da leave_requests (dati reali)
    // La modalità test viene usata solo per i calcoli real-time
    let leaveQuery = supabase
      .from('leave_requests')
      .select('*')
      .eq('status', 'approved');
    
    // Filtra per user_id solo se specificato, altrimenti per admin mostra tutte le leave requests
    if (userId) {
      leaveQuery = leaveQuery.eq('user_id', userId);
    } else if (req.user.role === 'employee') {
      leaveQuery = leaveQuery.eq('user_id', req.user.id);
    }
    
    if (month && year) {
      const monthNum = parseInt(month, 10);
      const yearNum = parseInt(year, 10);
      const monthStr = String(monthNum).padStart(2, '0');
      const startDate = `${yearNum}-${monthStr}-01`;
      const endDate = new Date(yearNum, monthNum, 0).toISOString().split('T')[0];
      leaveQuery = leaveQuery.gte('start_date', startDate).lte('end_date', endDate);
    }

    const { data: leaveRequests, error: leaveError } = await leaveQuery;
    
    if (leaveError) {
      console.error('Leave requests fetch error:', leaveError);
    }

    // Mappa le attendance con informazioni su assenze giustificate
    const attendanceWithLeaves = attendance.map(record => {
      const recordDate = record.date;
      
      // Controlla se c'è una leave request approvata per questa data
      const hasApprovedLeave = leaveRequests?.some(leave => {
        const leaveStart = new Date(leave.start_date).toISOString().split('T')[0];
        const leaveEnd = new Date(leave.end_date).toISOString().split('T')[0];
        return recordDate >= leaveStart && recordDate <= leaveEnd;
      });

      // Se c'è una leave approvata, trova quale tipo
      let leaveType = null;
      let leaveReason = null;
      if (hasApprovedLeave) {
        const leave = leaveRequests.find(leave => {
          const leaveStart = new Date(leave.start_date).toISOString().split('T')[0];
          const leaveEnd = new Date(leave.end_date).toISOString().split('T')[0];
          return recordDate >= leaveStart && recordDate <= leaveEnd;
        });
        leaveType = leave?.type;
        leaveReason = leave?.reason;
      }

      return {
        ...record,
        is_justified_absence: hasApprovedLeave,
        leave_type: leaveType,
        leave_reason: leaveReason
      };
    });

    res.json(attendanceWithLeaves);
  } catch (error) {
    console.error('Attendance fetch error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Save daily attendance with actual hours
app.put('/api/attendance/save-daily', authenticateToken, async (req, res) => {
  try {
    const { date, actualHours, expectedHours, balanceHours, notes } = req.body;
    
    if (!date || actualHours === undefined || expectedHours === undefined) {
      return res.status(400).json({ error: 'Dati mancanti' });
    }

    const targetUserId = req.user.role === 'employee' ? req.user.id : (req.body.userId || req.user.id);
    
    // Aggiorna o inserisci il record di presenza
    const { data, error } = await supabase
      .from('attendance')
      .upsert({
        user_id: targetUserId,
        date: date,
        actual_hours: parseFloat(actualHours),
        expected_hours: parseFloat(expectedHours),
        balance_hours: parseFloat(balanceHours || 0),
        notes: notes || '',
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,date'
      })
      .select()
      .single();

    if (error) {
      console.error('Attendance save error:', error);
      return res.status(500).json({ error: 'Errore nel salvare le presenze' });
    }

    res.json({
      success: true,
      message: 'Presenza salvata con successo',
      attendance: data,
      isTestData: false
    });
  } catch (error) {
    console.error('Attendance save error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Salvataggio orario delle presenze (ogni ora)
app.put('/api/attendance/save-hourly', authenticateToken, async (req, res) => {
  try {
    const { date, actualHours, expectedHours, balanceHours, notes } = req.body;
    
    if (!date || actualHours === undefined || expectedHours === undefined) {
      return res.status(400).json({ error: 'Dati mancanti' });
    }

    const targetUserId = req.user.role === 'employee' ? req.user.id : (req.body.userId || req.user.id);

    // Aggiorna o inserisci il record di presenza
    const { data, error } = await supabase
      .from('attendance')
      .upsert({
        user_id: targetUserId,
        date: date,
        actual_hours: parseFloat(actualHours),
        expected_hours: parseFloat(expectedHours),
        balance_hours: parseFloat(balanceHours || 0),
        notes: notes || '',
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,date'
      })
      .select()
      .single();

    if (error) {
      console.error('Hourly attendance save error:', error);
      return res.status(500).json({ error: 'Errore nel salvare le presenze orarie' });
    }

    res.json({
      success: true,
      message: 'Presenza oraria salvata con successo',
      attendance: data
    });
  } catch (error) {
    console.error('Hourly attendance save error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Get monthly hours balance for a user - HYBRID SYSTEM with real-time calculation
app.get('/api/attendance/hours-balance', authenticateToken, async (req, res) => {
  try {
    const { year, month, userId } = req.query;
    const targetUserId = userId || req.user.id;
    const { date: today, time: currentTime, dateTime: now, isTestMode } = await getCurrentDateTime();
    
    if (isTestMode) {
      console.log(`🧪 TEST MODE: Hours balance per ${today} alle ${currentTime}`);
    }
    
    // Verifica permessi
    if (req.user.role === 'employee' && targetUserId !== req.user.id) {
      return res.status(403).json({ error: 'Accesso negato' });
    }

    // Calcola il balance dalle presenze del mese (usa data simulata se in test mode)
    const targetYear = year || now.getFullYear();
    const targetMonth = month || (now.getMonth() + 1);
    const startDate = new Date(targetYear, targetMonth - 1, 1).toISOString().split('T')[0];
    const endDate = new Date(targetYear, targetMonth, 0).toISOString().split('T')[0];

    const { data: attendance, error } = await supabase
      .from('attendance')
      .select('actual_hours, balance_hours, expected_hours, date')
      .eq('user_id', targetUserId)
      .gte('date', startDate)
      .lte('date', endDate);

    if (error) {
      console.error('Attendance fetch error:', error);
      return res.status(500).json({ error: 'Errore nel recupero delle presenze' });
    }

    // Get work schedules for real-time calculation
    const { data: workSchedules, error: scheduleError } = await supabase
      .from('work_schedules')
      .select('*')
      .eq('user_id', targetUserId);

    if (scheduleError) {
      console.error('Work schedules fetch error:', scheduleError);
      // Continue without real-time calculation
    }

    // Calculate real-time hours for today (hybrid system) - usa data simulata se in test mode
    const todayRecord = attendance.find(record => record.date === today);
    
    let realTimeActualHours = 0;
    let realTimeContractHours = 0;
    let realTimeEffectiveHours = 0;
    let realTimeRemainingHours = 0;
    let hasRealTimeCalculation = false;
    
    // Always calculate real-time if today is within the month range (usa data simulata se in test mode)
    const isCurrentMonth = now.getFullYear() === parseInt(targetYear) && 
                          (now.getMonth() + 1) === parseInt(targetMonth);
    
    if (isCurrentMonth && workSchedules && workSchedules.length > 0) {
      const dayOfWeek = now.getDay();
      
      // Find today's work schedule
      const todaySchedule = workSchedules.find(schedule => 
        schedule.day_of_week === dayOfWeek && schedule.is_working_day
      );
      
      if (todaySchedule) {
        // Recupera permessi per oggi (SEMPRE da leave_requests - dati reali)
        const { data: permissionsToday } = await supabase
          .from('leave_requests')
          .select('hours, permission_type, exit_time, entry_time')
          .eq('user_id', targetUserId)
          .eq('type', 'permission')
          .eq('status', 'approved')
          .lte('start_date', today)
          .gte('end_date', today);
        
        let permissionData = null;
        if (permissionsToday && permissionsToday.length > 0) {
          let totalHours = 0;
          let exitTime = null;
          let entryTime = null;
          const permissionTypes = new Set();
          
          permissionsToday.forEach(perm => {
            totalHours += parseFloat(perm.hours || 0);
            if (perm.permission_type === 'early_exit' && perm.exit_time) {
              permissionTypes.add('early_exit');
              if (!exitTime || perm.exit_time < exitTime) {
                exitTime = perm.exit_time;
              }
            }
            if (perm.permission_type === 'late_entry' && perm.entry_time) {
              permissionTypes.add('late_entry');
              if (!entryTime || perm.entry_time > entryTime) {
                entryTime = perm.entry_time;
              }
            }
          });
          
          if (exitTime || entryTime) {
            permissionData = { hours: totalHours, permission_types: Array.from(permissionTypes), exit_time: exitTime, entry_time: entryTime };
          }
        }
        
        // USA LA FUNZIONE CENTRALIZZATA per calcolare le ore real-time (usa currentTime da getCurrentDateTime)
        const result = calculateRealTimeHours(todaySchedule, currentTime, permissionData);
        realTimeActualHours = result.actualHours;
        realTimeEffectiveHours = result.expectedHours;
        realTimeContractHours = result.contractHours;
        realTimeRemainingHours = result.remainingHours;
        
        hasRealTimeCalculation = true;
        console.log(`🕐 Real-time calculation (centralized) for today: ${realTimeActualHours.toFixed(2)}h worked, ${realTimeContractHours.toFixed(2)}h contract, ${realTimeEffectiveHours.toFixed(2)}h effective (remaining ${realTimeRemainingHours.toFixed(2)}h)`);
      }
    }

    // Calculate statistics with real-time data for today ONLY
    let totalActualHours = 0;
    let totalExpectedHours = 0;
    
    // If we have real-time calculation for today, use ONLY that (ignore DB record for today)
    // IMPORTANTE: Questo assicura che i dati real-time sovrascrivano sempre i dati del database per oggi
    if (hasRealTimeCalculation && isCurrentMonth) {
      // Use real-time for today (IGNORA completamente il record DB per oggi)
      totalActualHours = realTimeActualHours;
      totalExpectedHours = realTimeContractHours;
      
      console.log(`🔄 Using real-time for today: ${realTimeActualHours.toFixed(2)}h actual, ${realTimeContractHours.toFixed(2)}h contract`);
      
      // Add other days from database (excluding today if it exists)
      attendance.forEach(record => {
        if (record.date !== today) {
          totalActualHours += record.actual_hours || 0;
          totalExpectedHours += record.expected_hours || 8;
          console.log(`  📅 ${record.date}: +${record.actual_hours || 0}h actual, +${record.expected_hours || 8}h expected`);
        } else {
          console.log(`  ⏭️ Skipping DB record for today (${record.date}) - using real-time instead`);
        }
      });
    } else {
      // No real-time calculation, use all database values
      attendance.forEach(record => {
        totalActualHours += record.actual_hours || 0;
        totalExpectedHours += record.expected_hours || 8;
      });
    }
    
    // Calcola il saldo totale: usa il calcolo real-time per oggi, database per i giorni passati
    const totalBalance = totalActualHours - totalExpectedHours;
    
    // Per overtime e deficit, ricalcola anche per oggi usando il balance real-time
    let todayBalanceHours = 0;
    if (hasRealTimeCalculation && isCurrentMonth) {
      todayBalanceHours = realTimeActualHours - realTimeContractHours;
    }
    
    const overtimeHours = attendance.reduce((sum, record) => {
      if (record.date === today && hasRealTimeCalculation && isCurrentMonth) {
        // Usa il balance real-time per oggi
        return todayBalanceHours > 0 ? sum + todayBalanceHours : sum;
      }
      const balance = record.balance_hours || 0;
      return balance > 0 ? sum + balance : sum;
    }, 0);
    
    // Deficit = ore mancanti (sempre positivo per chiarezza)
    const deficitHours = attendance.reduce((sum, record) => {
      if (record.date === today && hasRealTimeCalculation && isCurrentMonth) {
        // Usa il balance real-time per oggi
        return todayBalanceHours < 0 ? sum + Math.abs(todayBalanceHours) : sum;
      }
      const balance = record.balance_hours || 0;
      return balance < 0 ? sum + Math.abs(balance) : sum;
    }, 0);
    
    // Calcola workingDays considerando anche il calcolo real-time di oggi
    let workingDays = attendance.filter(record => (record.actual_hours || 0) > 0).length;
    let absentDays = attendance.filter(record => (record.actual_hours || 0) === 0).length;
    
    // Se abbiamo calcolo real-time per oggi, aggiungilo ai workingDays se > 0
    if (hasRealTimeCalculation && isCurrentMonth && realTimeActualHours > 0) {
      // Controlla se oggi è già nel database
      const todayInDb = attendance.find(record => record.date === today);
      if (!todayInDb) {
        // Oggi non è nel database ma abbiamo ore real-time > 0, aggiungilo
        workingDays += 1;
        console.log(`📊 Added today to workingDays (real-time): ${realTimeActualHours.toFixed(2)}h`);
      }
      // Se oggi è nel database, workingDays è già corretto
    }

    console.log(`📊 Hours balance calculation (hybrid):`, {
      totalActualHours,
      totalExpectedHours,
      totalBalance,
      overtimeHours,
      deficitHours,
      workingDays,
      absentDays,
      attendanceCount: attendance.length,
      realTimeToday: realTimeActualHours > 0 ? `${realTimeActualHours.toFixed(2)}h` : 'no'
    });

    res.json({
      total_worked: totalActualHours, // TOTALE ORE LAVORATE (sempre positivo)
      monte_ore: totalBalance, // MONTE ORE (saldo positivo/negativo)
      working_days: workingDays,
      absent_days: absentDays
    });
  } catch (error) {
    console.error('Hours balance fetch error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Update attendance record (for admin to mark overtime, early departure, etc.)
app.put('/api/attendance/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Accesso negato' });
    }

    const { id } = req.params;
    const { 
      actual_hours, 
      notes 
    } = req.body;

    // Calcola il saldo ore automaticamente
    const { data: attendance } = await supabase
      .from('attendance')
      .select('user_id, date, expected_hours')
      .eq('id', id)
      .single();

    if (!attendance) {
      return res.status(404).json({ error: 'Record di presenza non trovato' });
    }

    const balance_hours = actual_hours - attendance.expected_hours;

    const { data: updatedAttendance, error } = await supabase
      .from('attendance')
      .update({
        actual_hours,
        balance_hours,
        notes
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Attendance update error:', error);
      return res.status(500).json({ error: 'Errore nell\'aggiornamento' });
    }

    // Aggiorna il monte ore mensile
    const date = new Date(attendance.date);
    await supabase.rpc('update_monthly_hours_balance', {
      p_user_id: attendance.user_id,
      p_year: date.getFullYear(),
      p_month: date.getMonth() + 1
    });

    res.json({
      success: true,
      message: 'Presenza aggiornata con successo',
      attendance: updatedAttendance
    });
  } catch (error) {
    console.error('Attendance update error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Delete attendance record
app.delete('/api/attendance/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Accesso negato' });
    }

    const { id } = req.params;

    // Verifica che il record esista
    const { data: attendance } = await supabase
      .from('attendance')
      .select('user_id, date')
      .eq('id', id)
      .single();

    if (!attendance) {
      return res.status(404).json({ error: 'Record di presenza non trovato' });
    }

    // Elimina il record
    const { error } = await supabase
      .from('attendance')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Attendance delete error:', error);
      return res.status(500).json({ error: 'Errore nell\'eliminazione' });
    }

    // Aggiorna il monte ore mensile
    const date = new Date(attendance.date);
    await supabase.rpc('update_monthly_hours_balance', {
      p_user_id: attendance.user_id,
      p_year: date.getFullYear(),
      p_month: date.getMonth() + 1
    });

    res.json({
      success: true,
      message: 'Record eliminato con successo'
    });
  } catch (error) {
    console.error('Attendance delete error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Generate automatic attendance for a period (admin only)
app.post('/api/attendance/generate', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Accesso negato' });
    }

    const { userId, startDate, endDate } = req.body;

    if (!userId || !startDate || !endDate) {
      return res.status(400).json({ error: 'Parametri mancanti' });
    }

    // Genera presenze automatiche usando funzione SQL se disponibile,
    // altrimenti esegui fallback lato applicazione
    const { error } = await supabase.rpc('generate_automatic_attendance', {
      p_user_id: userId,
      p_start_date: startDate,
      p_end_date: endDate
    });

    if (error) {
      console.warn('⚠️ generate_automatic_attendance RPC non disponibile, uso fallback lato app:', error?.message || error);

      // Fallback: calcola expected_hours dai work_schedules e inserisce attendance "completed"
      const start = new Date(startDate);
      const end = new Date(endDate);

      // Carica tutti i work schedules dell'utente
      const { data: schedules, error: wsError } = await supabase
        .from('work_schedules')
        .select('*')
        .eq('user_id', userId);

      if (wsError) {
        console.error('Fallback work_schedules error:', wsError);
        return res.status(500).json({ error: 'Errore nel recupero degli orari' });
      }

      const inserts = [];
      const dayToIdx = {
        '0': 0, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6
      };

      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const iso = d.toISOString().split('T')[0];
        const dow = d.getDay();
        const todaySchedule = schedules.find(s => s.day_of_week === dow && s.is_working_day === true);
        
        if (!todaySchedule) {
          console.log(`⏭️ Skip ${iso} (day ${dow}): no working schedule`);
          continue;
        }

        if (!todaySchedule.start_time || !todaySchedule.end_time) {
          console.log(`⏭️ Skip ${iso}: schedule without start/end time`);
          continue;
        }

        try {
          const expectedHours = calculateExpectedHoursForSchedule({ 
            start_time: todaySchedule.start_time, 
            end_time: todaySchedule.end_time, 
            break_duration: todaySchedule.break_duration || 60
          });

          if (!expectedHours || expectedHours <= 0) {
            console.log(`⏭️ Skip ${iso}: invalid expected hours (${expectedHours})`);
            continue;
          }

          inserts.push({
            user_id: userId,
            date: iso,
            expected_hours: Math.round(expectedHours * 10) / 10,
            actual_hours: Math.round(expectedHours * 10) / 10,
            balance_hours: 0,
            notes: '[Generato dall\'admin - fallback]'
          });
        } catch (scheduleError) {
          console.error(`❌ Error processing schedule for ${iso}:`, scheduleError);
          continue;
        }
      }

      if (inserts.length === 0) {
        return res.status(400).json({ error: 'Nessun orario lavorativo nel periodo selezionato' });
      }

      const { data: inserted, error: insError } = await supabase
        .from('attendance')
        .insert(inserts)
        .select();

      if (insError) {
        console.error('❌ Fallback insert attendance error:', insError);
        console.error('❌ Error details:', JSON.stringify(insError, null, 2));
        console.error('❌ Attempting to insert:', inserts.length, 'records');
        return res.status(500).json({ error: 'Errore nella generazione delle presenze', details: insError.message });
      }

      console.log(`✅ ${inserted?.length || 0} presenze generate con fallback`);
    } else {
      // RPC function ha funzionato
      console.log('✅ Presenze generate usando RPC function');
    }

    res.json({
      success: true,
      message: 'Presenze generate con successo'
    });
  } catch (error) {
    console.error('❌ Generate attendance error:', error);
    console.error('❌ Error stack:', error.stack);
    console.error('❌ Request body:', JSON.stringify(req.body, null, 2));
    res.status(500).json({ error: 'Errore interno del server', details: error.message });
  }
});

// ==================== WORK SCHEDULES ENDPOINTS ====================

// Get work schedules for a user
app.get('/api/work-schedules', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.query;
    
    // Se è admin e non specifica userId, restituisce tutti i work schedules
    if (req.user.role === 'admin' && !userId) {
      const { data: schedules, error } = await supabase
        .from('work_schedules')
        .select(`
          *,
          users!work_schedules_user_id_fkey(first_name, last_name, id)
        `)
        .order('user_id, day_of_week');
      
      if (error) {
        console.error('Work schedules fetch error:', error);
        return res.status(500).json({ error: 'Errore nel recupero degli orari' });
      }
      
      return res.json(schedules);
    }
    
    // Per dipendenti o admin che specifica userId
    const targetUserId = userId || req.user.id;
    
    // Verifica permessi
    if (req.user.role === 'employee' && targetUserId !== req.user.id) {
      return res.status(403).json({ error: 'Accesso negato' });
    }

    const { data: schedules, error } = await supabase
      .from('work_schedules')
      .select('*')
      .eq('user_id', targetUserId)
      .order('day_of_week');

    if (error) {
      console.error('Work schedules fetch error:', error);
      return res.status(500).json({ error: 'Errore nel recupero degli orari' });
    }

    res.json(schedules);
  } catch (error) {
    console.error('Work schedules fetch error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Create or update work schedule
app.post('/api/work-schedules', authenticateToken, async (req, res) => {
  try {
    const { userId, schedules } = req.body;
    const targetUserId = userId || req.user.id;
    
    // Verifica permessi
    if (req.user.role === 'employee' && targetUserId !== req.user.id) {
      return res.status(403).json({ error: 'Accesso negato' });
    }

    if (!schedules || !Array.isArray(schedules)) {
      return res.status(400).json({ error: 'Orari non validi' });
    }

    // Elimina orari esistenti per questo utente
    await supabase
      .from('work_schedules')
      .delete()
      .eq('user_id', targetUserId);

    // Inserisci nuovi orari
    const schedulesWithUserId = schedules.map(schedule => ({
      ...schedule,
      user_id: targetUserId
    }));

    const { data: newSchedules, error } = await supabase
      .from('work_schedules')
      .insert(schedulesWithUserId)
      .select();

    if (error) {
      console.error('Work schedules create error:', error);
      return res.status(500).json({ error: 'Errore nel salvataggio degli orari' });
    }

    res.json({
      success: true,
      message: 'Orari di lavoro salvati con successo',
      schedules: newSchedules
    });
  } catch (error) {
    console.error('Work schedules create error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// ==================== DASHBOARD ENDPOINTS ====================

// Debug endpoint per verificare dati senza autenticazione
app.get('/api/debug/stats', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // Check if tables exist and have data
    const { data: employees, error: empError } = await supabase
      .from('employees')
      .select('*', { count: 'exact' })
      .limit(5);
    
    const { data: attendance, error: attError } = await supabase
      .from('attendance')
      .select('*', { count: 'exact' })
      .limit(5);
    
    const { data: leaveRequests, error: leaveError } = await supabase
      .from('leave_requests')
      .select('*', { count: 'exact' })
      .limit(5);

    res.json({
      today,
      employees: {
        count: employees?.length || 0,
        error: empError?.message || null,
        sample: employees?.slice(0, 2) || []
      },
      attendance: {
        count: attendance?.length || 0,
        error: attError?.message || null,
        sample: attendance?.slice(0, 2) || []
      },
      leaveRequests: {
        count: leaveRequests?.length || 0,
        error: leaveError?.message || null,
        sample: leaveRequests?.slice(0, 2) || []
      }
    });
  } catch (error) {
    console.error('Debug stats error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Dashboard stats
app.get('/api/dashboard/stats', authenticateToken, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();
    
    // Total employees
    const { count: totalEmployees } = await supabase
      .from('employees')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');

    // Present today - count those who have attendance records
    const { count: presentToday } = await supabase
      .from('attendance')
      .select('*', { count: 'exact', head: true })
      .eq('date', today);

    // Pending requests
    const { count: pendingRequests } = await supabase
      .from('leave_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    // Calculate monthly hours balance for current month
    let monthlyBalance = 0;
    if (req.user.role === 'admin') {
      // Admin vede il totale di tutti i dipendenti
      const { data: balances } = await supabase
        .from('hours_balance')
        .select('total_balance')
        .eq('year', currentYear)
        .eq('month', currentMonth);
      
      monthlyBalance = balances?.reduce((sum, balance) => sum + (balance.total_balance || 0), 0) || 0;
    } else {
      // Employee vede solo il proprio
      const { data: balance } = await supabase
        .from('hours_balance')
        .select('total_balance')
        .eq('user_id', req.user.id)
        .eq('year', currentYear)
        .eq('month', currentMonth)
        .single();
      
      monthlyBalance = balance?.total_balance || 0;
    }

    // Calculate attendance rate
    const attendanceRate = totalEmployees > 0 ? ((presentToday / totalEmployees) * 100).toFixed(1) : 0;

    res.json({
      totalEmployees: totalEmployees || 0,
      presentToday: presentToday || 0,
      pendingRequests: pendingRequests || 0,
      attendanceRate: parseFloat(attendanceRate),
      monthlyBalance: parseFloat(monthlyBalance.toFixed(2))
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ error: 'Errore nel recupero delle statistiche' });
  }
});

// Dashboard weekly attendance data
app.get('/api/dashboard/attendance', authenticateToken, async (req, res) => {
  try {
    // Admin vede tutti i dati, employee vede solo i propri

    // Get last 7 days
    const today = new Date();
    const weekData = [];
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      let presenzeQuery = supabase
        .from('attendance')
        .select('*', { count: 'exact', head: true })
        .eq('date', dateStr);
      
      // Calcola assenze: per ora non abbiamo un sistema di assenze
      let assenzeQuery = { count: 0 };
      
      // Se è employee, mostra solo i propri dati
      if (req.user.role === 'employee') {
        presenzeQuery = presenzeQuery.eq('user_id', req.user.id);
        assenzeQuery = assenzeQuery.eq('user_id', req.user.id);
      }
      
      const { count: presenze } = await presenzeQuery;
      const { count: assenze } = await assenzeQuery;
      
      weekData.push({
        name: date.toLocaleDateString('it-IT', { weekday: 'short' }),
        presenze: presenze || 0,
        assenze: assenze || 0,
        date: dateStr
      });
    }

    res.json(weekData);
  } catch (error) {
    console.error('Weekly attendance error:', error);
    res.status(500).json({ error: 'Errore nel recupero delle presenze settimanali' });
  }
});

// Dashboard departments data
app.get('/api/dashboard/departments', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Accesso negato' });
    }

    // Count employees per department con gestione errore campo mancante
    let deptCount = {};
    
    try {
      const { data: departments, error } = await supabase
        .from('users')
        .select('department')
        .eq('role', 'employee')
        .eq('is_active', true);

      if (error) {
        console.log('Campo department non esiste, uso conteggio vuoto');
        // Se il campo non esiste, usa conteggio vuoto
        deptCount = {};
      } else {
        // Count employees per department
        departments.forEach(emp => {
          const dept = emp.department || 'Amministrazione';
          deptCount[dept] = (deptCount[dept] || 0) + 1;
        });
      }
    } catch (error) {
      console.log('Errore nel recupero dipartimenti, uso conteggio vuoto');
      deptCount = {};
    }

    const colors = ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#3b82f6'];
    const result = Object.entries(deptCount).map(([name, value], index) => ({
      name,
      value,
      color: colors[index % colors.length],
      employees: value
    }));

    res.json(result);
  } catch (error) {
    console.error('Departments error:', error);
    res.status(500).json({ error: 'Errore nel recupero dei dipartimenti' });
  }
});

// Current attendance (who's in office now) - REAL-TIME VERSION
app.get('/api/attendance/current', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Accesso negato' });
    }

    // Usa getCurrentDateTime per ottenere data/ora (reale o simulata dall'admin)
    // Nota: per ogni utente, controlleremo se ha modalità test attiva individualmente
    const { date: today, time: currentTime, dateTime: now, isTestMode } = await getCurrentDateTime();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const dayOfWeek = now.getDay();
    
    if (isTestMode) {
      console.log(`🧪 ADMIN TEST MODE: Visualizzazione presenze per ${today} alle ${currentTime}`);
    }
    
    // Get all users with their work schedules
    const { data: allUsers, error: usersError } = await supabase
      .from('users')
      .select(`
        id, first_name, last_name, department,
        work_schedules!left(*)
      `)
      .neq('role', 'admin');
    
    if (usersError) {
      console.error('Users error:', usersError);
      return res.status(500).json({ error: 'Errore nel recupero degli utenti' });
    }

    console.log(`🔍 Admin current attendance - Day: ${dayOfWeek}, Time: ${currentHour}:${currentMinute}`);
    console.log(`🔍 Total users found: ${allUsers.length}`);
    
    // IMPORTANTE: Leggi SEMPRE da attendance e leave_requests (dati reali)
    // La modalità test viene usata solo per simulare l'orario nei calcoli real-time
    // I dati di test vengono salvati in test_attendance, ma per la visualizzazione usiamo sempre i dati reali
    
    // Recupera presenze per oggi (SEMPRE da attendance - dati reali)
    const { data: attendanceToday, error: attendanceError } = await supabase
      .from('attendance')
      .select('user_id, actual_hours, expected_hours')
      .eq('date', today);
    
    // Crea mappa user_id -> presenza per oggi
    const attendanceMap = {};
    if (attendanceToday && !attendanceError) {
      attendanceToday.forEach(a => {
        attendanceMap[a.user_id] = {
          actual_hours: a.actual_hours,
          expected_hours: a.expected_hours
        };
      });
    }
    console.log(`📅 Presenze oggi (attendance):`, Object.keys(attendanceMap).length, 'utenti');
    
    // Recupera malattie per oggi (SEMPRE da leave_requests - dati reali)
    const { data: sickToday, error: sickError } = await supabase
      .from('leave_requests')
      .select('user_id, start_date, end_date')
      .eq('type', 'sick_leave')
      .eq('status', 'approved')
      .lte('start_date', today)
      .gte('end_date', today);
    
    // Crea mappa user_id -> date per malattie
    const sickMap = {};
    if (sickToday && !sickError) {
      sickToday.forEach(s => {
        if (!sickMap[s.user_id]) sickMap[s.user_id] = [];
        sickMap[s.user_id].push({ start: s.start_date, end: s.end_date });
      });
    }
    console.log(`🤒 Malattie oggi:`, Object.keys(sickMap).length);
    
    // Recupera permessi 104 per oggi (SEMPRE da leave_requests - dati reali)
    const { data: perm104Today, error: perm104Error } = await supabase
      .from('leave_requests')
      .select('user_id, start_date, end_date')
      .eq('type', 'permission_104')
      .eq('status', 'approved')
      .lte('start_date', today)
      .gte('end_date', today);
    
    // Crea mappa user_id -> date per permessi 104
    const perm104Map = {};
    if (perm104Today && !perm104Error) {
      perm104Today.forEach(p => {
        if (!perm104Map[p.user_id]) perm104Map[p.user_id] = [];
        perm104Map[p.user_id].push({ start: p.start_date, end: p.end_date });
      });
    }
    console.log(`🔵 Permessi 104 oggi:`, Object.keys(perm104Map).length);
    
    // Recupera permessi approvati per oggi per tutti gli utenti (SEMPRE da leave_requests - dati reali)
    const { data: permissionsToday, error: permError } = await supabase
      .from('leave_requests')
      .select('user_id, hours, permission_type, exit_time, entry_time, start_date, end_date')
      .eq('type', 'permission')
      .eq('status', 'approved')
      .lte('start_date', today)
      .gte('end_date', today);
    
    // Crea una mappa user_id -> array di permessi (per gestire test mode per utente)
    const permissionsMap = {};
    if (permissionsToday && !permError) {
      permissionsToday.forEach(perm => {
        if (!permissionsMap[perm.user_id]) permissionsMap[perm.user_id] = [];
        permissionsMap[perm.user_id].push({
          hours: parseFloat(perm.hours || 0),
          permission_type: perm.permission_type,
          exit_time: perm.exit_time,
          entry_time: perm.entry_time,
          start_date: perm.start_date,
          end_date: perm.end_date
        });
      });
      console.log(`🕐 Permessi oggi:`, Object.keys(permissionsMap).length, 'utenti con permessi');
    }
    
    // Calculate real-time attendance for each user
    // Per ogni utente, controlla se ha modalità test attiva e usa quella data/ora
    const currentAttendance = await Promise.all(allUsers.map(async (user) => {
      const userToday = today;
      const userCurrentTime = currentTime;
      const userNow = now;
      const userDayOfWeek = userNow.getDay();
      const userCurrentHour = userNow.getHours();
      const userCurrentMinute = userNow.getMinutes();
      
      console.log(`🔍 Processing user: ${user.first_name} ${user.last_name}`);
      console.log(`🔍 User work_schedules:`, user.work_schedules?.length || 0);
      
      // Controlla se è in malattia (usa la data dell'utente se in test mode)
      const userSick = sickMap[user.id]?.some(s => 
        userToday >= s.start && userToday <= s.end
      );
      if (userSick) {
        console.log(`🤒 ${user.first_name} è in malattia oggi`);
        return {
          user_id: user.id,
          first_name: user.first_name,
          last_name: user.last_name,
          name: `${user.first_name} ${user.last_name}`,
          department: user.department || 'Non specificato',
          is_working_day: true,
          status: 'sick_leave',
          actual_hours: 0,
          expected_hours: 0,
          balance_hours: 0,
          permission_end_time: null
        };
      }
      
      // Controlla se ha permesso 104 (usa la data dell'utente se in test mode)
      const userPerm104 = perm104Map[user.id]?.some(p => 
        userToday >= p.start && userToday <= p.end
      );
      if (userPerm104) {
        console.log(`🔵 ${user.first_name} ha permesso 104 oggi`);
        return {
          user_id: user.id,
          first_name: user.first_name,
          last_name: user.last_name,
          name: `${user.first_name} ${user.last_name}`,
          department: user.department || 'Non specificato',
          is_working_day: true,
          status: 'permission_104',
          actual_hours: 0,
          expected_hours: 0,
          balance_hours: 0,
          permission_end_time: null
        };
      }
      
      // Find today's work schedule (usa il giorno della settimana dell'utente se in test mode)
      let todaySchedule = user.work_schedules?.find(schedule => 
        schedule.day_of_week === userDayOfWeek && schedule.is_working_day
      );
      
      console.log(`🔍 Today schedule found:`, !!todaySchedule);
      if (todaySchedule) {
        console.log(`🔍 Schedule: ${todaySchedule.start_time}-${todaySchedule.end_time}, break: ${todaySchedule.break_duration}min`);
      }
      
      // Se non trova schedule, crea automaticamente quelli di default
      if (!todaySchedule || !user.work_schedules || user.work_schedules.length === 0) {
        console.log(`🔧 [current] Creating default schedules for user ${user.id} (${user.first_name})...`);
        
        const defaultSchedules = [
          { user_id: user.id, day_of_week: 1, is_working_day: true, start_time: '09:00', end_time: '18:00', break_duration: 60 },
          { user_id: user.id, day_of_week: 2, is_working_day: true, start_time: '09:00', end_time: '18:00', break_duration: 60 },
          { user_id: user.id, day_of_week: 3, is_working_day: true, start_time: '09:00', end_time: '18:00', break_duration: 60 },
          { user_id: user.id, day_of_week: 4, is_working_day: true, start_time: '09:00', end_time: '18:00', break_duration: 60 },
          { user_id: user.id, day_of_week: 5, is_working_day: true, start_time: '09:00', end_time: '18:00', break_duration: 60 },
          { user_id: user.id, day_of_week: 6, is_working_day: false, start_time: '09:00', end_time: '18:00', break_duration: 60 },
          { user_id: user.id, day_of_week: 0, is_working_day: false, start_time: '09:00', end_time: '18:00', break_duration: 60 }
        ];
        
        const { error: createError } = await supabase
          .from('work_schedules')
          .insert(defaultSchedules);
        
        if (createError) {
          console.error(`❌ [current] Failed to create default schedules for ${user.first_name}:`, createError);
          return {
            user_id: user.id,
            first_name: user.first_name,
            last_name: user.last_name,
            name: `${user.first_name} ${user.last_name}`,
            department: user.department || 'Non specificato',
            is_working_day: false,
            status: 'non_working_day',
            actual_hours: 0,
            expected_hours: 0,
            balance_hours: 0,
            permission_end_time: null
          };
        }
        
        console.log(`✅ [current] Default schedules created for ${user.first_name}!`);
        
        // Usa lo schedule di oggi dai default appena creati
        const newTodaySchedule = defaultSchedules.find(s => s.day_of_week === userDayOfWeek);
        if (!newTodaySchedule || !newTodaySchedule.is_working_day) {
          return {
            user_id: user.id,
            first_name: user.first_name,
            last_name: user.last_name,
            name: `${user.first_name} ${user.last_name}`,
            department: user.department || 'Non specificato',
            is_working_day: false,
            status: 'non_working_day',
            actual_hours: 0,
            expected_hours: 0,
            balance_hours: 0,
            permission_end_time: null
          };
        }
        
        todaySchedule = newTodaySchedule;
        console.log(`🔍 Using new schedule: ${todaySchedule.start_time}-${todaySchedule.end_time}`);
      }

      // Se c'è una presenza salvata per oggi, controllare se la giornata è completata
      const savedAttendance = attendanceMap[user.id];
      
      // Determina se la giornata è completata (orario corrente > orario fine)
      const { start_time, end_time, break_duration, break_start_time } = todaySchedule;
      const [scheduleEndHour, scheduleEndMin] = end_time.split(':').map(Number);
      const isCompleted = userCurrentHour > scheduleEndHour || (userCurrentHour === scheduleEndHour && userCurrentMinute >= scheduleEndMin);
      
      // Usa la presenza salvata SOLO se la giornata è completata
      if (savedAttendance && isCompleted) {
        console.log(`📅 ${user.first_name} - Giornata completata, uso dati salvati: ${savedAttendance.actual_hours}h / ${savedAttendance.expected_hours}h`);
        return {
          user_id: user.id,
          first_name: user.first_name,
          last_name: user.last_name,
          name: `${user.first_name} ${user.last_name}`,
          department: user.department || 'Non specificato',
          is_working_day: true,
          status: 'completed',
          actual_hours: savedAttendance.actual_hours || 0,
          expected_hours: savedAttendance.expected_hours || 0,
          balance_hours: (savedAttendance.actual_hours || 0) - (savedAttendance.expected_hours || 0),
          permission_end_time: null
        };
      }
      
      // Se la giornata NON è completata, calcola sempre real-time (anche se esiste presenza salvata)
      if (savedAttendance && !isCompleted) {
        console.log(`🕐 ${user.first_name} - Giornata in corso, ignoro dati salvati (${savedAttendance.actual_hours}h) e calcolo real-time`);
      }
      
      // Se non c'è presenza salvata, calcola se dovrebbe essere presente basandosi sull'orario
      // (questo è importante per la modalità test, dove potresti non aver ancora salvato presenze)
      const [startHour, startMin] = start_time.split(':').map(Number);
      const [endHour, endMin] = end_time.split(':').map(Number);
      const breakDuration = break_duration || 60;
      
      // Calculate expected hours (ORE CONTRATTUALI - sempre fisse)
      const totalMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);
      const workMinutes = totalMinutes - breakDuration;
      const expectedHours = calculateExpectedHoursForSchedule({ start_time: start_time, end_time: end_time, break_duration }); // NON modificare per permessi early_exit/late_entry!
      
      // Controlla se c'è un permesso per la data dell'utente (usa la data dell'utente se in test mode)
      const userPermissions = permissionsMap[user.id]?.filter(p => 
        userToday >= p.start_date && userToday <= p.end_date
      ) || [];
      
      let permissionData = null;
      if (userPermissions.length > 0) {
        let totalHours = 0;
        let exitTime = null;
        let entryTime = null;
        const permissionTypes = new Set();
        
        userPermissions.forEach(perm => {
          totalHours += parseFloat(perm.hours || 0);
          if (perm.permission_type === 'early_exit' && perm.exit_time) {
            permissionTypes.add('early_exit');
            if (!exitTime || perm.exit_time < exitTime) {
              exitTime = perm.exit_time;
            }
          }
          if (perm.permission_type === 'late_entry' && perm.entry_time) {
            permissionTypes.add('late_entry');
            if (!entryTime || perm.entry_time > entryTime) {
              entryTime = perm.entry_time;
            }
          }
        });
        
        if (exitTime || entryTime) {
          permissionData = {
            hours: totalHours,
            permission_types: Array.from(permissionTypes),
            exit_time: exitTime,
            entry_time: entryTime
          };
        }
      }
      
      // Calcola l'orario di fine/inizio effettivo considerando i permessi
      let effectiveEndHour = endHour;
      let effectiveEndMin = endMin;
      let effectiveStartHour = startHour;
      let effectiveStartMin = startMin;
      
      // PERMESSO USCITA ANTICIPATA: non riduce expectedHours, crea solo debito
      if (permissionData?.exit_time) {
        const [exitHour, exitMin] = permissionData.exit_time.split(':').map(Number);
        effectiveEndHour = exitHour;
        effectiveEndMin = exitMin;
        console.log(`🚪 ${user.first_name} ha permesso uscita anticipata alle ${permissionData.exit_time} → potenziale debito di ${permissionData.hours}h`);
      }
      
      // PERMESSO ENTRATA POSTICIPATA: non riduce expectedHours, crea solo debito
      if (permissionData?.entry_time) {
        const [entryHour, entryMin] = permissionData.entry_time.split(':').map(Number);
        effectiveStartHour = entryHour;
        effectiveStartMin = entryMin;
        console.log(`🚪 ${user.first_name} ha permesso entrata posticipata alle ${permissionData.entry_time} → potenziale debito di ${permissionData.hours}h`);
      }
      
      // Calculate real-time hours (same logic as employee page)
      let actualHours = 0;
      let status = 'not_started';
      
      // Controlla se ha iniziato (usa effectiveStartHour per late_entry e userCurrentHour per test mode)
      if (userCurrentHour < effectiveStartHour || (userCurrentHour === effectiveStartHour && userCurrentMinute < effectiveStartMin)) {
        actualHours = 0;
        status = 'not_started';
      } else if (userCurrentHour > effectiveEndHour || (userCurrentHour === effectiveEndHour && userCurrentMinute >= effectiveEndMin)) {
        // Giornata finita: calcola le ore effettivamente lavorate fino a effectiveEndHour
        const effectiveWorkMinutes = (effectiveEndHour * 60 + effectiveEndMin) - (effectiveStartHour * 60 + effectiveStartMin) - breakDuration;
        actualHours = effectiveWorkMinutes / 60;
        status = 'completed';
        console.log(`✅ ${user.first_name} - COMPLETED: worked ${actualHours}h (expected: ${expectedHours}h) → balance: ${actualHours - expectedHours}h`);
      } else {
        // Durante la giornata lavorativa - calcola ore real-time
        // USA effectiveStartHour perché potrebbe essere entrato in ritardo
        // USA userCurrentHour/userCurrentMinute per rispettare la modalità test dell'utente
        const minutesFromStart = (userCurrentHour - effectiveStartHour) * 60 + (userCurrentMinute - effectiveStartMin);
        const totalWorkMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);
        const hasLunchBreak = totalWorkMinutes > 300;
        
        let totalMinutesWorked = 0;
        
        if (hasLunchBreak) {
          // FULL DAY: usa break_start_time se disponibile, altrimenti 13:00
          const currentTimeInMinutes = userCurrentHour * 60 + userCurrentMinute;
          
          let breakStartInMinutes;
          if (break_start_time) {
            const [breakHour, breakMin] = break_start_time.split(':').map(Number);
            breakStartInMinutes = breakHour * 60 + breakMin;
          } else {
            // Default: 13:00
            breakStartInMinutes = 13 * 60;
          }
          
          const breakEndInMinutes = breakStartInMinutes + breakDuration;
          
          console.log(`🔍 ${user.first_name} - Current: ${userCurrentHour}:${userCurrentMinute}, Start: ${effectiveStartHour}:${effectiveStartMin}, Break: ${break_start_time || '13:00'}`);
          
          // Calcola minuti dall'inizio EFFETTIVO (considerando late_entry)
          const startTimeInMinutes = effectiveStartHour * 60 + effectiveStartMin;
          
          if (currentTimeInMinutes < breakStartInMinutes) {
            // Prima della pausa pranzo
            totalMinutesWorked = currentTimeInMinutes - startTimeInMinutes;
            status = 'working';
            console.log(`✅ ${user.first_name} - WORKING (before break): ${totalMinutesWorked}min`);
          } else if (currentTimeInMinutes >= breakStartInMinutes && currentTimeInMinutes < breakEndInMinutes) {
            // Durante la pausa pranzo
            totalMinutesWorked = breakStartInMinutes - startTimeInMinutes;
            status = 'on_break';
            console.log(`⏸️ ${user.first_name} - ON BREAK: worked ${totalMinutesWorked}min before break`);
          } else {
            // Dopo la pausa pranzo
            const morningMinutes = breakStartInMinutes - startTimeInMinutes;
            const afternoonMinutes = currentTimeInMinutes - breakEndInMinutes;
            totalMinutesWorked = morningMinutes + afternoonMinutes;
            status = 'working';
            console.log(`✅ ${user.first_name} - WORKING (after break): morning ${morningMinutes}min + afternoon ${afternoonMinutes}min = ${totalMinutesWorked}min`);
          }
        } else {
          // HALF DAY: no lunch break
          totalMinutesWorked = minutesFromStart;
          status = 'working';
          console.log(`✅ ${user.first_name} - WORKING (half day): ${totalMinutesWorked}min`);
        }
        
        actualHours = totalMinutesWorked / 60;
      }
      
      const balanceHours = actualHours - expectedHours;
      
      const result = {
        user_id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        name: `${user.first_name} ${user.last_name}`,
        department: user.department || 'Non specificato',
        is_working_day: true,
        status,
        actual_hours: Math.round(actualHours * 10) / 10,
        expected_hours: Math.round(expectedHours * 10) / 10,
        balance_hours: Math.round(balanceHours * 10) / 10,
        start_time,
        end_time,
        break_duration: breakDuration,
        permission_end_time: permissionData?.exit_time || null
      };
      
      console.log(`🔍 User result: ${result.name} - Status: ${result.status}, Hours: ${result.actual_hours}h, Working day: ${result.is_working_day}`);
      return result;
    }));

    console.log(`🔍 Total calculated attendance records: ${currentAttendance.length}`);
    console.log(`🔍 All records:`, currentAttendance.map(emp => `${emp.name}: ${emp.status} (${emp.actual_hours}h)`));

    // Modalità predefinita: restituisci SOLO i presenti ora (working/on_break/present)
    // Se necessario, in futuro possiamo aggiungere una query (?includeScheduled=true) per includere anche not_started/completed
    const presentNow = currentAttendance.filter(emp =>
      emp.is_working_day && (emp.status === 'working' || emp.status === 'on_break' || emp.status === 'present')
    );

    console.log(`🔍 Present now: ${presentNow.length}`);
    console.log(`🔍 Records:`, presentNow.map(emp => `${emp.name}: ${emp.status} (${emp.actual_hours}h/${emp.expected_hours}h)`));

    res.json(presentNow);
  } catch (error) {
    console.error('Current attendance error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Get employees on sick leave today
app.get('/api/attendance/sick-today', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Accesso negato' });
    }

    const today = new Date().toISOString().split('T')[0];
    
    // Get all approved sick leave requests for today
    const { data: sickLeaves, error: leaveError } = await supabase
      .from('leave_requests')
      .select(`
        *,
        users!leave_requests_user_id_fkey(id, first_name, last_name, department, email)
      `)
      .eq('type', 'sick_leave')
      .eq('status', 'approved')
      .lte('start_date', today)
      .gte('end_date', today);
    
    if (leaveError) {
      console.error('Sick leave fetch error:', leaveError);
      return res.status(500).json({ error: 'Errore nel recupero delle malattie' });
    }

    const employeesOnSickLeave = sickLeaves.map(leave => ({
      user_id: leave.users.id,
      name: `${leave.users.first_name} ${leave.users.last_name}`,
      department: leave.users.department || 'Non specificato',
      email: leave.users.email,
      reason: leave.reason,
      start_date: leave.start_date,
      end_date: leave.end_date,
      notes: leave.notes
    }));

    console.log(`🤒 Employees on sick leave today: ${employeesOnSickLeave.length}`);
    res.json(employeesOnSickLeave);
  } catch (error) {
    console.error('Sick leave today error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Get total hours bank balance for user (cumulative from all time)
app.get('/api/attendance/total-balance', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.query;
    const targetUserId = userId || req.user.id;
    
    // Verifica permessi
    if (req.user.role === 'employee' && targetUserId !== req.user.id) {
      return res.status(403).json({ error: 'Accesso negato' });
    }

    // Calcola il saldo totale da TUTTE le presenze
    const { data: allAttendance, error } = await supabase
      .from('attendance')
      .select('balance_hours, date, actual_hours, expected_hours')
      .eq('user_id', targetUserId);
    
    if (error) {
      console.error('Total balance fetch error:', error);
      return res.status(500).json({ error: 'Errore nel recupero del saldo' });
    }

    const { date: today, time: currentTime, dateTime: now, isTestMode } = await getCurrentDateTime();
    
    let todayBalance = 0;
    let todayRecord = allAttendance.find(r => r.date === today);
    let hasRealTimeCalculation = false;
    let realTimeActualHours = 0;
    let realTimeEffectiveHours = 0;
    let realTimeContractHours = 0;
    let realTimeRemainingHours = 0;
    let todayBalanceHours = 0;
    
    // Verifica se oggi (o data simulata) è un giorno lavorativo e calcola real-time
    const dayOfWeek = now.getDay();
    const { data: schedule } = await supabase
      .from('work_schedules')
      .select('*')
      .eq('user_id', targetUserId)
      .eq('day_of_week', dayOfWeek)
      .eq('is_working_day', true)
      .single();
    
    if (schedule) {
      // Recupera permessi per oggi (SEMPRE da leave_requests - dati reali)
      const { data: permissionsToday } = await supabase
        .from('leave_requests')
        .select('hours, permission_type, exit_time, entry_time')
        .eq('user_id', targetUserId)
        .eq('type', 'permission')
        .eq('status', 'approved')
        .lte('start_date', today)
        .gte('end_date', today);
      
      let permissionData = null;
      if (permissionsToday && permissionsToday.length > 0) {
        let totalHours = 0;
        let exitTime = null;
        let entryTime = null;
        const permissionTypes = new Set();
        
        permissionsToday.forEach(perm => {
          totalHours += parseFloat(perm.hours || 0);
          if (perm.permission_type === 'early_exit' && perm.exit_time) {
            permissionTypes.add('early_exit');
            if (!exitTime || perm.exit_time < exitTime) {
              exitTime = perm.exit_time;
            }
          }
          if (perm.permission_type === 'late_entry' && perm.entry_time) {
            permissionTypes.add('late_entry');
            if (!entryTime || perm.entry_time > entryTime) {
              entryTime = perm.entry_time;
            }
          }
        });
        
        if (exitTime || entryTime) {
          permissionData = { hours: totalHours, permission_types: Array.from(permissionTypes), exit_time: exitTime, entry_time: entryTime };
        }
      }
      
      // USA LA FUNZIONE CENTRALIZZATA con data/ora simulate se in test mode
      const result = calculateRealTimeHours(schedule, currentTime, permissionData);
      todayBalance = result.balanceHours;
      todayBalanceHours = result.balanceHours;
      realTimeActualHours = result.actualHours;
      realTimeEffectiveHours = result.expectedHours;
      realTimeContractHours = result.contractHours;
      realTimeRemainingHours = result.remainingHours;
      hasRealTimeCalculation = true;
      
      console.log(`🔄 Using real-time balance for today: ${todayBalance.toFixed(2)}h (instead of DB: ${todayRecord?.balance_hours || 0}h)`);
    } else if (todayRecord) {
      // Non è un giorno lavorativo, usa il balance dal DB
      todayBalance = todayRecord.balance_hours || 0;
    }

    // Somma tutti i saldi, usando real-time per oggi
    const totalBalance = allAttendance.reduce((sum, record) => {
      if (record.date === today && schedule) {
        // Usa il balance real-time per oggi invece del DB
        return sum + todayBalance;
      }
      return sum + (record.balance_hours || 0);
    }, 0);

    console.log(`💰 Total balance for user ${targetUserId}: ${totalBalance.toFixed(2)}h (using real-time for today: ${todayBalance.toFixed(2)}h)`);

    res.json({
      userId: targetUserId,
      totalBalanceHours: Math.round(totalBalance * 100) / 100,
      totalBalanceMinutes: Math.round(totalBalance * 60),
      isCredit: totalBalance > 0,
      isDebt: totalBalance < 0,
      realTime: hasRealTimeCalculation ? {
        actualHours: realTimeActualHours,
        effectiveExpectedHours: realTimeEffectiveHours,
        contractHours: realTimeContractHours,
        remainingHours: realTimeRemainingHours,
        balanceHours: todayBalanceHours,
        dayBalanceHours: todayBalanceHours
      } : null
    });
  } catch (error) {
    console.error('Total balance error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Get approved permissions for today (early exit / late entry)
app.get('/api/attendance/permissions-today', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Accesso negato' });
    }

    const today = new Date().toISOString().split('T')[0];
    
    // Get all approved permission requests for today
    const { data: permissions, error: permError } = await supabase
      .from('leave_requests')
      .select(`
        *,
        users!leave_requests_user_id_fkey(id, first_name, last_name, department, email)
      `)
      .eq('type', 'permission')
      .eq('status', 'approved')
      .lte('start_date', today)
      .gte('end_date', today);
    
    if (permError) {
      console.error('Permissions fetch error:', permError);
      return res.status(500).json({ error: 'Errore nel recupero dei permessi' });
    }

    const approvedPermissions = permissions.map(perm => ({
      user_id: perm.users.id,
      name: `${perm.users.first_name} ${perm.users.last_name}`,
      department: perm.users.department || 'Non specificato',
      email: perm.users.email,
      permission_type: perm.permission_type, // 'early_exit', 'late_entry', 'hourly', 'personal'
      exit_time: perm.exit_time, // Es. "16:45"
      entry_time: perm.entry_time, // Es. "10:00"
      hours: perm.hours, // Ore permesso (se hourly)
      reason: perm.reason,
      start_date: perm.start_date,
      end_date: perm.end_date,
      notes: perm.notes
    }));

    console.log(`📝 Approved permissions today: ${approvedPermissions.length}`);
    res.json(approvedPermissions);
  } catch (error) {
    console.error('Permissions today error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Get approved 104 permissions for today
app.get('/api/attendance/104-today', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Accesso negato' });
    }

    const today = new Date().toISOString().split('T')[0];
    
    // Get all approved 104 permissions for today
    const { data: permissions104, error: perm104Error } = await supabase
      .from('leave_requests')
      .select(`
        *,
        users!leave_requests_user_id_fkey(id, first_name, last_name, department, email)
      `)
      .eq('type', 'permission_104')
      .eq('status', 'approved')
      .lte('start_date', today)
      .gte('end_date', today);
    
    if (perm104Error) {
      console.error('104 permissions fetch error:', perm104Error);
      return res.status(500).json({ error: 'Errore nel recupero dei permessi 104' });
    }

    const employeesOn104 = permissions104.map(perm => ({
      user_id: perm.users.id,
      name: `${perm.users.first_name} ${perm.users.last_name}`,
      department: perm.users.department || 'Non specificato',
      email: perm.users.email,
      reason: perm.reason || 'Permesso Legge 104',
      start_date: perm.start_date,
      end_date: perm.end_date,
      notes: perm.notes
    }));

    console.log(`🔵 Employees using 104 permission today: ${employeesOn104.length}`);
    res.json(employeesOn104);
  } catch (error) {
    console.error('104 permissions today error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Upcoming departures (next 2 hours)
app.get('/api/attendance/upcoming-departures', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Accesso negato' });
    }

    const now = new Date();
    const in2Hours = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    
    const { data: upcoming, error } = await supabase
      .from('attendance')
      .select(`
        *,
        users!inner(first_name, last_name, department)
      `)
      .eq('date', now.toISOString().split('T')[0])
      .not('clock_in', 'is', null)
      .is('clock_out', null)
      .order('clock_in');

    if (error) {
      console.error('Upcoming departures error:', error);
      return res.status(500).json({ error: 'Errore nel recupero delle uscite imminenti' });
    }

    // Calculate expected departure times (assuming 8-hour workday)
    const upcomingDepartures = upcoming.map(att => {
      const checkInTime = new Date(att.clock_in);
      const expectedCheckOut = new Date(checkInTime.getTime() + 8 * 60 * 60 * 1000);
      
      return {
        id: att.id,
        name: `${att.users.first_name} ${att.users.last_name}`,
        department: att.users.department || 'Non specificato',
        clock_in: att.clock_in,
        expected_check_out: expectedCheckOut.toTimeString().split(' ')[0].substring(0, 5),
        minutes_until_departure: Math.round((expectedCheckOut - now) / (1000 * 60))
      };
    }).filter(att => att.minutes_until_departure > 0 && att.minutes_until_departure <= 120);

    res.json(upcomingDepartures);
  } catch (error) {
    console.error('Upcoming departures error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// ==================== MANUAL ATTENDANCE GENERATION ====================

// Generate attendance for a specific user and date (for testing/debugging)
app.post('/api/attendance/generate-manual', authenticateToken, async (req, res) => {
  try {
    const { userId, date } = req.body;
    const targetUserId = userId || req.user.id;
    const targetDate = date || new Date().toISOString().split('T')[0];
    
    // Verifica permessi: admin può generare per chiunque, employee solo per se stesso
    if (req.user.role === 'employee' && targetUserId !== req.user.id) {
      return res.status(403).json({ error: 'Accesso negato' });
    }

    // Ottieni l'orario per questo giorno della settimana
    const dayOfWeek = new Date(targetDate).getDay();
    const { data: schedule, error: scheduleError } = await supabase
      .from('work_schedules')
      .select('*')
      .eq('user_id', targetUserId)
      .eq('day_of_week', dayOfWeek)
      .eq('is_working_day', true)
      .single();

    if (scheduleError || !schedule) {
      return res.status(400).json({ error: 'Nessun orario di lavoro definito per questo giorno' });
    }

    // Verifica se esiste già una presenza per questa data
    const { data: existingAttendance } = await supabase
      .from('attendance')
      .select('id')
      .eq('user_id', targetUserId)
      .eq('date', targetDate)
      .single();

    if (existingAttendance) {
      return res.status(400).json({ error: 'Presenza già esistente per questa data' });
    }

    // Calcola ore di lavoro basate sull'orario specifico
    const { start_time, end_time, break_duration, break_start_time } = schedule;
    const start = new Date(`2000-01-01T${start_time}`);
    const end = new Date(`2000-01-01T${end_time}`);
    const totalMinutes = (end - start) / (1000 * 60);
    const workMinutes = totalMinutes - (break_duration || 60);
    const workHours = workMinutes / 60;

    // Crea la presenza automatica
    const { data: newAttendance, error: attendanceError } = await supabase
      .from('attendance')
      .insert({
        user_id: targetUserId,
        date: targetDate,
        notes: `Presenza generata manualmente per orario ${start_time}-${end_time}`
      })
      .select()
      .single();

    if (attendanceError) {
      console.error('Manual attendance creation error:', attendanceError);
      return res.status(500).json({ error: 'Errore nella creazione della presenza' });
    }

    // Crea i dettagli della presenza basati sull'orario specifico
    const breakMinutes = break_duration || 60;
    let details = [];

    if (schedule.work_type === 'full_day') {
      // Giornata completa con pausa pranzo
      const workMinutes = totalMinutes - breakMinutes;
      const morningMinutes = Math.floor(workMinutes / 2);
      const afternoonMinutes = workMinutes - morningMinutes;
      
      const breakStart = new Date(start.getTime() + (morningMinutes * 60 * 1000));
      const breakEnd = new Date(breakStart.getTime() + (breakMinutes * 60 * 1000));
      
      details = [
        {
          attendance_id: newAttendance.id,
          user_id: targetUserId,
          date: targetDate,
          segment: 'morning',
          start_time: start_time,
          end_time: breakStart.toTimeString().substring(0, 5),
          status: 'completed',
          notes: 'Periodo mattutino completato'
        },
        {
          attendance_id: newAttendance.id,
          user_id: targetUserId,
          date: targetDate,
          segment: 'lunch_break',
          start_time: breakStart.toTimeString().substring(0, 5),
          end_time: breakEnd.toTimeString().substring(0, 5),
          status: 'completed',
          notes: 'Pausa pranzo'
        },
        {
          attendance_id: newAttendance.id,
          user_id: targetUserId,
          date: targetDate,
          segment: 'afternoon',
          start_time: breakEnd.toTimeString().substring(0, 5),
          end_time: end_time,
          status: 'completed',
          notes: 'Periodo pomeridiano completato'
        }
      ];
    } else if (schedule.work_type === 'morning') {
      details = [
        {
          attendance_id: newAttendance.id,
          user_id: targetUserId,
          date: targetDate,
          segment: 'morning',
          start_time: start_time,
          end_time: end_time,
          status: 'completed',
          notes: 'Turno mattutino completato'
        }
      ];
    } else if (schedule.work_type === 'afternoon') {
      details = [
        {
          attendance_id: newAttendance.id,
          user_id: targetUserId,
          date: targetDate,
          segment: 'afternoon',
          start_time: start_time,
          end_time: end_time,
          status: 'completed',
          notes: 'Turno pomeridiano completato'
        }
      ];
    }

    // Inserisci i dettagli
    if (details.length > 0) {
      const { error: detailsError } = await supabase
        .from('attendance_details')
        .insert(details);

      if (detailsError) {
        console.error('Attendance details creation error:', detailsError);
      }
    }

    res.json({
      success: true,
      message: 'Presenza generata con successo',
      attendance: newAttendance,
      details: details.length
    });
  } catch (error) {
    console.error('Manual attendance generation error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Generate attendance for all employees today
app.post('/api/attendance/generate-today', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Accesso negato' });
    }

    const today = new Date().toISOString().split('T')[0];
    const dayOfWeek = new Date().getDay();

    // Ottieni tutti i dipendenti attivi con i loro orari di lavoro per oggi
    const { data: employees, error: employeesError } = await supabase
      .from('users')
      .select(`
        id,
        first_name,
        last_name,
        email,
        work_schedules!inner(
          day_of_week,
          is_working_day,
          start_time,
          end_time,
          break_duration
        )
      `)
      .eq('is_active', true)
      .eq('role', 'employee')
      .eq('work_schedules.day_of_week', dayOfWeek)
      .eq('work_schedules.is_working_day', true);

    if (employeesError) {
      console.error('Errore nel recupero dipendenti:', employeesError);
      return res.status(500).json({ error: 'Errore nel recupero dei dipendenti' });
    }

    if (!employees || employees.length === 0) {
      return res.status(404).json({ error: 'Nessun dipendente con orario di lavoro per oggi' });
    }

    let generatedCount = 0;
    let skippedCount = 0;

    // Per ogni dipendente, genera la presenza automatica
    for (const employee of employees) {
      const schedule = employee.work_schedules[0];

      // Verifica se esiste già una presenza per oggi
      const { data: existingAttendance } = await supabase
        .from('attendance')
        .select('id')
        .eq('user_id', employee.id)
        .eq('date', today)
        .single();

      if (existingAttendance) {
        skippedCount++;
        continue;
      }

      // Crea la presenza automatica
      const { error: attendanceError } = await supabase
        .from('attendance')
        .insert({
          user_id: employee.id,
          date: today,
          notes: `Presenza automatica per orario ${schedule.start_time}-${schedule.end_time}`
        });

      if (attendanceError) {
        console.error(`Errore creazione presenza per ${employee.first_name}:`, attendanceError);
        continue;
      }

      generatedCount++;
    }

    res.json({
      success: true,
      message: `Presenze generate: ${generatedCount} nuove, ${skippedCount} già esistenti`,
      generated: generatedCount,
      skipped: skippedCount,
      total: employees.length
    });
  } catch (error) {
    console.error('Errore generazione presenze per oggi:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Calculate real-time hours for today
app.get('/api/attendance/current-hours', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { date: today, time: currentTime, dateTime: now, isTestMode } = await getCurrentDateTime();
    
    console.log(`🕐 [current-hours] User: ${req.user.email}, Date: ${today}, Time: ${currentTime}, TestMode: ${isTestMode}`);
    
    // Ottieni l'orario di lavoro per oggi
    const dayOfWeek = now.getDay();
    console.log(`📅 [current-hours] Day of week: ${dayOfWeek} (0=Dom, 1=Lun, 5=Ven)`);
    
    const { data: schedule, error: scheduleError } = await supabase
      .from('work_schedules')
      .select('*')
      .eq('user_id', userId)
      .eq('day_of_week', dayOfWeek)
      .eq('is_working_day', true)
      .single();

    if (scheduleError || !schedule) {
      console.log(`❌ [current-hours] No schedule found:`, scheduleError);
      console.log(`🔧 [current-hours] Creating default schedules for user ${userId}...`);
      
      // Crea orari di default per tutti i giorni
      const defaultSchedules = [
        { user_id: userId, day_of_week: 1, is_working_day: true, start_time: '09:00', end_time: '18:00', break_duration: 60 }, // Lunedì
        { user_id: userId, day_of_week: 2, is_working_day: true, start_time: '09:00', end_time: '18:00', break_duration: 60 }, // Martedì
        { user_id: userId, day_of_week: 3, is_working_day: true, start_time: '09:00', end_time: '18:00', break_duration: 60 }, // Mercoledì
        { user_id: userId, day_of_week: 4, is_working_day: true, start_time: '09:00', end_time: '18:00', break_duration: 60 }, // Giovedì
        { user_id: userId, day_of_week: 5, is_working_day: true, start_time: '09:00', end_time: '18:00', break_duration: 60 }, // Venerdì
        { user_id: userId, day_of_week: 6, is_working_day: false, start_time: '09:00', end_time: '18:00', break_duration: 60 }, // Sabato
        { user_id: userId, day_of_week: 0, is_working_day: false, start_time: '09:00', end_time: '18:00', break_duration: 60 }  // Domenica
      ];
      
      const { error: createError } = await supabase
        .from('work_schedules')
        .insert(defaultSchedules);
      
      if (createError) {
        console.error(`❌ [current-hours] Failed to create default schedules:`, createError);
        return res.json({
          isWorkingDay: false,
          message: 'Nessun orario di lavoro per oggi'
        });
      }
      
      console.log(`✅ [current-hours] Default schedules created! Retrying...`);
      
      // Riprova a recuperare lo schedule
      const { data: retrySchedule, error: retryError } = await supabase
        .from('work_schedules')
        .select('*')
        .eq('user_id', userId)
        .eq('day_of_week', dayOfWeek)
        .eq('is_working_day', true)
        .single();
      
      if (retryError || !retrySchedule) {
        return res.json({
          isWorkingDay: false,
          message: 'Nessun orario di lavoro per oggi'
        });
      }
      
      // Usa il nuovo schedule
      schedule = retrySchedule;
    }
    
    console.log(`✅ [current-hours] Schedule found: ${schedule.start_time}-${schedule.end_time}, break: ${schedule.break_duration}min`);

    // Recupera permessi approvati per oggi per questo utente
    const { data: permissionsToday, error: permError } = await supabase
      .from('leave_requests')
      .select('hours, permission_type, exit_time, entry_time')
      .eq('user_id', userId)
      .eq('type', 'permission')
      .eq('status', 'approved')
      .lte('start_date', today)
      .gte('end_date', today);
    
    let permissionData = null;
    if (permissionsToday && !permError && permissionsToday.length > 0) {
      // Aggrega i permessi per oggi
      let totalHours = 0;
      let exitTime = null;
      let entryTime = null;
      const permissionTypes = new Set();
      
      permissionsToday.forEach(perm => {
        totalHours += parseFloat(perm.hours || 0);
        if (perm.permission_type === 'early_exit' && perm.exit_time) {
          permissionTypes.add('early_exit');
          if (!exitTime || perm.exit_time < exitTime) {
            exitTime = perm.exit_time;
          }
        }
        if (perm.permission_type === 'late_entry' && perm.entry_time) {
          permissionTypes.add('late_entry');
          if (!entryTime || perm.entry_time > entryTime) {
            entryTime = perm.entry_time;
          }
        }
      });
      
      if (exitTime || entryTime) {
        permissionData = { hours: totalHours, permission_types: Array.from(permissionTypes), exit_time: exitTime, entry_time: entryTime };
        console.log(`🚪 Permessi trovati: [${permissionData.permission_types.join(', ')}], exit=${exitTime}, entry=${entryTime}`);
      }
    }

    // USA LA FUNZIONE CENTRALIZZATA per calcolare le ore
    const { actualHours, expectedHours, contractHours, balanceHours, remainingHours, status } = calculateRealTimeHours(
      schedule,
      currentTime,
      permissionData
    );
    
    console.log(`📊 [current-hours] Result: actual=${actualHours}h, expected=${expectedHours}h, contract=${contractHours}h, balance=${balanceHours}h, status=${status}`);

    res.json({
      isWorkingDay: true,
      schedule: {
        start_time: schedule.start_time,
        end_time: schedule.end_time,
        break_duration: schedule.break_duration || 60
      },
      currentTime,
      expectedHours,
      contractHours,
      actualHours,
      balanceHours,
      remainingHours,
      status,
      progress: expectedHours > 0 ? Math.min((actualHours / expectedHours) * 100, 100) : 100
    });
  } catch (error) {
    console.error('Current hours calculation error:', error);
    res.status(500).json({ error: 'Errore nel calcolo delle ore correnti' });
  }
});

// Update attendance with real-time hours
app.put('/api/attendance/update-current', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const today = new Date().toISOString().split('T')[0];
    const now = new Date();
    const currentTime = now.toTimeString().substring(0, 5); // HH:MM format
    
    console.log(`🔄 Update current attendance for user ${userId}, today: ${today}, current time: ${currentTime}`);
    
    // Ottieni l'orario di lavoro per oggi
    const dayOfWeek = now.getDay();
    console.log(`📅 Day of week: ${dayOfWeek}`);
    
    const { data: schedule, error: scheduleError } = await supabase
      .from('work_schedules')
      .select('*')
      .eq('user_id', userId)
      .eq('day_of_week', dayOfWeek)
      .eq('is_working_day', true)
      .single();

    console.log(`📋 Schedule query result:`, { schedule, error: scheduleError });

    if (scheduleError || !schedule) {
      console.log(`❌ No working schedule found for user ${userId} on day ${dayOfWeek}`);
      return res.status(400).json({ error: 'Nessun orario di lavoro per oggi' });
    }

    // Recupera permessi approvati per oggi (early_exit/late_entry)
    const { data: permissionsToday } = await supabase
      .from('leave_requests')
      .select('hours, permission_type, exit_time, entry_time')
      .eq('user_id', userId)
      .eq('type', 'permission')
      .eq('status', 'approved')
      .lte('start_date', today)
      .gte('end_date', today);
    
    let permissionData = null;
    if (permissionsToday && permissionsToday.length > 0) {
      let totalHours = 0;
      let exitTime = null;
      let entryTime = null;
      const permissionTypes = new Set();
      
      permissionsToday.forEach(perm => {
        totalHours += parseFloat(perm.hours || 0);
        if (perm.permission_type === 'early_exit' && perm.exit_time) {
          permissionTypes.add('early_exit');
          if (!exitTime || perm.exit_time < exitTime) {
            exitTime = perm.exit_time;
          }
        }
        if (perm.permission_type === 'late_entry' && perm.entry_time) {
          permissionTypes.add('late_entry');
          if (!entryTime || perm.entry_time > entryTime) {
            entryTime = perm.entry_time;
          }
        }
      });
      
      if (exitTime || entryTime) {
        permissionData = { hours: totalHours, permission_types: Array.from(permissionTypes), exit_time: exitTime, entry_time: entryTime };
      }
    }

    // USA LA FUNZIONE CENTRALIZZATA per calcolare le ore
    const { actualHours, expectedHours, contractHours, balanceHours, status } = calculateRealTimeHours(
      schedule,
      currentTime,
      permissionData
    );
    
    console.log(`📊 Calculated (centralized): expected=${expectedHours.toFixed(2)}h (contract=${contractHours.toFixed(2)}h), actual=${actualHours.toFixed(2)}h, balance=${balanceHours.toFixed(2)}h, status=${status}`);

    // Aggiorna o crea la presenza per oggi
    const { data: existingAttendance } = await supabase
      .from('attendance')
      .select('id')
      .eq('user_id', userId)
      .eq('date', today)
      .single();

    if (existingAttendance) {
      // Aggiorna presenza esistente (aggiorna anche expected_hours per sicurezza)
      const { error: updateError } = await supabase
        .from('attendance')
        .update({
          actual_hours: actualHours,
          expected_hours: contractHours,
          balance_hours: balanceHours,
          notes: `Aggiornato alle ${currentTime} - ${status}`
        })
        .eq('id', existingAttendance.id);

      if (updateError) {
        console.error('Update attendance error:', updateError);
        return res.status(500).json({ error: 'Errore nell\'aggiornamento della presenza' });
      }
      console.log(`✅ Updated existing attendance record`);
    } else {
      // Crea nuova presenza
      const { error: insertError } = await supabase
        .from('attendance')
        .insert({
          user_id: userId,
          date: today,
          expected_hours: contractHours,
          actual_hours: actualHours,
          balance_hours: balanceHours,
          notes: `Presenza aggiornata alle ${currentTime} - ${status}`
        });

      if (insertError) {
        console.error('Insert attendance error:', insertError);
        return res.status(500).json({ error: 'Errore nella creazione della presenza' });
      }
      console.log(`✅ Created new attendance record`);
    }

    res.json({
      success: true,
      message: 'Presenza aggiornata con successo',
      hours: {
        isWorkingDay: true,
        schedule: {
          start_time,
          end_time,
          break_duration: break_duration || 60
        },
        currentTime,
        expectedHours: Math.round(expectedHours * 10) / 10,
        contractHours: Math.round(contractHours * 10) / 10,
        actualHours: Math.round(actualHours * 10) / 10,
        balanceHours: Math.round(balanceHours * 10) / 10,
        remainingHours: Math.round(remainingHours * 10) / 10,
        status,
        progress: expectedHours > 0 ? Math.min((actualHours / expectedHours) * 100, 100) : 100
      }
    });
  } catch (error) {
    console.error('Update current attendance error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Get attendance details for a user and date
app.get('/api/attendance/details', authenticateToken, async (req, res) => {
  try {
    const { date, userId } = req.query;
    
    if (!date) {
      return res.status(400).json({ error: 'Data richiesta' });
    }

    const targetUserId = userId || req.user.id;
    
    // Verifica permessi: admin può vedere tutti, employee solo i propri
    if (req.user.role === 'employee' && targetUserId !== req.user.id) {
      return res.status(403).json({ error: 'Accesso negato' });
    }

    // Ottieni i dettagli dalla tabella attendance
    const { data: attendance, error } = await supabase
      .from('attendance')
      .select(`
        *,
        users!inner(first_name, last_name, email)
      `)
      .eq('user_id', targetUserId)
      .eq('date', date)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // Nessun record trovato
        return res.json({
          success: true,
          details: null,
          message: 'Nessun dettaglio disponibile per questa data'
        });
      }
      console.error('Attendance details fetch error:', error);
      return res.status(500).json({ error: 'Errore nel recupero dei dettagli' });
    }

    // Ottieni anche l'orario di lavoro per quel giorno
    const dayOfWeek = new Date(date).getDay();
    const { data: schedule } = await supabase
      .from('work_schedules')
      .select('*')
      .eq('user_id', targetUserId)
      .eq('day_of_week', dayOfWeek)
      .single();

    const { date: today, time: currentTime } = await getCurrentDateTime();
    
    let actualHours = attendance.actual_hours || 0;
    let expectedHours = attendance.expected_hours || 8;
    let contractHours = attendance.expected_hours || 8;
    let remainingHours = Math.max(0, expectedHours - actualHours);
    let balanceHours = attendance.balance_hours || 0;
    
    // Se è oggi (o data simulata), calcola le ore real-time usando la logica corretta
    if (date === today && schedule) {
      // Recupera permessi per oggi
      const { data: permissionsToday } = await supabase
        .from('leave_requests')
        .select('hours, permission_type, exit_time, entry_time')
        .eq('user_id', targetUserId)
        .eq('type', 'permission')
        .eq('status', 'approved')
        .lte('start_date', today)
        .gte('end_date', today);
      
      let permissionData = null;
      if (permissionsToday && permissionsToday.length > 0) {
        let totalHours = 0;
        let exitTime = null;
        let entryTime = null;
        const permissionTypes = new Set();
        
        permissionsToday.forEach(perm => {
          totalHours += parseFloat(perm.hours || 0);
          if (perm.permission_type === 'early_exit' && perm.exit_time) {
            permissionTypes.add('early_exit');
            if (!exitTime || perm.exit_time < exitTime) {
              exitTime = perm.exit_time;
            }
          }
          if (perm.permission_type === 'late_entry' && perm.entry_time) {
            permissionTypes.add('late_entry');
            if (!entryTime || perm.entry_time > entryTime) {
              entryTime = perm.entry_time;
            }
          }
        });
        
        if (exitTime || entryTime) {
          permissionData = { hours: totalHours, permission_types: Array.from(permissionTypes), exit_time: exitTime, entry_time: entryTime };
        }
      }
      
      // USA LA FUNZIONE CENTRALIZZATA con data/ora simulate se in test mode
      const result = calculateRealTimeHours(schedule, currentTime, permissionData);
      actualHours = result.actualHours;
      expectedHours = result.expectedHours;
      contractHours = result.contractHours;
      remainingHours = result.remainingHours;
      balanceHours = result.balanceHours;
      
      console.log(`🔄 Attendance details for today: real-time calculation (centralized) - actual=${actualHours.toFixed(2)}h, expected=${expectedHours.toFixed(2)}h (contract=${contractHours.toFixed(2)}h), balance=${balanceHours.toFixed(2)}h`);
    }

    res.json({
      success: true,
      details: {
        attendance,
        schedule,
        summary: {
          date: attendance.date,
          employee: `${attendance.users.first_name} ${attendance.users.last_name}`,
          expectedHours: Math.round(contractHours * 10) / 10,
          effectiveExpectedHours: Math.round(expectedHours * 10) / 10,
          actualHours: Math.round(actualHours * 10) / 10,
          remainingHours: Math.round((remainingHours ?? Math.max(0, contractHours - actualHours)) * 10) / 10,
          balanceHours: Math.round(balanceHours * 10) / 10,
          status: actualHours > 0 ? 'Presente' : 'Assente',
          notes: attendance.notes || 'Nessuna nota'
        }
      }
    });
  } catch (error) {
    console.error('Attendance details error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

/**
 * Admin utility endpoint to recalculate attendance for a specific user/date.
 * Body: { userId: string, date?: 'YYYY-MM-DD', time?: 'HH:MM' }
 */
app.post('/api/admin/fix-attendance', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId, date, time } = req.body || {};

    if (!userId) {
      return res.status(400).json({ error: 'userId richiesto' });
    }

    const targetDate = date || new Date().toISOString().split('T')[0];
    const dayOfWeek = new Date(targetDate).getDay();

    const { data: schedule, error: scheduleError } = await supabase
      .from('work_schedules')
      .select('*')
      .eq('user_id', userId)
      .eq('day_of_week', dayOfWeek)
      .eq('is_working_day', true)
      .single();

    if (scheduleError || !schedule) {
      return res.status(404).json({ error: 'Nessun orario di lavoro configurato per questa data' });
    }

    const { data: permissionsToday, error: permError } = await supabase
      .from('leave_requests')
      .select('hours, permission_type, exit_time, entry_time')
      .eq('user_id', userId)
      .eq('type', 'permission')
      .eq('status', 'approved')
      .lte('start_date', targetDate)
      .gte('end_date', targetDate);

    if (permError) {
      console.error('❌ Fix attendance permission fetch error:', permError);
      return res.status(500).json({ error: 'Errore nel recupero dei permessi' });
    }

    let permissionData = null;
    if (permissionsToday && permissionsToday.length > 0) {
      let totalHours = 0;
      let exitTime = null;
      let entryTime = null;
      const permissionTypes = new Set();

      permissionsToday.forEach(perm => {
        totalHours += parseFloat(perm.hours || 0);
        if (perm.permission_type === 'early_exit' && perm.exit_time) {
          permissionTypes.add('early_exit');
          if (!exitTime || perm.exit_time < exitTime) {
            exitTime = perm.exit_time;
          }
        }
        if (perm.permission_type === 'late_entry' && perm.entry_time) {
          permissionTypes.add('late_entry');
          if (!entryTime || perm.entry_time > entryTime) {
            entryTime = perm.entry_time;
          }
        }
      });

      if (exitTime || entryTime) {
        permissionData = {
          hours: totalHours,
          permission_types: Array.from(permissionTypes),
          exit_time: exitTime,
          entry_time: entryTime
        };
      }
    }

    const calculationTime = time || permissionData?.exit_time || schedule.end_time;

    const { actualHours, expectedHours, contractHours, balanceHours, remainingHours, status } = calculateRealTimeHours(
      schedule,
      calculationTime,
      permissionData
    );

    const upsertPayload = {
      user_id: userId,
      date: targetDate,
      expected_hours: contractHours,
      actual_hours: actualHours,
      balance_hours: balanceHours,
      notes: `Ricalcolato manualmente alle ${calculationTime} (status: ${status})`
    };

    const { error: upsertError } = await supabase
      .from('attendance')
      .upsert(upsertPayload, { onConflict: 'user_id,date' });

    if (upsertError) {
      console.error('❌ Fix attendance upsert error:', upsertError);
      return res.status(500).json({ error: 'Errore durante l\'aggiornamento della presenza' });
    }

    res.json({
      success: true,
      message: 'Presenza ricalcolata correttamente',
      data: {
        date: targetDate,
        userId,
        calculationTime,
        expectedHours,
        contractHours,
        actualHours,
        balanceHours,
        remainingHours,
        status,
        permissionData
      }
    });
  } catch (error) {
    console.error('❌ Fix attendance error:', error);
    res.status(500).json({ error: 'Errore interno durante il ricalcolo' });
  }
});

// Update attendance detail status
app.put('/api/attendance/details/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    // Verifica che il dettaglio esista e appartenga all'utente
    const { data: detail, error: fetchError } = await supabase
      .from('attendance_details')
      .select(`
        *,
        attendance!inner(user_id)
      `)
      .eq('id', id)
      .single();

    if (fetchError || !detail) {
      return res.status(404).json({ error: 'Dettaglio non trovato' });
    }

    // Verifica permessi
    if (req.user.role === 'employee' && detail.attendance.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Accesso negato' });
    }

    const { data: updatedDetail, error: updateError } = await supabase
      .from('attendance_details')
      .update({
        status,
        notes,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Update detail error:', updateError);
      return res.status(500).json({ error: 'Errore nell\'aggiornamento' });
    }

    res.json({
      success: true,
      message: 'Dettaglio aggiornato con successo',
      detail: updatedDetail
    });
  } catch (error) {
    console.error('Update detail error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// ==================== LEAVE REQUESTS API ====================

// ==================== USER ATTENDANCE STATS ====================

// Get user attendance statistics
app.get('/api/attendance/user-stats', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const today = new Date().toISOString().split('T')[0];
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();

    // Check if user is clocked in today
    const { data: todayAttendance, error: todayError } = await supabase
      .from('attendance')
      .select('clock_in, clock_out')
      .eq('user_id', userId)
      .eq('date', today)
      .single();

    let isClockedIn = false;
    let todayHours = '0h 0m';
    
    if (todayAttendance && !todayError) {
      isClockedIn = !!todayAttendance.clock_in && !todayAttendance.clock_out;
      if (todayAttendance.clock_in && todayAttendance.clock_out) {
        const clockIn = new Date(todayAttendance.clock_in);
        const clockOut = new Date(todayAttendance.clock_out);
        const hours = (clockOut - clockIn) / (1000 * 60 * 60);
        const h = Math.floor(hours);
        const m = Math.floor((hours - h) * 60);
        todayHours = `${h}h ${m}m`;
      } else if (todayAttendance.clock_in) {
        const clockIn = new Date(todayAttendance.clock_in);
        const now = new Date();
        const hours = (now - clockIn) / (1000 * 60 * 60);
        const h = Math.floor(hours);
        const m = Math.floor((hours - h) * 60);
        todayHours = `${h}h ${m}m`;
      }
    }

    // Count monthly presences (giorni con check_in)
    const { count: daysWithAttendance, error: monthlyError } = await supabase
      .from('attendance')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('date', `${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`)
      .lt('date', `${currentYear}-${(currentMonth + 1).toString().padStart(2, '0')}-01`)
      .not('clock_in', 'is', null);

    // Count approved leave days in this month
    const { count: approvedLeaveDays } = await supabase
      .from('leave_requests')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'approved')
      .in('type', ['permission', 'sick', 'vacation'])
      .gte('start_date', `${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`)
      .lt('end_date', `${currentYear}-${(currentMonth + 1).toString().padStart(2, '0')}-01`);

    // Monthly presences = days with attendance + approved leave days
    const monthlyPresences = (daysWithAttendance || 0) + (approvedLeaveDays || 0);

    // Get user workplace from profile
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('workplace')
      .eq('id', userId)
      .single();

    res.json({
      isClockedIn,
      todayHours,
      monthlyPresences: monthlyPresences || 0,
      expectedMonthlyPresences: 20, // Standard working days per month
      workplace: userData?.workplace || 'LABA Firenze - Sede Via Vecchietti'
    });

  } catch (error) {
    console.error('User attendance stats error:', error);
    res.status(500).json({ error: 'Errore nel recupero delle statistiche' });
  }
});

// ==================== LEAVE BALANCES API ====================

// Get user leave balances (vacation, sick, permissions)
app.get('/api/leave-balances', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { year = new Date().getFullYear() } = req.query;

    const { data: balances, error } = await supabase
      .from('leave_balances')
      .select('*')
      .eq('user_id', userId)
      .eq('year', year);

    if (error) {
      console.error('Leave balances error:', error);
      return res.status(500).json({ error: 'Errore nel recupero dei saldi' });
    }

    // Format data for frontend
    const formattedBalances = {
      vacation: {
        total: 26, // Base Italian vacation days
        used: 0,
        pending: 0,
        remaining: 26
      },
      sick: {
        total: 180, // Annual sick days
        used: 0,
        pending: 0,
        remaining: 180
      },
      permission: {
        total: 104, // Annual permission hours
        used: 0,
        pending: 0,
        remaining: 104
      }
    };

    // Update with real data if available
    balances.forEach(balance => {
      if (balance.leave_type === 'vacation') {
        formattedBalances.vacation = {
          total: balance.total_entitled,
          used: balance.used,
          pending: balance.pending,
          remaining: balance.remaining
        };
      } else if (balance.leave_type === 'sick') {
        formattedBalances.sick = {
          total: balance.total_entitled,
          used: balance.used,
          pending: balance.pending,
          remaining: balance.remaining
        };
      } else if (balance.leave_type === 'permission') {
        formattedBalances.permission = {
          total: balance.total_entitled,
          used: balance.used,
          pending: balance.pending,
          remaining: balance.remaining
        };
      }
    });

    res.json(formattedBalances);

  } catch (error) {
    console.error('Leave balances error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// ==================== LEAVE REQUESTS ENDPOINTS ====================

// Get all leave requests (admin) or user's requests
app.get('/api/leave-requests', authenticateToken, async (req, res) => {
  try {
    const { month, year, type } = req.query;
    const targetUserId = req.user.role === 'admin' && req.query.userId ? req.query.userId : req.user.id;
    
    // IMPORTANTE: Leggi SEMPRE da leave_requests (dati reali)
    // La modalità test viene usata solo per i calcoli real-time (orario simulato)
    // I dati di test vengono salvati in test_leave_requests, ma per la visualizzazione usiamo sempre i dati reali
    let query = supabase
      .from('leave_requests')
      .select(`
        *,
        users!leave_requests_user_id_fkey(first_name, last_name, email),
        approver:users!leave_requests_approved_by_fkey(first_name, last_name, email)
      `)
      .order('created_at', { ascending: false });

    // Filter by type if provided (vacation, sick_leave, permission, etc.)
    if (type) {
      query = query.eq('type', type);
    }

    // Filter by month/year if provided
    if (month && year) {
      const startDate = new Date(year, month - 1, 1).toISOString();
      const endDate = new Date(year, month, 0).toISOString();
      query = query.gte('start_date', startDate).lte('end_date', endDate);
    }

    // If not admin, only show user's own requests
    if (req.user.role !== 'admin') {
      query = query.eq('user_id', req.user.id);
    }

    const { data: requests, error } = await query;

    if (error) {
      console.error('Leave requests fetch error:', error);
      return res.status(500).json({ error: 'Errore nel recupero delle richieste' });
    }

    const formattedRequests = requests.map(req => ({
      id: req.id,
      type: req.type,
      startDate: req.start_date,
      endDate: req.end_date,
      reason: req.reason,
      status: req.status,
      submittedAt: req.created_at,
      approvedAt: req.approved_at,
      approvedBy: req.approved_by,
      approver: req.approver ? {
        id: req.approver.id,
        name: `${req.approver.first_name} ${req.approver.last_name}`,
        email: req.approver.email
      } : null,
      notes: req.notes,
      // Campi specifici per permessi
      permissionType: req.permission_type,
      hours: req.hours,
      exitTime: req.exit_time,
      entryTime: req.entry_time,
      permissionDate: req.start_date, // Per compatibilità
      user: {
        id: req.users.id,
        name: `${req.users.first_name} ${req.users.last_name}`,
        email: req.users.email,
        department: 'Non specificato'
      },
      submittedBy: `${req.users.first_name} ${req.users.last_name}` // Per compatibilità con frontend
    }));

    res.json(formattedRequests);
  } catch (error) {
    console.error('Leave requests fetch error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Get permission hours for a specific user and date
app.get('/api/leave-requests/permission-hours', authenticateToken, async (req, res) => {
  try {
    const { userId, date } = req.query;

    if (!date) {
      return res.status(400).json({ error: 'Data richiesta mancante' });
    }

    // Se non è admin, può vedere solo i propri permessi
    const targetUserId = req.user.role === 'admin' && userId ? userId : req.user.id;

    // Recupera permessi approvati per questo giorno
    const { data: permissions, error } = await supabase
      .from('leave_requests')
      .select('type, hours, permission_type, exit_time, entry_time')
      .eq('user_id', targetUserId)
      .eq('status', 'approved')
      .lte('start_date', date)
      .gte('end_date', date);

    if (error) {
      console.error('Permission hours fetch error:', error);
      return res.status(500).json({ error: 'Errore nel recupero dei permessi' });
    }

    // Calcola le ore totali di permesso per questo giorno
    let totalPermissionHours = 0;
    const permissionDetails = [];

    if (permissions && permissions.length > 0) {
      permissions.forEach(perm => {
        // Solo per permessi normali (non 104, non malattia, non ferie)
        if (perm.type === 'permission' && perm.hours && perm.hours > 0) {
          totalPermissionHours += parseFloat(perm.hours);
          permissionDetails.push({
            type: perm.permission_type,
            hours: perm.hours,
            exitTime: perm.exit_time,
            entryTime: perm.entry_time
          });
        }
      });
    }

    console.log(`📊 Permission hours for user ${targetUserId} on ${date}:`, totalPermissionHours);

    res.json({
      success: true,
      date,
      userId: targetUserId,
      totalPermissionHours: parseFloat(totalPermissionHours.toFixed(2)),
      permissions: permissionDetails
    });
  } catch (error) {
    console.error('Permission hours error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Create leave request
app.post('/api/leave-requests', authenticateToken, async (req, res) => {
  try {
    const { type, startDate, endDate, reason, notes, permissionType, hours, exitTime, entryTime, doctor } = req.body;

    const normalizeTime = (value) => {
      if (value === null || value === undefined) return null;
      if (typeof value === 'string' && value.trim() === '') return null;
      return value;
    };

    const normalizeHours = (value) => {
      if (value === null || value === undefined || value === '') return null;
      const numericValue = typeof value === 'number' ? value : parseFloat(value);
      return Number.isFinite(numericValue) ? numericValue : null;
    };

    // Validation
    if (!type || !startDate || !endDate) {
      return res.status(400).json({ error: 'Campi obbligatori mancanti' });
    }
    
    // Reason is required only for certain types
    if (type !== 'vacation' && type !== 'permission' && type !== 'permission_104' && !reason) {
      return res.status(400).json({ error: 'Motivo richiesto per questo tipo di richiesta' });
    }

    // Validazione specifica per FERIE (separata dalla banca ore)
    if (type === 'vacation') {
      // Verifica che ci sia un periodo aperto per le date richieste
      const { data: periods, error: periodsError } = await supabase
        .from('vacation_periods')
        .select('*')
        .eq('is_open', true)
        .lte('start_date', startDate)
        .gte('end_date', endDate);

      if (periodsError) {
        console.error('Error checking vacation periods:', periodsError);
        return res.status(500).json({ error: 'Errore nella verifica dei periodi ferie' });
      }

      if (!periods || periods.length === 0) {
        return res.status(400).json({ 
          error: 'Non ci sono periodi di richiesta ferie aperti per le date selezionate',
          startDate,
          endDate
        });
      }

      // Verifica che tutte le date richieste siano nei periodi validi per le ferie
      const start = new Date(startDate);
      const end = new Date(endDate);
      let invalidDates = [];

      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        const isInValidPeriod = periods.some(period => 
          dateStr >= period.vacation_start_date && dateStr <= period.vacation_end_date
        );

        if (!isInValidPeriod) {
          invalidDates.push(dateStr);
        }
      }

      if (invalidDates.length > 0) {
        return res.status(400).json({ 
          error: 'Alcune date richieste non sono disponibili nei periodi aperti',
          invalidDates
        });
      }

      // Verifica bilancio ferie (giorni, non ore)
      const currentYear = new Date(startDate).getFullYear();
      const daysRequested = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

      // Recupera o crea bilancio ferie
      let { data: balance, error: balanceError } = await supabase
        .from('vacation_balances')
        .select('*')
        .eq('user_id', req.user.id)
        .eq('year', currentYear)
        .single();

      if (balanceError && balanceError.code === 'PGRST116') {
        // Nessun bilancio trovato, creane uno nuovo con 30 giorni
        const { data: newBalance, error: createError } = await supabase
          .from('vacation_balances')
          .insert([{
            user_id: req.user.id,
            year: currentYear,
            total_days: 30,
            used_days: 0,
            pending_days: 0,
            remaining_days: 30
          }])
          .select()
          .single();

        if (createError) {
          console.error('Vacation balance creation error:', createError);
          return res.status(500).json({ error: 'Errore nella creazione del bilancio ferie' });
        }

        balance = newBalance;
      } else if (balanceError) {
        console.error('Vacation balance fetch error:', balanceError);
        return res.status(500).json({ error: 'Errore nel recupero del bilancio ferie' });
      }

      // Calcola pending_days dalle richieste in attesa
      const { data: pendingRequests, error: pendingError } = await supabase
        .from('leave_requests')
        .select('days_requested')
        .eq('user_id', req.user.id)
        .eq('type', 'vacation')
        .eq('status', 'pending')
        .gte('start_date', `${currentYear}-01-01`)
        .lte('end_date', `${currentYear}-12-31`);

      let pendingDays = 0;
      if (!pendingError && pendingRequests) {
        pendingDays = pendingRequests.reduce((sum, req) => sum + (req.days_requested || 0), 0);
      }

      const remainingDays = (balance.total_days || 30) - (balance.used_days || 0) - pendingDays;

      if (daysRequested > remainingDays) {
        return res.status(400).json({ 
          error: 'Giorni di ferie insufficienti',
          requested: daysRequested,
          available: remainingDays,
          totalDays: balance.total_days || 30,
          usedDays: balance.used_days || 0,
          pendingDays
        });
      }
    }

    // Validazione specifica per permessi 104
    if (type === 'permission_104') {
      // Verifica che l'utente abbia la 104
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('has_104')
        .eq('id', req.user.id)
        .single();

      if (userError || !userData || !userData.has_104) {
        return res.status(403).json({ error: 'Non hai diritto ai permessi legge 104' });
      }

      // Verifica limite mensile (3 permessi al mese)
      const currentMonth = new Date(startDate).getMonth() + 1;
      const currentYear = new Date(startDate).getFullYear();
      
      const { count, error: countError } = await supabase
        .from('leave_requests')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', req.user.id)
        .eq('type', 'permission_104')
        .in('status', ['approved', 'pending'])
        .gte('start_date', `${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`)
        .lt('start_date', `${currentYear}-${(currentMonth + 1).toString().padStart(2, '0')}-01`);

      if (countError) {
        console.error('Error checking 104 limit:', countError);
        return res.status(500).json({ error: 'Errore nella verifica del limite permessi 104' });
      }

      if (count >= 3) {
        const monthName = new Date(currentYear, currentMonth - 1, 1).toLocaleDateString('it-IT', { month: 'long' });
        return res.status(400).json({ 
          error: `Hai già utilizzato tutti e 3 i permessi 104 per ${monthName} ${currentYear}`,
          usedCount: count,
          maxCount: 3
        });
      }
    }

    // Calcola i giorni richiesti
    const start = new Date(startDate);
    const end = new Date(endDate);
    const daysRequested = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

    // Calcola le ore effettive per i permessi con orari specifici
    let calculatedHours = hours;
    if (type === 'permission' && (exitTime || entryTime) && permissionType) {
      try {
        // Ottieni il work_schedule dell'utente per il giorno specifico
        const permissionDate = new Date(startDate);
        const dayOfWeek = permissionDate.getDay(); // 0 = Domenica, 1 = Lunedì, etc.

        const { data: workSchedule, error: scheduleError } = await supabase
          .from('work_schedules')
          .select('start_time, end_time, is_working_day')
          .eq('user_id', req.user.id)
          .eq('day_of_week', dayOfWeek)
          .single();

        if (!scheduleError && workSchedule && workSchedule.is_working_day) {
          // Funzione helper per convertire HH:MM in minuti
          const timeToMinutes = (timeStr) => {
            const [hours, minutes] = timeStr.split(':').map(Number);
            return hours * 60 + minutes;
          };

          const standardStartMinutes = timeToMinutes(workSchedule.start_time);
          const standardEndMinutes = timeToMinutes(workSchedule.end_time);

          if (permissionType === 'early_exit' && exitTime) {
            // Uscita anticipata: calcola da exitTime alla fine standard
            const exitMinutes = timeToMinutes(exitTime);
            const minutesDiff = standardEndMinutes - exitMinutes;
            calculatedHours = parseFloat((minutesDiff / 60).toFixed(2));
            console.log(`🕐 Uscita anticipata calcolata: ${exitTime} -> ${workSchedule.end_time} = ${calculatedHours} ore`);
          } else if (permissionType === 'late_entry' && entryTime) {
            // Entrata posticipata: calcola dall'inizio standard a entryTime
            const entryMinutes = timeToMinutes(entryTime);
            const minutesDiff = entryMinutes - standardStartMinutes;
            calculatedHours = parseFloat((minutesDiff / 60).toFixed(2));
            console.log(`🕐 Entrata posticipata calcolata: ${workSchedule.start_time} -> ${entryTime} = ${calculatedHours} ore`);
          }
        } else {
          console.warn('⚠️ Orario di lavoro non trovato per questo giorno, usando 0 ore');
          calculatedHours = 0;
        }
      } catch (calcError) {
        console.error('❌ Errore nel calcolo delle ore:', calcError);
        // Se c'è un errore, mantieni il valore passato o usa 0
        calculatedHours = hours || 0;
      }
    }

    // Prepara i dati per l'inserimento, escludendo i campi che potrebbero non esistere
    const insertData = {
      user_id: req.user.id,
      type: type, // 'permission', 'sick', 'vacation', 'permission_104'
      start_date: startDate,
      end_date: endDate,
      reason: reason || (type === 'vacation' ? 'Ferie' : type === 'permission_104' ? 'Permesso Legge 104' : ''),
      status: type === 'permission_104' ? 'approved' : 'pending', // Auto-approva permessi 104
      submitted_at: new Date().toISOString(),
      days_requested: daysRequested
    };

    // Se è permesso 104, aggiungi auto-approvazione
    if (type === 'permission_104') {
      insertData.approved_at = new Date().toISOString();
      insertData.approved_by = req.user.id; // Auto-approvato
    }

    // Aggiungi campi opzionali solo se sono definiti
    if (notes !== undefined) insertData.notes = notes;
    if (doctor !== undefined) insertData.doctor = doctor;
    if (permissionType !== undefined) insertData.permission_type = permissionType;
    
    // Per FERIE: non salvare ore (sono giorni interi, non ore)
    // Per PERMESSI: salva le ore calcolate
    if (type !== 'vacation') {
      const normalizedHours = normalizeHours(calculatedHours);
      if (normalizedHours !== null) {
        insertData.hours = normalizedHours; // Usa le ore calcolate solo per permessi
      }
    }

    const normalizedExitTime = normalizeTime(exitTime);
    const normalizedEntryTime = normalizeTime(entryTime);

    if (normalizedExitTime !== null) insertData.exit_time = normalizedExitTime;
    if (normalizedEntryTime !== null) insertData.entry_time = normalizedEntryTime;

    console.log('🔧 Inserting leave request with data:', insertData);

    const { data: newRequest, error } = await supabase
      .from('leave_requests')
      .insert([insertData])
      .select()
      .single();

    if (error) {
      console.error('❌ Leave request creation error:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      console.error('Insert data that failed:', JSON.stringify(insertData, null, 2));
      return res.status(500).json({ error: 'Errore nella creazione della richiesta' });
    }

    console.log('✅ Leave request created successfully:', newRequest.id);

    // Recupera i dati dell'utente che ha fatto la richiesta
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('first_name, last_name, email')
      .eq('id', req.user.id)
      .single();

    if (userError) {
      console.error('Errore nel recupero dati utente per notifica:', userError);
    }

    const userName = userData ? `${userData.first_name} ${userData.last_name}` : 'Dipendente';
    
    // Parse date as local time to avoid UTC timezone issues
    const parseLocalDate = (dateStr) => {
      if (!dateStr || typeof dateStr !== 'string') {
        console.error('⚠️ Invalid date string:', dateStr);
        return new Date();
      }
      // Ensure format is YYYY-MM-DD
      const dateMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (!dateMatch) {
        console.error('⚠️ Date format not recognized:', dateStr);
        return new Date(dateStr);
      }
      const [, year, month, day] = dateMatch.map(Number);
      const parsedDate = new Date(year, month - 1, day);
      console.log(`📅 Parsing date: ${dateStr} -> ${year}-${month}-${day} -> ${parsedDate.toLocaleDateString('it-IT')}`);
      return parsedDate;
    };
    
    const formattedStartDate = parseLocalDate(startDate).toLocaleDateString('it-IT', { 
      day: '2-digit', 
      month: 'long', 
      year: 'numeric',
      timeZone: 'Europe/Rome'
    });
    console.log(`✅ Formatted start date: ${startDate} -> ${formattedStartDate}`);
    const formattedEndDate = startDate === endDate 
      ? formattedStartDate 
      : parseLocalDate(endDate).toLocaleDateString('it-IT', { 
          day: '2-digit', 
          month: 'long', 
          year: 'numeric',
          timeZone: 'Europe/Rome'
        });
    const dateRange = startDate === endDate ? formattedStartDate : `${formattedStartDate} - ${formattedEndDate}`;

    // Crea notifiche per tutti gli admin
    try {
      const { data: admins, error: adminsError } = await supabase
        .from('users')
        .select('id, email')
        .eq('role', 'admin')
        .eq('is_active', true);

      if (!adminsError && admins && admins.length > 0) {
        const notificationPromises = admins.map(admin => 
          supabase
            .from('notifications')
            .insert([{
              user_id: admin.id,
              title: 'Nuova richiesta Permesso',
              message: `${userName} ha richiesto un permesso ${startDate === endDate ? 'per il' : 'dal'} ${dateRange}`,
              type: 'permission',
              is_read: false,
              request_id: newRequest.id,
              created_at: new Date().toISOString()
            }])
        );

        await Promise.all(notificationPromises);
        console.log(`✅ Notifiche create per ${admins.length} admin`);

        // Invia email a tutti gli admin
        try {
          await sendEmailToAdmins('newRequest', [
            userName,
            type,
            startDate, // Passa la data originale YYYY-MM-DD, il template la formatterà
            endDate,   // Passa la data originale YYYY-MM-DD, il template la formatterà
            newRequest.id
          ]);
          console.log('✅ Email inviate agli admin');
        } catch (emailError) {
          console.error('⚠️ Errore invio email admin:', emailError);
          // Non bloccare la risposta se l'email fallisce
        }
      }
    } catch (notificationError) {
      console.error('⚠️ Errore creazione notifiche:', notificationError);
      // Non bloccare la risposta se le notifiche falliscono
    }

    console.log('🎉 Sending success response for request:', newRequest.id);
    
    res.status(201).json({
      success: true,
      message: 'Richiesta inviata con successo',
      request: newRequest
    });
  } catch (error) {
    console.error('Leave request creation error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Admin creates leave request for employee
app.post('/api/admin/leave-requests', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId, type, startDate, endDate, reason, notes, permissionType, hours, exitTime, entryTime, doctor, medicalCode } = req.body;

    const normalizeTime = (value) => {
      if (value === null || value === undefined) return null;
      if (typeof value === 'string' && value.trim() === '') return null;
      return value;
    };

    const normalizeHours = (value) => {
      if (value === null || value === undefined || value === '') return null;
      const numericValue = typeof value === 'number' ? value : parseFloat(value);
      return Number.isFinite(numericValue) ? numericValue : null;
    };

    // Validation
    if (!userId || !type || !startDate || !endDate) {
      return res.status(400).json({ error: 'Campi obbligatori mancanti (userId, type, startDate, endDate)' });
    }

    // Verifica che il dipendente esista
    const { data: employee, error: employeeError } = await supabase
      .from('users')
      .select('id, first_name, last_name, email, role')
      .eq('id', userId)
      .single();

    if (employeeError || !employee) {
      return res.status(404).json({ error: 'Dipendente non trovato' });
    }

    if (employee.role === 'admin') {
      return res.status(400).json({ error: 'Non puoi creare richieste per un admin' });
    }

    // Calcola i giorni richiesti
    const start = new Date(startDate);
    const end = new Date(endDate);
    const daysRequested = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

    // Se admin crea FERIE, verifica bilancio ferie (ma NON valida periodi - admin può bypassare)
    if (type === 'vacation') {
      const requestYear = new Date(startDate).getFullYear();

      // Recupera o crea bilancio ferie
      let { data: balance, error: balanceError } = await supabase
        .from('vacation_balances')
        .select('*')
        .eq('user_id', userId)
        .eq('year', requestYear)
        .single();

      if (balanceError && balanceError.code === 'PGRST116') {
        // Nessun bilancio trovato, creane uno nuovo con 30 giorni
        const { data: newBalance, error: createError } = await supabase
          .from('vacation_balances')
          .insert([{
            user_id: userId,
            year: requestYear,
            total_days: 30,
            used_days: 0,
            pending_days: 0,
            remaining_days: 30
          }])
          .select()
          .single();

        if (createError) {
          console.error('Vacation balance creation error:', createError);
          return res.status(500).json({ error: 'Errore nella creazione del bilancio ferie' });
        }

        balance = newBalance;
      } else if (balanceError) {
        console.error('Vacation balance fetch error:', balanceError);
        return res.status(500).json({ error: 'Errore nel recupero del bilancio ferie' });
      }

      // Calcola pending_days dalle richieste in attesa
      const { data: pendingRequests, error: pendingError } = await supabase
        .from('leave_requests')
        .select('days_requested')
        .eq('user_id', userId)
        .eq('type', 'vacation')
        .eq('status', 'pending')
        .gte('start_date', `${requestYear}-01-01`)
        .lte('end_date', `${requestYear}-12-31`);

      let pendingDays = 0;
      if (!pendingError && pendingRequests) {
        pendingDays = pendingRequests.reduce((sum, req) => sum + (req.days_requested || 0), 0);
      }

      const remainingDays = (balance.total_days || 30) - (balance.used_days || 0) - pendingDays;

      // Admin può creare ferie anche se il saldo è negativo (override), ma avvisiamo
      if (daysRequested > remainingDays) {
        console.warn(`⚠️ Admin crea ferie oltre il saldo disponibile: ${daysRequested} giorni richiesti, ${remainingDays} disponibili`);
        // Non blocchiamo - admin può override
      }
    }

    // Calcola le ore effettive per i permessi con orari specifici (NON per ferie)
    // PER FERIE: non calcolare ore, sono giorni interi
    let calculatedHours = null;
    if (type === 'permission' && (exitTime || entryTime) && permissionType) {
      calculatedHours = hours;
      try {
        // Ottieni il work_schedule del dipendente per il giorno specifico
        const permissionDate = new Date(startDate);
        const dayOfWeek = permissionDate.getDay(); // 0 = Domenica, 1 = Lunedì, etc.

        const { data: workSchedule, error: scheduleError } = await supabase
          .from('work_schedules')
          .select('start_time, end_time, is_working_day')
          .eq('user_id', userId)
          .eq('day_of_week', dayOfWeek)
          .single();

        if (!scheduleError && workSchedule && workSchedule.is_working_day) {
          // Funzione helper per convertire HH:MM in minuti
          const timeToMinutes = (timeStr) => {
            const [hours, minutes] = timeStr.split(':').map(Number);
            return hours * 60 + minutes;
          };

          const standardStartMinutes = timeToMinutes(workSchedule.start_time);
          const standardEndMinutes = timeToMinutes(workSchedule.end_time);

          if (permissionType === 'early_exit' && exitTime) {
            // Uscita anticipata: calcola da exitTime alla fine standard
            const exitMinutes = timeToMinutes(exitTime);
            const minutesDiff = standardEndMinutes - exitMinutes;
            calculatedHours = parseFloat((minutesDiff / 60).toFixed(2));
            console.log(`🕐 Uscita anticipata calcolata: ${exitTime} -> ${workSchedule.end_time} = ${calculatedHours} ore`);
          } else if (permissionType === 'late_entry' && entryTime) {
            // Entrata posticipata: calcola dall'inizio standard a entryTime
            const entryMinutes = timeToMinutes(entryTime);
            const minutesDiff = entryMinutes - standardStartMinutes;
            calculatedHours = parseFloat((minutesDiff / 60).toFixed(2));
            console.log(`🕐 Entrata posticipata calcolata: ${workSchedule.start_time} -> ${entryTime} = ${calculatedHours} ore`);
          }
        } else {
          console.warn('⚠️ Orario di lavoro non trovato per questo giorno, usando 0 ore');
          calculatedHours = 0;
        }
      } catch (calcError) {
        console.error('❌ Errore nel calcolo delle ore:', calcError);
        // Se c'è un errore, mantieni il valore passato o usa 0
        calculatedHours = hours || 0;
      }
    }

    // Prepara i dati per l'inserimento
    const insertData = {
      user_id: userId,
      type: type,
      start_date: startDate,
      end_date: endDate,
      reason: reason || (type === 'vacation' ? 'Ferie' : ''),
      status: 'approved', // Auto-approvato perché creato dall'admin
      submitted_at: new Date().toISOString(),
      approved_at: new Date().toISOString(),
      approved_by: req.user.id, // ID dell'admin che ha creato
      days_requested: daysRequested,
      notes: notes ? `[Creato dall'admin] ${notes}` : '[Creato dall\'admin]'
    };

    // Aggiungi campi opzionali
    if (doctor !== undefined) insertData.doctor = doctor;
    if (medicalCode !== undefined) insertData.medical_code = medicalCode;
    if (permissionType !== undefined) insertData.permission_type = permissionType;
    
    // Per FERIE: non salvare ore (sono giorni interi, non ore)
    // Per PERMESSI: salva le ore calcolate
    if (type !== 'vacation') {
      const normalizedHours = normalizeHours(calculatedHours);
      if (normalizedHours !== null) {
        insertData.hours = normalizedHours; // Usa le ore calcolate solo per permessi
      }
    }
    
    // Se admin crea ferie approvate direttamente, aggiorna bilancio ferie
    if (type === 'vacation' && insertData.status === 'approved') {
      const requestYear = new Date(startDate).getFullYear();
      const daysRequested = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

      // Aggiorna bilancio ferie dopo la creazione (vedi sotto)
      setTimeout(async () => {
        // Questo verrà eseguito dopo la risposta per non rallentare
        let { data: balance, error: balanceError } = await supabase
          .from('vacation_balances')
          .select('*')
          .eq('user_id', userId)
          .eq('year', requestYear)
          .single();

        if (balanceError && balanceError.code === 'PGRST116') {
          await supabase.from('vacation_balances').insert([{
            user_id: userId,
            year: requestYear,
            total_days: 30,
            used_days: daysRequested,
            pending_days: 0,
            remaining_days: 30 - daysRequested
          }]);
        } else if (!balanceError && balance) {
          const newUsedDays = (balance.used_days || 0) + daysRequested;
          await supabase.from('vacation_balances').update({
            used_days: newUsedDays,
            remaining_days: (balance.total_days || 30) - newUsedDays,
            updated_at: new Date().toISOString()
          }).eq('id', balance.id);
        }
      }, 100);
    }

    const normalizedExitTime = normalizeTime(exitTime);
    const normalizedEntryTime = normalizeTime(entryTime);

    if (normalizedExitTime !== null) insertData.exit_time = normalizedExitTime;
    if (normalizedEntryTime !== null) insertData.entry_time = normalizedEntryTime;

    console.log('🔧 Admin creating leave request for employee:', employee.email);
    console.log('📋 Insert data:', JSON.stringify(insertData, null, 2));

    const { data: newRequest, error } = await supabase
      .from('leave_requests')
      .insert([insertData])
      .select()
      .single();

    if (error) {
      console.error('❌ Admin leave request creation error:', error);
      console.error('❌ Error details:', JSON.stringify(error, null, 2));
      console.error('❌ Insert data that failed:', JSON.stringify(insertData, null, 2));
      return res.status(500).json({ 
        error: 'Errore nella creazione della richiesta',
        details: error.message || 'Errore sconosciuto'
      });
    }

    console.log('✅ Admin leave request created successfully:', newRequest.id);

    // Crea notifica per il dipendente
    try {
      const notificationData = {
        user_id: userId,
        type: 'leave_approved',
        title: `${type === 'vacation' ? 'Ferie' : type === 'sick_leave' ? 'Malattia' : 'Permesso'} aggiunto dall'admin`,
        message: (() => {
          // Parse date as local time to avoid UTC timezone issues
          const parseLocalDate = (dateStr) => {
            const [year, month, day] = dateStr.split('-').map(Number);
            return new Date(year, month - 1, day);
          };
          
          const formattedStart = parseLocalDate(startDate).toLocaleDateString('it-IT', { 
            day: '2-digit', 
            month: 'long', 
            year: 'numeric',
            timeZone: 'Europe/Rome'
          });
          const formattedEnd = startDate === endDate 
            ? formattedStart 
            : parseLocalDate(endDate).toLocaleDateString('it-IT', { 
                day: '2-digit', 
                month: 'long', 
                year: 'numeric',
                timeZone: 'Europe/Rome'
              });
          const dateRange = startDate === endDate ? formattedStart : `dal ${formattedStart} al ${formattedEnd}`;
          return `L'amministratore ha registrato ${type === 'vacation' ? 'ferie' : type === 'sick_leave' ? 'una malattia' : 'un permesso'} ${dateRange}. ${reason ? `Motivo: ${reason}` : ''}`;
        })(),
        related_id: newRequest.id,
        is_read: false,
        created_at: new Date().toISOString()
      };

      const { error: notifError } = await supabase
        .from('notifications')
        .insert([notificationData]);

      if (notifError) {
        console.error('❌ Notification creation error:', notifError);
      } else {
        console.log('✅ Notification created for employee:', employee.email);
      }
    } catch (notifError) {
      console.error('❌ Notification error:', notifError);
    }

    // Invia email al dipendente
    try {
      const { sendEmail } = require('./emailService');
      const typeLabel = type === 'vacation' ? 'vacation' : type === 'sick_leave' ? 'sick_leave' : 'permission';
      
      // Invia email usando il template requestResponse con status approved
      await sendEmail(
        employee.email,
        'requestResponse',
        [
          typeLabel,        // requestType
          'approved',        // status
          startDate,        // startDate (YYYY-MM-DD, il template la formatterà)
          endDate,          // endDate (YYYY-MM-DD, il template la formatterà)
          notes || reason || '[Registrato dall\'amministratore]', // notes
          newRequest.id     // requestId
        ]
      );
      
      console.log('✅ Email sent to employee:', employee.email);
    } catch (emailError) {
      console.error('❌ Email send error:', emailError);
    }

    res.status(201).json({
      success: true,
      message: `${type === 'vacation' ? 'Ferie' : type === 'sick_leave' ? 'Malattia' : 'Permesso'} aggiunto con successo per ${employee.first_name} ${employee.last_name}`,
      request: newRequest
    });
  } catch (error) {
    console.error('Admin leave request creation error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Approve/Reject leave request (admin only)
app.put('/api/leave-requests/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Stato non valido' });
    }

    const { data: updatedRequest, error } = await supabase
      .from('leave_requests')
      .update({
        status: status,
        approved_at: new Date().toISOString(),
        approved_by: req.user.id,
        notes: notes || ''
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Leave request update error:', error);
      return res.status(500).json({ error: 'Errore nell\'aggiornamento della richiesta' });
    }

    // Se è una richiesta FERIE approvata, aggiorna il bilancio ferie (giorni, non ore)
    // IMPORTANTE: Le ferie NON influenzano la banca ore (balance_hours)
    if (updatedRequest.type === 'vacation' && status === 'approved') {
      const requestYear = new Date(updatedRequest.start_date).getFullYear();
      const daysRequested = updatedRequest.days_requested || 0;

      if (daysRequested > 0) {
        // Recupera o crea bilancio ferie
        let { data: balance, error: balanceError } = await supabase
          .from('vacation_balances')
          .select('*')
          .eq('user_id', updatedRequest.user_id)
          .eq('year', requestYear)
          .single();

        if (balanceError && balanceError.code === 'PGRST116') {
          // Nessun bilancio trovato, creane uno nuovo con 30 giorni
          const { data: newBalance, error: createError } = await supabase
            .from('vacation_balances')
            .insert([{
              user_id: updatedRequest.user_id,
              year: requestYear,
              total_days: 30,
              used_days: daysRequested,
              pending_days: 0,
              remaining_days: 30 - daysRequested
            }])
            .select()
            .single();

          if (createError) {
            console.error('Vacation balance creation error:', createError);
          } else {
            balance = newBalance;
          }
        } else if (!balanceError && balance) {
          // Aggiorna bilancio esistente
          const newUsedDays = (balance.used_days || 0) + daysRequested;
          const newRemainingDays = (balance.total_days || 30) - newUsedDays;

          const { error: updateError } = await supabase
            .from('vacation_balances')
            .update({
              used_days: newUsedDays,
              remaining_days: newRemainingDays,
              updated_at: new Date().toISOString()
            })
            .eq('id', balance.id);

          if (updateError) {
            console.error('Vacation balance update error:', updateError);
          } else {
            console.log(`✅ Bilancio ferie aggiornato: +${daysRequested} giorni (totale utilizzati: ${newUsedDays})`);
          }
        }
      }
    }

    // Se è una richiesta FERIE rifiutata, rimuovi i giorni pending dal bilancio
    if (updatedRequest.type === 'vacation' && status === 'rejected') {
      // Il pending_days verrà ricalcolato automaticamente al prossimo accesso
      // Non serve fare nulla qui perché viene ricalcolato dinamicamente
      console.log(`❌ Richiesta ferie rifiutata: ${updatedRequest.days_requested} giorni non utilizzati`);
    }

    // Crea notifica per il dipendente
    try {
      const typeLabels = {
        'permission': 'Permesso',
        'sick': 'Malattia', 
        'vacation': 'Ferie'
      };

      const statusLabels = {
        'approved': 'approvata',
        'rejected': 'rifiutata'
      };

      // Parse date as local time to avoid UTC timezone issues
      const parseLocalDate = (dateStr) => {
        const [year, month, day] = dateStr.split('-').map(Number);
        return new Date(year, month - 1, day);
      };
      
      // Formatta le date in italiano
      const formattedStartDate = parseLocalDate(updatedRequest.start_date).toLocaleDateString('it-IT', { 
        day: '2-digit', 
        month: 'long', 
        year: 'numeric',
        timeZone: 'Europe/Rome'
      });
      const formattedEndDate = updatedRequest.start_date === updatedRequest.end_date
        ? formattedStartDate
        : parseLocalDate(updatedRequest.end_date).toLocaleDateString('it-IT', { 
            day: '2-digit', 
            month: 'long', 
            year: 'numeric',
            timeZone: 'Europe/Rome'
          });
      const dateRange = updatedRequest.start_date === updatedRequest.end_date 
        ? formattedStartDate 
        : `dal ${formattedStartDate} al ${formattedEndDate}`;

        await supabase
          .from('notifications')
          .insert([
            {
              user_id: updatedRequest.user_id,
              title: `Richiesta ${typeLabels[updatedRequest.type] || updatedRequest.type} ${statusLabels[status]}`,
              message: `La tua richiesta di ${typeLabels[updatedRequest.type] || updatedRequest.type} ${dateRange} è stata ${statusLabels[status]}${notes ? `. Note: ${notes}` : ''}`,
              type: 'response',
              request_id: updatedRequest.id,
              request_type: updatedRequest.type,
              is_read: false,
              created_at: new Date().toISOString()
            }
          ]);

        // Invia email al dipendente
        try {
          const { data: user, error: userError } = await supabase
            .from('users')
            .select('email, first_name, last_name')
            .eq('id', updatedRequest.user_id)
            .single();

          if (!userError && user) {
            // Usa sempre l'email aziendale
            if (isRealEmail(user.email)) {
              const requestType = typeLabels[updatedRequest.type] || updatedRequest.type;
              const requestId = updatedRequest.id;
              
              await sendEmail(user.email, 'requestResponse', [
                requestType, 
                status, 
                updatedRequest.start_date, 
                updatedRequest.end_date, 
                notes || '', 
                requestId
              ]);
              console.log(`Email inviata a ${user.email} per risposta richiesta`);
            } else {
              console.log('Email non inviata: privacy - email non reale o non autorizzata');
            }
          }
        } catch (emailError) {
          console.error('Errore invio email dipendente:', emailError);
          // Non bloccare la risposta se l'email fallisce
        }
    } catch (notificationError) {
      console.error('Notification creation error:', notificationError);
      // Non bloccare l'aggiornamento se le notifiche falliscono
    }

    res.json({
      success: true,
      message: `Richiesta ${status === 'approved' ? 'approvata' : 'rifiutata'} con successo`,
      request: updatedRequest
    });
  } catch (error) {
    console.error('Leave request update error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});


// ==================== HEALTH CHECK ====================

app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// ==================== STATIC FILES ====================

// Serve static files from client/dist (only in production, after API routes)
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/dist')));
}

// ==================== POLLING FALLBACK ====================

// Check for updates (polling fallback)
app.post('/api/updates/check', authenticateToken, async (req, res) => {
  try {
    const { userId, lastUpdate } = req.body;
    
    // Per ora restituiamo sempre false, in futuro possiamo implementare
    // un sistema di tracking degli aggiornamenti
    res.json({
      hasUpdates: false,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Polling check error:', error);
    res.json({
      hasUpdates: false,
      timestamp: new Date().toISOString()
    });
  }
});

// ==================== WEBSOCKET REAL-TIME ====================

// Make WebSocket manager available to routes
app.set('wsManager', wsManager);
app.set('broadcastToAll', (data) => wsManager.broadcastToAll(data));
app.set('broadcastToAdmins', (data) => wsManager.broadcastToAdmins(data));
app.set('broadcastToUser', (userId, data) => wsManager.broadcastToUser(userId, data));
app.set('broadcastToOthers', (excludeUserId, data) => wsManager.broadcastToOthers(excludeUserId, data));

// ==================== ERROR HANDLING ====================

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Errore interno del server' });
});

// ==================== START SERVER ====================

// ==================== SETTINGS ENDPOINTS ====================

// Save settings
app.post('/api/settings', authenticateToken, async (req, res) => {
  try {
    const { settings } = req.body;
    
    if (!settings) {
      return res.status(400).json({ error: 'Settings data required' });
    }

    // Salva nelle tabelle settings per categoria
    const categories = Object.keys(settings);
    const results = [];
    
    for (const category of categories) {
      // Prima cancella le impostazioni esistenti per questa categoria
      await supabase
        .from('settings')
        .delete()
        .eq('user_id', req.user.id)
        .eq('category', category);

      // Poi inserisci le nuove impostazioni
      const { data, error } = await supabase
        .from('settings')
        .insert({
          user_id: req.user.id,
          category: category,
          settings: settings[category],
          updated_at: new Date().toISOString()
        })
        .select();
      
      if (error) {
        console.error(`Settings save error for ${category}:`, error);
        results.push({ category, success: false, error: error.message });
      } else {
        results.push({ category, success: true });
      }
    }

    const hasErrors = results.some(r => !r.success);
    
    if (hasErrors) {
      return res.status(500).json({ 
        error: 'Errore nel salvare alcune impostazioni', 
        details: results 
      });
    }

    res.json({ success: true, message: 'Impostazioni salvate con successo' });
  } catch (error) {
    console.error('Settings save error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Get settings
app.get('/api/settings', authenticateToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('settings')
      .select('category, settings')
      .eq('user_id', req.user.id);

    if (error) {
      console.error('Settings fetch error:', error);
      return res.status(500).json({ error: 'Errore nel recuperare le impostazioni' });
    }

    // Raggruppa settings per categoria
    const settings = {};
    data.forEach(item => {
      settings[item.category] = item.settings;
    });

    res.json(settings);
  } catch (error) {
    console.error('Settings fetch error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// ==================== WORK SCHEDULES ENDPOINTS ====================

// Get work schedule for user
// Rimosso endpoint duplicato - usa quello alla linea 1295

// Save work schedule for user
app.post('/api/work-schedules', authenticateToken, async (req, res) => {
  try {
    const { schedules } = req.body;
    
    if (!schedules || !Array.isArray(schedules)) {
      return res.status(400).json({ error: 'Array schedules richiesto' });
    }

    // Cancella orari esistenti
    await supabase
      .from('work_schedules')
      .delete()
      .eq('user_id', req.user.id);

    // Inserisci nuovi orari
    const schedulesWithUserId = schedules.map(schedule => ({
      ...schedule,
      user_id: req.user.id
    }));

    const { data, error } = await supabase
      .from('work_schedules')
      .insert(schedulesWithUserId)
      .select();

    if (error) {
      console.error('Work schedules save error:', error);
      return res.status(500).json({ error: 'Errore nel salvare gli orari di lavoro' });
    }

    res.json({ success: true, data });
  } catch (error) {
    console.error('Work schedules save error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Get work schedule for specific employee (admin only)
app.get('/api/work-schedules/:userId', authenticateToken, async (req, res) => {
  try {
    // Solo admin può vedere orari di altri utenti
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Accesso negato' });
    }

    const { userId } = req.params;
    
    const { data, error } = await supabase
      .from('work_schedules')
      .select('*')
      .eq('user_id', userId)
      .order('day_of_week');

    if (error) {
      console.error('Employee work schedules fetch error:', error);
      return res.status(500).json({ error: 'Errore nel recuperare gli orari di lavoro del dipendente' });
    }

    res.json(data);
  } catch (error) {
    console.error('Employee work schedules fetch error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Create notification
app.post('/api/notifications', authenticateToken, async (req, res) => {
  try {
    const { userId, title, message, type = 'info' } = req.body;

    if (!userId || !title || !message) {
      return res.status(400).json({ error: 'Campi obbligatori mancanti' });
    }

    const { data, error } = await supabase
      .from('notifications')
      .insert([
        {
          user_id: userId,
          title: title,
          message: message,
          type: type,
          is_read: false,
          created_at: new Date().toISOString()
        }
      ])
      .select()
      .single();

    if (error) {
      console.error('Notification creation error:', error);
      return res.status(500).json({ error: 'Errore nella creazione della notifica' });
    }

    res.status(201).json({
      success: true,
      message: 'Notifica creata con successo',
      notification: data
    });
  } catch (error) {
    console.error('Notification creation error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// ==================== LEAVE BALANCES ENDPOINTS ====================

// Get leave balances for user
app.get('/api/leave-balances', authenticateToken, async (req, res) => {
  try {
    const { year = new Date().getFullYear() } = req.query;
    
    const { data, error } = await supabase
      .from('leave_balances')
      .select('*')
      .eq('user_id', req.user.id)
      .eq('year', parseInt(year))
      .order('leave_type');

    if (error) {
      console.error('Leave balances fetch error:', error);
      return res.status(500).json({ error: 'Errore nel recuperare i saldi ferie' });
    }

    res.json(data);
  } catch (error) {
    console.error('Leave balances fetch error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// ==================== VACATION PERIODS ENDPOINTS ====================
// Gestione periodi di richiesta ferie (admin apre/chiude periodi)

// Get vacation periods (aperto/chiuso, periodi disponibili)
app.get('/api/vacation-periods', authenticateToken, async (req, res) => {
  try {
    const { isOpen, date } = req.query;
    
    let query = supabase
      .from('vacation_periods')
      .select('*, users:created_by(first_name, last_name)')
      .order('start_date', { ascending: false });
    
    if (isOpen !== undefined) {
      query = query.eq('is_open', isOpen === 'true');
    }
    
    // Se viene passata una data, filtra solo i periodi che includono quella data
    if (date) {
      query = query
        .lte('start_date', date)
        .gte('end_date', date);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Vacation periods fetch error:', error);
      return res.status(500).json({ error: 'Errore nel recupero dei periodi ferie' });
    }
    
    res.json(data || []);
  } catch (error) {
    console.error('Vacation periods error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Get available vacation periods (solo quelli aperti e validi per oggi)
app.get('/api/vacation-periods/available', authenticateToken, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    const { data, error } = await supabase
      .from('vacation_periods')
      .select('*')
      .eq('is_open', true)
      .lte('start_date', today)
      .gte('end_date', today)
      .order('vacation_start_date', { ascending: true });
    
    if (error) {
      console.error('Available vacation periods fetch error:', error);
      return res.status(500).json({ error: 'Errore nel recupero dei periodi disponibili' });
    }
    
    res.json(data || []);
  } catch (error) {
    console.error('Available vacation periods error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Check if a date range is within available vacation periods
app.post('/api/vacation-periods/validate', authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate } = req.body;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Date inizio e fine richieste' });
    }
    
    // Verifica che esista almeno un periodo aperto che include tutte le date richieste
    const { data: periods, error } = await supabase
      .from('vacation_periods')
      .select('*')
      .eq('is_open', true)
      .lte('start_date', startDate)
      .gte('end_date', endDate);
    
    if (error) {
      console.error('Period validation error:', error);
      return res.status(500).json({ error: 'Errore nella validazione del periodo' });
    }
    
    // Verifica che tutte le date richieste siano nei periodi validi per le ferie
    const start = new Date(startDate);
    const end = new Date(endDate);
    let isValid = false;
    let invalidDates = [];
    
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      const isInValidPeriod = periods.some(period => 
        dateStr >= period.vacation_start_date && dateStr <= period.vacation_end_date
      );
      
      if (!isInValidPeriod) {
        invalidDates.push(dateStr);
      }
    }
    
    isValid = invalidDates.length === 0;
    
    res.json({
      isValid,
      invalidDates,
      periods: periods || []
    });
  } catch (error) {
    console.error('Period validation error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Admin: Create vacation period
app.post('/api/vacation-periods', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, startDate, endDate, vacationStartDate, vacationEndDate, isOpen, maxConcurrentRequests, notes } = req.body;
    
    if (!name || !startDate || !endDate || !vacationStartDate || !vacationEndDate) {
      return res.status(400).json({ error: 'Campi obbligatori mancanti' });
    }
    
    const { data, error } = await supabase
      .from('vacation_periods')
      .insert([{
        name,
        start_date: startDate,
        end_date: endDate,
        vacation_start_date: vacationStartDate,
        vacation_end_date: vacationEndDate,
        is_open: isOpen !== undefined ? isOpen : true,
        max_concurrent_requests: maxConcurrentRequests || null,
        created_by: req.user.id,
        notes: notes || null
      }])
      .select()
      .single();
    
    if (error) {
      console.error('Vacation period creation error:', error);
      return res.status(500).json({ error: 'Errore nella creazione del periodo' });
    }
    
    res.status(201).json(data);
  } catch (error) {
    console.error('Vacation period creation error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Admin: Update vacation period
app.put('/api/vacation-periods/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, startDate, endDate, vacationStartDate, vacationEndDate, isOpen, maxConcurrentRequests, notes } = req.body;
    
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (startDate !== undefined) updateData.start_date = startDate;
    if (endDate !== undefined) updateData.end_date = endDate;
    if (vacationStartDate !== undefined) updateData.vacation_start_date = vacationStartDate;
    if (vacationEndDate !== undefined) updateData.vacation_end_date = vacationEndDate;
    if (isOpen !== undefined) updateData.is_open = isOpen;
    if (maxConcurrentRequests !== undefined) updateData.max_concurrent_requests = maxConcurrentRequests;
    if (notes !== undefined) updateData.notes = notes;
    updateData.updated_at = new Date().toISOString();
    
    const { data, error } = await supabase
      .from('vacation_periods')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      console.error('Vacation period update error:', error);
      return res.status(500).json({ error: 'Errore nell\'aggiornamento del periodo' });
    }
    
    if (!data) {
      return res.status(404).json({ error: 'Periodo non trovato' });
    }
    
    res.json(data);
  } catch (error) {
    console.error('Vacation period update error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Admin: Delete vacation period
app.delete('/api/vacation-periods/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const { error } = await supabase
      .from('vacation_periods')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('Vacation period deletion error:', error);
      return res.status(500).json({ error: 'Errore nell\'eliminazione del periodo' });
    }
    
    res.json({ success: true, message: 'Periodo eliminato con successo' });
  } catch (error) {
    console.error('Vacation period deletion error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// ==================== VACATION BALANCES ENDPOINTS ====================
// Bilanci ferie (giorni interi, separati dalla banca ore)

// Get vacation balance for user (giorni, non ore)
app.get('/api/vacation-balances', authenticateToken, async (req, res) => {
  try {
    const { userId, year } = req.query;
    const targetUserId = userId || req.user.id;
    const targetYear = year ? parseInt(year) : new Date().getFullYear();
    
    // Verifica permessi
    if (req.user.role === 'employee' && targetUserId !== req.user.id) {
      return res.status(403).json({ error: 'Accesso negato' });
    }
    
    // Recupera o crea bilancio ferie
    let { data: balance, error } = await supabase
      .from('vacation_balances')
      .select('*')
      .eq('user_id', targetUserId)
      .eq('year', targetYear)
      .single();
    
    if (error && error.code === 'PGRST116') {
      // Nessun bilancio trovato, creane uno nuovo con 30 giorni
      const { data: newBalance, error: createError } = await supabase
        .from('vacation_balances')
        .insert([{
          user_id: targetUserId,
          year: targetYear,
          total_days: 30,
          used_days: 0,
          pending_days: 0,
          remaining_days: 30
        }])
        .select()
        .single();
      
      if (createError) {
        console.error('Vacation balance creation error:', createError);
        return res.status(500).json({ error: 'Errore nella creazione del bilancio' });
      }
      
      balance = newBalance;
    } else if (error) {
      console.error('Vacation balance fetch error:', error);
      return res.status(500).json({ error: 'Errore nel recupero del bilancio' });
    }
    
    // Calcola pending_days dalle richieste in attesa
    const { data: pendingRequests, error: pendingError } = await supabase
      .from('leave_requests')
      .select('days_requested')
      .eq('user_id', targetUserId)
      .eq('type', 'vacation')
      .eq('status', 'pending')
      .gte('start_date', `${targetYear}-01-01`)
      .lte('end_date', `${targetYear}-12-31`);
    
    if (!pendingError && pendingRequests) {
      const pendingDays = pendingRequests.reduce((sum, req) => sum + (req.days_requested || 0), 0);
      
      // Aggiorna pending_days se diverso
      if (balance.pending_days !== pendingDays) {
        const remainingDays = balance.total_days - balance.used_days - pendingDays;
        
        const { data: updatedBalance, error: updateError } = await supabase
          .from('vacation_balances')
          .update({
            pending_days: pendingDays,
            remaining_days: remainingDays,
            updated_at: new Date().toISOString()
          })
          .eq('id', balance.id)
          .select()
          .single();
        
        if (!updateError && updatedBalance) {
          balance = updatedBalance;
        }
      }
    }
    
    res.json(balance);
  } catch (error) {
    console.error('Vacation balance error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// ==================== 104 PERMISSIONS ENDPOINTS ====================

// Get 104 permissions count for current month
app.get('/api/104-permissions/count', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();

    // Count 104 permissions for current month
    const { count, error } = await supabase
      .from('leave_requests')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('type', 'permission_104')
      .eq('status', 'approved')
      .gte('start_date', `${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`)
      .lt('start_date', `${currentYear}-${(currentMonth + 1).toString().padStart(2, '0')}-01`);

    if (error) {
      console.error('104 permissions count error:', error);
      return res.status(500).json({ error: 'Errore nel conteggio permessi 104' });
    }

    res.json({
      usedThisMonth: count || 0,
      maxPerMonth: 3,
      remaining: Math.max(0, 3 - (count || 0))
    });
  } catch (error) {
    console.error('104 permissions count error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// ==================== DEPARTMENTS ENDPOINTS ====================

// Get all departments with employee count
app.get('/api/departments', authenticateToken, async (req, res) => {
  try {
    // Ottieni dipartimenti
    const { data: departments, error: deptError } = await supabase
      .from('departments')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (deptError) {
      console.error('Departments fetch error:', deptError);
      return res.status(500).json({ error: 'Errore nel recuperare i dipartimenti' });
    }

    // Ottieni conteggio dipendenti per dipartimento
    // Prima controlla se il campo department esiste
    let departmentCounts = {};
    
    try {
      const { data: employees, error: empError } = await supabase
        .from('users')
        .select('department')
        .eq('role', 'employee')
        .eq('is_active', true);

      if (empError) {
        console.log('Campo department non esiste, uso conteggio vuoto');
        // Se il campo non esiste, usa conteggio vuoto
        departmentCounts = {};
      } else {
        // Conta dipendenti per dipartimento
        employees.forEach(emp => {
          const dept = emp.department || 'Amministrazione';
          departmentCounts[dept] = (departmentCounts[dept] || 0) + 1;
        });
      }
    } catch (error) {
      console.log('Errore nel conteggio dipendenti, uso conteggio vuoto');
      departmentCounts = {};
    }

    // Aggiungi conteggio a ogni dipartimento
    const departmentsWithCount = departments.map(dept => ({
      ...dept,
      employee_count: departmentCounts[dept.name] || 0
    }));

    res.json(departmentsWithCount);
  } catch (error) {
    console.error('Departments fetch error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// ==================== HOLIDAYS ENDPOINTS ====================

// Get holidays for year
app.get('/api/holidays', authenticateToken, async (req, res) => {
  try {
    const { year = new Date().getFullYear() } = req.query;

    const { data, error } = await supabase
      .from('holidays')
      .select('*')
      .gte('date', `${year}-01-01`)
      .lte('date', `${year}-12-31`)
      .order('date');

    if (error) {
      console.error('Holidays fetch error:', error);
      // Se la tabella non esiste o ha errori, restituisci giorni festivi di default
      return res.json(getDefaultHolidays(year));
    }

    // Se non ci sono dati per l'anno richiesto, restituisci i default
    if (!data || data.length === 0) {
      return res.json(getDefaultHolidays(year));
    }

    res.json(data);
  } catch (error) {
    console.error('Holidays fetch error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Funzione per ottenere festività di default per anno
function getDefaultHolidays(year) {
  const holidays2025 = [
    { id: '1', name: 'Capodanno', date: '2025-01-01', is_national: true, is_paid: true },
    { id: '2', name: 'Epifania', date: '2025-01-06', is_national: true, is_paid: true },
    { id: '3', name: 'Pasqua', date: '2025-04-20', is_national: true, is_paid: true },
    { id: '4', name: 'Pasquetta', date: '2025-04-21', is_national: true, is_paid: true },
    { id: '5', name: 'Festa della Liberazione', date: '2025-04-25', is_national: true, is_paid: true },
    { id: '6', name: 'Festa del Lavoro', date: '2025-05-01', is_national: true, is_paid: true },
    { id: '7', name: 'Festa della Repubblica', date: '2025-06-02', is_national: true, is_paid: true },
    { id: '8', name: 'Ferragosto', date: '2025-08-15', is_national: true, is_paid: true },
    { id: '9', name: 'Tutti i Santi', date: '2025-11-01', is_national: true, is_paid: true },
    { id: '10', name: 'Immacolata Concezione', date: '2025-12-08', is_national: true, is_paid: true },
    { id: '11', name: 'Natale', date: '2025-12-25', is_national: true, is_paid: true },
    { id: '12', name: 'Santo Stefano', date: '2025-12-26', is_national: true, is_paid: true }
  ];

  const holidays2026 = [
    { id: '13', name: 'Capodanno', date: '2026-01-01', is_national: true, is_paid: true },
    { id: '14', name: 'Epifania', date: '2026-01-06', is_national: true, is_paid: true },
    { id: '15', name: 'Carnevale', date: '2026-02-17', is_national: true, is_paid: true },
    { id: '16', name: 'Pasqua', date: '2026-04-05', is_national: true, is_paid: true },
    { id: '17', name: 'Pasquetta', date: '2026-04-06', is_national: true, is_paid: true },
    { id: '18', name: 'Festa della Liberazione', date: '2026-04-25', is_national: true, is_paid: true },
    { id: '19', name: 'Festa del Lavoro', date: '2026-05-01', is_national: true, is_paid: true },
    { id: '20', name: 'Festa della Repubblica', date: '2026-06-02', is_national: true, is_paid: true },
    { id: '21', name: 'Ferragosto', date: '2026-08-15', is_national: true, is_paid: true },
    { id: '22', name: 'Tutti i Santi', date: '2026-11-01', is_national: true, is_paid: true },
    { id: '23', name: 'Immacolata Concezione', date: '2026-12-08', is_national: true, is_paid: true },
    { id: '24', name: 'Natale', date: '2026-12-25', is_national: true, is_paid: true },
    { id: '25', name: 'Santo Stefano', date: '2026-12-26', is_national: true, is_paid: true },
    { id: '26', name: 'San Silvestro', date: '2026-12-31', is_national: true, is_paid: true }
  ];

  return year === 2025 ? holidays2025 : year === 2026 ? holidays2026 : holidays2025;
}

// Get holidays calendar for month
app.get('/api/holidays/calendar', authenticateToken, async (req, res) => {
  try {
    const { year = new Date().getFullYear(), month = new Date().getMonth() + 1 } = req.query;

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const { data, error } = await supabase
      .from('holidays')
      .select('*')
      .gte('date', startDate.toISOString().split('T')[0])
      .lte('date', endDate.toISOString().split('T')[0])
      .order('date');

    if (error) {
      console.error('Holidays calendar error:', error);
      return res.status(500).json({ error: 'Errore nel recuperare il calendario festivo' });
    }

    res.json(data);
  } catch (error) {
    console.error('Holidays calendar error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// ==================== NOTIFICATIONS ENDPOINTS ====================

// Get notifications for user
// Helper per verificare email reali (privacy) - ora accetta tutte le email valide
const isRealEmail = (email) => {
  if (!email || typeof email !== 'string') return false;
  // Verifica formato email valido
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Endpoint per inviare promemoria email
app.post('/api/email/reminder', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { type, userId, customMessage } = req.body;
    
    if (!type || !userId) {
      return res.status(400).json({ error: 'Tipo e userId richiesti' });
    }

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('email, first_name, last_name, department')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return res.status(404).json({ error: 'Utente non trovato' });
    }

    // SOLO email reali per privacy
    if (!isRealEmail(user.email)) {
      return res.status(403).json({ error: 'Privacy: email non autorizzata per invii' });
    }
    
    // Usa sempre l'email aziendale
    if (!user.email) {
      return res.status(400).json({ error: 'Email non configurata per questo utente' });
    }

    let emailResult;
    switch (type) {
      case 'attendance':
        emailResult = await sendEmail(user.email, 'attendanceReminder', [
          `${user.first_name} ${user.last_name}`,
          user.department || 'Ufficio'
        ]);
        break;
      case 'custom':
        if (!customMessage) {
          return res.status(400).json({ error: 'Messaggio personalizzato richiesto' });
        }
        // Per ora invio un'email generica, potresti creare un template personalizzato
        emailResult = await sendEmail(user.email, 'attendanceReminder', [
          `${user.first_name} ${user.last_name}`,
          customMessage
        ]);
        break;
      default:
        return res.status(400).json({ error: 'Tipo di promemoria non valido' });
    }

    if (emailResult.success) {
      res.json({
        success: true,
        message: 'Promemoria inviato con successo',
        messageId: emailResult.messageId
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Errore nell\'invio del promemoria',
        details: emailResult.error
      });
    }
  } catch (error) {
    console.error('Email reminder error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Endpoint per gestire impostazioni automazione email
app.get('/api/email/scheduler/status', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const status = emailScheduler.getStatus();
    res.json({
      success: true,
      scheduler: status
    });
  } catch (error) {
    console.error('Scheduler status error:', error);
    res.status(500).json({ error: 'Errore nel recupero stato scheduler' });
  }
});

app.post('/api/email/scheduler/start', authenticateToken, requireAdmin, async (req, res) => {
  try {
    emailScheduler.start();
    res.json({
      success: true,
      message: 'Email Scheduler avviato con successo'
    });
  } catch (error) {
    console.error('Scheduler start error:', error);
    res.status(500).json({ error: 'Errore nell\'avvio scheduler' });
  }
});

app.post('/api/email/scheduler/stop', authenticateToken, requireAdmin, async (req, res) => {
  try {
    emailScheduler.stop();
    res.json({
      success: true,
      message: 'Email Scheduler fermato con successo'
    });
  } catch (error) {
    console.error('Scheduler stop error:', error);
    res.status(500).json({ error: 'Errore nella fermata scheduler' });
  }
});

// Endpoint per inviare email manuali
// Funzione per calcolare dati report settimanale
async function calculateWeeklyReportData(userId) {
  try {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay() + 1); // Lunedì
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6); // Domenica
    
    // Recupera presenze della settimana
    const { data: attendance, error } = await supabase
      .from('attendance')
      .select('date, actual_hours, expected_hours, balance_hours')
      .eq('user_id', userId)
      .gte('date', startOfWeek.toISOString().split('T')[0])
      .lte('date', endOfWeek.toISOString().split('T')[0]);
    
    if (error) {
      console.error('Error fetching weekly attendance:', error);
      return { weekNumber: 1, totalHours: 0, daysPresent: 0, overtimeHours: 0, balanceHours: 0 };
    }
    
    // Calcola statistiche
    const totalHours = attendance.reduce((sum, day) => sum + (day.actual_hours || 0), 0);
    const daysPresent = attendance.filter(day => (day.actual_hours || 0) > 0).length;
    const overtimeHours = attendance.reduce((sum, day) => sum + Math.max(0, (day.balance_hours || 0)), 0);
    const balanceHours = attendance.reduce((sum, day) => sum + (day.balance_hours || 0), 0);
    
    // Calcola numero settimana
    const weekNumber = Math.ceil((today.getDate() - today.getDay() + 1) / 7);
    
    return {
      weekNumber,
      totalHours: Math.round(totalHours * 10) / 10,
      daysPresent,
      overtimeHours: Math.round(overtimeHours * 10) / 10,
      balanceHours: Math.round(balanceHours * 10) / 10
    };
  } catch (error) {
    console.error('Error calculating weekly report data:', error);
    return { weekNumber: 1, totalHours: 0, daysPresent: 0, overtimeHours: 0, balanceHours: 0 };
  }
}

app.post('/api/email/send', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { employeeId, type, message } = req.body;
    
    if (!employeeId || !type) {
      return res.status(400).json({ error: 'Parametri mancanti' });
    }

    // Recupera i dati del dipendente
    const { data: employee, error: employeeError } = await supabase
      .from('users')
      .select('first_name, last_name, email')
      .eq('id', employeeId)
      .single();

    if (employeeError || !employee) {
      return res.status(404).json({ error: 'Dipendente non trovato' });
    }

    // Invia email in base al tipo
    let emailTemplate;
    let emailData;
    
    switch (type) {
      case 'attendance':
        emailTemplate = 'attendanceReminder';
        emailData = [employee.first_name, employee.department || 'Non specificato'];
        break;
      case 'leave':
        emailTemplate = 'newRequest';
        emailData = [`${employee.first_name} ${employee.last_name}`, 'Permesso', new Date().toLocaleDateString('it-IT'), new Date().toLocaleDateString('it-IT'), 'MAN-' + Date.now()];
        break;
      case 'report':
        emailTemplate = 'weeklyReport';
        // Calcola dati reali della settimana corrente
        const weekData = await calculateWeeklyReportData(employeeId);
        emailData = [employee.first_name, weekData];
        break;
      case 'custom':
        // Per messaggi personalizzati, crea un template semplice
        const customTemplate = {
          subject: `📧 Messaggio da HR LABA`,
          html: `
            <div style="font-family: Arial, sans-serif; padding: 20px;">
              <h2>Messaggio da HR LABA</h2>
              <p>${message}</p>
              <hr>
              <p><small>LABA Firenze - Sistema HR</small></p>
            </div>
          `
        };
        
        const { sendEmail } = require('./emailService');
        const result = await sendEmail(employee.email, customTemplate.subject, customTemplate.html);
        
        if (result.success) {
          res.json({ message: 'Email inviata con successo' });
        } else {
          res.status(500).json({ error: 'Errore nell\'invio dell\'email' });
        }
        return;
      default:
        return res.status(400).json({ error: 'Tipo email non valido' });
    }

    const { sendEmail } = require('./emailService');
    const result = await sendEmail(employee.email, emailTemplate, emailData);
    
    if (result.success) {
      res.json({ message: 'Email inviata con successo' });
    } else {
      res.status(500).json({ error: 'Errore nell\'invio dell\'email' });
    }
  } catch (error) {
    console.error('Email send error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Endpoint di test per inviare email
app.post('/api/email/test', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { email, template, type } = req.body;
    
    const { sendEmail, sendEmailToAdmins } = require('./emailService');
    
    // Se email specificata, invia a quell'email, altrimenti invia a tutti gli admin
    if (email) {
      let result;
      
      switch (template || 'newRequest') {
        case 'newRequest': {
          const today = new Date().toISOString().split('T')[0];
          result = await sendEmail(email, 'newRequest', [
            'Simone Azzinelli',
            'permission',
            today,
            today,
            12345
          ]);
          break;
        }
        case 'requestResponse': {
          const today = new Date().toISOString().split('T')[0];
          result = await sendEmail(email, 'requestResponse', [
            'permission',
            type || 'approved',
            today,
            today,
            'Test di approvazione',
            12345
          ]);
          break;
        }
        case 'attendanceReminder':
          result = await sendEmail(email, 'attendanceReminder', [
            'Simone Azzinelli',
            'Ufficio'
          ]);
          break;
        case 'weeklyReport':
          result = await sendEmail(email, 'weeklyReport', [
            'Simone Azzinelli',
            {
              weekNumber: 1,
              totalHours: 40,
              daysPresent: 5,
              overtimeHours: 2,
              balanceHours: 2
            }
          ]);
          break;
        default:
          return res.status(400).json({ error: 'Template non valido' });
      }
      
      if (result.success) {
        return res.json({ 
          success: true, 
          message: `Email di test inviata a ${email}`,
          messageId: result.messageId 
        });
      } else {
        return res.status(500).json({ 
          error: 'Errore nell\'invio dell\'email', 
          details: result.error 
        });
      }
    } else {
      // Invia a tutti gli admin
      const today = new Date().toISOString().split('T')[0];
      const result = await sendEmailToAdmins('newRequest', [
        'Simone Azzinelli',
        'permission',
        today,
        today,
        12345
      ]);
      
      return res.json({ 
        success: true, 
        message: `Email di test inviate a ${result.length} admin`,
        results: result
      });
    }
  } catch (error) {
    console.error('Email test error:', error);
    res.status(500).json({ error: 'Errore interno del server', details: error.message });
  }
});

// Endpoint per toggle scheduler
app.post('/api/email/scheduler/toggle', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const currentStatus = emailScheduler.getStatus();
    
    if (currentStatus.active) {
      emailScheduler.stop();
      res.json({
        success: true,
        message: 'Email Scheduler fermato',
        scheduler: { active: false }
      });
    } else {
      emailScheduler.start();
      res.json({
        success: true,
        message: 'Email Scheduler avviato',
        scheduler: { active: true }
      });
    }
  } catch (error) {
    console.error('Scheduler toggle error:', error);
    res.status(500).json({ error: 'Errore nel toggle scheduler' });
  }
});

// Endpoint per inviare report settimanali
app.post('/api/email/weekly-report', authenticateToken, requireAdmin, async (req, res) => {
  try {
    console.log('📊 Weekly report request received:', req.body);
    const { userId, weekNumber } = req.body;
    
    if (!userId) {
      console.log('❌ Missing userId');
      return res.status(400).json({ error: 'UserId richiesto' });
    }

    console.log('🔍 Fetching user data for userId:', userId);
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('email, first_name, last_name')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      console.log('❌ User not found:', userError);
      return res.status(404).json({ error: 'Utente non trovato' });
    }

    console.log('👤 User found:', user.email);

    // SOLO email reali per privacy
    if (!isRealEmail(user.email)) {
      console.log('❌ Email not authorized:', user.email);
      return res.status(403).json({ error: 'Privacy: email non autorizzata per invii' });
    }
    
    // Usa sempre l'email aziendale
    if (!user.email) {
      console.log('❌ No email configured');
      return res.status(400).json({ error: 'Email non configurata per questo utente' });
    }

    // Recupera dati settimanali REALI dal database
    const currentDate = new Date();
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay() + 1); // Lunedì
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6); // Domenica

    // Calcola ore lavorate settimanali
    const { data: weeklyAttendance, error: attendanceError } = await supabase
      .from('attendance')
      .select('hours_worked, expected_hours, date')
      .eq('user_id', userId)
      .gte('date', startOfWeek.toISOString().split('T')[0])
      .lte('date', endOfWeek.toISOString().split('T')[0])
      .not('hours_worked', 'is', null);

    let totalHours = 0;
    let daysPresent = 0;
    let overtimeHours = 0;
    let expectedSum = 0;

    if (!attendanceError && weeklyAttendance) {
      weeklyAttendance.forEach(record => {
        if (record.hours_worked) {
          totalHours += record.hours_worked;
          daysPresent++;
          expectedSum += (record.expected_hours || 8);
          
          // Calcola straordinario (oltre 8 ore al giorno)
          if (record.hours_worked > 8) {
            overtimeHours += (record.hours_worked - 8);
          }
        }
      });
    }

    // Calcola saldo ore (ore lavorate - ore previste)
    const expectedHours = expectedSum || (daysPresent * 8);
    const balanceHours = totalHours - expectedHours;

    const weekData = {
      weekNumber: weekNumber || Math.ceil((currentDate.getDate() - currentDate.getDay() + 1) / 7),
      totalHours: Math.round(totalHours * 10) / 10,
      daysPresent: daysPresent,
      overtimeHours: Math.round(overtimeHours * 10) / 10,
      balanceHours: Math.round(balanceHours * 10) / 10
    };

    console.log('📊 Week data calculated:', weekData);

         console.log('📧 Sending email to:', user.email);
         const emailResult = await sendEmail(user.email, 'weeklyReport', [
           `${user.first_name} ${user.last_name}`,
           weekData
         ]);

    console.log('📧 Email result:', emailResult);

    if (emailResult.success) {
      console.log('✅ Email sent successfully');
      res.json({
        success: true,
        message: 'Report settimanale inviato con successo',
        messageId: emailResult.messageId
      });
    } else {
      console.log('❌ Email failed:', emailResult.error);
      res.status(500).json({
        success: false,
        error: 'Errore nell\'invio del report',
        details: emailResult.error
      });
    }
  } catch (error) {
    console.error('Weekly report error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

app.get('/api/notifications', authenticateToken, async (req, res) => {
  try {
    const { limit = 50, unread_only = false } = req.query;
    
    let query = supabase
      .from('notifications')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));

    if (unread_only === 'true') {
      query = query.eq('is_read', false);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Notifications fetch error:', error);
      return res.status(500).json({ error: 'Errore nel recuperare le notifiche' });
    }

    res.json(data);
  } catch (error) {
    console.error('Notifications fetch error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Mark notification as read
app.put('/api/notifications/:id/read', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const { data, error } = await supabase
      .from('notifications')
      .update({ 
        is_read: true, 
        read_at: new Date().toISOString() 
      })
      .eq('id', id)
      .eq('user_id', req.user.id)
      .select();

    if (error) {
      console.error('Notification update error:', error);
      return res.status(500).json({ error: 'Errore nell\'aggiornare la notifica' });
    }

    res.json({ success: true, data });
  } catch (error) {
    console.error('Notification update error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// ==================== HOURS-BASED SYSTEM API ====================

// Import hours-based API routes
const hoursBasedAPI = require('./hours-based-api');

// Add supabase to request object for hours-based API
app.use('/api/hours', authenticateToken, (req, res, next) => {
  req.supabase = supabase;
  next();
}, hoursBasedAPI);

// ==================== CATCH-ALL ROUTE ====================

// User weekly hours calculation
app.get('/api/attendance/user-weekly-hours', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get current week start and end dates
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay() + 1); // Monday
    startOfWeek.setHours(0, 0, 0, 0);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6); // Sunday
    endOfWeek.setHours(23, 59, 59, 999);
    
    // Get attendance records for current week
    const { data: weeklyAttendance, error } = await supabase
      .from('attendance')
      .select('hours_worked, clock_in, clock_out, date')
      .eq('user_id', userId)
      .gte('date', startOfWeek.toISOString().split('T')[0])
      .lte('date', endOfWeek.toISOString().split('T')[0]);
    
    if (error) {
      console.error('Weekly hours error:', error);
      return res.status(500).json({ error: 'Errore nel calcolo delle ore settimanali' });
    }
    
    // Calculate total hours including current session
    let totalHours = 0;
    const today = new Date().toISOString().split('T')[0];
    
    weeklyAttendance.forEach(record => {
      if (record.hours_worked) {
        // Use saved hours
        totalHours += parseFloat(record.hours_worked) || 0;
      } else if (record.clock_in && !record.clock_out && record.date === today) {
        // Calculate current session hours
        const clockInTime = new Date(record.clock_in);
        const now = new Date();
        const currentHours = (now - clockInTime) / (1000 * 60 * 60);
        totalHours += currentHours;
      }
    });
    
    res.json({ 
      success: true, 
      data: { 
        totalHours: totalHours,
        weeklyAttendance: weeklyAttendance.length
      } 
    });
  } catch (error) {
    console.error('Weekly hours error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// User overtime calculation
app.get('/api/attendance/user-overtime', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get current month start and end dates
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    // Get attendance records for current month
    const { data: monthlyAttendance, error } = await supabase
      .from('attendance')
      .select('hours_worked, expected_hours')
      .eq('user_id', userId)
      .gte('date', startOfMonth.toISOString().split('T')[0])
      .lte('date', endOfMonth.toISOString().split('T')[0])
      .not('hours_worked', 'is', null);
    
    if (error) {
      console.error('Overtime error:', error);
      return res.status(500).json({ error: 'Errore nel calcolo degli straordinari' });
    }
    
    // Calculate total hours worked this month
    const totalHoursWorked = monthlyAttendance.reduce((sum, record) => sum + (parseFloat(record.hours_worked) || 0), 0);
    
    // Calculate expected hours from records when available, fallback to 160
    const expectedHours = monthlyAttendance.reduce((sum, r) => sum + (parseFloat(r.expected_hours) || 0), 0) || 160;
    const overtimeHours = totalHoursWorked - expectedHours;
    
    res.json({ 
      success: true, 
      data: { 
        overtimeHours: overtimeHours,
        totalHoursWorked: totalHoursWorked,
        expectedHours: expectedHours
      } 
    });
  } catch (error) {
    console.error('Overtime error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Monthly attendance report CSV export (admin only)
app.get('/api/admin/reports/monthly-attendance', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const monthParam = parseInt(req.query.month, 10);
    const yearParam = parseInt(req.query.year, 10);

    if (!monthParam || monthParam < 1 || monthParam > 12 || !yearParam || yearParam < 2000) {
      return res.status(400).json({ error: 'Parametri mese/anno non validi' });
    }

    const startDate = new Date(Date.UTC(yearParam, monthParam - 1, 1));
    const endDate = new Date(Date.UTC(yearParam, monthParam, 0));
    const startISO = startDate.toISOString().split('T')[0];
    const endISO = endDate.toISOString().split('T')[0];

    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, first_name, last_name, role, is_active')
      .neq('role', 'admin')
      .eq('is_active', true);

    if (usersError) {
      console.error('Monthly report users error:', usersError);
      return res.status(500).json({ error: 'Errore nel recupero dei dipendenti' });
    }

    if (!users || users.length === 0) {
      return res
        .status(200)
        .setHeader('Content-Type', 'text/csv; charset=utf-8')
        .setHeader('Content-Disposition', `attachment; filename="report-presenze-${yearParam}-${String(monthParam).padStart(2, '0')}.csv"`)
        .send('\ufeffNome;Cognome;Lunedì;Martedì;Mercoledì;Giovedì;Venerdì;Sabato;Domenica;Ore Permesso;Giorni Malattia;Giorni Ferie\n');
    }

    const userIds = users.map(u => u.id);

    const { data: attendanceData, error: attendanceError } = await supabase
      .from('attendance')
      .select('user_id, date, actual_hours')
      .in('user_id', userIds)
      .gte('date', startISO)
      .lte('date', endISO);

    if (attendanceError) {
      console.error('Monthly report attendance error:', attendanceError);
      return res.status(500).json({ error: 'Errore nel recupero delle presenze' });
    }

    const { data: leaveData, error: leaveError } = await supabase
      .from('leave_requests')
      .select('user_id, type, start_date, end_date, hours, days_requested, permission_type')
      .in('user_id', userIds)
      .eq('status', 'approved')
      .lte('start_date', endISO)
      .gte('end_date', startISO);

    if (leaveError) {
      console.error('Monthly report leave error:', leaveError);
      return res.status(500).json({ error: 'Errore nel recupero dei permessi' });
    }

    // Funzione per convertire ore decimali in formato "Hh Mm"
    const formatHoursToHhMm = (hoursDecimal) => {
      if (hoursDecimal === null || hoursDecimal === undefined || hoursDecimal === 0) {
        return '0h 0m';
      }
      const hours = Math.floor(Math.abs(hoursDecimal));
      const minutes = Math.floor((Math.abs(hoursDecimal) - hours) * 60);
      const sign = hoursDecimal < 0 ? '-' : '';
      return `${sign}${hours}h ${minutes}m`;
    };

    const summary = {};
    users.forEach(user => {
      summary[user.id] = {
        firstName: user.first_name || '',
        lastName: user.last_name || '',
        dowHours: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
        permissionHours: 0,
        sickDays: 0,
        vacationDays: 0
      };
    });

    (attendanceData || []).forEach(record => {
      const entry = summary[record.user_id];
      if (!entry) return;
      const recordDate = new Date(`${record.date}T00:00:00Z`);
      const day = recordDate.getUTCDay();
      entry.dowHours[day] += Number(record.actual_hours || 0);
    });

    const calculateOverlapDays = (requestStart, requestEnd) => {
      const start = new Date(`${requestStart}T00:00:00Z`);
      const end = new Date(`${requestEnd}T00:00:00Z`);
      const monthStart = new Date(`${startISO}T00:00:00Z`);
      const monthEnd = new Date(`${endISO}T00:00:00Z`);
      const overlapStart = start > monthStart ? start : monthStart;
      const overlapEnd = end < monthEnd ? end : monthEnd;
      if (overlapEnd < overlapStart) return 0;
      const diffMs = overlapEnd - overlapStart;
      return Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
    };

    (leaveData || []).forEach(request => {
      const entry = summary[request.user_id];
      if (!entry) return;

      const overlapDays = calculateOverlapDays(request.start_date, request.end_date);
      if (overlapDays <= 0) return;

      if (request.type === 'permission') {
        const requestHours =
          request.hours !== null && request.hours !== undefined
            ? Number(request.hours)
            : overlapDays * 8;
        entry.permissionHours += requestHours;
      } else if (request.type === 'sick_leave') {
        entry.sickDays += overlapDays;
      } else if (request.type === 'vacation') {
        entry.vacationDays += overlapDays;
      }
    });

    const dayOrder = [1, 2, 3, 4, 5, 6, 0];
    const dayLabels = [
      'Lunedì',
      'Martedì',
      'Mercoledì',
      'Giovedì',
      'Venerdì',
      'Sabato',
      'Domenica'
    ];

    const header = [
      'Nome',
      'Cognome',
      ...dayLabels,
      'Ore Permesso',
      'Giorni Malattia',
      'Giorni Ferie'
    ];

    const csvEscape = value => {
      const stringValue = value !== null && value !== undefined ? String(value) : '';
      if (/[\";\\n]/.test(stringValue)) {
        return `"${stringValue.replace(/\"/g, '""')}"`;
      }
      return stringValue;
    };

    // Aggiungi BOM UTF-8 per supporto corretto dei caratteri accentati in Excel
    const lines = ['\ufeff' + header.join(';')];

    Object.values(summary).forEach(entry => {
      const row = [
        csvEscape(entry.firstName),
        csvEscape(entry.lastName),
        ...dayOrder.map(day => formatHoursToHhMm(entry.dowHours[day] || 0)),
        formatHoursToHhMm(entry.permissionHours),
        entry.sickDays,
        entry.vacationDays
      ];
      lines.push(row.join(';'));
    });

    const csvContent = lines.join('\n');
    const monthString = String(monthParam).padStart(2, '0');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="report-presenze-${yearParam}-${monthString}.csv"`);
    res.status(200).send(csvContent);
  } catch (error) {
    console.error('Monthly report error:', error);
    res.status(500).json({ error: 'Errore nella generazione del report' });
  }
});

// Catch-all route for SPA (must be last - only for non-API GET requests)
app.get('*', (req, res) => {
  // Solo per richieste GET che non sono API
  if (!req.path.startsWith('/api/')) {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
  } else {
    res.status(404).json({ error: 'API endpoint non trovato' });
  }
});

// ==================== SISTEMA SALVATAGGIO AUTOMATICO PRESENZE ====================

// Endpoint per salvataggio orario (chiamabile da servizi esterni come cron-job.org)
app.post('/api/cron/hourly-save', async (req, res) => {
  try {
    console.log('🕘 Salvataggio orario richiesto via API...');
    await saveHourlyAttendance();
    res.json({ success: true, message: 'Salvataggio orario completato' });
  } catch (error) {
    console.error('❌ Errore salvataggio orario API:', error);
    res.status(500).json({ error: 'Errore nel salvataggio orario' });
  }
});

// Endpoint di debug per vedere i log della funzione saveHourlyAttendance
app.get('/api/debug/cron-logs', async (req, res) => {
  try {
    const logs = [];
    const originalLog = console.log;
    const originalError = console.error;
    
    // Intercetta i log
    console.log = (...args) => {
      logs.push({ type: 'log', message: args.join(' ') });
      originalLog(...args);
    };
    console.error = (...args) => {
      logs.push({ type: 'error', message: args.join(' ') });
      originalError(...args);
    };
    
    // Esegui la funzione
    await saveHourlyAttendance();
    
    // Ripristina i log
    console.log = originalLog;
    console.error = originalError;
    
    res.json({ success: true, logs });
  } catch (error) {
    console.error('❌ Errore debug:', error);
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});

// Endpoint temporaneo per creare record di test
app.post('/api/test/create-attendance-record', async (req, res) => {
  try {
    console.log('🔧 Creazione record di test...');
    const today = new Date().toISOString().split('T')[0];
    
    // Trova il primo dipendente
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, first_name, last_name')
      .eq('role', 'employee')
      .limit(1);
    
    if (usersError || !users || users.length === 0) {
      return res.status(500).json({ error: 'Nessun dipendente trovato' });
    }
    
    const user = users[0];
    console.log(`🔧 Creando record per: ${user.first_name} ${user.last_name}`);
    
    // Crea record di test
    const { data, error } = await supabase
      .from('attendance')
      .upsert({
        user_id: user.id,
        date: today,
        actual_hours: 0,
        expected_hours: 8,
        balance_hours: -8,
        notes: 'Record di test per malattia'
      }, {
        onConflict: 'user_id,date'
      })
      .select()
      .single();
    
    if (error) {
      console.error('❌ Errore creazione record:', error);
      return res.status(500).json({ error: 'Errore nella creazione del record' });
    }
    
    console.log('✅ Record creato:', data);
    res.json({ success: true, message: 'Record di test creato', record: data });
    
  } catch (error) {
    console.error('❌ Errore endpoint test:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Endpoint per finalizzazione giornaliera
app.post('/api/cron/daily-finalize', async (req, res) => {
  try {
    console.log('🌙 Finalizzazione giornaliera richiesta via API...');
    await finalizeDailyAttendance();
    res.json({ success: true, message: 'Finalizzazione giornaliera completata' });
  } catch (error) {
    console.error('❌ Errore finalizzazione API:', error);
    res.status(500).json({ error: 'Errore nella finalizzazione giornaliera' });
  }
});

/**
 * Salva automaticamente le presenze real-time per tutti i dipendenti
 */
async function saveHourlyAttendance() {
  console.log('🕘 Salvataggio automatico presenze orarie...');
  
  try {
    // Ottieni tutti i dipendenti (non admin)
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, first_name, last_name, role')
      .eq('role', 'employee');
    
    if (usersError) {
      console.error('❌ Errore nel recupero dipendenti:', usersError);
      return;
    }
    
    console.log(`👥 Trovati ${users.length} dipendenti`);
    
    if (!users || users.length === 0) {
      console.log('⚠️  Nessun dipendente trovato');
      return;
    }
    
    const today = new Date().toISOString().split('T')[0];
    let successCount = 0;
    let errorCount = 0;
    
    for (const user of users) {
      try {
        console.log(`🔍 Processando: ${user.first_name} ${user.last_name}`);
        
        // Calcola le ore real-time per questo dipendente oggi
        const dayOfWeek = new Date().getDay();
        const currentHour = new Date().getHours();
        const currentMinute = new Date().getMinutes();
        
        console.log(`📅 Oggi è: giorno ${dayOfWeek}, ora ${currentHour}:${currentMinute}`);
        
        // Ottieni l'orario di lavoro per oggi
        const { data: workSchedules, error: scheduleError } = await supabase
          .from('work_schedules')
          .select('*')
          .eq('user_id', user.id);
        
        if (scheduleError) {
          console.error(`❌ Errore recupero orari per ${user.first_name}:`, scheduleError);
          continue;
        }
        
        if (!workSchedules || workSchedules.length === 0) {
          console.log(`⏭️  Saltato: ${user.first_name} ${user.last_name} - nessun orario configurato`);
          continue;
        }
        
        console.log(`📋 Trovati ${workSchedules.length} orari per ${user.first_name}`);
        
        const todaySchedule = workSchedules.find(schedule => 
          schedule.day_of_week === dayOfWeek && schedule.is_working_day
        );
        
        if (!todaySchedule) {
          console.log(`⏭️  Saltato: ${user.first_name} ${user.last_name} - giorno non lavorativo (giorno ${dayOfWeek})`);
          continue;
        }
        
        console.log(`✅ Trovato orario per ${user.first_name}: ${todaySchedule.start_time} - ${todaySchedule.end_time}`);
        
        // DEBUG: Log dettagliato per Simone
        if (user.first_name === 'Simone') {
          console.log(`🔍 DEBUG SIMONE - Orario schedule:`, {
            start_time: todaySchedule.start_time,
            end_time: todaySchedule.end_time,
            break_duration: todaySchedule.break_duration,
            break_start_time: todaySchedule.break_start_time
          });
        }
        
        // Calcola ore real-time usando la STESSA LOGICA del frontend
        const { start_time, end_time, break_duration, break_start_time } = todaySchedule;
        const [startHour, startMin] = start_time.split(':').map(Number);
        const [endHour, endMin] = end_time.split(':').map(Number);
        const breakDuration = break_duration || 60;
        
        // Calcola ore attese totali dall'orario contrattuale (SEMPRE FISSE!)
        const totalMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);
        const workMinutes = totalMinutes - breakDuration;
        const expectedHours = calculateExpectedHoursForSchedule({ start_time, end_time, break_duration }); // NON ridurre per permessi!
        
        // DEBUG: Log calcolo ore attese per Simone
        if (user.first_name === 'Simone') {
          console.log(`🔍 DEBUG SIMONE - Calcolo ore attese:`, {
            startHour, startMin, endHour, endMin,
            totalMinutes, breakDuration, workMinutes, expectedHours
          });
        }
        
        // Controlla se ci sono permessi per questo dipendente oggi
        const { data: permissions, error: permError } = await supabase
          .from('leave_requests')
          .select('*')
          .eq('user_id', user.id)
          .eq('type', 'permission')
          .eq('status', 'approved')
          .lte('start_date', today)
          .gte('end_date', today);
        
        // DEBUG: Log permessi per Simone
        if (user.first_name === 'Simone') {
          console.log(`🔍 DEBUG SIMONE - Permessi trovati:`, {
            permissionsCount: permissions ? permissions.length : 0,
            permissions: permissions || [],
            permError: permError
          });
        }
        
        // Trova orari effettivi considerando permessi
        let effectiveEndHour = endHour;
        let effectiveEndMin = endMin;
        let effectiveStartHour = startHour;
        let effectiveStartMin = startMin;
        
        if (permissions && permissions.length > 0) {
          for (const perm of permissions) {
            if (perm.permission_type === 'early_exit' && perm.exit_time) {
              const [exitHour, exitMin] = perm.exit_time.split(':').map(Number);
              effectiveEndHour = exitHour;
              effectiveEndMin = exitMin;
              console.log(`🚪 ${user.first_name} ha permesso uscita anticipata alle ${perm.exit_time}`);
            }
            if (perm.permission_type === 'late_entry' && perm.entry_time) {
              const [entryHour, entryMin] = perm.entry_time.split(':').map(Number);
              effectiveStartHour = entryHour;
              effectiveStartMin = entryMin;
              console.log(`🚪 ${user.first_name} ha permesso entrata posticipata alle ${perm.entry_time}`);
            }
          }
        }
        
        // DEBUG: Log orari effettivi per Simone
        if (user.first_name === 'Simone') {
          console.log(`🔍 DEBUG SIMONE - Orari effettivi:`, {
            originalStart: `${startHour}:${startMin}`,
            originalEnd: `${endHour}:${endMin}`,
            effectiveStart: `${effectiveStartHour}:${effectiveStartMin}`,
            effectiveEnd: `${effectiveEndHour}:${effectiveEndMin}`,
            currentTime: `${currentHour}:${currentMinute}`
          });
        }
        
        // Calcola ore effettive real-time
        let actualHours = 0;
        let status = 'not_started';
        
        // DEBUG: Log condizioni per Simone
        if (user.first_name === 'Simone') {
          console.log(`🔍 DEBUG SIMONE - Controllo condizioni:`, {
            currentHour, currentMinute,
            currentHourType: typeof currentHour,
            currentMinuteType: typeof currentMinute,
            effectiveStartHour, effectiveStartMin,
            effectiveStartHourType: typeof effectiveStartHour,
            effectiveEndHour, effectiveEndMin,
            effectiveEndHourType: typeof effectiveEndHour,
            beforeStart: currentHour < effectiveStartHour || (currentHour === effectiveStartHour && currentMinute < effectiveStartMin),
            afterEnd: currentHour > effectiveEndHour || (currentHour === effectiveEndHour && currentMinute >= effectiveEndMin),
            condition1: currentHour < effectiveStartHour,
            condition2: currentHour === effectiveStartHour && currentMinute < effectiveStartMin,
            condition3: currentHour > effectiveEndHour,
            condition4: currentHour === effectiveEndHour && currentMinute >= effectiveEndMin
          });
        }
        
        // Se è prima dell'inizio effettivo (considerando late_entry)
        if (currentHour < effectiveStartHour || (currentHour === effectiveStartHour && currentMinute < effectiveStartMin)) {
          actualHours = 0;
          status = 'not_started';
          if (user.first_name === 'Simone') {
            console.log(`🔍 DEBUG SIMONE - NOT STARTED: actualHours=0`);
          }
        }
        // Se è dopo la fine effettiva (considerando early_exit)
        else if (currentHour > effectiveEndHour || (currentHour === effectiveEndHour && currentMinute >= effectiveEndMin)) {
          // Calcola le ore REALMENTE lavorate (da effectiveStart a effectiveEnd)
          const effectiveWorkMinutes = (effectiveEndHour * 60 + effectiveEndMin) - (effectiveStartHour * 60 + effectiveStartMin) - breakDuration;
          actualHours = effectiveWorkMinutes / 60;
          status = 'completed';
          if (user.first_name === 'Simone') {
            console.log(`🔍 DEBUG SIMONE - COMPLETED:`, {
              effectiveWorkMinutes, actualHours, breakDuration
            });
          }
        }
        // Se è durante l'orario di lavoro
        else {
          if (user.first_name === 'Simone') {
            console.log(`🔍 DEBUG SIMONE - DURANTE LAVORO: Questo NON dovrebbe succedere alle 19:04!`);
          }
          // Determina se è una giornata completa (ha pausa pranzo) o mezza giornata
          const totalWorkMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);
          const hasLunchBreak = totalWorkMinutes > 300; // Più di 5 ore = giornata completa
          
          if (hasLunchBreak) {
            // GIORNATA COMPLETA: usa break_start_time se disponibile, altrimenti 13:00
            const currentTimeInMinutes = currentHour * 60 + currentMinute;
            
            let breakStartInMinutes;
            if (break_start_time) {
              const [breakHour, breakMin] = break_start_time.split(':').map(Number);
              breakStartInMinutes = breakHour * 60 + breakMin;
            } else {
              // Default: 13:00
              breakStartInMinutes = 13 * 60;
            }
            
            const breakEndInMinutes = breakStartInMinutes + breakDuration;
            
            // Calcola minuti dall'inizio EFFETTIVO (considerando late_entry)
            const startTimeInMinutes = effectiveStartHour * 60 + effectiveStartMin;
            
            if (currentTimeInMinutes < breakStartInMinutes) {
              // Prima della pausa pranzo
              const totalMinutesWorked = currentTimeInMinutes - startTimeInMinutes;
              actualHours = totalMinutesWorked / 60;
              status = 'working';
            } else if (currentTimeInMinutes >= breakStartInMinutes && currentTimeInMinutes < breakEndInMinutes) {
              // Durante la pausa pranzo
              const totalMinutesWorked = breakStartInMinutes - startTimeInMinutes;
              actualHours = totalMinutesWorked / 60;
              status = 'on_break';
            } else {
              // Dopo la pausa pranzo
              const morningMinutes = breakStartInMinutes - startTimeInMinutes;
              const afternoonMinutes = currentTimeInMinutes - breakEndInMinutes;
              const totalMinutesWorked = morningMinutes + afternoonMinutes;
              actualHours = totalMinutesWorked / 60;
              status = 'working';
            }
          } else {
            // MEZZA GIORNATA: non ha pausa pranzo (es. 9:00-13:00)
            const minutesFromStart = (currentHour - effectiveStartHour) * 60 + (currentMinute - effectiveStartMin);
            actualHours = minutesFromStart / 60;
            status = 'working';
          }
        }
        
        // DEBUG: Log risultato finale
        const balanceHours = actualHours - expectedHours;
        console.log(`📊 Risultato calcolo ${user.first_name}:`, {
          actualHours: actualHours.toFixed(2),
          expectedHours: expectedHours.toFixed(2),
          balanceHours: balanceHours.toFixed(2),
          status,
          hasPermissions: permissions && permissions.length > 0
        });
        
        // FIX GENERALE: Se dipendente senza permessi dopo la fine dell'orario, deve avere expectedHours
        const isAfterWorkEnd = currentHour > effectiveEndHour || (currentHour === effectiveEndHour && currentMinute >= effectiveEndMin);
        
        if (isAfterWorkEnd && (!permissions || permissions.length === 0)) {
          // Dipendente senza permessi dopo la fine dell'orario = ha lavorato le ore attese
          if (Math.abs(actualHours - expectedHours) > 0.01) {
            console.log(`🔧 FIX ${user.first_name}: Correggo actualHours da ${actualHours.toFixed(2)} a ${expectedHours.toFixed(2)} (no permissions, after work end, status=${status})`);
            actualHours = expectedHours;
            status = 'completed'; // Forza anche lo status
          }
        }
        
        // Salva SEMPRE i dati per giorni lavorativi (anche se actualHours = 0)
        console.log(`💾 Tentativo salvataggio: ${user.first_name} - ${actualHours.toFixed(2)}h/${expectedHours}h - Status: ${status}`);
        
        const { error: saveError } = await supabase
          .from('attendance')
          .upsert({
            user_id: user.id,
            date: today,
            actual_hours: Math.round(actualHours * 100) / 100,
            expected_hours: Math.round(expectedHours * 100) / 100,
            balance_hours: Math.round((actualHours - expectedHours) * 100) / 100,
            notes: 'Salvataggio automatico orario'
          }, {
            onConflict: 'user_id,date'
          });
        
        if (saveError) {
          console.error(`❌ Errore salvataggio per ${user.first_name} ${user.last_name}:`, saveError);
          errorCount++;
        } else {
          console.log(`✅ Salvato: ${user.first_name} ${user.last_name} - ${actualHours.toFixed(2)}h (${status})`);
          successCount++;
        }
        
      } catch (error) {
        console.error(`❌ Errore per ${user.first_name} ${user.last_name}:`, error.message);
        errorCount++;
      }
    }
    
    console.log(`✅ Salvataggio automatico completato: ${successCount} salvati, ${errorCount} errori`);
    
  } catch (error) {
    console.error('❌ Errore durante il salvataggio automatico:', error.message);
  }
}

/**
 * Finalizza la giornata appena conclusa per tutti i dipendenti
 */
async function finalizeDailyAttendance() {
  console.log('🌙 Finalizzazione automatica giornata appena conclusa...');
  
  try {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    
    console.log(`📅 Finalizzazione per il giorno: ${yesterdayStr}`);
    
    // Ottieni tutti i dipendenti (non admin)
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, first_name, last_name, role')
      .eq('role', 'employee');
    
    if (usersError) {
      console.error('❌ Errore nel recupero dipendenti:', usersError);
      return;
    }
    
    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;
    
    for (const user of users) {
      try {
        // Controlla se esiste già un record per ieri
        const { data: existingRecord } = await supabase
          .from('attendance')
          .select('*')
          .eq('user_id', user.id)
          .eq('date', yesterdayStr)
          .single();
        
        if (existingRecord && existingRecord.actual_hours > 0) {
          console.log(`✅ Già finalizzato: ${user.first_name} ${user.last_name} - ${existingRecord.actual_hours}h`);
          skippedCount++;
          continue;
        }
        
        // Calcola le ore finali per ieri
        const dayOfWeek = yesterday.getDay();
        const { data: workSchedules } = await supabase
          .from('work_schedules')
          .select('*')
          .eq('user_id', user.id);
        
        const yesterdaySchedule = workSchedules?.find(schedule => 
          schedule.day_of_week === dayOfWeek && schedule.is_working_day
        );
        
        if (!yesterdaySchedule) {
          console.log(`⏭️  Saltato: ${user.first_name} ${user.last_name} - giorno non lavorativo`);
          skippedCount++;
          continue;
        }
        
        // Per una giornata completa, le ore effettive = ore attese
        const { start_time, end_time, break_duration } = yesterdaySchedule;
        const [startHour, startMin] = start_time.split(':').map(Number);
        const [endHour, endMin] = end_time.split(':').map(Number);
        const breakDuration = break_duration || 60;
        
        const totalMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);
        const workMinutes = totalMinutes - breakDuration;
        const finalExpectedHours = workMinutes / 60;
        const finalActualHours = finalExpectedHours; // Giornata completa
        const finalBalanceHours = 0;
        
        // Salva il record finale per ieri
        const { error: saveError } = await supabase
          .from('attendance')
          .upsert({
            user_id: user.id,
            date: yesterdayStr,
            actual_hours: Math.round(finalActualHours * 100) / 100,
            expected_hours: Math.round(finalExpectedHours * 100) / 100,
            balance_hours: Math.round(finalBalanceHours * 100) / 100,
            notes: 'Finalizzazione automatica giornata'
          }, {
            onConflict: 'user_id,date'
          });
        
        if (saveError) {
          console.error(`❌ Errore finalizzazione per ${user.first_name} ${user.last_name}:`, saveError);
          errorCount++;
        } else {
          console.log(`✅ Finalizzato: ${user.first_name} ${user.last_name} - ${finalActualHours}h`);
          successCount++;
        }
        
      } catch (error) {
        console.error(`❌ Errore per ${user.first_name} ${user.last_name}:`, error.message);
        errorCount++;
      }
    }
    
    console.log(`✅ Finalizzazione automatica completata: ${successCount} finalizzati, ${skippedCount} saltati, ${errorCount} errori`);
    
  } catch (error) {
    console.error('❌ Errore durante la finalizzazione automatica:', error.message);
  }
}

// Cron job per salvataggio ogni ora (minuto 0)
const hourlySaveJob = cron.schedule('0 * * * *', async () => {
  await saveHourlyAttendance();
}, {
  scheduled: false, // Verrà avviato dopo
  timezone: 'Europe/Rome'
});

// Cron job per finalizzazione giornata a mezzanotte
const dailyFinalizeJob = cron.schedule('0 0 * * *', async () => {
  await finalizeDailyAttendance();
}, {
  scheduled: false, // Verrà avviato dopo
  timezone: 'Europe/Rome'
});

// Endpoint per correggere i dati errati di Simone
app.post('/api/admin/fix-simone-data', authenticateToken, requireAdmin, async (req, res) => {
  try {
    console.log('🔧 Correzione dati Simone...');
    
    // Trova Simone
    const { data: simone, error: userError } = await supabase
      .from('users')
      .select('id, first_name, last_name')
      .eq('first_name', 'Simone')
      .eq('last_name', 'Azzinelli')
      .single();
      
    if (userError) {
      console.error('❌ Errore nel trovare Simone:', userError);
      return res.status(404).json({ error: 'Simone non trovato' });
    }
    
    console.log('👤 Simone trovato:', simone);
    
    // Controlla tutte le presenze di Simone
    const { data: attendance, error: attError } = await supabase
      .from('attendance')
      .select('*')
      .eq('user_id', simone.id)
      .order('date', { ascending: false });
      
    if (attError) {
      console.error('❌ Errore nel recuperare presenze:', attError);
      return res.status(500).json({ error: 'Errore nel recuperare presenze' });
    }
    
    console.log('📊 Presenze Simone trovate:', attendance.length);
    
    // Mostra i dati attuali
    const currentData = attendance.map(record => ({
      date: record.date,
      actual_hours: record.actual_hours,
      expected_hours: record.expected_hours,
      balance_hours: record.balance_hours
    }));
    
    // Calcola saldo totale attuale
    const totalBalance = attendance.reduce((sum, record) => sum + (record.balance_hours || 0), 0);
    console.log('💰 Saldo totale attuale Simone:', totalBalance, 'h');
    
    if (totalBalance !== 0) {
      console.log('🔧 Correggo i dati di Simone...');
      
      // Per ogni record, correggo il balance_hours a 0
      for (const record of attendance) {
        const correctedBalance = 0;
        const correctedActualHours = record.expected_hours; // Assume che abbia lavorato le ore complete
        
        console.log(`🔧 Correggo ${record.date}: ${record.balance_hours}h → ${correctedBalance}h`);
        
        const { error: updateError } = await supabase
          .from('attendance')
          .update({
            balance_hours: correctedBalance,
            actual_hours: correctedActualHours
          })
          .eq('id', record.id);
          
        if (updateError) {
          console.error(`❌ Errore nell'aggiornare ${record.date}:`, updateError);
        } else {
          console.log(`✅ Corretto ${record.date}`);
        }
      }
      
      console.log('🎉 Correzione completata! Simone ora ha saldo 0h');
      
      res.json({
        success: true,
        message: 'Dati di Simone corretti con successo',
        previousBalance: totalBalance,
        newBalance: 0,
        recordsUpdated: attendance.length,
        previousData: currentData
      });
    } else {
      console.log('✅ Simone ha già saldo 0h, nessuna correzione necessaria');
      res.json({
        success: true,
        message: 'Simone ha già saldo 0h',
        balance: 0,
        data: currentData
      });
    }
    
  } catch (error) {
    console.error('❌ Errore generale:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Endpoint temporaneo per applicare migration break_start_time
app.post('/api/admin/migrate/break-start-time', authenticateToken, requireAdmin, async (req, res) => {
  try {
    console.log('🔧 Applicazione migration break_start_time...');

    // 1. Verifica se la colonna esiste già
    const { data: checkData, error: checkError } = await supabase
      .from('work_schedules')
      .select('break_start_time')
      .limit(1);

    let columnExists = !checkError;
    
    if (!columnExists) {
      console.log('➕ Colonna non esiste, creazione in corso...');
      // Crea la colonna con RawSQL (se Supabase lo supporta)
      // Altrimenti dovrà essere fatto manualmente su Supabase dashboard
      return res.json({
        success: false,
        message: 'La colonna break_start_time deve essere aggiunta manualmente su Supabase Dashboard',
        sql: 'ALTER TABLE work_schedules ADD COLUMN break_start_time TIME DEFAULT \'13:00\';'
      });
    }

    // 2. Aggiorna i record esistenti con 13:00 come default
    const { data: updated, error: updateError } = await supabase
      .from('work_schedules')
      .update({ break_start_time: '13:00' })
      .is('break_start_time', null)
      .eq('is_working_day', true)
      .select();

    if (updateError) {
      console.error('❌ Errore aggiornamento:', updateError);
      return res.status(500).json({ error: updateError.message });
    }

    console.log(`✅ ${updated?.length || 0} record aggiornati`);
    
    res.json({
      success: true,
      message: `Migration completata! ${updated?.length || 0} orari aggiornati con break_start_time = 13:00`,
      updated: updated?.length || 0
    });
  } catch (error) {
    console.error('❌ Migration error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 🔐 Endpoint temporaneo per resettare password di Adriano
app.post('/api/admin/reset-adriano-password', async (req, res) => {
  try {
    const bcrypt = require('bcrypt');
    const hashedPassword = await bcrypt.hash('adriano26', 10);

    const { data: updated, error: updateError } = await supabase
      .from('users')
      .update({ password: hashedPassword })
      .eq('email', 'adriano.toccafondi@labafirenze.com')
      .select();

    if (updateError) {
      return res.status(500).json({ error: updateError.message });
    }

    console.log(`✅ Password di Adriano resettata a "adriano26"`);
    res.json({ success: true, message: 'Password resettata a "adriano26"' });
  } catch (error) {
    console.error('❌ Reset password error:', error);
    res.status(500).json({ error: error.message });
  }
});

server.listen(PORT, () => {
  console.log(`🚀 Server HR LABA avviato su porta ${PORT}`);
  console.log(`📊 Dashboard: http://localhost:${PORT}`);
  console.log(`🔗 Frontend URL: ${process.env.FRONTEND_URL || 'https://hr.laba.biz'}`);
  console.log(`🗄️  Database: ${supabaseUrl}`);
  console.log(`🔌 WebSocket attivo per aggiornamenti real-time`);
  
  // Avvia Email Scheduler
  emailScheduler.start();
  
  // Avvia Attendance Scheduler
  const attendanceScheduler = new AttendanceScheduler();
  attendanceScheduler.start();
  
  // Avvia Sistema Salvataggio Automatico Presenze
  console.log('🕘 Avvio sistema salvataggio automatico presenze...');
  hourlySaveJob.start();
  dailyFinalizeJob.start();
  console.log('✅ Sistema salvataggio automatico presenze attivato');
  console.log('📅 Salvataggio ore: Ogni ora al minuto 0');
  console.log('📅 Finalizzazione giornata: Ogni giorno a mezzanotte');
});

module.exports = app;

// Silence verbose emoji logs in production
if (process.env.NODE_ENV === 'production' && process.env.VERBOSE_LOGS !== 'true') {
  const originalLog = console.log;
  console.log = (...args) => {
    const first = args[0];
    if (typeof first === 'string' && /^(🔍|📊|🔄|✅|🔌|🔵|🏥|📋|⚠️|💰|🕐|🚪|👥|🔎)/.test(first)) {
      return; // skip verbose logs
    }
    originalLog(...args);
  };
}

// Get total hours bank balance for multiple users (admin only)
app.get('/api/attendance/total-balances', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Accesso negato' });
    }

    // optional CSV of userIds: ?userIds=a,b,c
    const userIdsParam = req.query.userIds;
    const shouldFilter = !!userIdsParam;
    const userIds = shouldFilter ? userIdsParam.split(',').map(s => s.trim()).filter(Boolean) : null;

    let query = supabase
      .from('attendance')
      .select('user_id, balance_hours');

    if (shouldFilter && userIds && userIds.length > 0) {
      query = query.in('user_id', userIds);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Total balances fetch error:', error);
      return res.status(500).json({ error: 'Errore nel recupero dei saldi' });
    }

    // Aggregate in memory (Supabase JS lacks groupBy client side)
    const totals = {};
    for (const row of data || []) {
      const uid = row.user_id;
      const bal = row.balance_hours || 0;
      totals[uid] = (totals[uid] || 0) + bal;
    }

    res.json({ success: true, balances: totals });
  } catch (error) {
    console.error('Total balances error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});
