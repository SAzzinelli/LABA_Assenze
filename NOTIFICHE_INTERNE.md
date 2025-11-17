# 🔔 Notifiche Interne - Gestione personale LABA

Documento che descrive **QUANDO** vengono create le notifiche interne al gestionale (oltre alle email).

---

## 🔄 DA DIPENDENTE → ADMIN

### 1. 📋 Nuova Richiesta Creata da Dipendente

**Quando:** Un dipendente crea una nuova richiesta di:
- Permesso
- Ferie
- Malattia
- Permesso Legge 104
- Trasferta

**Endpoint:** `POST /api/leave-requests`  
**Riga codice:** `server/index.js` ~4492-4507

**Azioni:**
1. ✅ Creazione notifica in-app per **tutti gli admin attivi**
2. 📧 Invio email a tutti gli admin (vedi EMAIL_FLOW.md)

**Dettagli Notifica:**
- **Tipo:** `'permission'` (hardcoded - da correggere?)
- **Titolo:** `'Nuova richiesta Permesso'` (hardcoded - mostra sempre "Permesso" anche se è malattia/ferie)
- **Messaggio:** `${userName} ha richiesto un permesso ${dateRange}`
- **Destinatari:** Tutti gli admin con `role='admin'` e `is_active=true`
- **Campo:** `request_id` collegato alla richiesta

**⚠️ PROBLEMA POTENZIALE:** 
- Il `type` è sempre `'permission'` anche se è malattia/ferie
- Il titolo è sempre "Nuova richiesta Permesso" anche se è malattia/ferie

---

### 2. 👤 Nuovo Dipendente Registrato

**Quando:** Un nuovo dipendente si registra nel sistema

**Endpoint:** `POST /api/auth/register`  
**Riga codice:** `server/index.js` ~477-489

**Azioni:**
1. ✅ Creazione notifica in-app per **tutti gli admin attivi**
2. ❌ Nessuna email (solo notifica interna)

**Dettagli Notifica:**
- **Tipo:** `'info'`
- **Titolo:** `'Nuovo Dipendente Registrato'`
- **Messaggio:** `${firstName} ${lastName} si è registrato nel sistema`
- **Destinatari:** Tutti gli admin con `role='admin'` e `is_active=true`
- **Campo:** Nessun `request_id` o `related_id`

---

## 🔄 DA ADMIN → DIPENDENTE

### 1. ✅ Admin Crea Richiesta per Dipendente (Registrazione Diretta)

**Quando:** Admin crea/registra direttamente una richiesta per un dipendente:
- Admin aggiunge permesso per un dipendente
- Admin aggiunge ferie per un dipendente  
- Admin aggiunge malattia per un dipendente

**Endpoint:** `POST /api/admin/leave-requests`  
**Riga codice:** `server/index.js` ~4791-4826

**Azioni:**
1. ✅ Creazione richiesta con status `'approved'` (auto-approvato)
2. ✅ Creazione notifica in-app per il dipendente
3. 📧 Invio email al dipendente (vedi EMAIL_FLOW.md)

**Dettagli Notifica:**
- **Tipo:** `'leave_approved'`
- **Titolo:** Dinamico:
  - `'Ferie aggiunto dall'admin'` se `type='vacation'`
  - `'Malattia aggiunto dall'admin'` se `type='sick_leave'`
  - `'Permesso aggiunto dall'admin'` per gli altri
- **Messaggio:** `'L'amministratore ha registrato [tipo] [dateRange]. [reason]'`
- **Destinatario:** Il dipendente per cui è stata creata la richiesta
- **Campo:** `related_id` collegato alla richiesta

---

### 2. ✅❌ Admin Approva/Rifiuta Richiesta Dipendente

**Quando:** Admin modifica lo status di una richiesta esistente:
- Admin approva una richiesta `'pending'` → `'approved'`
- Admin rifiuta una richiesta `'pending'` → `'rejected'`

**Endpoint:** `PUT /api/leave-requests/:id`  
**Riga codice:** `server/index.js` ~5177-5190

**Azioni:**
1. ✅ Aggiornamento status richiesta
2. ✅ Aggiornamento bilanci (ferie, permessi 104, ecc.)
3. ✅ Creazione notifica in-app per il dipendente
4. 📧 Invio email al dipendente (vedi EMAIL_FLOW.md)

**Dettagli Notifica:**
- **Tipo:** `'response'`
- **Titolo:** Dinamico:
  - `'Richiesta Permesso approvata'` / `'Richiesta Permesso rifiutata'`
  - `'Richiesta Malattia approvata'` / `'Richiesta Malattia rifiutata'`
  - `'Richiesta Ferie approvata'` / `'Richiesta Ferie rifiutata'`
- **Messaggio:** `'La tua richiesta di [tipo] [dateRange] è stata [approvata/rifiutata][. Note: notes]'`
- **Destinatario:** Il dipendente che ha fatto la richiesta
- **Campi:** 
  - `request_id` collegato alla richiesta
  - `request_type` con il tipo di richiesta (`'permission'`, `'vacation'`, `'sick_leave'`, ecc.)

---

## 🛠️ NOTIFICHE MANUALI (Admin)

### 1. 📝 Admin Crea Notifica Manuale

**Quando:** Admin crea manualmente una notifica per un dipendente (feature admin)

