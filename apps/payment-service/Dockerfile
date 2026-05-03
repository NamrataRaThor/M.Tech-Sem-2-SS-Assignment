# Multi-stage build for Payment Service
FROM node:18-alpine AS builder

WORKDIR /app

# Copy root monorepo config
COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/payment-service ./apps/payment-service

# Install dependencies
RUN npm install

# Build common and contracts packages

# Build the service
WORKDIR /app/apps/payment-service
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
COPY --from=builder /app/apps/payment-service/dist ./apps/payment-service/dist
COPY --from=builder /app/apps/payment-service/package.json ./apps/payment-service/package.json
COPY --from=builder /app/apps/payment-service/prisma ./apps/payment-service/prisma

USER eventsphere

EXPOSE 8084

CMD ["node", "apps/payment-service/dist/index.js"]
