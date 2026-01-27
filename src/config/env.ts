/**
 * Environment Configuration
 * Centralized access to environment variables with type safety.
 */

const baseUrl = import.meta.env.VITE_API_BASE_URL;

if (!baseUrl) {
    throw new Error('VITE_API_BASE_URL is not defined');
}

export const config = {
    api: {
        baseUrl,
        timeout: 30000,
    },
    isProduction: import.meta.env.PROD,
    isDev: import.meta.env.DEV,
};
