FROM node:20-slim

WORKDIR /app

# Set production environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Install system dependencies (curl for healthchecks, python3 & pip for optional Python tools)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    python3 \
    python3-pip \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install node dependencies
COPY package*.json ./
RUN npm install

# Install optional python dependencies
COPY requirements.txt ./
RUN pip3 install --no-cache-dir -r requirements.txt --break-system-packages 2>/dev/null || true

# Copy all source files
COPY . .

# Build Vite frontend assets and bundle Express backend to dist/server.cjs
RUN npm run build

# Expose container ingress port (Railway overrides $PORT at runtime)
EXPOSE 3000

# Start production server serving frontend UI, API routes, healthchecks, and Telegram worker
CMD ["npm", "start"]

