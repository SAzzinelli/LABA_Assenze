#!/bin/bash

# Script per deploy completo su Railway
echo "🚀 Deploy completo sistema HR LABA su Railway..."

# Build del frontend
echo "📦 Building frontend..."
cd client
npm install
npm run build
cd ..

# Verifica che il build sia stato creato
if [ ! -d "client/dist" ]; then
    echo "❌ Errore: Build frontend non trovato"
    exit 1
fi

echo "✅ Build frontend completato"

# Verifica che il server sia configurato correttamente
echo "🔧 Verifica configurazione server..."
if [ ! -f "server/index.js" ]; then
    echo "❌ Errore: Server non trovato"
    exit 1
fi

echo "✅ Server configurato correttamente"

# Test del server locale
echo "🧪 Test server locale..."
npm start &
SERVER_PID=$!

# Aspetta che il server si avvii
sleep 5

# Test endpoint
if curl -f http://localhost:3000/health > /dev/null 2>&1; then
    echo "✅ Server locale funzionante"
else
    echo "❌ Errore: Server locale non risponde"
    kill $SERVER_PID
    exit 1
fi

# Ferma il server di test
kill $SERVER_PID

echo "🎯 Sistema pronto per deploy su Railway!"
echo "📋 Istruzioni:"
echo "1. Committa le modifiche: git add . && git commit -m 'Deploy sistema ore completo'"
echo "2. Push su Railway: git push railway main"
echo "3. Verifica che Railway esegua: npm start"
echo "4. Controlla che serva sia frontend che backend"

echo "✅ Script completato!"
