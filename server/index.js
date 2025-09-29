const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

// Rate limiting rimosso per facilitare i test

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? (process.env.FRONTEND_URL || 'https://hr.laba.biz')
      : ['http://localhost:5173', 'http://127.0.0.1:5173'],
    methods: ['GET', 'POST'],
    credentials: true
  }
});
const PORT = process.env.PORT || 3000;

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL || 'https://gojhljczpwbjxbbrtrlq.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || 'sb_secret_s7Vzh0AtPEaEv3f3VmkIEg_3ZqBhGsS';
const supabase = createClient(supabaseUrl, supabaseKey);

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key_here_change_in_production';

// Admin middleware
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin' && req.user.role !== 'Amministratore') {
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
      has104 = false 
    } = req.body;
    
    // Validazione email dominio
    if (!email.endsWith('@labafirenze.com')) {
      return res.status(400).json({ error: 'Solo email @labafirenze.com sono accettate' });
    }
    
    // Validazione campi obbligatori
    if (!email || !password || !firstName || !lastName || !department || !position || !hireDate || !workplace || !contractType) {
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
          department: department
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
    const { data: employees, error } = await supabase
      .from('users')
      .select(`
        *,
        work_patterns!left(*),
        work_schedules!left(*)
      `)
      .eq('is_active', true)
      .order('last_name');

    if (error) {
      console.error('Employees fetch error:', error);
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
        birthDate: emp.date_of_birth || '',
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
        weeklyHours: activeWorkPattern ? 
          (activeWorkPattern.monday_hours + activeWorkPattern.tuesday_hours + 
           activeWorkPattern.wednesday_hours + activeWorkPattern.thursday_hours + 
           activeWorkPattern.friday_hours + activeWorkPattern.saturday_hours + 
           activeWorkPattern.sunday_hours) : 0
      };
    });

    res.json(formattedEmployees);
  } catch (error) {
    console.error('Employees fetch error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Add new employee
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
      has104 = false 
    } = req.body;

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
          role: 'employee',
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

// ==================== ATTENDANCE ENDPOINTS ====================

// Get attendance records
app.get('/api/attendance', authenticateToken, async (req, res) => {
  try {
    const { date, userId } = req.query;
    
    let query = supabase
      .from('attendance')
      .select('*')
      .order('date', { ascending: false });

    if (date) {
      query = query.eq('date', date);
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

    res.json(attendance);
  } catch (error) {
    console.error('Attendance fetch error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Clock in
app.post('/api/attendance/clock-in', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'employee') {
      return res.status(403).json({ error: 'Solo i dipendenti possono timbrare' });
    }

    const today = new Date().toISOString().split('T')[0];
    
    // Check if already clocked in today
    const { data: existingRecord } = await supabase
      .from('attendance')
      .select('id, clock_in, clock_out')
      .eq('user_id', req.user.id)
      .eq('date', today)
      .single();

    if (existingRecord && existingRecord.clock_in && !existingRecord.clock_out) {
      return res.status(400).json({ error: 'Sei già entrato oggi' });
    }

    const clockInTime = new Date().toISOString();
    
    if (existingRecord) {
      // Update existing record
      const { error } = await supabase
        .from('attendance')
        .update({
          clock_in: clockInTime,
          status: 'present'
        })
        .eq('id', existingRecord.id);

      if (error) {
        console.error('Clock in update error:', error);
        return res.status(500).json({ error: 'Errore nel salvataggio' });
      }
    } else {
      // Create new record
      const { error } = await supabase
        .from('attendance')
        .insert([
          {
            user_id: req.user.id,
            clock_in: clockInTime,
            date: today,
            status: 'present'
          }
        ]);

      if (error) {
        console.error('Clock in create error:', error);
        return res.status(500).json({ error: 'Errore nel salvataggio' });
      }
    }

    res.json({
      success: true,
      message: 'Entrata registrata',
      clockInTime: clockInTime
    });
  } catch (error) {
    console.error('Clock in error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Clock out
app.post('/api/attendance/clock-out', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'employee') {
      return res.status(403).json({ error: 'Solo i dipendenti possono timbrare' });
    }

    const today = new Date().toISOString().split('T')[0];
    
    // Find today's record
    const { data: record } = await supabase
      .from('attendance')
      .select('id, clock_in, clock_out')
      .eq('user_id', req.user.id)
      .eq('date', today)
      .single();

    if (!record || !record.clock_in || record.clock_out) {
      return res.status(400).json({ error: 'Non puoi uscire senza essere entrato' });
    }

    const clockOutTime = new Date().toISOString();
    const clockInTime = new Date(record.clock_in);
    
    // Calcola ore totali tra entrata e uscita
    const totalHours = ((new Date(clockOutTime) - clockInTime) / (1000 * 60 * 60));
    
    // Calcola automaticamente la pausa pranzo
    let lunchBreakHours = 0;
    
    // Se le ore totali sono >= 6 ore, applica automaticamente 1 ora di pausa pranzo
    if (totalHours >= 6) {
      lunchBreakHours = 1; // Pausa pranzo standard di 1 ora
    }
    
    // Calcola ore lavorate sottraendo la pausa pranzo
    const hoursWorked = (totalHours - lunchBreakHours).toFixed(2);

    const { error } = await supabase
      .from('attendance')
      .update({
        clock_out: clockOutTime,
        hours_worked: parseFloat(hoursWorked)
      })
      .eq('id', record.id);

    if (error) {
      console.error('Clock out error:', error);
      return res.status(500).json({ error: 'Errore nel salvataggio' });
    }

    res.json({
      success: true,
      message: 'Uscita registrata',
      clockOutTime: clockOutTime,
      hoursWorked: hoursWorked
    });
  } catch (error) {
    console.error('Clock out error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// ==================== DASHBOARD ENDPOINTS ====================

// Dashboard stats
app.get('/api/dashboard/stats', authenticateToken, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // Total employees
    const { count: totalEmployees } = await supabase
      .from('employees')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');

    // Present today
    const { count: presentToday } = await supabase
      .from('attendance')
      .select('*', { count: 'exact', head: true })
      .eq('date', today)
      .eq('status', 'present');

    // Pending requests
    const { count: pendingRequests } = await supabase
      .from('leave_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    // Calculate attendance rate
    const attendanceRate = totalEmployees > 0 ? ((presentToday / totalEmployees) * 100).toFixed(1) : 0;

    res.json({
      totalEmployees: totalEmployees || 0,
      presentToday: presentToday || 0,
      pendingRequests: pendingRequests || 0,
      attendanceRate: parseFloat(attendanceRate)
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
        .eq('date', dateStr)
        .not('check_in', 'is', null);
      
      // Calcola assenze: chi non ha check_in MA non è in permesso/malattia/ferie
      let assenzeQuery = supabase
        .from('attendance')
        .select('*', { count: 'exact', head: true })
        .eq('date', dateStr)
        .is('check_in', null);
      
      // Se è employee, mostra solo i propri dati
      if (req.user.role === 'employee') {
        presenzeQuery = presenzeQuery.eq('user_id', req.user.id);
        assenzeQuery = assenzeQuery.eq('user_id', req.user.id);
      }
      
      const { count: presenze } = await presenzeQuery;
      const { count: totalAssenze } = await assenzeQuery;
      
      // Conta quanti sono in permesso/malattia/ferie approvati in questa data
      const { count: inPermessi } = await supabase
        .from('leave_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'approved')
        .lte('start_date', dateStr)
        .gte('end_date', dateStr)
        .in('type', ['permission', 'sick', 'vacation']);
      
      // Assenze reali = Totali assenze - Quelli in permesso/malattia/ferie
      const assenze = Math.max(0, (totalAssenze || 0) - (inPermessi || 0));
      
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

// Current attendance (who's in office now)
app.get('/api/attendance/current', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Accesso negato' });
    }

    const today = new Date().toISOString().split('T')[0];
    
    // Get people who checked in today but haven't checked out
    const { data: currentAttendance, error } = await supabase
      .from('attendance')
      .select(`
        *,
        users!inner(first_name, last_name)
      `)
      .eq('date', today)
      .not('clock_in', 'is', null)
      .is('clock_out', null)
      .order('clock_in');

    if (error) {
      console.error('Current attendance error:', error);
      return res.status(500).json({ error: 'Errore nel recupero delle presenze attuali' });
    }

    const formatted = currentAttendance.map(att => ({
      id: att.id,
      user_id: att.user_id,
      name: `${att.users.first_name} ${att.users.last_name}`,
      department: 'Non specificato',
      clock_in: att.clock_in,
      clock_out: att.clock_out,
      hours_worked: att.hours_worked
    }));

    res.json(formatted);
  } catch (error) {
    console.error('Current attendance error:', error);
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
        users!inner(first_name, last_name)
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
        department: 'Non specificato',
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
      isClockedIn = !!todayAttendance.clock_in;
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
    const { month, year } = req.query;
    
    let query = supabase
      .from('leave_requests')
      .select(`
        *,
        users!leave_requests_user_id_fkey(first_name, last_name, email)
      `)
      .order('created_at', { ascending: false });

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
      notes: req.notes,
      user: {
        id: req.users.id,
        name: `${req.users.first_name} ${req.users.last_name}`,
        email: req.users.email,
        department: 'Non specificato'
      }
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
    const { type, startDate, endDate, reason, notes } = req.body;

    // Validation
    if (!type || !startDate || !endDate || !reason) {
      return res.status(400).json({ error: 'Campi obbligatori mancanti' });
    }

    const { data: newRequest, error } = await supabase
      .from('leave_requests')
      .insert([
        {
          user_id: req.user.id,
          type: type, // 'permission', 'sick', 'vacation'
          start_date: startDate,
          end_date: endDate,
          reason: reason,
          notes: notes || '',
          status: 'pending'
        }
      ])
      .select()
      .single();

    if (error) {
      console.error('Leave request creation error:', error);
      return res.status(500).json({ error: 'Errore nella creazione della richiesta' });
    }

    // Crea notifica per tutti gli admin
    try {
      const { data: admins, error: adminError } = await supabase
        .from('users')
        .select('id, first_name, last_name')
        .eq('role', 'admin');

      if (!adminError && admins) {
        const typeLabels = {
          'permission': 'Permesso',
          'sick': 'Malattia', 
          'vacation': 'Ferie'
        };

        const notifications = admins.map(admin => ({
          user_id: admin.id,
          title: `Nuova richiesta ${typeLabels[type] || type}`,
          message: `${req.user.first_name} ${req.user.last_name} ha richiesto ${typeLabels[type] || type} dal ${startDate} al ${endDate}`,
          type: 'request',
          is_read: false,
          created_at: new Date().toISOString()
        }));

        await supabase
          .from('notifications')
          .insert(notifications);
      }
    } catch (notificationError) {
      console.error('Notification creation error:', notificationError);
      // Non bloccare la richiesta se le notifiche falliscono
    }

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
            is_read: false,
            created_at: new Date().toISOString()
          }
        ]);
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

// ==================== WEBSOCKET REAL-TIME ====================

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log(`🔌 Client connesso: ${socket.id}`);

  // Join user to their room
  socket.on('join', (userData) => {
    if (userData.userId) {
      socket.join(`user_${userData.userId}`);
      console.log(`👤 Utente ${userData.userId} si è unito alla stanza`);
    }
    if (userData.role === 'admin') {
      socket.join('admin_room');
      console.log(`👑 Admin si è unito alla stanza admin`);
    }
  });

  // Handle attendance updates
  socket.on('attendance_update', (data) => {
    // Broadcast to admin room
    io.to('admin_room').emit('attendance_changed', data);
    console.log(`📊 Aggiornamento presenze: ${JSON.stringify(data)}`);
  });

  // Handle leave request updates
  socket.on('leave_request_update', (data) => {
    // Broadcast to admin room
    io.to('admin_room').emit('new_leave_request', data);
    console.log(`📋 Nuova richiesta permessi: ${JSON.stringify(data)}`);
  });

  // Handle request approval/rejection
  socket.on('request_decision', (data) => {
    // Notify the specific user
    io.to(`user_${data.userId}`).emit('request_updated', data);
    console.log(`✅ Decisione richiesta: ${JSON.stringify(data)}`);
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`🔌 Client disconnesso: ${socket.id}`);
  });
});

// Make io available to routes
app.set('io', io);

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
app.get('/api/work-schedules', authenticateToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('work_schedules')
      .select('*')
      .eq('user_id', req.user.id)
      .order('day_of_week');

    if (error) {
      console.error('Work schedules fetch error:', error);
      return res.status(500).json({ error: 'Errore nel recuperare gli orari di lavoro' });
    }

    res.json(data);
  } catch (error) {
    console.error('Work schedules fetch error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

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
      .select('hours_worked')
      .eq('user_id', userId)
      .gte('date', startOfWeek.toISOString().split('T')[0])
      .lte('date', endOfWeek.toISOString().split('T')[0])
      .not('hours_worked', 'is', null);
    
    if (error) {
      console.error('Weekly hours error:', error);
      return res.status(500).json({ error: 'Errore nel calcolo delle ore settimanali' });
    }
    
    // Calculate total hours
    const totalHours = weeklyAttendance.reduce((sum, record) => {
      return sum + (parseFloat(record.hours_worked) || 0);
    }, 0);
    
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

server.listen(PORT, () => {
  console.log(`🚀 Server HR LABA avviato su porta ${PORT}`);
  console.log(`📊 Dashboard: http://localhost:${PORT}`);
  console.log(`🔗 Frontend URL: ${process.env.FRONTEND_URL || 'https://hr.laba.biz'}`);
  console.log(`🗄️  Database: ${supabaseUrl}`);
  console.log(`🔌 WebSocket attivo per aggiornamenti real-time`);
});

module.exports = app;
