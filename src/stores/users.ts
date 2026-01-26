// stores/users.ts
import { defineStore } from 'pinia';
import { usersService } from '@/services/users.service';
import type { User, CreateUserPayload, UpdateUserPayload } from '@/types/user.types';

export const useUsersStore = defineStore('users', {
  state: () => ({
    users: [] as User[],
    initialized: false,
    loading: false,
    error: null as string | null,
  }),

  getters: {
    // Get all users
    allUsers(): User[] {
      return this.users;
    },

    // Get user by slug
    getUserBySlug(): (slug: string) => User | undefined {
      return (slug: string) => this.users.find(u => u.slug === slug);
    },

    // Get user by id
    getUserById(): (id: string) => User | undefined {
      return (id: string) => this.users.find(u => u.id === id);
    },
  },

  actions: {
    /**
     * Initialize users from backend API
     */
    async initialize() {
      if (this.initialized) return;

      this.loading = true;
      this.error = null;

      try {
        const rawUsers = await usersService.getAll();
        this.users = (rawUsers as any[]).map(u => ({
          ...u,
          id: u.id?.toString() || '',
          name: u.name || u.username || 'Unknown',
          username: u.username || u.email || 'unknown',
          role: u.role || u.role_name || 'user',
          slug: u.slug || u.username || u.id?.toString() || '',
          jabatan: u.jabatan || u.id_jabatan || '',
          joined: u.joined || u.created_at || ''
        })) as User[];
        this.initialized = true;
        this.loading = false;
      } catch (error: any) {
        console.error('Failed to load users:', error);
        this.error = error.message || 'Failed to load users';
        this.loading = false;
        this.users = [];
      }
    },

    /**
     * Refresh users list from backend
     */
    async refresh() {
      this.loading = true;
      this.error = null;

      try {
        const rawUsers = await usersService.getAll();
        this.users = (rawUsers as any[]).map(u => ({
          ...u,
          id: u.id?.toString() || '',
          name: u.name || u.username || 'Unknown',
          username: u.username || u.email || 'unknown',
          role: u.role || u.role_name || 'user',
          slug: u.slug || u.username || u.id?.toString() || '',
          jabatan: u.jabatan || u.id_jabatan || '',
          joined: u.joined || u.created_at || ''
        })) as User[];
        this.loading = false;
      } catch (error: any) {
        console.error('Failed to refresh users:', error);
        this.error = error.message || 'Failed to refresh users';
        this.loading = false;
      }
    },

    /**
     * Create a new user
     */
    async createUser(payload: CreateUserPayload) {
      this.loading = true;
      this.error = null;

      try {
        const newUser = await usersService.create(payload);
        this.users.push(newUser);
        this.loading = false;
        return { success: true, user: newUser };
      } catch (error: any) {
        console.error('Failed to create user:', error);
        this.error = error.message || 'Failed to create user';
        this.loading = false;
        return { success: false, error: this.error };
      }
    },

    /**
     * Update a user by slug
     */
    async updateUserBySlug(slug: string, updates: UpdateUserPayload) {
      const user = this.getUserBySlug(slug);
      if (!user) {
        return { success: false, error: 'User not found' };
      }

      return this.updateUserById(user.id, updates);
    },

    /**
     * Update a user by id
     */
    async updateUserById(id: string, updates: UpdateUserPayload) {
      this.loading = true;
      this.error = null;

      try {
        const updatedUser = await usersService.update(id, updates);

        const index = this.users.findIndex(u => u.id === id);
        if (index !== -1) {
          this.users[index] = updatedUser;
        }

        this.loading = false;
        return { success: true, user: updatedUser };
      } catch (error: any) {
        console.error('Failed to update user:', error);
        this.error = error.message || 'Failed to update user';
        this.loading = false;
        return { success: false, error: this.error };
      }
    },

    /**
     * Delete a user by id
     */
    async deleteUserById(id: string) {
      this.loading = true;
      this.error = null;

      try {
        await usersService.delete(id);

        const index = this.users.findIndex(u => u.id === id);
        if (index !== -1) {
          this.users.splice(index, 1);
        }

        this.loading = false;
        return { success: true };
      } catch (error: any) {
        console.error('Failed to delete user:', error);
        this.error = error.message || 'Failed to delete user';
        this.loading = false;
        return { success: false, error: this.error };
      }
    },
  },
});
