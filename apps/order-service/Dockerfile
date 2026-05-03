# Multi-stage build for Order Service
FROM node:18-alpine AS builder

WORKDIR /app

# Copy root monorepo config
COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/order-service ./apps/order-service

# Install dependencies
RUN npm install

# Build common and contracts packages

# Build the service
WORKDIR /app/apps/order-service
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
COPY --from=builder /app/apps/order-service/dist ./apps/order-service/dist
COPY --from=builder /app/apps/order-service/package.json ./apps/order-service/package.json
COPY --from=builder /app/apps/order-service/prisma ./apps/order-service/prisma

USER eventsphere

EXPOSE 8085

CMD ["node", "apps/order-service/dist/index.js"]
