# 📧 Flussi Email - Gestione personale LABA

Documento che descrive **QUANDO** vengono inviate le email tra Admin e Dipendenti.

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
**Riga codice:** `server/index.js` ~4511

**Azioni:**
1. ✅ Creazione notifica in-app per tutti gli admin
2. 📧 Invio email a **tutti gli admin attivi** con template `newRequest`
3. Email contiene: Dipendente, Tipo Richiesta, Periodo

**Template:** `newRequest`  
**Oggetto:** `🔔 Nuova Richiesta di [Tipo] - Gestione personale LABA`  
**Destinatari:** Tutti gli admin con `role='admin'` e `is_active=true`

**Nota:** La richiesta viene creata con status `'pending'` (in attesa di approvazione).

---

## 🔄 DA ADMIN → DIPENDENTE

### 1. ✅ Admin Crea Richiesta per Dipendente (Registrazione Diretta)

**Quando:** Admin crea/registra direttamente una richiesta per un dipendente:
- Admin aggiunge permesso per un dipendente
- Admin aggiunge ferie per un dipendente  
- Admin aggiunge malattia per un dipendente

**Endpoint:** `POST /api/admin/leave-requests`  
**Riga codice:** `server/index.js` ~4843

**Azioni:**
1. ✅ Creazione richiesta con status `'approved'` (auto-approvato)
2. ✅ Creazione notifica in-app per il dipendente
3. 📧 Invio email al dipendente con template `requestResponse` e status `'approved'`

**Template:** `requestResponse` (verde - approvata)  
**Oggetto:** `📋 Richiesta di [Tipo] Approvata - Gestione personale LABA`  
**Destinatario:** Il dipendente per cui è stata creata la richiesta

**Nota:** Questa è una registrazione diretta, non una richiesta che viene approvata dopo.

---

### 2. ✅❌ Admin Approva/Rifiuta Richiesta Dipendente

**Quando:** Admin modifica lo status di una richiesta esistente:
- Admin approva una richiesta `'pending'` → `'approved'`
- Admin rifiuta una richiesta `'pending'` → `'rejected'`

**Endpoint:** `PUT /api/leave-requests/:id`  
**Riga codice:** `server/index.js` ~5206

**Azioni:**
1. ✅ Aggiornamento status richiesta
2. ✅ Aggiornamento bilanci (ferie, permessi 104, ecc.)
3. ✅ Creazione notifica in-app per il dipendente
4. 📧 Invio email al dipendente con template `requestResponse`

**Template:** `requestResponse`
- Se `status='approved'` → **Verde** - "Richiesta di [Tipo] Approvata"
- Se `status='rejected'` → **Rosso** - "Richiesta di [Tipo] Rifiutata"

**Oggetto:** `📋 Richiesta di [Tipo] [Approvata/Rifiutata] - Gestione personale LABA`  
**Destinatario:** Il dipendente che ha fatto la richiesta

**Nota:** Solo se lo status viene modificato (approvato o rifiutato). Modifiche ad altri campi non inviano email.

---

### 3. 🎉 Admin Attiva Account Dipendente

**Quando:** Admin attiva/approva un nuovo account dipendente (imposta `is_active=true`)

**Endpoint:** `PUT /api/users/:id`  
**Riga codice:** `server/index.js` ~682

**Azioni:**
1. ✅ Aggiornamento `is_active=true` nel database
2. 📧 Invio email di benvenuto al dipendente (se ha `personal_email` configurata)

**Template:** `welcome`  
**Oggetto:** `🎉 Benvenuto in LABA Firenze!`  
**Destinatario:** Email personale del dipendente (`personal_email`)

**Nota:** Email inviata solo se il dipendente ha un'email personale configurata.

---

## 🔄 DA SISTEMA → DIPENDENTE

### 1. 📊 Report Settimanale Automatico

**Quando:** Automaticamente ogni settimana (se configurato tramite scheduler)

**Endpoint:** `GET /api/email/weekly-report/:userId`  
**Riga codice:** `server/index.js` ~6426  
**Scheduler:** `server/emailScheduler.js`

**Azioni:**
1. 📊 Calcolo dati settimanali (ore lavorate, straordinari, saldo ore)
2. 📧 Invio email con report settimanale

**Template:** `weeklyReport`  
**Oggetto:** `📊 Report Settimanale - Settimana [N] - Gestione personale LABA`  
**Destinatario:** Tutti i dipendenti (configurabile)

**Nota:** Questo è automatico, non richiesto manualmente.

---

## ❌ EMAIL RIMOSSE

### Promemoria Timbratura

**Stato:** ❌ RIMOSSE - Non più disponibili

**Motivo:** Le timbrature non vengono più gestite tramite email promemoria.

**Template:** `attendanceReminder` (rimosso)  
**Endpoint:** Disabilitati

---

## 📝 RECOVERY REQUESTS (Recupero Ore)

### Stato Attuale: ⚠️ NON IMPLEMENTATO

Le email per i recovery requests (recupero ore) **non sono ancora implementate**:

1. ❌ **Admin propone recupero a dipendente** → Solo log console (riga ~7030)
2. ❌ **Dipendente accetta proposta admin** → Solo log console (riga ~7328)
3. ❌ **Recupero rifiutato** → Solo log console (riga ~7322)

**TODO:** Implementare template email per recovery requests.

---

## 📋 RIEPILOGO TABELLA

| Da | A | Quando | Template | Status | Codice |
|---|---|--------|----------|--------|---------|
| **Dipendente** | **Admin** | Crea nuova richiesta | `newRequest` | Pending | ~4511 |
| **Admin** | **Dipendente** | Crea richiesta per dipendente | `requestResponse` | Approved (verde) | ~4843 |
| **Admin** | **Dipendente** | Approva richiesta | `requestResponse` | Approved (verde) | ~5206 |
| **Admin** | **Dipendente** | Rifiuta richiesta | `requestResponse` | Rejected (rosso) | ~5206 |
| **Admin** | **Dipendente** | Attiva account | `welcome` | - | ~682 |
| **Sistema** | **Dipendente** | Report settimanale | `weeklyReport` | - | ~6426 |

---

## 🔍 NOTE TECNICHE

1. **Email a tutti gli admin:** `sendEmailToAdmins()` recupera tutti gli admin con `role='admin'` e `is_active=true`

2. **Email singola dipendente:** `sendEmail()` invia all'email del dipendente (`email` aziendale, non `personal_email` tranne che per welcome)

3. **Gestione errori:** Gli errori di invio email **non bloccano** le operazioni principali (creazione richiesta, approvazione, ecc.)

4. **Normalizzazione status:** Lo status viene normalizzato (`trim().toLowerCase()`) prima di determinare i colori nelle email `requestResponse`

5. **Link dinamici:** I pulsanti "Visualizza Dettagli" nelle email portano alla pagina specifica:
   - `/malattia` per malattia
   - `/ferie` per ferie
   - `/permessi` per permessi
   - `/permessi104` per permessi 104

---

## ⚠️ PUNTI DI ATTENZIONE

- ❌ **Recovery Requests:** Email non ancora implementate (solo log console)
- ✅ **Status "undefined":** Risolto - ora usa `statusText` invece di `statusLabel`
- ✅ **Link pagine:** Ora corretti - portano alla pagina specifica del tipo di richiesta
- ✅ **Email timbratura:** Rimosse completamente

