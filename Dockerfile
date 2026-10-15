FROM node:20-slim

# dumb-init como PID 1 para que ffmpeg/yt-dlp no dejen procesos zombis,
# git para el comando .version, python3 para extractores de yt-dlp,
# ca-certificates para descargas HTTPS.
RUN apt-get update && apt-get install -y --no-install-recommends \
      dumb-init ffmpeg curl git python3 ca-certificates fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

# yt-dlp con verificación de checksum contra el manifiesto oficial
ARG YTDLP_VERSION=2026.08.19
RUN mkdir -p /tmp/ytdlp && cd /tmp/ytdlp \
    && curl -fsSLO "https://github.com/yt-dlp/yt-dlp/releases/download/${YTDLP_VERSION}/yt-dlp" \
    && curl -fsSLO "https://github.com/yt-dlp/yt-dlp/releases/download/${YTDLP_VERSION}/SHA2-256SUMS" \
    && grep -E '[[:space:]]yt-dlp$' SHA2-256SUMS | sha256sum -c - \
    && install -m 755 yt-dlp /usr/local/bin/yt-dlp \
    && cd / && rm -rf /tmp/ytdlp

WORKDIR /app

COPY package*.json ./

# npm ci respeta package-lock.json (npm install puede resolver otras versiones)
RUN npm ci --omit=dev && npm cache clean --force

COPY . .

# Usuario sin privilegios
RUN mkdir -p /app/sessions && chown -R node:node /app
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||3000),r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "src/index.js"]