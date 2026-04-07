FROM node:25-alpine AS base
WORKDIR /app

# Dependencies
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci

# Build
COPY frontend/ .
RUN npm run build

# Production
FROM node:25-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=base --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=base --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=base --chown=nextjs:nodejs /app/public ./public

USER nextjs

EXPOSE 3000
CMD ["node", "server.js"]
