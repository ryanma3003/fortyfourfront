/**
 * Environment Configuration
 * Centralized access to environment variables with type safety.
 * 
 * In dev: VITE_API_BASE_URL is empty — requests go to /api/* which
 * Vite proxy forwards to the backend. This makes cookies work
 * because the browser sees same-origin requests.
 * 
 * In production: set VITE_API_BASE_URL to the actual backend URL
 * (should be same domain so SameSite=Strict cookies work).
 */

const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY || '';

export const config = {
    api: {
        baseUrl,
        timeout: 30000,
    },
    turnstile: {
        siteKey: turnstileSiteKey,
    },
    isProduction: import.meta.env.PROD,
    isDev: import.meta.env.DEV,
};
