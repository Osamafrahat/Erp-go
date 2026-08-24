FROM node:22-slim

WORKDIR /app

RUN apt-get update -qq && \
    apt-get install -y --no-install-recommends python3 make g++ && \
    rm -rf /var/lib/apt/lists/*

COPY package-lock.json package.json ./
RUN npm ci

COPY . .

EXPOSE 3001
CMD [ "node", "src/index.js" ]
