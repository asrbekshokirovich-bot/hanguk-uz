FROM node:22-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY index.mjs ./
COPY analyzers ./analyzers

# Runs forever, polling Frigate. Restart policy is handled by compose.
CMD ["node", "index.mjs"]
