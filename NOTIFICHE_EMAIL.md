# 📧 Elenco Completo Notifiche Email e In-App

## 🔄 **DIPENDENTE → ADMIN**

### 1. **Nuova Richiesta (Permessi, Ferie, Malattia, Permessi 104)**
- **Quando:** Dipendente crea una nuova richiesta
- **Destinatario:** Tutti gli admin attivi
- **Notifica In-App:** ✅ Sì
  - **Tipo:** `new_request`, `new_vacation`, `new_sick_leave`, `new_permission_104`
  - **Titolo:** "Nuova richiesta di [Tipo]"
  - **Messaggio:** Nome dipendente, tipo richiesta, periodo, dettagli (ore per permessi)
- **Email:** ✅ Sì
  - **Template:** `newRequest`
  - **Oggetto:** "Nuova Richiesta di [Tipo] - Gestione personale LABA"
  - **Contenuto:** Dettagli richiesta, link per visualizzare

### 2. **Richiesta Modifica Permesso Approvato**
- **Quando:** Dipendente richiede modifica a permesso già approvato
- **Destinatario:** Tutti gli admin attivi
- **Notifica In-App:** ✅ Sì
  - **Tipo:** `permission_modification_request`
  - **Titolo:** "Richiesta Modifica Permesso"
  - **Messaggio:** 
    - 📅 Permesso originale (data, ore)
    - 💬 Motivo della richiesta
    - ✏️ Modifiche richieste
- **Email:** ✅ Sì
  - **Template:** `permissionModificationRequest` (da verificare se esiste)
  - **Oggetto:** "Richiesta Modifica Permesso - Gestione personale LABA"
  - **Contenuto:** Dettagli permesso originale, motivo, modifiche richieste

---

## 🔄 **ADMIN → DIPENDENTE**

### 3. **Approvazione/Rifiuto Richiesta**
- **Quando:** Admin approva o rifiuta una richiesta
- **Destinatario:** Dipendente proprietario della richiesta
- **Notifica In-App:** ✅ Sì
  - **Tipo:** `leave_approved`, `leave_rejected`
  - **Titolo:** "Richiesta di [Tipo] [Approvata/Rifiutata]"
  - **Messaggio:** Tipo richiesta, data, ore/giorni, status, note (se presenti)
- **Email:** ✅ Sì
  - **Template:** `requestResponse`
  - **Oggetto:** "Richiesta di [Tipo] - Gestione personale LABA"
  - **Contenuto:** 
    - Status (verde se approvata, rosso se rifiutata)
    - Dettagli richiesta (data, ore/giorni)
    - Note amministratore (se presenti)
    - Link per visualizzare

### 4. **Modifica Permesso Approvato**
- **Quando:** Admin modifica un permesso già approvato (cambio data, orari)
- **Destinatario:** Dipendente proprietario del permesso
- **Notifica In-App:** ✅ Sì
  - **Tipo:** `permission_modified`
  - **Titolo:** "Permesso Modificato"
  - **Messaggio:** 
    - 📅 Cambio data (se modificata)
    - 🕐 Cambio orario entrata (se modificato)
    - 🕐 Cambio orario uscita (se modificato)
    - ⏱️ Cambio ore (se ricalcolate)
- **Email:** ✅ Sì
  - **Template:** `permissionModified`
  - **Oggetto:** "Permesso Modificato - Gestione personale LABA"
  - **Contenuto:** Data e ore aggiornate, link per visualizzare

### 5. **Registrazione Permesso da Admin**
- **Quando:** Admin crea direttamente un permesso per un dipendente
- **Destinatario:** Dipendente
- **Notifica In-App:** ✅ Sì
  - **Tipo:** `leave_approved`
  - **Titolo:** "Richiesta di [Tipo] Approvata"
  - **Messaggio:** Tipo, data, ore, note "[Registrato dall'amministratore]"
