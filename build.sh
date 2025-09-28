#!/bin/bash

echo "🚀 Building Presenze LABA HR System v2.0..."

# Set environment
export NODE_ENV=production

# Clean install dependencies (important for Railway)
echo "🧹 Cleaning node_modules..."
rm -rf node_modules client/node_modules

# Install dependencies with clean cache
echo "📦 Installing server dependencies..."
npm ci --only=production

# Install client dependencies
echo "📦 Installing client dependencies..."
cd client && npm ci && cd ..

# Build client
echo "🏗️  Building client..."
cd client && npm run build && cd ..

# Check if build was successful
if [ -d "client/dist" ]; then
    echo "✅ Build successful! Files in client/dist:"
    ls -la client/dist/
    echo "📋 Build info:"
    echo "NODE_ENV: $NODE_ENV"
    echo "PORT: ${PORT:-3000}"
    echo "FRONTEND_URL: ${FRONTEND_URL:-https://hr.laba.biz}"
    echo "Node version: $(node --version)"
    echo "NPM version: $(npm --version)"
else
    echo "❌ Build failed!"
    exit 1
fi

echo "🎉 Build completed successfully!"