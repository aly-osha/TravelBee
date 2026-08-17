FROM node:20-alpine AS build
WORKDIR /usr/src/app

COPY package*.json ./
COPY apps/web/package*.json ./apps/web/
RUN npm ci --workspace=apps/web

COPY . .
RUN npm run build --workspace=apps/web

FROM nginxinc/nginx-unprivileged:alpine
COPY --from=build /usr/src/app/apps/web/dist /usr/share/nginx/html
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
