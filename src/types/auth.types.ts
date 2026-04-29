export interface LoginPayload {
    identifier: string;
    password: string;
    turnstileToken?: string;
}

export interface LoginRequestBody {
    "cf-turnstile-response": string;
    identifier: string;
    password: string;
}

export interface RegisterPayload {
    username: string;
    email: string;
    password: string;
    // Optional company fields
    id_perusahaan?: string;
    nama_perusahaan?: string;
}

/**
 * Login response from backend.
 * Direct-login tokens are set via HTTP-only cookies, not returned in the body.
 * MFA flows may still return continuation tokens for the next verification step.
 */
export interface AuthResponse {
    message?: string;
    // MFA tokens — mutually exclusive
    setup_token?: string;
    mfa_token?: string;
    user?: AuthUser;
    // Allow additional properties from backend
    [key: string]: any;
}

export interface AuthUser {
    id: string;
    username: string;
    email: string;
    name?: string;
    id_jabatan?: string;
    role_id?: string;
    role_name?: string;
    role?: string;
    created_at?: string;
    updated_at?: string;
}

/** POST /api/mfa/setup response */
export interface MfaSetupResponse {
    secret: string;
    otpauth_url: string;
}

/** POST /api/mfa/enable response */
export interface MfaEnableResponse {
    message?: string;
    user?: AuthUser;
}

/** POST /api/mfa/verify response */
export interface MfaVerifyResponse {
    message?: string;
    user?: AuthUser;
}
