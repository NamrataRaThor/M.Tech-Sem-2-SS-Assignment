# Multi-stage build for API Gateway
FROM node:18-alpine AS builder

WORKDIR /app

# Copy root monorepo config
COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/api-gateway ./apps/api-gateway

# Install dependencies
RUN npm install

# Build common package

# Build the gateway
WORKDIR /app/apps/api-gateway
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
COPY --from=builder /app/apps/api-gateway/dist ./apps/api-gateway/dist
COPY --from=builder /app/apps/api-gateway/package.json ./apps/api-gateway/package.json

USER eventsphere

EXPOSE 8080

CMD ["node", "apps/api-gateway/dist/index.js"]
