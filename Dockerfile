# Aivancity Hub — production image (API + static frontend on one origin).
# Playwright/scraping is a local-only feature and is not installed here.
FROM node:20-slim

ENV NODE_ENV=production \
    PORT=8080 \
    DATA_DIR=/data

WORKDIR /app
COPY backend/package*.json backend/
RUN cd backend && npm install --omit=dev --omit=optional --no-audit --no-fund && npm cache clean --force

COPY backend/src backend/src
COPY frontend frontend

RUN mkdir -p /data && chown -R node:node /data
USER node
VOLUME ["/data"]
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "backend/src/index.js"]
