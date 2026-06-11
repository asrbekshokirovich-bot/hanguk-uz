# Always-on worker. Provide env vars at runtime (compose/host), not via .env.
FROM node:22-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY . .
# Long-running process; restart policy should be handled by the orchestrator.
CMD ["node", "index.mjs"]
