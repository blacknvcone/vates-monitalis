// ============================================================
// Logto OIDC Configuration
// ============================================================

export const logtoConfig = {
  endpoint: import.meta.env.VITE_LOGTO_ENDPOINT || 'https://auth.danipras.dev',
  appId: import.meta.env.VITE_LOGTO_APP_ID || '',
  redirectUri: import.meta.env.VITE_LOGTO_REDIRECT_URI || `${window.location.origin}/callback`,
  postLogoutRedirectUri: import.meta.env.VITE_LOGTO_POST_LOGOUT_URI || window.location.origin,
};
