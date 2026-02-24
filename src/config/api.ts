import { config } from './env';
import type { HttpMethod } from '@/types/api.types';

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
 * Base API Client using native fetch.
 * Authentication is handled entirely via HTTP-only cookies.
 * Every request includes `credentials: 'include'` so the browser
 * sends the cookie automatically — no Authorization header needed.
 */
class ApiClient {
    private baseUrl: string;
    private defaultHeaders: Record<string, string>;

    constructor(baseUrl: string) {
        this.baseUrl = baseUrl;
        this.defaultHeaders = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        };
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
            ...this.defaultHeaders,
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
