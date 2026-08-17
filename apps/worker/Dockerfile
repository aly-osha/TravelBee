FROM node:20-alpine AS base
WORKDIR /usr/src/app

COPY package*.json ./
COPY apps/worker/package*.json ./apps/worker/
RUN npm ci --workspace=apps/worker

COPY . .
CMD [ "npm", "run", "start", "--workspace=apps/worker" ]
