# Use Debian/Ubuntu slim as base
FROM node:20-bookworm-slim

# Set environment
ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONIOENCODING=utf-8
ENV PORT=7860

# Install all compilers & language runtimes:
# - python3
# - gcc, g++ (build-essential)
# - default-jdk (javac, java)
# - golang-go
# - rustc, cargo
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    python3 \
    golang-go \
    rustc \
    default-jdk-headless \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Create user with user ID 1000 (recommended for Hugging Face security permissions)
RUN useradd -m -u 1000 user
USER user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH

WORKDIR /home/user/app

# Copy package files and install dependencies
COPY --chown=user package*.json ./
RUN npm install --production

# Copy entire application (Frontend + Backend)
COPY --chown=user server.js ./
COPY --chown=user src ./src
COPY --chown=user public ./public

# Expose standard Hugging Face port 7860
EXPOSE 7860

# Start unified server
CMD ["node", "server.js"]
