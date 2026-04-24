import { api } from '@/config/api';
import type { User, CreateUserPayload, UpdateUserPayload } from '@/types/user.types';
import { useNotificationStore } from '@/stores/notifications';

/**
 * Users Service
 * Handles CRUD operations for users
 */
class UsersService {
    /**
     * Get all users
     * @returns Array of users
     */
    async getAll(): Promise<User[]> {
        return api.get<User[]>('/api/users');
    }

    /**
     * Get current authenticated user (cookie auth)
     * @returns Current user object
     */
    async getCurrentUser(): Promise<User> {
        return api.get<User>('/api/me');
    }

    /**
     * Get user by ID
     * @param id User ID
     * @returns User object
     */
    async getById(id: string): Promise<User> {
        return api.get<User>(`/api/users/${id}`);
    }

    /**
     * Create new user
     * @param payload User creation data
     * @returns Created user object
     */
    async create(payload: CreateUserPayload): Promise<User> {
        return api.post<User>('/api/users', payload);
    }

    /**
     * Update existing user
     * @param id User ID
     * @param payload User update data
     * @returns Updated user object
     */
    async update(id: string, payload: UpdateUserPayload | FormData): Promise<User> {
        useNotificationStore().trackSelfAction('user', id);
        return api.put<User>(`/api/users/${id}`, payload);
    }

    /**
     * Delete user
     * @param id User ID
     * @returns Success response
     */
    async delete(id: string): Promise<void> {
        useNotificationStore().trackSelfAction('user', id);
        return api.delete<void>(`/api/users/${id}`);
    }

    /**
     * Update profile photo via dedicated endpoint
     * @param id User ID
     * @param formData FormData containing 'photo' file field
     */
    async updateProfilePhoto(id: string, formData: FormData): Promise<User> {
        return api.post<User>(`/api/users/${id}/profile-photo`, formData);
    }

    /**
     * Update banner image via dedicated endpoint
     * @param id User ID
     * @param formData FormData containing 'banner' file field
     */
    async updateBanner(id: string, formData: FormData): Promise<User> {
        return api.post<User>(`/api/users/${id}/banner`, formData);
    }

    /**
     * Update user password
     * @param id User ID
     * @param payload { old_password, new_password, confirm_new_password }
     */
    async updatePassword(id: string, payload: { old_password: string; new_password: string; confirm_new_password: string }): Promise<void> {
        return api.put<void>(`/api/users/${id}/password`, payload);
    }

    /**
     * Update user status via dedicated endpoint
     * @param id User ID
     * @param payload Status payload object containing the ID
     */
    async updateStatus(id: string, payload: { id: string; [key: string]: any }): Promise<any> {
        return api.patch(`/api/users/${id}/status`, payload);
    }

    /**
     * Update current authenticated user via /api/me
     * @param payload User update data
     * @returns Updated user object
     */
    async updateMe(payload: UpdateUserPayload | FormData): Promise<User> {
        return api.put<User>('/api/me', payload);
    }

    /**
     * Update current user's own password via /api/me/password
     * @param payload { old_password, new_password, confirm_new_password }
     */
    async updateMePassword(payload: { old_password: string; new_password: string; confirm_new_password: string }): Promise<void> {
        return api.put<void>('/api/me/password', payload);
    }

    /**
     * Update current user's profile photo via /api/me/profile-photo
     * @param formData FormData containing 'profile_photo' file field
     */
    async updateMePhoto(formData: FormData): Promise<User> {
        return api.post<User>('/api/me/media', formData);
    }

    /**
     * Update current user's banner via /api/me/banner
     * @param formData FormData containing 'banner' file field
     */
    async updateMeBanner(formData: FormData): Promise<User> {
        return api.post<User>('/api/me/media', formData);
    }
}

export const usersService = new UsersService();
