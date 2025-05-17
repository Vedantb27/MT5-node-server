# Stage 1: Build and install dependencies
FROM node:18 AS builder

WORKDIR /build

# Copy only package files first to leverage Docker cache
COPY package*.json ./

# Install dependencies inside the container (not from host)
RUN npm install

# Now copy the rest of your app code
COPY . .

# Stage 2: Production image
FROM node:18 AS runner

WORKDIR /app

# Copy only the necessary parts from the builder
COPY --from=builder /build/package*.json ./
COPY --from=builder /build/node_modules ./node_modules/
COPY --from=builder /build/. .

# Expose port (optional but recommended)
EXPOSE 8000

# Run the app
CMD ["npm", "start"]
