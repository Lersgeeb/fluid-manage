# Build stage: compiles the app; none of this reaches the final image.
FROM node:24-alpine AS build
WORKDIR /app

# Installing before copying the source keeps dependencies in their own cache layer.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# Runtime stage: static files only, served by a non-root Nginx.
FROM nginxinc/nginx-unprivileged:stable-alpine

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:8080/ || exit 1
