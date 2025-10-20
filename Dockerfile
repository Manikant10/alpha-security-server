# ==============================
# ALPHA SECURITY SERVER - DOCKERFILE
# ==============================

# Use official Node.js runtime as base image
FROM node:25-alpine

# Set working directory
WORKDIR /app

# Create app user for security
RUN addgroup -g 1001 -S nodejs
RUN adduser -S alphaserver -u 1001

# Create necessary directories
RUN mkdir -p /app/data /app/logs /app/uploads /app/backups
RUN chown -R alphaserver:nodejs /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy application code
COPY . .

# Set correct permissions
RUN chown -R alphaserver:nodejs /app

# Switch to non-root user
USER alphaserver

# Create volume mounts for persistent data
VOLUME ["/app/data", "/app/logs", "/app/uploads", "/app/backups"]

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => process.exit(res.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# Start the application
CMD ["npm", "start"]