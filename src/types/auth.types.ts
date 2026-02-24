export interface LoginPayload {
    email: string;
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
 * Token is sent via HTTP-only cookie (NOT in response body).
 * Body contains message + user info only.
 */
export interface AuthResponse {
    message?: string;
    user?: {
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
    };
    // Allow additional properties from backend
    [key: string]: any;
}
