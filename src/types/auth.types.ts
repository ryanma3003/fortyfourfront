export interface LoginPayload {
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
 * Returns one of: setup_token (MFA first-time), mfa_token (MFA verify), or access_token (direct login).
 */
export interface AuthResponse {
    message?: string;
    // MFA tokens — mutually exclusive
    setup_token?: string;
    mfa_token?: string;
    access_token?: string;
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
    access_token: string;
    user: AuthUser;
}

/** POST /api/mfa/verify response */
export interface MfaVerifyResponse {
    message?: string;
    access_token: string;
    user: AuthUser;
}