- **Email:** ✅ Sì
  - **Template:** `requestResponse` (con status 'approved')
  - **Oggetto:** "Richiesta di [Tipo] - Gestione personale LABA"
  - **Contenuto:** Dettagli permesso registrato

### 6. **Reset Password**
- **Quando:** Admin resetta la password di un dipendente
- **Destinatario:** Dipendente
- **Notifica In-App:** ❌ No
- **Email:** ✅ Sì
  - **Template:** `resetPassword`
  - **Oggetto:** "Reset Password - Gestione personale LABA"
  - **Contenuto:** Nuova password temporanea, istruzioni per cambio password

### 7. **Account Approvato/Attivato**
- **Quando:** Admin approva account di nuovo dipendente
- **Destinatario:** Dipendente (email personale se presente)
- **Notifica In-App:** ❌ No
- **Email:** ✅ Sì
  - **Template:** `welcome`
  - **Oggetto:** "Benvenuto in LABA Firenze!"
  - **Contenuto:** Messaggio di benvenuto, istruzioni per primo accesso

---

## 📋 **ALTRE NOTIFICHE**

### 8. **Nuovo Dipendente Registrato**
- **Quando:** Nuovo dipendente si registra
- **Destinatario:** Tutti gli admin attivi
- **Notifica In-App:** ✅ Sì
  - **Tipo:** `info`
  - **Titolo:** "Nuovo Dipendente Registrato"
  - **Messaggio:** "[Nome Cognome] si è registrato nel sistema"
- **Email:** ❌ No

### 9. **Notifica Manuale**
- **Quando:** Admin crea notifica manuale
- **Destinatario:** Utente specifico
- **Notifica In-App:** ✅ Sì
  - **Tipo:** Personalizzato
  - **Titolo:** Personalizzato
  - **Messaggio:** Personalizzato
- **Email:** ❌ No

---

## 📊 **RIEPILOGO TEMPLATE EMAIL**

| Template | Quando | Da → A | Tipo |
|----------|--------|--------|------|
| `newRequest` | Nuova richiesta | Dipendente → Admin | Permessi, Ferie, Malattia, 104 |
| `requestResponse` | Approvazione/Rifiuto | Admin → Dipendente | Permessi, Ferie, Malattia, 104 |
| `permissionModified` | Modifica permesso | Admin → Dipendente | Permessi |
| `permissionModificationRequest` | Richiesta modifica | Dipendente → Admin | Permessi |
| `resetPassword` | Reset password | Admin → Dipendente | Account |
| `welcome` | Account approvato | Admin → Dipendente | Account |

---

## 🔔 **TIPI NOTIFICHE IN-APP**

| Tipo | Quando | Da → A |
|------|--------|--------|
| `new_request` | Nuova richiesta permesso | Dipendente → Admin |
| `new_vacation` | Nuova richiesta ferie | Dipendente → Admin |
| `new_sick_leave` | Nuova richiesta malattia | Dipendente → Admin |
| `new_permission_104` | Nuova richiesta permesso 104 | Dipendente → Admin |
| `permission_modification_request` | Richiesta modifica permesso | Dipendente → Admin |
| `leave_approved` | Richiesta approvata | Admin → Dipendente |
| `leave_rejected` | Richiesta rifiutata | Admin → Dipendente |
| `permission_modified` | Permesso modificato | Admin → Dipendente |
| `info` | Notifica informativa | Sistema → Admin/Dipendente |

---

## ⚠️ **NOTE IMPORTANTI**

1. **Email vengono inviate solo se:**
   - L'email è "reale" (non email di test come `test@example.com`)
   - Verificato tramite funzione `isRealEmail()`

2. **Notifiche in-app vengono sempre create** (indipendentemente dall'email)

3. **Template email supportano:**
   - Formattazione HTML responsive
   - Link diretti alle pagine del sistema
   - Dettagli specifici per tipo richiesta (ore per permessi, giorni per ferie)

4. **Notifiche di modifica permesso** vengono inviate solo se ci sono modifiche effettive (data, orari), non per ricalcolo automatico ore

