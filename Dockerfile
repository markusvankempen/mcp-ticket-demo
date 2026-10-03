# Same image for Code Engine and local `podman run`.
# The process starts from /app — never from a laptop absolute path.
FROM registry.redhat.io/ubi9/nodejs-20-minimal:latest

WORKDIR /app
COPY server/package.json ./
RUN npm install --omit=dev

COPY server/src ./src

ENV NODE_ENV=production
ENV MCP_MODE=http
ENV PORT=8080
ENV HOST=0.0.0.0
# Public bind: set ADMIN_PASSWORD at run time. demo/demo is laptop-only.

# Run as non-root — required by IBM security policy and good container practice.
USER 1001

EXPOSE 8080
CMD ["node", "src/index.js"]
