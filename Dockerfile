# Same image for Code Engine and local `podman run`.
# The process starts from /app — never from a laptop absolute path.
FROM node:20-alpine
WORKDIR /app
COPY server/package.json ./
RUN npm install --omit=dev
COPY server/src ./src
ENV NODE_ENV=production
ENV MCP_MODE=http
ENV PORT=8080
EXPOSE 8080
CMD ["node", "src/index.js"]
