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
 *
 * Token Refresh Strategy:
 * - On 401 response, automatically calls POST /api/refresh (cookie-based).
 * - If refresh succeeds, the original request is retried once.
 * - If refresh also fails (401), `onUnauthorized` callback is invoked
 *   so the app can log out and redirect to login.
 * - Concurrent 401s are queued and replayed after a single refresh attempt.
 */
class ApiClient {
    private baseUrl: string;
    private defaultHeaders: Record<string, string>;
    private requestQueue: Promise<void> = Promise.resolve();
    private readonly minRequestGapMs = 500;
    private readonly maxRetries = 3;
    private readonly maxRetryDelayMs = 30_000;
    private readonly retryableStatuses = new Set([429, 502, 503, 504]);
    private rateLimitedUntil = 0;

    // Refresh-token state — prevents multiple simultaneous refresh calls
    private isRefreshing = false;
    private refreshQueue: Array<(success: boolean) => void> = [];

    // Hook called when refresh fails (e.g. redirect to login)
    public onUnauthorized: (() => void) | null = null;

    constructor(baseUrl: string) {
        this.baseUrl = baseUrl;
        this.defaultHeaders = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        };
    }

    /**
     * Perform POST /api/refresh.
     * Returns true if the backend accepted the refresh (new cookie set),
     * false otherwise. Never throws.
     */
    private async tryRefreshToken(): Promise<boolean> {
        try {
            const cleanBaseUrl = this.baseUrl.replace(/\/$/, '');
            const res = await fetch(`${cleanBaseUrl}/api/refresh`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            });
            return res.ok;
        } catch {
            return false;
        }
    }

    /**
     * Wait for a pending refresh to finish.
     * Queued callers receive `true` (retry) or `false` (give up).
     */
    private waitForRefresh(): Promise<boolean> {
        return new Promise((resolve) => {
            this.refreshQueue.push(resolve);
        });
    }

    /** Drain the queue and notify all waiting callers. */
    private drainQueue(success: boolean) {
        this.refreshQueue.forEach((cb) => cb(success));
        this.refreshQueue = [];
    }

    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    private getRetryDelay(response: Response, retryAttempt: number): number {
        const retryAfter = response.headers.get('Retry-After');
        if (retryAfter) {
            const seconds = Number(retryAfter);
            if (!Number.isNaN(seconds)) {
                return Math.min(seconds * 1000, this.maxRetryDelayMs);
            }

            const retryAt = new Date(retryAfter).getTime();
            if (!Number.isNaN(retryAt)) {
                return Math.min(Math.max(0, retryAt - Date.now()), this.maxRetryDelayMs);
            }
        }

        const baseDelay = 1000 * Math.pow(2, retryAttempt);
        const jitter = Math.floor(Math.random() * 500);
        return Math.min(baseDelay + jitter, this.maxRetryDelayMs);
    }

    private shouldRetry(method: HttpMethod, status: number): boolean {
        if (!this.retryableStatuses.has(status)) return false;
        if (status === 429) return true;
        return method === 'GET';
    }

    private async waitTurn(): Promise<void> {
        const previous = this.requestQueue;
        let release!: () => void;

        this.requestQueue = new Promise((resolve) => {
            release = resolve;
        });

        await previous;
        const cooldownMs = Math.max(0, this.rateLimitedUntil - Date.now());
        if (cooldownMs > 0) {
            await this.sleep(cooldownMs);
        }
        await this.sleep(this.minRequestGapMs);
        release();
    }

    /**
     * Generic request method
     */
    private async request<T>(
        endpoint: string,
        method: HttpMethod,
        body?: any,
        customHeaders?: HeadersInit,
        isRetry = false,
        retryAttempt = 0,
    ): Promise<T> {
        const cleanBaseUrl = this.baseUrl.replace(/\/$/, '');
        const cleanEndpoint = endpoint.replace(/^\//, '');
        const url = `${cleanBaseUrl}/${cleanEndpoint}`;

        const isFormData = body instanceof FormData;
        const isUrlEncoded = body instanceof URLSearchParams;
        const headers: Record<string, string> = {
            ...this.defaultHeaders,
            ...customHeaders as Record<string, string>,
        };



        // If body is FormData, let fetch set the Content-Type with boundary
        if (isFormData) {
            delete headers['Content-Type'];
        }
        // If body is URLSearchParams, set application/x-www-form-urlencoded
        if (isUrlEncoded) {
            headers['Content-Type'] = 'application/x-www-form-urlencoded';
        }

        const options: RequestInit = {
            method,
            headers,
            credentials: 'include', // Enable HTTP-only cookie support
            body: isFormData || isUrlEncoded ? body : (body ? JSON.stringify(body) : undefined),
        };



        try {
            await this.waitTurn();
            const response = await fetch(url, options);

            // -------------------------------------------------------
            // 401 Handling — attempt token refresh then retry once
            // -------------------------------------------------------
            if (response.status === 401 && !isRetry) {
                // Never try to refresh the refresh endpoint itself or auth endpoints
                const isRefreshEndpoint = cleanEndpoint === 'api/refresh';
                const isAuthEndpoint = ['api/login', 'api/register', 'api/mfa/setup', 'api/mfa/enable', 'api/mfa/verify'].includes(cleanEndpoint);

                if (!isRefreshEndpoint && !isAuthEndpoint) {
                    let refreshed: boolean;

                    if (this.isRefreshing) {
                        // Another request is already refreshing — wait for it
                        refreshed = await this.waitForRefresh();
                    } else {
                        this.isRefreshing = true;
                        refreshed = await this.tryRefreshToken();
                        this.isRefreshing = false;
                        this.drainQueue(refreshed);
                    }

                    if (refreshed) {
                        // Retry the original request with the new cookie
                        return this.request<T>(endpoint, method, body, customHeaders, true, retryAttempt);
                    } else {
                        // Refresh failed — session is truly expired
                        this.onUnauthorized?.();
                        throw new ApiRequestError('Session expired. Please log in again.', 401);
                    }
                }
            }
            // -------------------------------------------------------

            if (this.shouldRetry(method, response.status) && retryAttempt < this.maxRetries) {
                const delay = this.getRetryDelay(response, retryAttempt);
                if (response.status === 429) {
                    this.rateLimitedUntil = Math.max(this.rateLimitedUntil, Date.now() + delay);
                }
                console.warn(`[ApiClient] ${response.status} for ${cleanEndpoint}. Retrying in ${delay}ms...`);
                await this.sleep(delay);
                return this.request<T>(endpoint, method, body, customHeaders, isRetry, retryAttempt + 1);
            }

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

            // Parse successful response. Some cookie-auth endpoints only set
            // HTTP-only cookies and return an empty body.
            const text = await response.text();
            if (!text) {
                return {} as T;
            }

            return JSON.parse(text);
        } catch (error) {
            if (error instanceof ApiRequestError) {
                throw error;
            }

            if (method === 'GET' && retryAttempt < this.maxRetries) {
                const delay = this.getRetryDelay(new Response(null, { status: 503 }), retryAttempt);
                console.warn(`[ApiClient] Network error for ${cleanEndpoint}. Retrying in ${delay}ms...`, error);
                await this.sleep(delay);
                return this.request<T>(endpoint, method, body, customHeaders, isRetry, retryAttempt + 1);
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

    public delete<T>(endpoint: string, body?: any, headers?: HeadersInit): Promise<T> {
        return this.request<T>(endpoint, 'DELETE', body, headers);
    }

    public patch<T>(endpoint: string, body: any, headers?: HeadersInit): Promise<T> {
        return this.request<T>(endpoint, 'PATCH', body, headers);
    }
}

// Export singleton instance
export const api = new ApiClient(config.api.baseUrl);
