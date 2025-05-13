# Stage 1: Install dependencies
FROM node:18 AS builder

WORKDIR /build

COPY package*.json . 

RUN npm install

COPY . .

# Stage 2: Run
FROM node:18 AS runner

WORKDIR /app

COPY --from=builder /build/package*.json . 
COPY --from=builder /build/node_modules ./node_modules/
COPY --from=builder /build/. .
# If you don't want to copy dev files like Dockerfile/test files, you can be more selective.

CMD ["npm", "start"]
