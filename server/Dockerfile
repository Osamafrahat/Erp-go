FROM node:22-slim

WORKDIR /app

COPY package-lock.json package.json ./
RUN npm ci

COPY . .

EXPOSE 3001
CMD [ "node", "src/index.js" ]
