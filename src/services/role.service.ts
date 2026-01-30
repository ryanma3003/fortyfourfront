import { api } from '@/config/api';

/**
 * Role interface matching API response
 */
export interface Role {
    id: number;
    name: string;
    description?: string;
    created_at?: string;
    updated_at?: string;
}

/**
 * Payload for creating a new role
 */
export interface CreateRolePayload {
    name: string;
    description?: string;
}

/**
 * Payload for updating an existing role
 */
export interface UpdateRolePayload {
    name?: string;
    description?: string;
}

/**
 * Payload for assigning a role to a user
 */
export interface AssignRolePayload {
    role_id: number;
}

/**
 * Role Service
 * Handles CRUD operations for roles via /api/role endpoints
 */
class RoleService {
    /**
     * Get all roles
     * GET /api/role
     * @returns Array of roles
     */
    async getAll(): Promise<Role[]> {
        return api.get<Role[]>('/api/role');
    }

    /**
     * Get role by ID
     * GET /api/role/{id}
     * @param id Role ID
     * @returns Role object
     */
    async getById(id: number): Promise<Role> {
        return api.get<Role>(`/api/role/${id}`);
    }

    /**
     * Create new role
     * POST /api/role
     * @param payload Role creation data
     * @returns Created role object
     */
    async create(payload: CreateRolePayload): Promise<Role> {
        return api.post<Role>('/api/role', payload);
    }

    /**
     * Update existing role
     * PUT /api/role/{id}
     * @param id Role ID
     * @param payload Role update data
     * @returns Updated role object
     */
    async update(id: number, payload: UpdateRolePayload): Promise<Role> {
        return api.put<Role>(`/api/role/${id}`, payload);
    }

    /**
     * Delete role
     * DELETE /api/role/{id}
     * @param id Role ID
     * @returns Success response
     */
    async delete(id: number): Promise<void> {
        return api.delete<void>(`/api/role/${id}`);
    }

    /**
     * Assign role to a user
     * Uses /api/users/{id} endpoint to update user's role
     * @param userId User ID
     * @param roleId Role ID to assign
     * @returns Updated user
     */
    async assignToUser(userId: string, roleId: number): Promise<any> {
        return api.put(`/api/users/${userId}`, { role_id: roleId });
    }
}

export const roleService = new RoleService();
