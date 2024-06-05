FROM node:20.13.1-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install -f
RUN npx ngcc --properties es2023 browser module main --first-only --create-ivy-entry-points
COPY . .
RUN npm run build
FROM nginx:stable
COPY default.conf /etc/nginx/conf.d
COPY --from=build /app/dist/desporto24/ /usr/share/nginx/html
EXPOSE 80
