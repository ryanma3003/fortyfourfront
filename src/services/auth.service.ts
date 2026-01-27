
import { api, TokenStorage } from '@/config/api';
import type { LoginPayload, RegisterPayload, AuthResponse } from '@/types/auth.types';

/**
 * Authentication Service
 * Handles login, register, and logout operations
 * Uses in-memory token storage for security (token not visible in DevTools)
 */
class AuthService {
    /**
     * Login user with email and password
     * @param payload Login credentials
     * @returns Authentication response with token and user data
     */
    async login(payload: LoginPayload): Promise<AuthResponse> {
        // Backend expects 'username', mapping email to username
        return api.post<AuthResponse>('/api/login', {
            username: payload.email,
            password: payload.password
        });
    }

    /**
     * Register new user
     * @param payload Registration data
     * @returns Authentication response with token and user data
     */
    async register(payload: RegisterPayload): Promise<AuthResponse> {
        return api.post<AuthResponse>('/api/register', payload);
    }

    /**
     * Logout user (client-side cleanup)
     * Clears the auth token from memory and API client
     */
    logout(): void {
        api.clearAuthToken();
        TokenStorage.clearToken();
        localStorage.removeItem('currentUser');
    }

    /**
     * Set authentication token for API requests
     * Stores in memory (not localStorage) for security
     * @param token JWT token
     */
    setAuthToken(token: string): void {
        TokenStorage.setToken(token);
        api.setAuthToken(token);
    }

    /**
     * Get current token from memory
     */
    getToken(): string | null {
        return TokenStorage.getToken();
    }

    /**
     * Check if user has valid token
     */
    hasToken(): boolean {
        return TokenStorage.hasToken();
    }
}

export const authService = new AuthService();
