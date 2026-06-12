FROM node:20-alpine AS build

ARG VITE_API_BASE_URL=https://games.umalii.com/squarify-api/
ARG VITE_APP_BASE_PATH=/squarify/

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . ./

ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_APP_BASE_PATH=${VITE_APP_BASE_PATH}

RUN npm run build

FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
