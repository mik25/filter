FROM debian:12.5-slim

EXPOSE 80
WORKDIR /home

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    git \
    python3 \
    make \
    g++ \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Install Node.js manually
RUN curl -fSL -o node.tar.gz https://nodejs.org/dist/v18.19.0/node-v18.19.0-linux-x64.tar.gz \
    && mkdir -p /usr/local/nodejs \
    && tar -xzf node.tar.gz -C /usr/local/nodejs --strip-components=1 \
    && rm node.tar.gz \
    && ln -s /usr/local/nodejs/bin/node /usr/local/bin/node \
    && ln -s /usr/local/nodejs/bin/npm /usr/local/bin/npm

# Install Yarn globally
RUN npm install -g yarn@1.22.22 \
    && ln -s /usr/local/nodejs/bin/yarn /usr/local/bin/yarn

# Download addon source from GitHub
RUN curl -L -o addon.zip https://github.com/mik25/nzbon/archive/refs/heads/indexers-and-servers.zip \
    && apt-get update && apt-get install -y unzip && apt-get clean \
    && unzip addon.zip && rm addon.zip \
    && mv nzbon-indexers-and-servers/* . && rm -rf nzbon-indexers-and-servers

# Install dependencies
RUN yarn install --frozen-lockfile --network-timeout 100000

# Replace any hardcoded ports with 80
RUN find . -type f -name "*.js" -exec sed -i 's/7000/80/g' {} \; || true && \
    find . -type f -name "*.js" -exec sed -i 's/3000/80/g' {} \; || true && \
    find . -type f -name "*.json" -exec sed -i 's/7000/80/g' {} \; || true && \
    find . -type f -name "*.json" -exec sed -i 's/3000/80/g' {} \; || true

# Create data directory for cache/logs
RUN mkdir -p /data/cache /data/logs && chmod -R 777 /data

# Set environment variables
ENV NODE_ENV=production \
    PORT=80

# Create startup script
RUN echo '#!/bin/bash' > /start.sh && \
    echo 'export NODE_ENV=production' >> /start.sh && \
    echo 'export PORT=80' >> /start.sh && \
    echo 'cd /home' >> /start.sh && \
    echo 'echo "Starting NZB Addon on port 80..."' >> /start.sh && \
    echo 'exec yarn start' >> /start.sh && \
    chmod +x /start.sh

VOLUME ["/data"]

CMD ["/start.sh"]
