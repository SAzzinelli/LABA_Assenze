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

// Rate limiting middleware
const rateLimit = require('express-rate-limit');

// Create rate limiters
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: { error: 'Troppi tentativi di login. Riprova tra 15 minuti.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { error: 'Troppe richieste. Riprova tra 15 minuti.' },
  standardHeaders: true,
  legacyHeaders: false,
});

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
  if (req.user.role !== 'admin') {
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

// Serve static files (only in production)
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/dist')));
} else {
  // In development, Vite serves the files on port 5173
  console.log('🔧 Modalità sviluppo: Vite serve i file statici su porta 5173');
}

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
app.post('/api/auth/login', authLimiter, async (req, res) => {
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
app.post('/api/auth/register', authLimiter, async (req, res) => {
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
app.get('/api/employees', apiLimiter, authenticateToken, async (req, res) => {
  try {
    const { data: employees, error } = await supabase
      .from('users')
      .select('*')
      .eq('is_active', true)
      .order('last_name');

    if (error) {
      console.error('Employees fetch error:', error);
      return res.status(500).json({ error: 'Errore nel recupero dei dipendenti' });
    }

    const formattedEmployees = employees.map(emp => ({
      id: emp.id,
      firstName: emp.first_name,
      lastName: emp.last_name,
      name: `${emp.first_name} ${emp.last_name}`,
      email: emp.email,
      department: emp.department || 'Non specificato',
      position: emp.position || 'Dipendente',
      hireDate: emp.hire_date || emp.created_at?.split('T')[0],
      status: emp.is_active ? 'active' : 'inactive',
      has104: emp.has_104,
      phone: emp.phone || '',
      birthDate: emp.date_of_birth || ''
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

// Dashboard weekly attendance data
app.get('/api/dashboard/attendance', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Accesso negato' });
    }

    // Get last 7 days
    const today = new Date();
    const weekData = [];
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const { count: presenze } = await supabase
        .from('attendance')
        .select('*', { count: 'exact', head: true })
        .eq('date', dateStr)
        .not('check_in', 'is', null);
      
      const { count: assenze } = await supabase
        .from('attendance')
        .select('*', { count: 'exact', head: true })
        .eq('date', dateStr)
        .is('check_in', null);
      
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

    const { data: departments, error } = await supabase
      .from('employees')
      .select('department')
      .eq('status', 'active');

    if (error) {
      console.error('Departments error:', error);
      return res.status(500).json({ error: 'Errore nel recupero dei dipartimenti' });
    }

    // Count employees per department
    const deptCount = {};
    departments.forEach(emp => {
      deptCount[emp.department] = (deptCount[emp.department] || 0) + 1;
    });

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

// Serve static files from client/dist
app.use(express.static(path.join(__dirname, '../client/dist')));

// ==================== CATCH-ALL ROUTE ====================

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

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
      const { data, error } = await supabase
        .from('settings')
        .upsert({
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

// ==================== DEPARTMENTS ENDPOINTS ====================

// Get all departments
app.get('/api/departments', authenticateToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('departments')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (error) {
      console.error('Departments fetch error:', error);
      return res.status(500).json({ error: 'Errore nel recuperare i dipartimenti' });
    }

    res.json(data);
  } catch (error) {
    console.error('Departments fetch error:', error);
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

server.listen(PORT, () => {
  console.log(`🚀 Server HR LABA avviato su porta ${PORT}`);
  console.log(`📊 Dashboard: http://localhost:${PORT}`);
  console.log(`🔗 Frontend URL: ${process.env.FRONTEND_URL || 'https://hr.laba.biz'}`);
  console.log(`🗄️  Database: ${supabaseUrl}`);
  console.log(`🔌 WebSocket attivo per aggiornamenti real-time`);
});

module.exports = app;
