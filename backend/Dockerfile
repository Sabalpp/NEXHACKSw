# Backend Dockerfile
FROM node:20-alpine AS base

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source files
COPY . .

# Development stage
FROM base AS development
ENV NODE_ENV=development
EXPOSE 3001
CMD ["npm", "run", "dev"]

# Build stage
FROM base AS build
RUN npm run build

# Production stage
FROM node:20-alpine AS production
WORKDIR /app

# Copy only production dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy built files
COPY --from=build /app/dist ./dist

ENV NODE_ENV=production
EXPOSE 3001

CMD ["node", "dist/server.js"]

