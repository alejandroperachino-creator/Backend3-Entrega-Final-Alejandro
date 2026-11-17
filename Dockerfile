FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production \
    PORT=3003 \
    UPLOAD_BASE_DIR=/shipnow-uploads

COPY --chown=node:node package.json ./
COPY --chown=node:node package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --chown=node:node . .
RUN mkdir -p /shipnow-uploads /app/logs && chown -R node:node /shipnow-uploads /app

EXPOSE 3003

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 CMD wget -qO- "http://127.0.0.1:${PORT}/api/health" >/dev/null || exit 1

USER node

CMD ["npm", "start"]
