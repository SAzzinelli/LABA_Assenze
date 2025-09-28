# 🚀 API Documentation - Sistema HR Presenze LABA

## 📋 Panoramica

Sistema completo per la gestione delle presenze e richieste del personale LABA con API REST e WebSocket real-time.

## 🔐 Autenticazione

### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "admin@labafirenze.com",
  "password": "laba2025"
}
```

**Risposta:**
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "admin@labafirenze.com",
    "role": "admin",
    "firstName": "Admin",
    "lastName": "LABA"
  },
  "token": "jwt_token"
}
```

### Registrazione
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "dipendente@labafirenze.com",
  "password": "password123",
  "firstName": "Mario",
  "lastName": "Rossi",
  "birthDate": "1990-01-01",
  "phone": "+39 333 123 4567",
  "department": "Amministrazione",
  "has104": false
}
```

## 👥 Dipendenti

### Lista Dipendenti
```http
GET /api/employees
Authorization: Bearer {token}
```

### Aggiungi Dipendente (Admin)
```http
POST /api/employees
Authorization: Bearer {token}
Content-Type: application/json

{
  "firstName": "Mario",
  "lastName": "Rossi",
  "email": "mario.rossi@labafirenze.com",
  "department": "Amministrazione",
  "position": "Impiegato",
  "phone": "+39 333 123 4567",
  "birthDate": "1990-01-01",
  "has104": false
}
```

## ⏰ Presenze

### Clock In/Out
```http
POST /api/attendance/clock
Authorization: Bearer {token}
Content-Type: application/json

{
  "action": "in" // o "out"
}
```

### Presenze Attuali (Admin)
```http
GET /api/attendance/current
Authorization: Bearer {token}
```

### Uscite Imminenti (Admin)
```http
GET /api/attendance/upcoming-departures
Authorization: Bearer {token}
```

## 📋 Richieste Permessi

### Lista Richieste
```http
GET /api/leave-requests?month=12&year=2025
Authorization: Bearer {token}
```

### Nuova Richiesta
```http
POST /api/leave-requests
Authorization: Bearer {token}
Content-Type: application/json

{
  "type": "permission", // permission, sick, vacation
  "startDate": "2025-12-25",
  "endDate": "2025-12-25",
  "reason": "Motivo della richiesta",
  "notes": "Note aggiuntive"
}
```

### Approva/Rifiuta Richiesta (Admin)
```http
PUT /api/leave-requests/{id}
Authorization: Bearer {token}
Content-Type: application/json

{
  "status": "approved", // approved, rejected
  "notes": "Motivo della decisione"
}
```

## 📊 Dashboard

### Statistiche
```http
GET /api/dashboard/stats
Authorization: Bearer {token}
```

### Presenze Settimanali
```http
GET /api/dashboard/attendance
Authorization: Bearer {token}
```

### Distribuzione Dipartimenti
```http
GET /api/dashboard/departments
Authorization: Bearer {token}
```

## 🔌 WebSocket Real-Time

### Connessione
```javascript
const socket = io('ws://localhost:3000');

// Unisciti alla stanza
socket.emit('join', {
  userId: 'user_id',
  role: 'admin'
});

// Ascolta aggiornamenti presenze
socket.on('attendance_changed', (data) => {
  console.log('Presenze aggiornate:', data);
});

// Ascolta nuove richieste
socket.on('new_leave_request', (data) => {
  console.log('Nuova richiesta:', data);
});
```

## 🛡️ Sicurezza

- **Rate Limiting**: 5 richieste/15min per auth, 100 richieste/15min per API
- **JWT**: Token di 24 ore con refresh automatico
- **CORS**: Configurato per dominio produzione
- **Helmet**: Headers di sicurezza
- **Validazione**: Input validation su tutti gli endpoint

## 📈 Status Codes

- `200` - Successo
- `201` - Creato
- `400` - Bad Request
- `401` - Non autorizzato
- `403` - Accesso negato
- `404` - Non trovato
- `429` - Rate limit exceeded
- `500` - Errore server

## 🧪 Testing

```bash
# Esegui test
npm test

# Test con coverage
npm run test:coverage

# Test in watch mode
npm run test:watch
```

## 🚀 Deploy

### Railway
```bash
# Deploy automatico su push
git push origin main
```

### Environment Variables
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your_service_key
JWT_SECRET=your_jwt_secret
NODE_ENV=production
FRONTEND_URL=https://hr.laba.biz
```

## 📝 Note

- Tutte le API richiedono autenticazione tranne `/health`
- Admin ha accesso completo, Employee solo ai propri dati
- WebSocket per aggiornamenti real-time
- Database PostgreSQL con Supabase
- Logging completo per debugging
