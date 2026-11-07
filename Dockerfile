FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY . .
RUN npm run build

FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
COPY --from=build --chown=node:node /app/dist/ ./
COPY --from=build --chown=node:node /app/node_modules/ ./node_modules/
USER node
EXPOSE 3000
CMD ["node", "server.mjs"]
