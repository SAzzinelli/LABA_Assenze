# 📚 **MANUALE UTENTE - SISTEMA HR BASATO SU ORE**

## 🎯 **INTRODUZIONE**

Benvenuto nel nuovo sistema HR di LABA basato su **ore** invece che su giorni fissi. Questo sistema ti permette di gestire ferie, permessi, straordinari e trasferte in modo più preciso e flessibile.

### **🔑 CONCETTI CHIAVE**

- **Tutto in ore**: Ferie, permessi e straordinari sono calcolati in ore
- **Pattern di lavoro**: Il tuo orario di lavoro determina quanto vale un giorno
- **Ledger a movimenti**: Ogni operazione lascia una traccia completa
- **Calcoli automatici**: Il sistema calcola tutto per te

---

## 🏠 **DASHBOARD PRINCIPALE**

### **📊 Panoramica Saldi**
- **Ferie**: Ore di ferie disponibili e utilizzate
- **Permessi**: Ore di permesso disponibili e utilizzate  
- **Monte Ore**: Ore di straordinario accumulate
- **Trasferte**: Viaggi per eventi programmati

### **📈 Statistiche Mensili**
- Ore maturate nel mese corrente
- Ore utilizzate nel mese corrente
- Bilancio netto ore

---

## 🏖️ **GESTIONE FERIE**

### **📅 Come Richiedere Ferie**

1. **Vai su "Le Mie Ferie"**
2. **Seleziona le date** di inizio e fine
3. **Il sistema calcola automaticamente** le ore necessarie
4. **Verifica il saldo** disponibile
5. **Invia la richiesta**

### **🧮 Calcolo Automatico Ore**

Il sistema calcola le ore ferie basandosi sul tuo **pattern di lavoro**:

- **Lunedì-Venerdì**: Ore complete del tuo orario
- **Sabato-Domenica**: 0 ore (giorni non lavorativi)
- **Festivi**: 0 ore (giorni non lavorativi)

**Esempio**: Se lavori 8h/giorno dal lunedì al venerdì:
- 1 giorno ferie = 8 ore
- 1 settimana ferie = 40 ore
- 1 mese ferie = 173.33 ore

### **📊 Visualizzazione Saldi**

Il sistema mostra sia **ore** che **giorni equivalenti**:
- **Totale**: 208h (≈ 26 giorni)
- **Utilizzate**: 64h (≈ 8 giorni)
- **Rimanenti**: 144h (≈ 18 giorni)
- **In attesa**: 16h (≈ 2 giorni)

---

## 🚗 **GESTIONE TRASFERTE**

### **📝 Come Creare una Trasferta**

1. **Vai su "Trasferte"**
2. **Clicca "Nuova Trasferta"**
3. **Compila i dati**:
   - Destinazione
   - Scopo del viaggio
   - Date di partenza e ritorno
   - Ore di viaggio
   - Ore di evento
4. **Invia la richiesta**

### **⏰ Calcolo Ore Trasferta**

- **Ore Viaggio**: Tempo speso in viaggio
- **Ore Evento**: Tempo effettivo sul posto
- **Totale**: Somma delle ore viaggio + evento

**Esempio**:
- Viaggio Milano-Roma: 4h
- Evento fiera: 8h
- **Totale trasferta**: 12h

### **📋 Stati Trasferte**

- **In attesa**: Richiesta inviata, in attesa di approvazione
- **Approvata**: Trasferta confermata
- **Rifiutata**: Trasferta non autorizzata
- **Completata**: Trasferta terminata

---

## ⏰ **GESTIONE MONTE ORE**

### **➕ Aggiungere Ore Straordinario**

1. **Vai su "Monte Ore"**
2. **Clicca "Aggiungi Ore"**
3. **Inserisci**:
   - Ore lavorate
   - Data dello straordinario
   - Motivo
   - Note aggiuntive
4. **Conferma**

### **➖ Usare Ore per Permesso**

1. **Vai su "Monte Ore"**
2. **Clicca "Usa Ore"**
3. **Inserisci**:
   - Ore da utilizzare
   - Data del permesso
   - Motivo
   - Note aggiuntive
4. **Conferma**

### **📊 Visualizzazione Saldi**

- **Totale Maturate**: Ore di straordinario accumulate
- **Totale Usate**: Ore utilizzate per permessi
- **Saldo Attuale**: Ore disponibili per permessi
- **In Attesa**: Richieste di permesso pendenti

### **📈 Statistiche Mensili**

- **Ore Maturate**: Straordinari del mese
- **Ore Usate**: Permessi del mese
- **Bilancio Netto**: Differenza tra maturate e usate

---

## 📅 **MATURAZIONE AUTOMATICA**

### **🔄 Come Funziona**

Ogni mese il sistema calcola automaticamente:
- **Ferie**: Basate sul tuo pattern di lavoro
- **Permessi**: Secondo il tuo tipo di contratto

### **📊 Calcolo Maturazione**

**Ferie**:
- Full-time: 17.33h/mese (208h/anno)
- Part-time: 8.67h/mese (104h/anno)

**Permessi**:
- Full-time: 8.67h/mese (104h/anno)
- Part-time: 4.33h/mese (52h/anno)

### **📈 Visualizzazione Cronologia**

Puoi vedere tutte le maturazioni mensili:
- Data di maturazione
- Ore maturate
- Periodo di riferimento
- Tipo di maturazione

---

## 🔄 **CARRY-OVER E SCADENZE**

### **📅 Scadenze Annuali**

