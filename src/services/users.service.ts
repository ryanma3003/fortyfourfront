import { api } from '@/config/api';
import type { User, CreateUserPayload, UpdateUserPayload } from '@/types/user.types';

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
        return api.put<User>(`/api/users/${id}`, payload);
    }

    /**
     * Delete user
     * @param id User ID
     * @returns Success response
     */
    async delete(id: string): Promise<void> {
        return api.delete<void>(`/api/users/${id}`);
    }
}

export const usersService = new UsersService();
