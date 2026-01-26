export interface LoginPayload {
    email: string;
    password: string;
}

export interface RegisterPayload {
    username: string;
    password: string;
}

export interface AuthResponse {
    access_token: string;
    expires_at: string;
    refresh_token: string;
    user: {
        id: string;
        username: string;
        email: string;
        id_jabatan: string;
        role_id: string;
        role_name: string;
        created_at: string;
        updated_at: string;
    };
}
