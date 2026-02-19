
import { api } from '@/config/api';
import type { LoginPayload, RegisterPayload, AuthResponse } from '@/types/auth.types';

/**
 * Authentication Service — Full Cookie Auth.
 * Backend sets HTTP-only cookie on login.
 * All requests include the cookie automatically via `credentials: 'include'`.
 * No tokens stored or sent by the frontend.
 */
class AuthService {
    /**
     * Login — backend sets HTTP-only cookie in Set-Cookie header.
     */
    async login(payload: LoginPayload): Promise<AuthResponse> {
        return api.post<AuthResponse>('/api/login', {
            username: payload.email,
            password: payload.password
        });
    }

    /**
     * Register new user
     */
    async register(payload: RegisterPayload): Promise<AuthResponse> {
        return api.post<AuthResponse>('/api/register', payload);
    }

    /**
     * Logout — backend clears the HTTP-only cookie.
     */
    async logout(): Promise<void> {
        try {
            await api.post<void>('/api/logout', {});
        } catch {
            // best-effort
        }
    }

    /**
     * Verify session: GET /api/me.
     * Cookie is sent automatically. Returns current user if valid.
     */
    async verifySession(): Promise<any> {
        return api.get<any>('/api/me');
    }
}

export const authService = new AuthService();
