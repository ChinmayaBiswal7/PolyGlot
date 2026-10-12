# Use Node 22 slim for native TypeScript stripping & maximum speed
FROM node:22-bookworm-slim

# Set environment
ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONIOENCODING=utf-8
ENV PORT=10000
ENV GOCACHE=/root/.cache/go-build

# Install all compilers & language runtimes:
# - python3
# - gcc, g++ (build-essential)
# - tcc (tiny C compiler: 5ms instant execution)
# - lld (ultra-fast LLVM linker)
# - default-jdk-headless (java)
# - golang-go
# - rustc
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    tcc \
    lld \
    python3 \
    python-is-python3 \
    golang-go \
    rustc \
    default-jdk-headless \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install --production

# Copy entire application (Frontend + Backend)
COPY server.js ./
COPY src ./src
COPY public ./public

# Expose Render default port
EXPOSE 10000

# Start unified server
CMD ["node", "server.js"]
