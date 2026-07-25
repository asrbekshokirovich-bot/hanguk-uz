# Always-on media bridge. Provide env vars at runtime (host/compose), not baked in.
FROM node:22-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY . .
# Long-running process; the host/orchestrator owns the restart policy.
EXPOSE 8080
CMD ["node", "server.mjs"]
