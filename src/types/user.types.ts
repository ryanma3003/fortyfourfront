export interface User {
    id: string;
    slug: string;
    username: string;
    name: string;
    display_name?: string;
    email: string;
    jabatan: string;
    role: string;
    phone: string;
    location: string;
    joined: string;
    photo?: string;
    banner?: string;
    status?: string;
    // Backend specific fields
    id_jabatan?: string;
    jabatan_name?: string;
    id_perusahaan?: string;
    role_name?: string;
    foto_profile?: string;
}

export interface CreateUserPayload {
    username: string;
    password: string;
    name: string;
    email: string;
    jabatan?: string;
    id_jabatan?: string;
    role: string;
    phone: string;
    location: string;
    photo?: string;
    banner?: string;
    status?: string;
}

export interface UpdateUserPayload {
    username?: string;
    password?: string;
    name?: string;
    display_name?: string;
    email?: string;
    jabatan?: string;
    id_jabatan?: string;
    role?: string;
    phone?: string;
    location?: string;
    photo?: string;
    banner?: string;
    status?: string;
    confirm_password?: string;
    banner_position_x?: number;
    banner_position_y?: number;
    foto_profile_position_x?: number;
    foto_profile_position_y?: number;
    fotoProfileBase64?: string;
    bannerBase64?: string;
}
