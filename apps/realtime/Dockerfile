FROM node:20-alpine AS base
WORKDIR /usr/src/app

COPY package*.json ./
COPY apps/realtime/package*.json ./apps/realtime/
RUN npm ci --workspace=apps/realtime

COPY . .
EXPOSE 5001
CMD [ "npm", "run", "start", "--workspace=apps/realtime" ]
