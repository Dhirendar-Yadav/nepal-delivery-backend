FROM node:24.19-bookworm-slim

ENV NODE_ENV=production

WORKDIR /app

COPY package*.json ./

RUN npm ci --omit=dev && npm cache clean --force

COPY . .

RUN mkdir -p /app/uploads && chown -R node:node /app/uploads

USER node

EXPOSE 5005

CMD ["node", "server.js"]