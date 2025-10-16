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
      
      workSchedulesToCreate = Object.entries(workSchedules).map(([day, schedule]) => ({
        user_id: newUser.id,
        day_of_week: dayMapping[day],
        is_working_day: schedule.isWorking,
        work_type: 'full_day',
        start_time: schedule.isWorking ? schedule.startTime : null,
        end_time: schedule.isWorking ? schedule.endTime : null,
        break_duration: schedule.isWorking ? schedule.breakDuration : 0
      }));
    } else {
      // Fallback: orari di default se non forniti
      workSchedulesToCreate = [
        { user_id: newUser.id, day_of_week: 1, is_working_day: true, work_type: 'full_day', start_time: '09:00', end_time: '18:00', break_duration: 60 },
        { user_id: newUser.id, day_of_week: 2, is_working_day: true, work_type: 'full_day', start_time: '09:00', end_time: '18:00', break_duration: 60 },
        { user_id: newUser.id, day_of_week: 3, is_working_day: true, work_type: 'full_day', start_time: '09:00', end_time: '18:00', break_duration: 60 },
        { user_id: newUser.id, day_of_week: 4, is_working_day: true, work_type: 'full_day', start_time: '09:00', end_time: '18:00', break_duration: 60 },
        { user_id: newUser.id, day_of_week: 5, is_working_day: true, work_type: 'full_day', start_time: '09:00', end_time: '18:00', break_duration: 60 },
        { user_id: newUser.id, day_of_week: 6, is_working_day: false, work_type: 'full_day', start_time: null, end_time: null, break_duration: 0 },
        { user_id: newUser.id, day_of_week: 0, is_working_day: false, work_type: 'full_day', start_time: null, end_time: null, break_duration: 0 }
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
        firstName: emp.first_name,
        lastName: emp.last_name,
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
      const startDate = `${year}-${month.padStart(2, '0')}-01`;
      const endDate = new Date(year, month, 0).toISOString().split('T')[0];
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
    const targetUserId = userId || req.user.id;
    let leaveQuery = supabase
      .from('leave_requests')
      .select('*')
      .eq('user_id', targetUserId)
      .eq('status', 'approved');
    
    if (month && year) {
      const startDate = `${year}-${month.padStart(2, '0')}-01`;
      const endDate = new Date(year, month, 0).toISOString().split('T')[0];
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

    // Verifica permessi
    if (req.user.role === 'employee') {
      // Employee può salvare solo i propri dati
      const targetUserId = req.user.id;
    } else {
      // Admin può salvare per qualsiasi utente
      const targetUserId = req.body.userId || req.user.id;
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
      attendance: data
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
    
    // Verifica permessi
    if (req.user.role === 'employee' && targetUserId !== req.user.id) {
      return res.status(403).json({ error: 'Accesso negato' });
    }

    // Calcola il balance dalle presenze del mese
    const targetYear = year || new Date().getFullYear();
    const targetMonth = month || new Date().getMonth() + 1;
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

    // Calculate real-time hours for today (hybrid system)
    const today = new Date().toISOString().split('T')[0];
    const todayRecord = attendance.find(record => record.date === today);
    
    let realTimeActualHours = 0;
    let realTimeExpectedHours = 0;
    let hasRealTimeCalculation = false;
    
    // Always calculate real-time if today is within the month range
    const todayDate = new Date();
    const isCurrentMonth = todayDate.getFullYear() === parseInt(targetYear) && 
                          (todayDate.getMonth() + 1) === parseInt(targetMonth);
    
    if (isCurrentMonth && workSchedules && workSchedules.length > 0) {
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const dayOfWeek = now.getDay();
      
      // Find today's work schedule
      const todaySchedule = workSchedules.find(schedule => 
        schedule.day_of_week === dayOfWeek && schedule.is_working_day
      );
      
      if (todaySchedule) {
        const { start_time, end_time, break_duration } = todaySchedule;
        const [startHour, startMin] = start_time.split(':').map(Number);
        const [endHour, endMin] = end_time.split(':').map(Number);
        const breakDuration = break_duration || 60;
        
        // Calculate expected hours
        const totalMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);
        const workMinutes = totalMinutes - breakDuration;
        realTimeExpectedHours = workMinutes / 60;
        
        // Calculate real-time hours (same logic as frontend)
        if (currentHour < startHour || (currentHour === startHour && currentMinute < startMin)) {
          realTimeActualHours = 0;
        } else if (currentHour > endHour || (currentHour === endHour && currentMinute >= endMin)) {
          realTimeActualHours = realTimeExpectedHours;
        } else {
          // During work time - calculate with lunch break logic
          const minutesFromStart = (currentHour - startHour) * 60 + (currentMinute - startMin);
          const totalWorkMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);
          const hasLunchBreak = totalWorkMinutes > 300;
          
          let totalMinutesWorked = 0;
          
          if (hasLunchBreak) {
            // FULL DAY: has lunch break
            const morningEndMinutes = (totalWorkMinutes - breakDuration) / 2;
            const breakStartMinutes = morningEndMinutes;
            const breakEndMinutes = morningEndMinutes + breakDuration;
            
            if (minutesFromStart < breakStartMinutes) {
              totalMinutesWorked = minutesFromStart;
            } else if (minutesFromStart >= breakStartMinutes && minutesFromStart < breakEndMinutes) {
              totalMinutesWorked = breakStartMinutes;
            } else {
              const morningMinutes = breakStartMinutes;
              const afternoonMinutes = minutesFromStart - breakEndMinutes;
              totalMinutesWorked = morningMinutes + afternoonMinutes;
            }
          } else {
            // HALF DAY: no lunch break
            totalMinutesWorked = minutesFromStart;
          }
          
          realTimeActualHours = totalMinutesWorked / 60;
        }
        
        hasRealTimeCalculation = true;
        console.log(`🕐 Real-time calculation for today: ${realTimeActualHours.toFixed(2)}h worked, ${realTimeExpectedHours.toFixed(2)}h expected`);
      }
    }

    // Calculate statistics with real-time data for today ONLY
    let totalActualHours = 0;
    let totalExpectedHours = 0;
    
    // If we have real-time calculation for today, use ONLY that (ignore DB record for today)
    if (hasRealTimeCalculation && isCurrentMonth) {
      // Use real-time for today
      totalActualHours = realTimeActualHours;
      totalExpectedHours = realTimeExpectedHours;
      
      // Add other days from database (excluding today if it exists)
      attendance.forEach(record => {
        if (record.date !== today) {
          totalActualHours += record.actual_hours || 0;
          totalExpectedHours += record.expected_hours || 8;
        }
      });
    } else {
      // No real-time calculation, use all database values
      attendance.forEach(record => {
        totalActualHours += record.actual_hours || 0;
        totalExpectedHours += record.expected_hours || 8;
      });
    }
    
    const totalBalance = totalActualHours - totalExpectedHours;
    
    const overtimeHours = attendance.reduce((sum, record) => {
      const balance = record.balance_hours || 0;
      return balance > 0 ? sum + balance : sum;
    }, 0);
    
    // Deficit = ore mancanti (sempre positivo per chiarezza)
    const deficitHours = attendance.reduce((sum, record) => {
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
      is_overtime, 
      is_early_departure, 
      is_late_arrival, 
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
        is_overtime,
        is_early_departure,
        is_late_arrival,
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

    // Genera presenze automatiche usando la funzione del database
    const { error } = await supabase.rpc('generate_automatic_attendance', {
      p_user_id: userId,
      p_start_date: startDate,
      p_end_date: endDate
    });

    if (error) {
      console.error('Generate attendance error:', error);
      return res.status(500).json({ error: 'Errore nella generazione delle presenze' });
    }

    res.json({
      success: true,
      message: 'Presenze generate con successo'
    });
  } catch (error) {
    console.error('Generate attendance error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
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

    const today = new Date().toISOString().split('T')[0];
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const dayOfWeek = now.getDay();
    
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
    
    // Calculate real-time attendance for each user
    const currentAttendance = allUsers.map(user => {
      console.log(`🔍 Processing user: ${user.first_name} ${user.last_name}`);
      console.log(`🔍 User work_schedules:`, user.work_schedules?.length || 0);
      
      // Find today's work schedule
      const todaySchedule = user.work_schedules?.find(schedule => 
        schedule.day_of_week === dayOfWeek && schedule.is_working_day
      );
      
      console.log(`🔍 Today schedule found:`, !!todaySchedule);
      if (todaySchedule) {
        console.log(`🔍 Schedule: ${todaySchedule.start_time}-${todaySchedule.end_time}, break: ${todaySchedule.break_duration}min`);
      }
      
      if (!todaySchedule) {
        return {
          user_id: user.id,
          name: `${user.first_name} ${user.last_name}`,
          department: user.department || 'Non specificato',
          is_working_day: false,
          status: 'non_working_day',
          actual_hours: 0,
          expected_hours: 0,
          balance_hours: 0
        };
      }

      const { start_time, end_time, break_duration } = todaySchedule;
      const [startHour, startMin] = start_time.split(':').map(Number);
      const [endHour, endMin] = end_time.split(':').map(Number);
      const breakDuration = break_duration || 60;
      
      // Calculate expected hours
      const totalMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);
      const workMinutes = totalMinutes - breakDuration;
      const expectedHours = workMinutes / 60;
      
      // Calculate real-time hours (same logic as employee page)
      let actualHours = 0;
      let status = 'not_started';
      
      if (currentHour < startHour || (currentHour === startHour && currentMinute < startMin)) {
        actualHours = 0;
        status = 'not_started';
      } else if (currentHour > endHour || (currentHour === endHour && currentMinute >= endMin)) {
        actualHours = expectedHours;
        status = 'completed';
      } else {
        // During work time - calculate with lunch break logic
        const minutesFromStart = (currentHour - startHour) * 60 + (currentMinute - startMin);
        const totalWorkMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);
        const hasLunchBreak = totalWorkMinutes > 300;
        
        let totalMinutesWorked = 0;
        
        if (hasLunchBreak) {
          // FULL DAY: has lunch break
          const morningEndMinutes = (totalWorkMinutes - breakDuration) / 2;
          const breakStartMinutes = morningEndMinutes;
          const breakEndMinutes = morningEndMinutes + breakDuration;
          
          if (minutesFromStart < breakStartMinutes) {
            totalMinutesWorked = minutesFromStart;
            status = 'working';
          } else if (minutesFromStart >= breakStartMinutes && minutesFromStart < breakEndMinutes) {
            totalMinutesWorked = breakStartMinutes;
            status = 'on_break';
          } else {
            const morningMinutes = breakStartMinutes;
            const afternoonMinutes = minutesFromStart - breakEndMinutes;
            totalMinutesWorked = morningMinutes + afternoonMinutes;
            status = 'working';
          }
        } else {
          // HALF DAY: no lunch break
          totalMinutesWorked = minutesFromStart;
          status = 'working';
        }
        
        actualHours = totalMinutesWorked / 60;
      }
      
      const balanceHours = actualHours - expectedHours;
      
      const result = {
        user_id: user.id,
        name: `${user.first_name} ${user.last_name}`,
        department: user.department || 'Non specificato',
        is_working_day: true,
        status,
        actual_hours: Math.round(actualHours * 10) / 10,
        expected_hours: Math.round(expectedHours * 10) / 10,
        balance_hours: Math.round(balanceHours * 10) / 10,
        start_time,
        end_time,
        break_duration: breakDuration
      };
      
      console.log(`🔍 User result: ${result.name} - Status: ${result.status}, Hours: ${result.actual_hours}h, Working day: ${result.is_working_day}`);
      return result;
    });

    console.log(`🔍 Total calculated attendance records: ${currentAttendance.length}`);
    console.log(`🔍 All records:`, currentAttendance.map(emp => `${emp.name}: ${emp.status} (${emp.actual_hours}h)`));

    // Filter to show only those who should be working today and are currently working (not completed)
    const currentlyWorking = currentAttendance.filter(emp => 
      emp.is_working_day && (emp.status === 'working' || emp.status === 'on_break')
    );

    console.log(`🔍 Filtered currently working: ${currentlyWorking.length}`);
    console.log(`🔍 Currently working:`, currentlyWorking.map(emp => `${emp.name}: ${emp.status}`));

    res.json(currentlyWorking);
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
    const { start_time, end_time, break_duration } = schedule;
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
    const today = new Date().toISOString().split('T')[0];
    const now = new Date();
    const currentTime = now.toTimeString().substring(0, 5); // HH:MM format
    
    // Ottieni l'orario di lavoro per oggi
    const dayOfWeek = now.getDay();
    const { data: schedule, error: scheduleError } = await supabase
      .from('work_schedules')
      .select('*')
      .eq('user_id', userId)
      .eq('day_of_week', dayOfWeek)
      .eq('is_working_day', true)
      .single();

    if (scheduleError || !schedule) {
      return res.json({
        isWorkingDay: false,
        message: 'Nessun orario di lavoro per oggi'
      });
    }

    const { start_time, end_time, break_duration } = schedule;
    
    // Calcola ore attese
    const startTime = new Date(`2000-01-01T${start_time}`);
    const endTime = new Date(`2000-01-01T${end_time}`);
    const totalMinutes = (endTime - startTime) / (1000 * 60);
    const workMinutes = totalMinutes - (break_duration || 60);
    const expectedHours = workMinutes / 60;

    // Calcola ore effettive basate sull'orario corrente
    let actualHours = 0;
    let status = 'not_started';
    
    if (currentTime >= start_time) {
      if (currentTime <= end_time) {
        // Durante l'orario di lavoro
        const currentTimeObj = new Date(`2000-01-01T${currentTime}`);
        const workedMinutes = (currentTimeObj - startTime) / (1000 * 60);
        
        // Pausa pranzo fissa dalle 13:00 alle 14:00 (o come configurato)
        const breakStartTime = new Date(`2000-01-01T13:00`);
        const breakEndTime = new Date(`2000-01-01T14:00`);
        
        if (currentTimeObj >= breakStartTime && currentTimeObj <= breakEndTime) {
          // Durante la pausa pranzo
          actualHours = (breakStartTime - startTime) / (1000 * 60) / 60;
          status = 'on_break';
        } else if (currentTimeObj > breakEndTime) {
          // Dopo la pausa pranzo
          const morningMinutes = (breakStartTime - startTime) / (1000 * 60);
          const afternoonMinutes = (currentTimeObj - breakEndTime) / (1000 * 60);
          actualHours = (morningMinutes + afternoonMinutes) / 60;
          status = 'working';
        } else {
          // Prima della pausa pranzo
          actualHours = workedMinutes / 60;
          status = 'working';
        }
      } else {
        // Dopo l'orario di lavoro
        actualHours = expectedHours;
        status = 'completed';
      }
    }

    // Calcola saldo ore
    const balanceHours = actualHours - expectedHours;

    res.json({
      isWorkingDay: true,
      schedule: {
        start_time,
        end_time,
        break_duration: break_duration || 60
      },
      currentTime,
      expectedHours: Math.round(expectedHours * 10) / 10,
      actualHours: Math.round(actualHours * 10) / 10,
      balanceHours: Math.round(balanceHours * 10) / 10,
      status,
      progress: Math.min((actualHours / expectedHours) * 100, 100)
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

    // Calcola ore attese CORRETTE: 9-18 con 1h pausa = 8h
    const startTime = new Date(`2000-01-01T${start_time}`);
    const endTime = new Date(`2000-01-01T${end_time}`);
    const totalMinutes = (endTime - startTime) / (1000 * 60); // Minuti totali (9 ore = 540 min)
    const workMinutes = totalMinutes - (break_duration || 60); // Sottrai pausa (540 - 60 = 480 min)
    const expectedHours = workMinutes / 60; // Converti in ore (480/60 = 8h)

    // Calcola ore effettive basate sull'orario corrente
    let actualHours = 0;
    let status = 'not_started';
    
    if (currentTime >= start_time) {
      if (currentTime <= end_time) {
        // Durante l'orario di lavoro
        const currentTimeObj = new Date(`2000-01-01T${currentTime}`);
        const workedMinutes = (currentTimeObj - startTime) / (1000 * 60);
        
        // Pausa pranzo fissa dalle 13:00 alle 14:00 (o come configurato)
        const breakStartTime = new Date(`2000-01-01T13:00`);
        const breakEndTime = new Date(`2000-01-01T14:00`);
        
        if (currentTimeObj >= breakStartTime && currentTimeObj <= breakEndTime) {
          // Durante la pausa pranzo
          actualHours = (breakStartTime - startTime) / (1000 * 60) / 60;
          status = 'on_break';
        } else if (currentTimeObj > breakEndTime) {
          // Dopo la pausa pranzo
          const morningMinutes = (breakStartTime - startTime) / (1000 * 60);
          const afternoonMinutes = (currentTimeObj - breakEndTime) / (1000 * 60);
          actualHours = (morningMinutes + afternoonMinutes) / 60;
          status = 'working';
        } else {
          // Prima della pausa pranzo
          actualHours = workedMinutes / 60;
          status = 'working';
        }
      } else {
        // Dopo l'orario di lavoro
        actualHours = expectedHours;
        status = 'completed';
      }
    }

    // Calcola saldo ore
    const balanceHours = actualHours - expectedHours;
    
    console.log(`📊 Calculated: expected=${expectedHours}h, actual=${actualHours}h, balance=${balanceHours}h, status=${status}`);

    // Aggiorna o crea la presenza per oggi
    const { data: existingAttendance } = await supabase
      .from('attendance')
      .select('id')
      .eq('user_id', userId)
      .eq('date', today)
      .single();

    if (existingAttendance) {
      // Aggiorna presenza esistente
      const { error: updateError } = await supabase
        .from('attendance')
        .update({
          actual_hours: actualHours,
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
          expected_hours: expectedHours,
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
        actualHours: Math.round(actualHours * 10) / 10,
        balanceHours: Math.round(balanceHours * 10) / 10,
        status,
        progress: Math.min((actualHours / expectedHours) * 100, 100)
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

    res.json({
      success: true,
      details: {
        attendance,
        schedule,
        summary: {
          date: attendance.date,
          employee: `${attendance.users.first_name} ${attendance.users.last_name}`,
          expectedHours: attendance.expected_hours || 8,
          actualHours: attendance.actual_hours || 0,
          balanceHours: attendance.balance_hours || 0,
          status: attendance.actual_hours > 0 ? 'Presente' : 'Assente',
          notes: attendance.notes || 'Nessuna nota'
        }
      }
    });
  } catch (error) {
    console.error('Attendance details error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
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

// Create leave request
app.post('/api/leave-requests', authenticateToken, async (req, res) => {
  try {
    const { type, startDate, endDate, reason, notes, permissionType, hours, exitTime, entryTime, doctor } = req.body;

    // Validation
    if (!type || !startDate || !endDate) {
      return res.status(400).json({ error: 'Campi obbligatori mancanti' });
    }
    
    // Reason is required only for certain types
    if (type !== 'vacation' && type !== 'permission' && !reason) {
      return res.status(400).json({ error: 'Motivo richiesto per questo tipo di richiesta' });
    }

    // Calcola i giorni richiesti
    const start = new Date(startDate);
    const end = new Date(endDate);
    const daysRequested = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

    // Prepara i dati per l'inserimento, escludendo i campi che potrebbero non esistere
    const insertData = {
      user_id: req.user.id,
      type: type, // 'permission', 'sick', 'vacation'
      start_date: startDate,
      end_date: endDate,
      reason: reason || (type === 'vacation' ? 'Ferie' : ''),
      status: 'pending',
      submitted_at: new Date().toISOString(),
      days_requested: daysRequested
    };

    // Aggiungi campi opzionali solo se sono definiti
    if (notes !== undefined) insertData.notes = notes;
    if (doctor !== undefined) insertData.doctor = doctor;
    if (permissionType !== undefined) insertData.permission_type = permissionType;
    if (hours !== undefined) insertData.hours = hours;
    if (exitTime !== undefined) insertData.exit_time = exitTime;
    if (entryTime !== undefined) insertData.entry_time = entryTime;

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

    // TEMPORANEAMENTE DISABILITATO per Railway
    console.log('⚠️ Notifiche temporaneamente disabilitate per Railway - richiesta creata con successo');

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
    if (hours !== undefined) insertData.hours = hours;
    if (exitTime !== undefined) insertData.exit_time = exitTime;
    if (entryTime !== undefined) insertData.entry_time = entryTime;

    console.log('🔧 Admin creating leave request for employee:', employee.email, insertData);

    const { data: newRequest, error } = await supabase
      .from('leave_requests')
      .insert([insertData])
      .select()
      .single();

    if (error) {
      console.error('❌ Admin leave request creation error:', error);
      return res.status(500).json({ error: 'Errore nella creazione della richiesta' });
    }

    console.log('✅ Admin leave request created successfully:', newRequest.id);

    // Crea notifica per il dipendente
    try {
      const notificationData = {
        user_id: userId,
        type: 'leave_approved',
        title: `${type === 'vacation' ? 'Ferie' : type === 'sick_leave' ? 'Malattia' : 'Permesso'} aggiunto dall'admin`,
        message: `L'amministratore ha registrato ${type === 'vacation' ? 'ferie' : type === 'sick_leave' ? 'una malattia' : 'un permesso'} dal ${new Date(startDate).toLocaleDateString('it-IT')} al ${new Date(endDate).toLocaleDateString('it-IT')}. ${reason ? `Motivo: ${reason}` : ''}`,
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
      const typeLabel = type === 'vacation' ? 'Ferie' : type === 'sick_leave' ? 'Malattia' : 'Permesso';
      
      await sendEmail(
        employee.email,
        'leaveApproved',
        [
          `${employee.first_name} ${employee.last_name}`,
          typeLabel,
          new Date(startDate).toLocaleDateString('it-IT'),
          new Date(endDate).toLocaleDateString('it-IT'),
          reason || 'Non specificato',
          '[Registrato dall\'amministratore]'
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

        await supabase
          .from('notifications')
          .insert([
            {
              user_id: updatedRequest.user_id,
              title: `Richiesta ${typeLabels[updatedRequest.type] || updatedRequest.type} ${statusLabels[status]}`,
              message: `La tua richiesta di ${typeLabels[updatedRequest.type] || updatedRequest.type} dal ${updatedRequest.start_date} al ${updatedRequest.end_date} è stata ${statusLabels[status]}${notes ? `. Note: ${notes}` : ''}`,
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
      .eq('year', parseInt(year))
      .order('date');

    if (error) {
      console.error('Holidays fetch error:', error);
      // Se la tabella non esiste o ha errori, restituisci giorni festivi di default
      const defaultHolidays = [
        { id: '1', name: 'Capodanno', date: `${year}-01-01`, year: parseInt(year), type: 'national' },
        { id: '2', name: 'Epifania', date: `${year}-01-06`, year: parseInt(year), type: 'national' },
        { id: '3', name: 'Festa del Lavoro', date: `${year}-05-01`, year: parseInt(year), type: 'national' },
        { id: '4', name: 'Festa della Repubblica', date: `${year}-06-02`, year: parseInt(year), type: 'national' },
        { id: '5', name: 'Ferragosto', date: `${year}-08-15`, year: parseInt(year), type: 'national' },
        { id: '6', name: 'Tutti i Santi', date: `${year}-11-01`, year: parseInt(year), type: 'national' },
        { id: '7', name: 'Immacolata Concezione', date: `${year}-12-08`, year: parseInt(year), type: 'national' },
        { id: '8', name: 'Natale', date: `${year}-12-25`, year: parseInt(year), type: 'national' },
        { id: '9', name: 'Santo Stefano', date: `${year}-12-26`, year: parseInt(year), type: 'national' }
      ];
      return res.json(defaultHolidays);
    }

    // Se non ci sono dati per l'anno richiesto, restituisci i default
    if (!data || data.length === 0) {
      const defaultHolidays = [
        { id: '1', name: 'Capodanno', date: `${year}-01-01`, year: parseInt(year), type: 'national' },
        { id: '2', name: 'Epifania', date: `${year}-01-06`, year: parseInt(year), type: 'national' },
        { id: '3', name: 'Festa del Lavoro', date: `${year}-05-01`, year: parseInt(year), type: 'national' },
        { id: '4', name: 'Festa della Repubblica', date: `${year}-06-02`, year: parseInt(year), type: 'national' },
        { id: '5', name: 'Ferragosto', date: `${year}-08-15`, year: parseInt(year), type: 'national' },
        { id: '6', name: 'Tutti i Santi', date: `${year}-11-01`, year: parseInt(year), type: 'national' },
        { id: '7', name: 'Immacolata Concezione', date: `${year}-12-08`, year: parseInt(year), type: 'national' },
        { id: '8', name: 'Natale', date: `${year}-12-25`, year: parseInt(year), type: 'national' },
        { id: '9', name: 'Santo Stefano', date: `${year}-12-26`, year: parseInt(year), type: 'national' }
      ];
      return res.json(defaultHolidays);
    }

    res.json(data);
  } catch (error) {
    console.error('Holidays fetch error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

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
// Helper per verificare email reali (privacy)
const isRealEmail = (email) => {
  const realEmails = ['hr@labafirenze.com', 'simone.azzinelli@labafirenze.com'];
  return realEmails.includes(email);
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
      .select('hours_worked, date')
      .eq('user_id', userId)
      .gte('date', startOfWeek.toISOString().split('T')[0])
      .lte('date', endOfWeek.toISOString().split('T')[0])
      .not('hours_worked', 'is', null);

    let totalHours = 0;
    let daysPresent = 0;
    let overtimeHours = 0;

    if (!attendanceError && weeklyAttendance) {
      weeklyAttendance.forEach(record => {
        if (record.hours_worked) {
          totalHours += record.hours_worked;
          daysPresent++;
          
          // Calcola straordinario (oltre 8 ore al giorno)
          if (record.hours_worked > 8) {
            overtimeHours += (record.hours_worked - 8);
          }
        }
      });
    }

    // Calcola saldo ore (ore lavorate - ore previste)
    const expectedHours = daysPresent * 8; // 8 ore al giorno
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
      .select('hours_worked')
      .eq('user_id', userId)
      .gte('date', startOfMonth.toISOString().split('T')[0])
      .lte('date', endOfMonth.toISOString().split('T')[0])
      .not('hours_worked', 'is', null);
    
    if (error) {
      console.error('Overtime error:', error);
      return res.status(500).json({ error: 'Errore nel calcolo degli straordinari' });
    }
    
    // Calculate total hours worked this month
    const totalHoursWorked = monthlyAttendance.reduce((sum, record) => {
      return sum + (parseFloat(record.hours_worked) || 0);
    }, 0);
    
    // Calculate expected hours (assuming 8h/day, 20 working days/month)
    const expectedHours = 160; // 8h * 20 days
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
        
        // Calcola ore real-time
        const { start_time, end_time, break_duration } = todaySchedule;
        const [startHour, startMin] = start_time.split(':').map(Number);
        const [endHour, endMin] = end_time.split(':').map(Number);
        const breakDuration = break_duration || 60;
        
        const totalWorkMinutes = (endHour * 60 + endMin - startHour * 60 - startMin);
        const hasLunchBreak = totalWorkMinutes > 300;
        const expectedHours = hasLunchBreak ? (totalWorkMinutes - 60) / 60 : totalWorkMinutes / 60;
        
        let actualHours = 0;
        let status = 'not_started';
        
        if (currentHour < startHour || (currentHour === startHour && currentMinute < startMin)) {
          actualHours = 0;
          status = 'not_started';
        } else if (currentHour > endHour || (currentHour === endHour && currentMinute >= endMin)) {
          actualHours = expectedHours;
          status = 'completed';
        } else {
          const minutesFromStart = (currentHour - startHour) * 60 + (currentMinute - startMin);
          
          if (hasLunchBreak) {
            const effectiveWorkMinutes = totalWorkMinutes - breakDuration;
            if (minutesFromStart <= effectiveWorkMinutes) {
              actualHours = minutesFromStart / 60;
              status = 'working';
            } else {
              actualHours = effectiveWorkMinutes / 60;
              status = 'on_break';
            }
          } else {
            actualHours = minutesFromStart / 60;
            status = 'working';
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
