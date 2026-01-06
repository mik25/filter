FROM debian:12.5-slim
EXPOSE 80
WORKDIR /home

RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates git && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Install Node.js the Lampac way
RUN curl -fSL -o node.tar.gz https://nodejs.org/dist/v18.19.0/node-v18.19.0-linux-x64.tar.gz \
    && mkdir -p /usr/local/nodejs \
    && tar -xzf node.tar.gz -C /usr/local/nodejs --strip-components=1 \
    && rm node.tar.gz \
    && ln -s /usr/local/nodejs/bin/node /usr/local/bin/node \
    && ln -s /usr/local/nodejs/bin/npm /usr/local/bin/npm

# Download from GitHub
RUN curl -L -o addon.zip https://github.com/mik25/filter/archive/refs/heads/5vers3.zip \
    && apt-get update && apt-get install -y unzip && apt-get clean \
    && unzip addon.zip && rm addon.zip \
    && mv filter-5vers3/* . && mv filter-5vers3/.* . 2>/dev/null || true \
    && rm -rf filter-5vers3

# Force replace any port references with 80
RUN find . -type f -name "*.js" -exec sed -i 's/3003/80/g' {} \; || true
RUN find . -type f -name "*.js" -exec sed -i 's/3000/80/g' {} \; || true
RUN find . -type f -name "*.json" -exec sed -i 's/3003/80/g' {} \; || true
RUN find . -type f -name "*.json" -exec sed -i 's/3000/80/g' {} \; || true

# Install dependencies
RUN npm install

# Create necessary directories with permissions
RUN mkdir -p data log storage && chmod -R 777 data log storage

# Set environment variables
ENV NODE_ENV=production


# Start the app (index.js is in /api folder)
CMD ["node", "api/index.js"]
