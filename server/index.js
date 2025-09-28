const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const session = require('express-session');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL || 'https://gojhljczpwbjxbbrtrlq.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || 'sb_secret_s7Vzh0AtPEaEv3f3VmkIEg_3ZqBhGsS';
const supabase = createClient(supabaseUrl, supabaseKey);

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key_here_change_in_production';

// Middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

app.use(cors({
  origin: process.env.FRONTEND_URL || 'https://hr.laba.biz',
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

// Serve static files
app.use(express.static(path.join(__dirname, '../client/dist')));

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
      has104 = false 
    } = req.body;
    
    // Validazione email dominio
    if (!email.endsWith('@labafirenze.com')) {
      return res.status(400).json({ error: 'Solo email @labafirenze.com sono accettate' });
    }
    
    // Validazione campi obbligatori
    if (!email || !password || !firstName || !lastName || !department) {
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
          has_104: has104
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
      .from('employees')
      .select(`
        *,
        users!inner(id, email, first_name, last_name, is_active)
      `)
      .eq('status', 'active')
      .order('users.last_name');

    if (error) {
      console.error('Employees fetch error:', error);
      return res.status(500).json({ error: 'Errore nel recupero dei dipendenti' });
    }

    const formattedEmployees = employees.map(emp => ({
      id: emp.id,
      user_id: emp.user_id,
      employeeNumber: emp.employee_number,
      firstName: emp.users.first_name,
      lastName: emp.users.last_name,
      email: emp.users.email,
      department: emp.department,
      position: emp.position,
      hireDate: emp.hire_date,
      status: emp.status,
      has104: emp.has_104,
      phone: emp.personal_info?.phone || '',
      birthDate: emp.personal_info?.birth_date || ''
    }));

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
    const hoursWorked = ((new Date(clockOutTime) - clockInTime) / (1000 * 60 * 60)).toFixed(2);

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

// ==================== HEALTH CHECK ====================

app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// ==================== CATCH-ALL ROUTE ====================

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

// ==================== ERROR HANDLING ====================

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Errore interno del server' });
});

// ==================== START SERVER ====================

app.listen(PORT, () => {
  console.log(`🚀 Server HR LABA avviato su porta ${PORT}`);
  console.log(`📊 Dashboard: http://localhost:${PORT}`);
  console.log(`🔗 Frontend URL: ${process.env.FRONTEND_URL || 'https://hr.laba.biz'}`);
  console.log(`🗄️  Database: ${supabaseUrl}`);
});

module.exports = app;
