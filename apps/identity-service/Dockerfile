# Multi-stage build for production-grade Node.js services
FROM node:18-alpine AS builder

WORKDIR /app

# Copy root monorepo config
COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/identity-service ./apps/identity-service

# Install dependencies
RUN npm install

# Build common and contracts packages first

# Build the service
WORKDIR /app/apps/identity-service
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
COPY --from=builder /app/apps/identity-service/dist ./apps/identity-service/dist
COPY --from=builder /app/apps/identity-service/package.json ./apps/identity-service/package.json
COPY --from=builder /app/apps/identity-service/prisma ./apps/identity-service/prisma

USER eventsphere

EXPOSE 8081

CMD ["node", "apps/identity-service/dist/index.js"]
