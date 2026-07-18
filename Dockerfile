# syntax=docker/dockerfile:1

# Build stage
FROM node:22-alpine AS builder
RUN npm install -g pnpm@10.29.3

WORKDIR /app

# Install dependencies
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copy source
COPY . .

# Build with placeholder — runtime injection replaces these
RUN VITE_CMS_URL=__VITE_CMS_URL__ \
    VITE_LOGTO_ENDPOINT=__VITE_LOGTO_ENDPOINT__ \
    VITE_LOGTO_APP_ID=__VITE_LOGTO_APP_ID__ \
    VITE_LOGTO_REDIRECT_URI=__VITE_LOGTO_REDIRECT_URI__ \
    VITE_LOGTO_POST_LOGOUT_URI=__VITE_LOGTO_POST_LOGOUT_URI__ \
    pnpm build

# Production stage - serve with nginx
FROM nginx:alpine AS runner

# Install envsubst for runtime injection
RUN apk add --no-cache gettext

# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

# Nginx config for SPA
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Entrypoint that injects env vars at runtime
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 80

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
