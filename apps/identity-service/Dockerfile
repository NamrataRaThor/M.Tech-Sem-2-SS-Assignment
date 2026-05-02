# Multi-stage build for production-grade Node.js services
FROM node:18-alpine AS builder

WORKDIR /app

# Copy root monorepo config
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages ./packages
COPY apps/identity-service ./apps/identity-service

# Install dependencies
RUN npm install

# Build common and contracts packages first
RUN npm run build -w @eventsphere/common
RUN npm run build -w @eventsphere/contracts

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
COPY --from=builder /app/packages/common/dist ./packages/common/dist
COPY --from=builder /app/packages/contracts/dist ./packages/contracts/dist

USER eventsphere

EXPOSE 8081

CMD ["node", "apps/identity-service/dist/index.js"]