- **31 Dicembre**: Scadenza ore ferie e permessi
- **Ore eccedenti**: Scadono automaticamente
- **Ore riportabili**: Trasferite all'anno successivo

### **📊 Limiti Carry-Over**

**Per tipo di contratto**:
- **Full-time**: Max 104h ferie riportabili
- **Part-time**: Max 52h ferie riportabili
- **Permessi**: Max 50% delle ore ferie riportabili

### **📈 Visualizzazione Carry-Over**

- **Ore Scadute**: Ore perse per eccedenza
- **Ore Riportate**: Ore trasferite all'anno successivo
- **Breakdown per Categoria**: Ferie vs Permessi
- **Cronologia Anni**: Confronto tra anni diversi

---

## 🎛️ **PATTERN DI LAVORO**

### **📋 Il Tuo Orario**

Il sistema conosce il tuo orario di lavoro:
- **Lunedì**: 8h
- **Martedì**: 8h
- **Mercoledì**: 8h
- **Giovedì**: 8h
- **Venerdì**: 8h
- **Sabato**: 0h
- **Domenica**: 0h

**Totale settimanale**: 40h
**Totale mensile**: 173.33h

### **🔄 Aggiornamenti Pattern**

Se il tuo orario cambia:
1. **Contatta l'amministratore**
2. **Il pattern viene aggiornato**
3. **I calcoli si adattano automaticamente**

---

## 📱 **INTERFACCIA UTENTE**

### **🎨 Design Moderno**

- **Interfaccia intuitiva**: Facile da usare
- **Design responsive**: Funziona su tutti i dispositivi
- **Colori chiari**: Verde per maturazioni, rosso per utilizzi
- **Icone significative**: Ogni funzione ha la sua icona

### **📊 Visualizzazioni**

- **Card informative**: Saldi principali sempre visibili
- **Grafici mensili**: Andamento ore nel tempo
- **Tabelle dettagliate**: Movimenti completi
- **Filtri avanzati**: Per anno, mese, categoria

### **🔔 Notifiche**

- **Richiesta approvata**: Notifica quando le tue richieste vengono approvate
- **Scadenze imminenti**: Avvisi per ore in scadenza
- **Saldi bassi**: Alert quando rimangono poche ore

---

## 🚀 **FUNZIONALITÀ AVANZATE**

### **📊 Reportistica**

- **Export dati**: Esporta i tuoi dati in Excel/PDF
- **Grafici personalizzati**: Visualizza le tue statistiche
- **Confronti temporali**: Confronta periodi diversi

### **🔍 Ricerca e Filtri**

- **Per data**: Filtra per periodo specifico
- **Per categoria**: Ferie, permessi, straordinari
- **Per stato**: Approvato, pendente, rifiutato
- **Per tipo**: Maturazione, utilizzo, scadenza

### **📱 Mobile**

- **App mobile**: Accesso da smartphone/tablet
- **Notifiche push**: Avvisi in tempo reale
- **Sincronizzazione**: Dati sempre aggiornati

---

## ❓ **DOMANDE FREQUENTI**

### **🤔 Perché il sistema usa le ore invece dei giorni?**

Le ore sono più precise e permettono:
- Calcoli proporzionali per part-time
- Gestione flessibile degli orari
- Tracciabilità completa dei movimenti

### **📅 Come vengono calcolate le ferie per un part-time?**

Le ferie sono calcolate proporzionalmente:
- Part-time 50%: 104h ferie/anno invece di 208h
- Part-time 75%: 156h ferie/anno invece di 208h

### **⏰ Cosa succede se lavoro più ore del previsto?**

Le ore extra vanno nel **Monte Ore**:
- Si accumulano come ore di straordinario
- Posso usarle per permessi di recupero
- Hanno una scadenza (di solito 12 mesi)

### **🚗 Le trasferte contano come lavoro normale?**

Sì, le trasferte sono considerate lavoro:
- Ore di viaggio: Conteggiate come lavoro
- Ore di evento: Conteggiate come lavoro normale
- Se superano l'orario normale: Differenza va in Monte Ore

### **📊 Posso vedere la cronologia completa dei miei movimenti?**

Sì, nel **Ledger Ore** puoi vedere:
- Tutte le maturazioni mensili
- Tutti gli utilizzi di ferie/permessi
- Tutte le scadenze e carry-over
- Tutti gli straordinari e recuperi

---

## 🆘 **SUPPORTO E AIUTO**

### **📞 Contatti**

- **Email**: hr@laba.biz
- **Telefono**: +39 02 1234567
- **Orari**: Lun-Ven 9:00-18:00

### **📚 Risorse**

- **Manuale tecnico**: Per sviluppatori
- **Video tutorial**: Guide passo-passo
- **FAQ complete**: Domande e risposte dettagliate

### **🐛 Segnalazione Problemi**

Se riscontri problemi:
1. **Controlla la connessione internet**
2. **Prova a ricaricare la pagina**
3. **Controlla che i dati siano corretti**
4. **Contatta il supporto tecnico**

---

## 🎉 **CONCLUSIONE**

Il nuovo sistema HR basato su ore ti offre:

✅ **Precisione**: Calcoli esatti basati sul tuo orario reale
✅ **Flessibilità**: Gestione personalizzata per ogni tipo di contratto
✅ **Trasparenza**: Tracciabilità completa di tutti i movimenti
✅ **Automazione**: Calcoli automatici senza errori manuali
✅ **Modernità**: Interfaccia intuitiva e responsive

**Benvenuto nel futuro della gestione HR!** 🚀

---

*Ultimo aggiornamento: Settembre 2025*
*Versione sistema: 2.0.0*
