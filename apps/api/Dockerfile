FROM node:20-alpine AS base
WORKDIR /usr/src/app

COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
RUN npm ci --workspace=apps/api

COPY . .
EXPOSE 5000
CMD [ "npm", "run", "start", "--workspace=apps/api" ]
