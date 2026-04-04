FROM node:20-slim
WORKDIR /usr/src/app
COPY backend/package*.json ./backend/
RUN cd backend && npm install --production
COPY . .
WORKDIR /usr/src/app/backend
ENV PORT=8080
EXPOSE 8080
CMD ["node", "server.js"]
