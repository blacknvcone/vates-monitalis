#!/bin/sh
# Runtime env var injection for Vite SPA
# Replaces placeholder strings in built JS files with actual env values

set -e

: "${VITE_CMS_URL:=https://cms.danipras.dev}"
: "${VITE_LOGTO_ENDPOINT:=https://auth.danipras.dev}"
: "${VITE_LOGTO_APP_ID:=}"
: "${VITE_LOGTO_REDIRECT_URI:=}"
: "${VITE_LOGTO_POST_LOGOUT_URI:=}"

# Find all JS files in dist and replace placeholders
find /usr/share/nginx/html -type f -name '*.js' -exec sed -i \
  -e "s|__VITE_CMS_URL__|${VITE_CMS_URL}|g" \
  -e "s|__VITE_LOGTO_ENDPOINT__|${VITE_LOGTO_ENDPOINT}|g" \
  -e "s|__VITE_LOGTO_APP_ID__|${VITE_LOGTO_APP_ID}|g" \
  -e "s|__VITE_LOGTO_REDIRECT_URI__|${VITE_LOGTO_REDIRECT_URI}|g" \
  -e "s|__VITE_LOGTO_POST_LOGOUT_URI__|${VITE_LOGTO_POST_LOGOUT_URI}|g" \
  {} +

exec "$@"
