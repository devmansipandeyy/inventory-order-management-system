# --- Build stage ---
FROM node:20-alpine AS build
WORKDIR /app

# Install dependencies (use lockfile when present)
COPY package*.json ./
RUN npm ci || npm install

# Copy source and build
COPY . .

# API base can be baked at build time (Vite inlines VITE_* at build).
ARG VITE_API_BASE=http://localhost:8011
ENV VITE_API_BASE=$VITE_API_BASE
RUN npm run build

# --- Serve stage ---
FROM nginx:1.27-alpine AS serve
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
