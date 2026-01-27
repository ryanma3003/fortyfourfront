import { config } from './env';
import type { ApiResponse, ApiError, HttpMethod } from '@/types/api.types';

/**
 * Secure Token Storage with obfuscation
 * Token is stored encrypted in sessionStorage to:
 * 1. Persist across page reloads (unlike pure memory storage)
 * 2. Not be easily readable in DevTools (unlike plain localStorage)
 * 3. Auto-clear when browser/tab is closed (sessionStorage behavior)
 */
const TokenStorage = (() => {
    const STORAGE_KEY = '_ast'; // Obfuscated key name
    
    // Simple obfuscation (not cryptographic, but hides from casual viewing)
    const obfuscate = (str: string): string => {
        return btoa(str.split('').reverse().join(''));
    };
    
    const deobfuscate = (str: string): string => {
        try {
            return atob(str).split('').reverse().join('');
        } catch {
            return '';
        }
    };

    return {
        setToken(token: string | null) {
            if (token) {
                sessionStorage.setItem(STORAGE_KEY, obfuscate(token));
            } else {
                sessionStorage.removeItem(STORAGE_KEY);
            }
        },
        getToken(): string | null {
            const stored = sessionStorage.getItem(STORAGE_KEY);
            if (stored) {
                return deobfuscate(stored);
            }
            return null;
        },
        clearToken() {
            sessionStorage.removeItem(STORAGE_KEY);
        },
        hasToken(): boolean {
            return sessionStorage.getItem(STORAGE_KEY) !== null;
        }
    };
})();

// Export for use in other modules
export { TokenStorage };

/**
 * Custom Error class for API errors
 */
export class ApiRequestError extends Error {
    public status: number;
    public data?: any;

    constructor(message: string, status: number, data?: any) {
        super(message);
        this.name = 'ApiRequestError';
        this.status = status;
        this.data = data;
    }
}

/**
 * Base API Client using native fetch
 */
class ApiClient {
    private baseUrl: string;
    private defaultHeaders: HeadersInit;

    constructor(baseUrl: string) {
        this.baseUrl = baseUrl;
        this.defaultHeaders = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        };
    }

    /**
     * Set authentication token for future requests
     * @param token JWT token
     */
    public setAuthToken(token: string) {
        this.defaultHeaders = {
            ...this.defaultHeaders,
            'Authorization': `Bearer ${token}`,
        };
    }

    /**
     * Clear authentication token
     */
    public clearAuthToken() {
        const { 'Authorization': _, ...headers } = this.defaultHeaders as Record<string, string>;
        this.defaultHeaders = headers;
    }

    /**
     * Generic request method
     */
    private async request<T>(endpoint: string, method: HttpMethod, body?: any, customHeaders?: HeadersInit): Promise<T> {
        const cleanBaseUrl = this.baseUrl.replace(/\/$/, '');
        const cleanEndpoint = endpoint.replace(/^\//, '');
        const url = `${cleanBaseUrl}/${cleanEndpoint}`;

        const isFormData = body instanceof FormData;
        const headers: Record<string, string> = {
            ...this.defaultHeaders as Record<string, string>,
            ...customHeaders as Record<string, string>,
        };

        // If body is FormData, let fetch set the Content-Type with boundary
        if (isFormData) {
            delete headers['Content-Type'];
        }

        const options: RequestInit = {
            method,
            headers,
            credentials: 'include', // Enable HTTP-only cookie support
            body: isFormData ? body : (body ? JSON.stringify(body) : undefined),
        };

        try {
            const response = await fetch(url, options);

            // Handle non-2xx responses
            if (!response.ok) {
                let errorMessage = `HTTP Error ${response.status}`;
                let errorData = null;

                try {
                    // Try to parse error response
                    const errorJson = await response.json();
                    console.error('API Error Response:', errorJson); // Log full error for debugging

                    if (errorJson.message) {
                        errorMessage = errorJson.message;
                    }

                    if (errorJson.errors) {
                        errorMessage += ` | Details: ${JSON.stringify(errorJson.errors)}`;
                    }

                    if (!errorJson.message && !errorJson.errors) {
                        errorMessage += ` | Response: ${JSON.stringify(errorJson)}`;
                    }

                    errorData = errorJson;
                } catch (e) {
                    // If response is not JSON, use status text
                    errorMessage = response.statusText || errorMessage;
                }

                throw new ApiRequestError(errorMessage, response.status, errorData);
            }

            // Handle 204 No Content
            if (response.status === 204) {
                return {} as T;
            }

            // Parse successful response
            return await response.json();
        } catch (error) {
            if (error instanceof ApiRequestError) {
                throw error;
            }
            // Network errors or JSON parsing errors
            throw new ApiRequestError(
                error instanceof Error ? error.message : 'Unknown network error',
                0
            );
        }
    }

    // Public convenience methods

    public get<T>(endpoint: string, headers?: HeadersInit): Promise<T> {
        return this.request<T>(endpoint, 'GET', undefined, headers);
    }

    public post<T>(endpoint: string, body: any, headers?: HeadersInit): Promise<T> {
        return this.request<T>(endpoint, 'POST', body, headers);
    }

    public put<T>(endpoint: string, body: any, headers?: HeadersInit): Promise<T> {
        return this.request<T>(endpoint, 'PUT', body, headers);
    }

    public delete<T>(endpoint: string, headers?: HeadersInit): Promise<T> {
        return this.request<T>(endpoint, 'DELETE', undefined, headers);
    }

    public patch<T>(endpoint: string, body: any, headers?: HeadersInit): Promise<T> {
        return this.request<T>(endpoint, 'PATCH', body, headers);
    }
}

// Export singleton instance
export const api = new ApiClient(config.api.baseUrl);
