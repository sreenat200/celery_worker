# BullMQ media worker — Koyeb/Railway (small RAM)
# Build context: media-worker/
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:22-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
ENV WORKER_CONCURRENCY=1
ENV SHARP_CONCURRENCY=1
ENV PG_POOL_MAX=2
ENV UV_THREADPOOL_SIZE=2
ENV ENABLE_AVIF=0
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x docker-entrypoint.sh && npx prisma generate
ENTRYPOINT ["./docker-entrypoint.sh"]
