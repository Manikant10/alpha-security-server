#!/bin/bash

# 🚀 Alpha Security Server - Quick Deployment Script
# This script helps you deploy your server to Railway quickly

echo "🛡️  Alpha Security Server - Deployment Script"
echo "=============================================="

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI is not installed. Installing..."
    npm install -g @railway/cli
    echo "✅ Railway CLI installed successfully!"
fi

# Check if user is logged in
echo "🔐 Checking Railway login status..."
if ! railway whoami &> /dev/null; then
    echo "👤 Please login to Railway..."
    railway login
fi

echo "✅ Logged in to Railway successfully!"

# Create new project or use existing
echo "📁 Setting up Railway project..."
if [ ! -f "railway.toml" ]; then
    railway init
else
    echo "✅ Railway project already configured"
fi

# Generate secure secrets
echo "🔐 Generating secure secrets..."
JWT_SECRET=$(openssl rand -base64 32)
API_SECRET=$(openssl rand -base64 32)
SESSION_SECRET=$(openssl rand -base64 32)
ENCRYPTION_KEY=$(openssl rand -base64 32)

# Set environment variables
echo "⚙️  Setting environment variables..."
railway variables set NODE_ENV=production
railway variables set JWT_SECRET="$JWT_SECRET"
railway variables set API_SECRET_KEY="$API_SECRET"
railway variables set SESSION_SECRET="$SESSION_SECRET"
railway variables set ENCRYPTION_KEY="$ENCRYPTION_KEY"
railway variables set DATABASE_PATH="./data/alpha-security.db"

echo "✅ Environment variables set successfully!"

# Deploy
echo "🚀 Deploying to Railway..."
railway up

echo ""
echo "🎉 Deployment completed!"
echo ""
echo "📋 Next steps:"
echo "1. Check your Railway dashboard for the deployment URL"
echo "2. Update ServerConfig.kt in your Android app with the new URL"
echo "3. Test your deployment by visiting /health endpoint"
echo ""
echo "🔗 Useful commands:"
echo "   railway logs     - View application logs"
echo "   railway status   - Check deployment status"
echo "   railway open     - Open your deployed app"
echo ""
echo "✅ Your Alpha Security Server is now online!"