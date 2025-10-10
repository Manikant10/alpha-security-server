# 🚀 Alpha Security Server - Quick Deployment Script (PowerShell)
# This script helps you deploy your server to Railway quickly on Windows

Write-Host "🛡️  Alpha Security Server - Deployment Script" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan

# Check if Railway CLI is installed
try {
    railway --version | Out-Null
    Write-Host "✅ Railway CLI is already installed!" -ForegroundColor Green
}
catch {
    Write-Host "❌ Railway CLI is not installed. Installing..." -ForegroundColor Yellow
    npm install -g @railway/cli
    Write-Host "✅ Railway CLI installed successfully!" -ForegroundColor Green
}

# Check if user is logged in
Write-Host "🔐 Checking Railway login status..." -ForegroundColor Yellow
try {
    railway whoami | Out-Null
    Write-Host "✅ Logged in to Railway successfully!" -ForegroundColor Green
}
catch {
    Write-Host "Please login to Railway..." -ForegroundColor Yellow
    railway login
}

# Create new project or use existing
Write-Host "📁 Setting up Railway project..." -ForegroundColor Yellow
if (!(Test-Path "railway.toml")) {
    railway init
}
else {
    Write-Host "✅ Railway project already configured" -ForegroundColor Green
}

# Generate secure secrets (Windows-compatible)
Write-Host "🔐 Generating secure secrets..." -ForegroundColor Yellow

function Generate-RandomString {
    param([int]$Length = 32)
    $chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/="
    $result = ""
    for ($i = 0; $i -lt $Length; $i++) {
        $result += $chars[(Get-Random -Maximum $chars.Length)]
    }
    return $result
}

$JWT_SECRET = Generate-RandomString -Length 44
$API_SECRET = Generate-RandomString -Length 44
$SESSION_SECRET = Generate-RandomString -Length 44
$ENCRYPTION_KEY = Generate-RandomString -Length 44

# Set environment variables
Write-Host "⚙️  Setting environment variables..." -ForegroundColor Yellow
railway variables set NODE_ENV=production
railway variables set JWT_SECRET="$JWT_SECRET"
railway variables set API_SECRET_KEY="$API_SECRET"
railway variables set SESSION_SECRET="$SESSION_SECRET"
railway variables set ENCRYPTION_KEY="$ENCRYPTION_KEY"
railway variables set DATABASE_PATH="./data/alpha-security.db"

Write-Host "✅ Environment variables set successfully!" -ForegroundColor Green

# Deploy
Write-Host "🚀 Deploying to Railway..." -ForegroundColor Cyan
railway up

Write-Host ""
Write-Host "🎉 Deployment completed!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Next steps:" -ForegroundColor Yellow
Write-Host "1. Check your Railway dashboard for the deployment URL"
Write-Host "2. Update ServerConfig.kt in your Android app with the new URL"
Write-Host "3. Test your deployment by visiting /health endpoint"
Write-Host ""
Write-Host "🔗 Useful commands:" -ForegroundColor Cyan
Write-Host "   railway logs     - View application logs"
Write-Host "   railway status   - Check deployment status"
Write-Host "   railway open     - Open your deployed app"
Write-Host ""
Write-Host "✅ Your Alpha Security Server is now online!" -ForegroundColor Green

# Keep window open
Write-Host ""
Write-Host "Press any key to continue..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")"
