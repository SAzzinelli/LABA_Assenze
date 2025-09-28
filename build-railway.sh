#!/bin/bash

echo "🚀 Building Presenze LABA HR System for Railway..."

# Set environment
export NODE_ENV=production

# Clean npm cache
echo "🧹 Cleaning npm cache..."
npm cache clean --force

# Clean install dependencies
echo "📦 Installing server dependencies..."
rm -rf node_modules
npm install --no-cache --production=false

# Install client dependencies
echo "📦 Installing client dependencies..."
cd client
rm -rf node_modules
npm install --no-cache
cd ..

# Build client
echo "🏗️ Building client..."
cd client && npm run build && cd ..

# Check if build was successful
if [ -d "client/dist" ]; then
    echo "✅ Build successful!"
    echo "📋 Build info:"
    echo "NODE_ENV: $NODE_ENV"
    echo "PORT: ${PORT:-3000}"
    echo "Node version: $(node --version)"
    echo "NPM version: $(npm --version)"
else
    echo "❌ Build failed!"
    exit 1
fi

echo "🎉 Build completed successfully!"
