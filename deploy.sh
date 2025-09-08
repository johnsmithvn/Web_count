#!/bin/bash

# Production Deployment Script
echo "🚀 Media Database Manager - Production Setup"
echo "============================================="

# Check if .env.production exists
if [ ! -f ".env.production" ]; then
    echo "📝 Creating .env.production from template..."
    cp .env.example .env.production
    echo "⚠️  IMPORTANT: Please edit .env.production with your settings:"
    echo "   - Set a strong JWT_SECRET"
    echo "   - Configure your domain/host settings"
    echo "   - Review security settings"
    echo ""
    read -p "Press Enter after you've edited .env.production..."
fi

# Generate random JWT secret if not set
if grep -q "your-super-secure-jwt-secret-here-please-change-this" .env.production; then
    echo "🔐 Generating secure JWT secret..."
    JWT_SECRET=$(openssl rand -base64 64 | tr -d '\n')
    # Use a safer replacement method to escape special characters  
    ESCAPED_JWT_SECRET=$(printf '%s\n' "$JWT_SECRET" | sed 's/[\.^$*+?{|]/\\&/g')
    sed -i "s/your-super-secure-jwt-secret-here-please-change-this/$ESCAPED_JWT_SECRET/" .env.production
    echo "✅ JWT secret generated and updated"
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm run install:all

# Build client
echo "🏗️  Building client for production..."
npm run build

# Initialize database  
echo "🗄️  Initializing database..."
npm run db:init

# Final checks
echo "🔍 Running pre-deployment checks..."

# Check if JWT_SECRET is set
if ! grep -q "JWT_SECRET=" .env.production; then
    echo "❌ JWT_SECRET not found in .env.production"
    exit 1
fi

# Check if build directory exists
if [ ! -d "client/build" ]; then
    echo "❌ Client build directory not found"
    exit 1
fi

# Check if database exists
if [ ! -f "server/database.db" ]; then
    echo "❌ Database file not found"
    exit 1
fi

echo ""
echo "✅ Production setup complete!"
echo "🚀 To start the server:"
echo "   npm run start:prod"
echo ""
echo "📋 Remember to:"
echo "   - Configure your reverse proxy (nginx/apache)"
echo "   - Set up SSL certificates"
echo "   - Configure firewall rules"
echo "   - Set up monitoring and backups"
