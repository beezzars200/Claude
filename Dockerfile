FROM node:18-alpine
WORKDIR /app
COPY ticket-system/web-scanner/package*.json ./
RUN npm install --omit=dev
COPY ticket-system/web-scanner/ .
EXPOSE 3000
CMD ["node", "app.js"]
