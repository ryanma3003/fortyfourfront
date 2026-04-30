// stores/users.ts
import { defineStore } from 'pinia';
import { usersService } from '@/services/users.service';
import { stakeholdersService } from '@/services/stakeholders.service';
import type { User, CreateUserPayload, UpdateUserPayload } from '@/types/user.types';

let initializePromise: Promise<void> | null = null;
const USERS_CACHE_KEY = 'vyzor:users:list:v1';
const CACHE_TTL_MS = 5 * 60 * 1000;

function readUsersCache(): User[] | null {
  try {
    const raw = sessionStorage.getItem(USERS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.savedAt || Date.now() - parsed.savedAt > CACHE_TTL_MS) return null;
    return Array.isArray(parsed.data) ? parsed.data : null;
  } catch {
    return null;
  }
}

function writeUsersCache(data: User[]) {
  try {
    sessionStorage.setItem(USERS_CACHE_KEY, JSON.stringify({ savedAt: Date.now(), data }));
  } catch {
    // Ignore storage quota/private-mode failures.
  }
}

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
      if (initializePromise) return initializePromise;

      const cached = readUsersCache();
      if (cached) {
        this.users = cached;
        this.initialized = true;
        this.error = null;
        return;
      }

      this.loading = true;
      this.error = null;

      initializePromise = (async () => {
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
        writeUsersCache(this.users);
        this.initialized = true;
      })();

      try {
        await initializePromise;
        this.loading = false;
      } catch (error: any) {
        console.error('Failed to load users:', error);
        this.error = error.message || 'Failed to load users';
        this.loading = false;
        this.users = [];
      } finally {
        initializePromise = null;
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
        writeUsersCache(this.users);
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
     * Also deletes associated company (perusahaan) if it exists (cascade delete)
     */
    async deleteUserById(id: string) {
      this.loading = true;
      this.error = null;

      try {
        // Find the user to get their associated company
        const userToDelete = this.users.find(u => u.id === id);
        const userIdPerusahaan = userToDelete?.id_perusahaan;

        // Delete user
        await usersService.delete(id);

        // If user has an associated company, delete it as well (cascade delete)
        if (userIdPerusahaan) {
          try {
            await stakeholdersService.delete(userIdPerusahaan);
            console.log(`Company (${userIdPerusahaan}) deleted along with user (${id})`);
          } catch (companyError) {
            console.warn('Failed to delete associated company:', companyError);
            // Continue even if company deletion fails
          }
        }

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
