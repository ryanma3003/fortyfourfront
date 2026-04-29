import { api } from '@/config/api';
import type {
    LoginPayload,
    LoginRequestBody,
    RegisterPayload,
    AuthResponse,
    MfaSetupResponse,
    MfaEnableResponse,
    MfaVerifyResponse,
} from '@/types/auth.types';

/**
 * Authentication Service — Cookie Auth + MFA.
 * Backend sets HTTP-only cookie on login.
 * MFA tokens (setup_token, mfa_token) are returned in response body.
 */
class AuthService {
    /**
     * Login - backend sets auth tokens via HTTP-only cookies.
     */
    async login(payload: LoginPayload): Promise<AuthResponse> {
        const body: LoginRequestBody = {
            "cf-turnstile-response": payload.turnstileToken ?? '',
            identifier: payload.identifier,
            password: payload.password,
        };

        return api.post<AuthResponse>('/api/login', body);
    }

    /**
     * Register new user.
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
     * Refresh access token — backend validates the refresh-token cookie
     * and issues a new access-token cookie.
     */
    async refresh(): Promise<void> {
        await api.post<void>('/api/refresh', {});
    }

    /**
     * Verify session: GET /api/users/{id}.
     * Cookie is sent automatically. Returns current user if valid.
     */
    async verifySession(userId: string): Promise<any> {
        return api.get<any>(`/api/users/${userId}`);
    }

    // ============================
    // MFA Endpoints
    // ============================

    /**
     * MFA Setup — request QR code and secret for first-time TOTP setup.
     * Returns otpauth_url (full URI for QR) and secret (Base32 uppercase).
     */
    async mfaSetup(setupToken: string): Promise<MfaSetupResponse> {
        return api.post<MfaSetupResponse>('/api/mfa/setup', {
            setup_token: setupToken,
        });
    }

    /**
     * MFA Enable — verify the 6-digit code during first-time setup.
     * On success, backend sets auth tokens via HTTP-only cookies.
     */
    async mfaEnable(setupToken: string, code: string): Promise<MfaEnableResponse> {
        return api.post<MfaEnableResponse>('/api/mfa/enable', {
            setup_token: setupToken,
            code,
        });
    }

    /**
     * MFA Verify — verify the 6-digit code for returning users.
     * On success, backend sets auth tokens via HTTP-only cookies.
     */
    async mfaVerify(mfaToken: string, code: string): Promise<MfaVerifyResponse> {
        return api.post<MfaVerifyResponse>('/api/mfa/verify', {
            mfa_token: mfaToken,
            code,
        });
    }
}

export const authService = new AuthService();