**Endpoint:** `POST /api/notifications`  
**Riga codice:** `server/index.js` ~5453-5481

**Azioni:**
1. ✅ Creazione notifica personalizzata

**Dettagli Notifica:**
- **Tipo:** Configurabile (default: `'info'`)
- **Titolo:** Personalizzato dall'admin
- **Messaggio:** Personalizzato dall'admin
- **Destinatario:** Dipendente specifico (`userId`)
- **Campo:** Nessun `request_id` o `related_id`

**Nota:** Questa è una notifica generica, non legata a richieste specifiche.

---

## ❌ NOTIFICHE NON IMPLEMENTATE

### Recovery Requests (Recupero Ore)

**Stato:** ❌ NON IMPLEMENTATO

Le notifiche per i recovery requests **non sono ancora implementate**:
- ❌ Admin propone recupero a dipendente → Nessuna notifica
- ❌ Dipendente accetta proposta admin → Nessuna notifica
- ❌ Recupero rifiutato → Nessuna notifica

**Codice:** Solo log console (righe ~7030, 7322, 7328)

**TODO:** Implementare notifiche per recovery requests.

---

## 📋 RIEPILOGO TABELLA

| Da | A | Quando | Tipo Notifica | Codice | Email |
|---|---|--------|---------------|--------|-------|
| **Dipendente** | **Admin** | Nuova richiesta creata | `'permission'` ⚠️ | ~4492 | ✅ |
| **Dipendente** | **Admin** | Nuovo dipendente registrato | `'info'` | ~477 | ❌ |
| **Admin** | **Dipendente** | Crea richiesta per dipendente | `'leave_approved'` | ~4791 | ✅ |
| **Admin** | **Dipendente** | Approva richiesta | `'response'` | ~5177 | ✅ |
| **Admin** | **Dipendente** | Rifiuta richiesta | `'response'` | ~5177 | ✅ |
| **Admin** | **Dipendente** | Notifica manuale | `'info'` (default) | ~5453 | ❌ |

---

## 🔍 DETTAGLI TECNICI

### Campi Notifiche

- `user_id`: Destinatario della notifica
- `title`: Titolo della notifica
- `message`: Messaggio della notifica
- `type`: Tipo notifica (`'info'`, `'permission'`, `'leave_approved'`, `'response'`, ecc.)
- `request_id`: ID della richiesta correlata (se presente)
- `request_type`: Tipo di richiesta (`'permission'`, `'vacation'`, `'sick_leave'`, ecc.)
- `related_id`: ID di un'altra risorsa correlata (se presente)
- `is_read`: Se la notifica è stata letta
- `read_at`: Timestamp di lettura
- `created_at`: Timestamp di creazione

### Tipi Notifica Utilizzati

1. **`'info'`**: Notifiche informative generiche
   - Nuovo dipendente registrato
   - Notifiche manuali admin

2. **`'permission'`**: Nuove richieste (attualmente hardcoded anche per malattia/ferie)

3. **`'leave_approved'`**: Richiesta creata direttamente dall'admin (auto-approvata)

4. **`'response'`**: Risposta a una richiesta (approvata o rifiutata)

### Navigation dalle Notifiche

Il frontend gestisce la navigazione quando si clicca su una notifica:

- **`request_type='permission'`** → Naviga a `/permessi`
- **`request_type='vacation'`** → Naviga a `/ferie`
- **`request_type='sick_leave'`** → Naviga a `/malattia`
- **Default** → Naviga a `/dashboard`

**Codice:** `client/src/components/Layout.jsx` ~64-78

---

## ⚠️ PROBLEMI NOTI

### 1. Type Hardcoded per Nuova Richiesta

**Problema:** Quando un dipendente crea una nuova richiesta, il `type` è sempre `'permission'` anche se è malattia o ferie.

**Codice:** `server/index.js` ~4499
```javascript
type: 'permission',  // ⚠️ Hardcoded - dovrebbe essere dinamico
title: 'Nuova richiesta Permesso',  // ⚠️ Hardcoded - mostra sempre "Permesso"
```

**Soluzione suggerita:**
```javascript
const typeMap = {
  'permission': 'permission',
  'vacation': 'vacation',
  'sick_leave': 'sick_leave',
  'permission_104': 'permission_104'
};
const titleMap = {
  'permission': 'Nuova richiesta Permesso',
  'vacation': 'Nuova richiesta Ferie',
  'sick_leave': 'Nuova richiesta Malattia',
  'permission_104': 'Nuova richiesta Permesso Legge 104'
};
type: typeMap[requestType] || 'info',
title: titleMap[requestType] || 'Nuova richiesta',
```

### 2. Recovery Requests - Nessuna Notifica

**Problema:** I recovery requests non hanno notifiche interne implementate.

**TODO:** Aggiungere notifiche quando:
- Admin propone recupero
- Dipendente accetta proposta
- Recupero rifiutato

---

## 🔄 AGGIORNAMENTO NOTIFICHE

Le notifiche vengono caricate:
- **Al mount del componente** (`Layout.jsx`)
- **Ogni 30 secondi** automaticamente (polling)

**Endpoint:** `GET /api/notifications?limit=50&unread_only=false`

**Marca come letta:** `PUT /api/notifications/:id/read`

