# Multi-stage Dockerfile for Universal Telegram Bot & Dashboard
FROM node:20-slim AS builder

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./
RUN npm ci

# Copy source code and build
COPY . .
RUN npm run build

# Production runtime stage
FROM node:20-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY package*.json ./
RUN npm ci --omit=dev

# Copy compiled backend and frontend assets
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/index.html ./index.html

EXPOSE 3000

CMD ["npm", "start"]
