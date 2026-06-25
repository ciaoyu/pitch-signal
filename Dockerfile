# Build stage
FROM node:22-alpine AS builder

WORKDIR /usr/src/app

# Install native dependencies for better-sqlite3
RUN apk add --no-cache python3 make g++ 

# Copy package files
COPY package*.json ./

# Install dependencies using ci for exact versions
RUN npm ci --omit=dev

# Production stage
FROM node:22-alpine

WORKDIR /usr/src/app

# su-exec lets the entrypoint drop from root to the 'node' user after fixing
# volume permissions (Railway mounts persistent volumes owned by root).
RUN apk add --no-cache su-exec

# Copy node_modules and built dependencies from builder
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/package*.json ./

# Copy application code (excluding files in .dockerignore)
COPY . .

# Entrypoint fixes the mounted-volume ownership then drops to 'node'.
RUN cp docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh \
  && chmod +x /usr/local/bin/docker-entrypoint.sh

# Set permissions for node user on the app directory
RUN chown -R node:node /usr/src/app

# NOTE: container starts as root so the entrypoint can chown the volume,
# then immediately drops to the non-root 'node' user via su-exec.
# The application process itself never runs as root.

# Expose port
EXPOSE 5099

# Environment variables (defaults; Railway variables take precedence)
ENV NODE_ENV=production
ENV PORT=5099
ENV DATA_PATH=/usr/src/app/data

# Health check — verify DB is reachable via /health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO /dev/null --server-response http://localhost:${PORT}/health 2>&1 | grep -q '200 OK' || exit 1

# Drop privileges in the entrypoint; run the app as 'node'.
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "server.js"]
