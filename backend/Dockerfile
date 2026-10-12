# ── Base ─────────────────────────────────────────────────────
FROM node:20-alpine AS base
WORKDIR /app
ENV NODE_ENV=production
# dumb-init for correct signal handling (graceful shutdown).
RUN apk add --no-cache dumb-init

# ── Dependencies (production only) ───────────────────────────
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev || npm install --omit=dev

# ── Runtime ──────────────────────────────────────────────────
FROM base AS runtime
ENV PORT=8080

# Copy installed deps and source.
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src

# Writable dirs for logs + local upload fallback, owned by the non-root user.
RUN mkdir -p /app/logs /app/uploads && chown -R node:node /app/logs /app/uploads

# Run as the built-in non-root user.
USER node

EXPOSE 8080

# Container-level health check hits the liveness probe.
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||8080)+(process.env.API_PREFIX||'/api')+'/health/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "src/index.js"]

