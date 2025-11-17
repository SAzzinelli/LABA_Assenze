# 📧 Template Email - Sistema HR LABA

Questo documento contiene tutti i testi delle email inviate dal sistema per verificarli insieme.

---

## 1. 🔔 Nuova Richiesta (Admin)

**Quando viene inviata:** Quando un dipendente crea una nuova richiesta (permesso, ferie, malattia, ecc.)

**Destinatario:** Tutti gli admin

**Template:** `newRequest`

**Oggetto:** `🔔 Nuova Richiesta di [Tipo] - Sistema HR LABA`

**Colori:**
- Header: Blu (`#3B82F6` → `#2563EB`)
- Box info: Blu chiaro (`#EFF6FF`) con bordo blu (`#3B82F6`)
- Bottone: Blu (`#3B82F6`)

**Testo:**
```
È stata ricevuta una nuova richiesta che richiede la tua attenzione.

📋 Dettagli Richiesta
- Dipendente: [Nome Cognome]
- Tipo Richiesta: [Malattia/Ferie/Permesso/Permesso Legge 104/Trasferta]
- Periodo: [GG/MM/AAAA - GG/MM/AAAA]
- ID Richiesta: #[ID]

[Bottone: 📊 Gestisci Richiesta]
```

---

## 2. 📋 Risposta Richiesta (Dipendente)

**Quando viene inviata:** Quando una richiesta viene approvata o rifiutata

**Destinatario:** Il dipendente che ha fatto la richiesta

**Template:** `requestResponse`

**Oggetto:** `📋 Richiesta di [Tipo] [Approvata/Rifiutata] - Sistema HR LABA`

**Colori APPROVATA:**
- Header: Verde (`#10B981` → `#059669`)
- Box status: Verde chiaro (`#D1FAE5`) con bordo verde (`#10B981`)
- Bottone: Verde (`#10B981`)
- Testo stato: Verde (`#10B981`)

**Colori RIFIUTATA:**
- Header: Rosso (`#EF4444` → `#DC2626`)
- Box status: Rosso chiaro (`#FEE2E2`) con bordo rosso (`#EF4444`)
- Bottone: Rosso (`#EF4444`)
- Testo stato: Rosso (`#EF4444`)

**Testo:**
```
La tua richiesta è stata [Approvata/Rifiutata].

📝 Dettagli Richiesta
- Tipo Richiesta: [Malattia/Ferie/Permesso/Permesso Legge 104/Trasferta]
- Periodo: [GG/MM/AAAA - GG/MM/AAAA]
- Stato: [Approvata/Rifiutata]
- ID Richiesta: #[ID]

[Se ci sono note:]
Note:
[Note dell'admin]

[Bottone: 📊 Visualizza Dettagli]
```

**⚠️ PROBLEMA POTENZIALE:** Il template usa `status === 'approved'` per determinare i colori, ma potrebbe esserci confusione se lo status è "modificata" o altri stati intermedi.

---

## 3. ⏰ Promemoria Timbratura

**Quando viene inviata:** Quando viene inviato un promemoria manuale o automatico per timbrare

**Destinatario:** Dipendente specifico

**Template:** `attendanceReminder`

**Oggetto:** `⏰ Promemoria Timbratura - LABA Firenze`

**Colori:**
- Header: Arancione (`#F59E0B` → `#D97706`)
- Box reminder: Giallo chiaro (`#FEF3C7`) con bordo arancione (`#F59E0B`)
- Bottone: Arancione (`#F59E0B`)

**Testo:**
```
Ciao [Nome]

Non dimenticare di registrare la tua presenza oggi!

📅 Ricorda di Timbrare
Dipartimento: [Dipartimento]

Assicurati di timbrare correttamente:
✅ Entrata al mattino
✅ Uscita alla sera
✅ Pausa pranzo (se applicabile)

[Bottone: ⏰ Vai alla Timbratura]
```

---

## 4. 📊 Report Settimanale

**Quando viene inviata:** Automaticamente ogni settimana (se configurato)

**Destinatario:** Tutti i dipendenti

**Template:** `weeklyReport`

**Oggetto:** `📊 Report Settimanale - Settimana [N] - Sistema HR LABA`

**Colori:**
- Header: Blu (`#3B82F6` → `#2563EB`)
- Box stats: Blu chiaro (`#EFF6FF`) con bordo blu (`#3B82F6`)
- Valori positivi: Verde (`#10B981`)
- Valori negativi: Rosso (`#EF4444`)
- Bottone: Blu (`#3B82F6`)

