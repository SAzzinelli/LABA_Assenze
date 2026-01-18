# Note di Sicurezza

## Vulnerabilità Note

### xlsx (SheetJS) - HIGH
**Versione attuale:** 0.18.5  
**Vulnerabilità:**
- Prototype Pollution (GHSA-4r6h-8v6p-xvw6)
- Regular Expression Denial of Service (ReDoS) (GHSA-5pgg-2g8v-p4x9)

**Stato:** Nessun fix disponibile al momento

**Contesto d'uso:**
- `xlsx` è utilizzato **solo per generare file Excel** per i report delle presenze
- **NON viene utilizzato per parsing di file Excel** caricati da utenti
- I file Excel vengono generati internamente dal sistema con dati già validati dal database

**Valutazione del rischio:**
- **Rischio limitato** perché:
  - Non viene processato input non fidato
  - I dati provengono dal database Supabase (già validati)
  - Non ci sono file Excel caricati da utenti esterni
- Le vulnerabilità sono più critiche quando si parsa input non fidato

**Raccomandazioni:**
- Monitorare gli aggiornamenti di `xlsx` per quando sarà disponibile un fix
- Valutare alternative come `exceljs` o `xlsx-populate` se necessario
- Mantenere il sistema aggiornato con le altre dipendenze

## Dipendenze Aggiornate

### Backend (server) - Ultimo aggiornamento: 18/01/2026
- ✅ `@supabase/supabase-js`: 2.58.0 → 2.90.1 (aggiornato 18/01/2026)
- ✅ `jsonwebtoken`: 9.0.2 → 9.0.3 (aggiornato 18/01/2026)
- ✅ `nodemailer`: 7.0.6 → 7.0.12 (aggiornato 18/01/2026, fix vulnerabilità moderate)
- ✅ `resend`: 6.1.1 → 6.7.0 (aggiornato 18/01/2026)
- ✅ `socket.io`: 4.8.1 → 4.8.3 (aggiornato 18/01/2026)
- ✅ `nodemon`: 3.1.4 → 3.1.11 (aggiornato 18/01/2026)
- ✅ `ws`: 8.18.3 → 8.19.0 (aggiornato 18/01/2026)
- ✅ `body-parser`: 1.20.2 → 1.20.4
- ✅ `express`: 4.19.2 → 4.22.1
- ✅ `express-rate-limit`: 8.1.0 → 8.2.1
- ✅ `helmet`: 7.1.0 → 7.2.0
- ✅ `glob`: 10.4.5 → 10.5.0 (fix vulnerabilità high)
- ✅ `js-yaml`: 3.14.1 → 3.14.2 (fix vulnerabilità moderate)
- ✅ `jws`: Risolta vulnerabilità high tramite npm audit fix (18/01/2026)
- ✅ `qs`: Risolta vulnerabilità high tramite npm audit fix (18/01/2026)

### Frontend (client)
- ✅ `autoprefixer`: 10.4.14 → 10.4.22
- ✅ `react-router-dom`: 6.8.1 → 6.30.2
- ✅ `tailwindcss`: 3.3.3 → 3.4.18

## Monitoraggio

Eseguire regolarmente:
```bash
npm audit
npm outdated
```

Per aggiornare le dipendenze:
```bash
npm audit fix
npm update
```

