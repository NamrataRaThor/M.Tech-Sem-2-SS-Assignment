# Multi-stage build for Catalog Service
FROM node:18-alpine AS builder

WORKDIR /app

# Copy root monorepo config
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages ./packages
COPY apps/catalog-service ./apps/catalog-service

# Install dependencies
RUN npm install

# Build common and contracts packages
RUN npm run build -w @eventsphere/common

# Build the service
WORKDIR /app/apps/catalog-service
RUN npx prisma generate
RUN npm run build

# Production image
FROM node:18-alpine

WORKDIR /app

# Create non-root user
RUN addgroup -S eventsphere && adduser -S eventsphere -G eventsphere

# Install wget for health checks
RUN apk add --no-cache wget

COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/catalog-service/dist ./apps/catalog-service/dist
COPY --from=builder /app/apps/catalog-service/package.json ./apps/catalog-service/package.json
COPY --from=builder /app/apps/catalog-service/prisma ./apps/catalog-service/prisma
COPY --from=builder /app/packages/common/dist ./packages/common/dist

USER eventsphere

EXPOSE 8082

CMD ["node", "apps/catalog-service/dist/index.js"]