**Testo:**
```
Ciao [Nome],

Ecco il riepilogo delle tue presenze e ore lavorate per la settimana:

📈 Riepilogo Settimanale
- Ore Lavorate Totali: [Xh Ym]
- Giorni di Presenza: [N]
- Ore Straordinario: [Xh Ym] (verde se > 0)
- Saldo Ore: [Xh Ym] (verde se >= 0, rosso se < 0)

[Bottone: 📊 Visualizza Dettagli Completi]
```

---

## 5. 🎉 Benvenuto

**Quando viene inviata:** Quando un account viene attivato/approvato

**Destinatario:** Nuovo dipendente

**Template:** `welcome`

**Oggetto:** `🎉 Benvenuto in LABA Firenze!`

**Colori:**
- Header: Verde (`#10B981` → `#059669`)
- Box welcome: Verde chiaro (`#D1FAE5`) con bordo verde (`#10B981`)
- Box steps: Grigio chiaro (`#F9FAFB`)
- Bottone: Verde (`#10B981`)

**Testo:**
```
Ciao [Nome], il tuo account è stato approvato

✅ Account Attivato
Il tuo account è stato approvato e attivato. Ora puoi accedere al sistema HR di LABA Firenze.

📋 Prossimi Passi
📋 Accedi al sistema con le tue credenziali
📋 Completa il tuo profilo
📋 Configura il tuo orario di lavoro
📋 Inizia a timbrare le presenze

[Bottone: 🚀 Accedi al Sistema]
```

---

## 6. 🔄 Recupero Ore - PROPOSTA ADMIN (NON IMPLEMENTATO)

**Quando DOVREBBE essere inviata:** Quando l'admin propone un recupero ore a un dipendente

**Destinatario:** Il dipendente per cui è stata proposta la recupero

**Template:** ❌ NON IMPLEMENTATO (solo TODO nel codice)

**Stato attuale:** Solo log in console, nessuna email inviata

---

## 7. 🔄 Recupero Ore - RISPOSTA (NON IMPLEMENTATO)

**Quando DOVREBBE essere inviata:** 
- Quando un recupero viene rifiutato
- Quando un dipendente accetta una proposta admin

**Destinatario:** 
- Dipendente (se rifiutato)
- Admin (se dipendente accetta proposta)

**Template:** ❌ NON IMPLEMENTATO (solo TODO nel codice)

**Stato attuale:** Solo log in console, nessuna email inviata

---

## 🔍 ANALISI PROBLEMA "STATO RIFIUTATO"

**Problema segnalato:** Le email a volte hanno stato "rifiutato" anche se sono modifiche o accettate.

**Soluzione applicata:**

1. **Correzione logica colori:** 
   - Aggiunta normalizzazione dello status (`trim().toLowerCase()`) prima del confronto
   - Usata variabile `isApproved` che verifica esattamente `'approved'`
   - VERDE solo se `normalizedStatus === 'approved'`, altrimenti ROSSO
   - Questo evita problemi con maiuscole/minuscole o spazi

2. **Correzione testi italiani:**
   - "Nuova Richiesta [Tipo]" → "Nuova Richiesta di [Tipo]"
   - "Richiesta [Tipo] [Stato]" → "Richiesta di [Tipo] [Stato]"
   - Tutti i testi ora hanno senso compiuto in italiano

3. **Note:**
   - Se lo status non è esattamente 'approved', viene considerato rifiutato (rosso)
   - Non ci sono stati intermedi gestiti, solo 'approved' e tutto il resto

**File da verificare:**
- `server/index.js` righe ~4839-4850 (admin crea richiesta per dipendente)
- `server/index.js` righe ~5206-5211 (aggiornamento richiesta)

---

## 📝 NOTE PER VERIFICA

1. **Colori:** Verificare che i colori siano coerenti con il brand LABA
2. **Testi:** Verificare che i testi siano chiari e corretti in italiano
3. **Stati:** Verificare che tutti gli stati possibili siano gestiti correttamente
4. **Link:** Verificare che i link puntino correttamente a `https://hr.laba.biz`
5. **Formattazione date:** Verificare formato GG/MM/AAAA
6. **Formattazione ore:** Verificare formato "Xh Ym" (es: "2h 30m")

