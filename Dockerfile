# Multi-stage Docker Build for Intelligent Media Processing Pipeline
FROM node:20-alpine AS build

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY client/package*.json ./client/

# Install dependencies
RUN npm install
RUN cd client && npm install

# Copy source files
COPY . .

# Build Vite frontend bundle
RUN cd client && npm run build

# Production Stage
FROM node:20-alpine AS production

WORKDIR /app

# Copy root package files
COPY package*.json ./
RUN npm install --only=production

# Copy built server and frontend assets
COPY --from=build /app/server ./server
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/client/dist ./client/dist

# Expose HTTP port
EXPOSE 5000

ENV PORT=5000
ENV NODE_ENV=production

# Start application server
CMD ["node", "server/index.js"]
