# Day-Off demo: a dependency-free Node static server, so no npm install is needed.
FROM node:22-alpine
WORKDIR /app
COPY server.mjs ./
COPY public ./public
ENV PORT=4173
EXPOSE 4173
# Map keys are passed at run time (see docker-compose.yml); they are never baked into the image.
USER node
CMD ["node", "server.mjs"]
