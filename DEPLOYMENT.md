# 🚀 Alpha Security Server - Deployment Guide

This guide provides multiple deployment options for your Alpha Security backend server.

## 📋 Pre-Deployment Checklist

- [ ] Update `.env.production` with your specific configuration
- [ ] Generate secure secrets for JWT_SECRET, API_SECRET_KEY, etc.
- [ ] Choose your deployment platform
- [ ] Update Android app's ServerConfig.kt with your deployed URL

---

## 🌐 Deployment Options

### Option 1: Railway (Recommended - Free Tier Available)

**Why Railway?** Free tier, easy deployment, automatic SSL, great for Node.js apps.

#### Steps:
1. **Sign up at [Railway](https://railway.app)**

2. **Install Railway CLI:**
   ```bash
   npm install -g @railway/cli
   ```

3. **Login and deploy:**
   ```bash
   cd alpha-server
   railway login
   railway new
   railway add
   railway up
   ```

4. **Set environment variables:**
   ```bash
   railway variables set NODE_ENV=production
   railway variables set JWT_SECRET=$(openssl rand -base64 32)
   railway variables set API_SECRET_KEY=$(openssl rand -base64 32)
   railway variables set SESSION_SECRET=$(openssl rand -base64 32)
   railway variables set ENCRYPTION_KEY=$(openssl rand -base64 32)
   ```

5. **Your app will be available at:** `https://your-app-name.up.railway.app`

---

### Option 2: Render (Free Tier with Limitations)

**Why Render?** Simple deployment, free tier, automatic SSL.

#### Steps:
1. **Sign up at [Render](https://render.com)**

2. **Connect your GitHub repository**

3. **Create a new Web Service:**
   - Environment: Node
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Auto-Deploy: Yes

4. **Configure Environment Variables** (in Render dashboard):
   ```
   NODE_ENV=production
   JWT_SECRET=[generate-random-32-char-string]
   API_SECRET_KEY=[generate-random-32-char-string]
   SESSION_SECRET=[generate-random-32-char-string]
   ```

5. **Your app will be available at:** `https://your-app-name.onrender.com`

---

### Option 3: Heroku (Paid - No Free Tier)

**Why Heroku?** Mature platform, lots of add-ons, easy scaling.

#### Steps:
1. **Install Heroku CLI** from [here](https://devcenter.heroku.com/articles/heroku-cli)

2. **Login and create app:**
   ```bash
   cd alpha-server
   heroku login
   heroku create your-app-name
   ```

3. **Set environment variables:**
   ```bash
   heroku config:set NODE_ENV=production
   heroku config:set JWT_SECRET=$(openssl rand -base64 32)
   heroku config:set API_SECRET_KEY=$(openssl rand -base64 32)
   heroku config:set SESSION_SECRET=$(openssl rand -base64 32)
   ```

4. **Deploy:**
   ```bash
   git add .
   git commit -m "Initial deployment"
   git push heroku main
   ```

5. **Your app will be available at:** `https://your-app-name.herokuapp.com`

---

### Option 4: Docker on VPS (Most Control)

**Why VPS?** Full control, potentially cheaper for high usage, custom domain.

#### Prerequisites:
- VPS with Ubuntu/CentOS
- Docker and Docker Compose installed
- Domain name (optional but recommended)

#### Steps:
1. **Clone your repository on the VPS:**
   ```bash
   git clone your-repository-url
   cd alpha-server
   ```

2. **Configure environment:**
   ```bash
   cp .env.production .env
   # Edit .env with your specific values
   nano .env
   ```

3. **Start with Docker Compose:**
   ```bash
   docker-compose up -d
   ```

4. **Set up SSL with Let's Encrypt (optional):**
   ```bash
   # Install certbot
   sudo apt install certbot python3-certbot-nginx
   
   # Get SSL certificate
   sudo certbot --nginx -d your-domain.com
   ```

---

## 🔧 Post-Deployment Configuration

### 1. Update Android App

Edit `app/src/main/java/com/example/alpha/config/ServerConfig.kt`:

```kotlin
private const val SERVER_BASE_URL = "https://your-deployed-url.com"
```

### 2. Test Your Deployment

Visit these URLs to verify everything works:

- **Health Check:** `https://your-url.com/health`
- **API Info:** `https://your-url.com/api`
- **Dashboard:** `https://your-url.com/dashboard`

### 3. Configure CORS

Make sure your deployed URL is added to CORS configuration in your environment variables:

```
CORS_ORIGIN=https://your-deployed-url.com
FRONTEND_URL=https://your-deployed-url.com
```

---

## 📊 Monitoring & Maintenance

### Health Monitoring

Your server includes a health endpoint: `/health`

Monitor this endpoint to ensure your server is running properly.

### Log Monitoring

Different platforms provide different logging solutions:

- **Railway:** Check logs in Railway dashboard
- **Render:** View logs in Render dashboard  
- **Heroku:** Use `heroku logs --tail`
- **VPS:** Use `docker-compose logs -f`

### Database Backups

For production, consider:
1. Regular database backups
2. Using managed database services
3. Setting up automated backup scripts

---

## 🔐 Security Considerations

1. **Always use HTTPS in production**
2. **Keep secrets secure** - never commit them to git
3. **Regular updates** - keep dependencies updated
4. **Rate limiting** - already configured in the server
5. **Firewall rules** - if using VPS, configure proper firewall rules

---

## 🚨 Troubleshooting

### Common Issues:

1. **Environment Variables Not Set**
   - Check platform-specific environment variable settings
   - Ensure secrets are properly generated

2. **CORS Issues**
   - Update CORS_ORIGIN in environment variables
   - Make sure Android app uses correct URL

3. **Database Connection Issues**
   - Check DATABASE_PATH configuration
   - Ensure proper file permissions

4. **WebSocket Connection Issues**
   - Verify platform supports WebSockets
   - Check proxy configuration

---

## 📱 Quick Start Commands

### Railway (Fastest):
```bash
npm install -g @railway/cli
railway login
railway new
railway up
```

### Docker (Local Testing):
```bash
docker-compose up -d
```

### Traditional VPS:
```bash
npm install
npm start
```

---

## 🎯 Recommended Flow

1. **Start with Railway** (free, easy)
2. **Test thoroughly** with your Android app
3. **Scale to VPS** when you need more control
4. **Add monitoring** as you grow

Your Alpha Security Server will be online and ready to manage devices securely! 🛡️