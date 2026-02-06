# Note di Sicurezza

## Vulnerabilità Note

### ~~xlsx (SheetJS)~~ - RISOLTO (06/02/2026)
**Sostituito con `exceljs`** - La libreria xlsx aveva vulnerabilità high (Prototype Pollution, ReDoS) senza fix disponibile. Migrazione completata a ExcelJS 4.4.0.

## Dipendenze Aggiornate

### Backend (server) - Ultimo aggiornamento: 18/01/2026
- ✅ `@supabase/supabase-js`: 2.58.0 → 2.90.1 (aggiornato 18/01/2026)
- ✅ `dotenv`: 16.4.5 → 17.2.3 (aggiornato 18/01/2026, major update)
- ✅ `helmet`: 7.2.0 → 8.1.0 (aggiornato 18/01/2026, major update)
- ✅ `uuid`: 10.0.0 → 13.0.0 (aggiornato 18/01/2026, major update)
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

