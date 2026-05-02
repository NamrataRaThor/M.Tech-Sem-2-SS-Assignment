# Multi-stage build for Ticket Service
FROM node:18-alpine AS builder

WORKDIR /app

# Copy root monorepo config
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages ./packages
COPY apps/ticket-service ./apps/ticket-service

# Install dependencies
RUN npm install

# Build common and contracts packages
RUN npm run build -w @eventsphere/common
RUN npm run build -w @eventsphere/contracts

# Build the service
WORKDIR /app/apps/ticket-service
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
COPY --from=builder /app/apps/ticket-service/dist ./apps/ticket-service/dist
COPY --from=builder /app/apps/ticket-service/package.json ./apps/ticket-service/package.json
COPY --from=builder /app/apps/ticket-service/prisma ./apps/ticket-service/prisma
COPY --from=builder /app/packages/common/dist ./packages/common/dist
COPY --from=builder /app/packages/contracts/dist ./packages/contracts/dist

USER eventsphere

EXPOSE 8086

CMD ["node", "apps/ticket-service/dist/index.js"]
