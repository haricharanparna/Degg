FROM node:24-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
ENV NODE_ENV=production DB_PATH=/data/degg.db
RUN mkdir -p /data && chown node:node /data
VOLUME /data
USER node
EXPOSE 8080
CMD ["sh", "-c", "node lib/seed.js && node server.js"]
