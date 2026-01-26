
import { api } from '@/config/api';
import type { LoginPayload, RegisterPayload, AuthResponse } from '@/types/auth.types';

/**
 * Authentication Service
 * Handles login, register, and logout operations
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
     * Clears the auth token from API client
     */
    logout(): void {
        api.clearAuthToken();
        localStorage.removeItem('auth_token');
        localStorage.removeItem('currentUser');
    }

    /**
     * Set authentication token for API requests
     * @param token JWT token
     */
    setAuthToken(token: string): void {
        api.setAuthToken(token);
    }
}

export const authService = new AuthService();
