FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY client/package.json client/
COPY server/package.json server/
RUN npm install
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000 DATA_DIR=/data
COPY package*.json ./
COPY server/package.json server/
RUN npm install --omit=dev -w server
COPY server server
COPY --from=build /app/client/dist client/dist
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 3000
HEALTHCHECK --interval=30s CMD wget -qO- http://localhost:3000/api/health || exit 1
CMD ["node", "server/index.js"]
