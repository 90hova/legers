FROM node:22-alpine
WORKDIR /srv/worker
COPY apps/worker/package.json ./
RUN npm install --omit=dev
COPY apps/worker/src ./src
EXPOSE 8787
CMD ["node","src/index.js"]
