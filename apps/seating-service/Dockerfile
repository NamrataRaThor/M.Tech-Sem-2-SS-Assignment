# Multi-stage build for Seating Service
FROM node:18-alpine AS builder

WORKDIR /app

# Copy root monorepo config
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages ./packages
COPY apps/seating-service ./apps/seating-service

# Install dependencies
RUN npm install

# Build common and contracts packages
RUN npm run build -w @eventsphere/common

# Build the service
WORKDIR /app/apps/seating-service
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
COPY --from=builder /app/apps/seating-service/dist ./apps/seating-service/dist
COPY --from=builder /app/apps/seating-service/package.json ./apps/seating-service/package.json
COPY --from=builder /app/apps/seating-service/prisma ./apps/seating-service/prisma
COPY --from=builder /app/packages/common/dist ./packages/common/dist

USER eventsphere

EXPOSE 8083

CMD ["node", "apps/seating-service/dist/index.js"]
