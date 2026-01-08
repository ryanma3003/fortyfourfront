// stores/users.ts
import { defineStore } from 'pinia';
import usersData from '../utils/users.json';

export interface User {
  id: number;
  slug: string;
  username: string;
  password: string;
  name: string;
  jabatan: string;
  role: string;
  phone: string;
  location: string;
  joined: string;
  token: string;
  photo?: string;
  banner?: string;
}

const STORAGE_KEY = 'app_users_data';

export const useUsersStore = defineStore('users', {
  state: () => ({
    users: [] as User[],
    initialized: false,
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
    getUserById(): (id: number) => User | undefined {
      return (id: number) => this.users.find(u => u.id === id);
    },
  },

  actions: {
    // Initialize users from JSON or localStorage
    initialize() {
      if (this.initialized) return;

      // Get default data from JSON file
      const defaultUsers = usersData.map((u: User) => ({ ...u }));

      // Try to load from localStorage
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        try {
          const storedUsers = JSON.parse(stored) as User[];
          
          // Merge stored data with defaults to ensure all fields exist
          this.users = defaultUsers.map(defaultUser => {
            const storedUser = storedUsers.find(su => su.id === defaultUser.id);
            if (storedUser) {
              // Merge: stored data takes priority, but fall back to defaults for missing fields
              return {
                ...defaultUser,   // Default values (includes photo, banner from users.json)
                ...storedUser,    // Stored values override defaults
                // Ensure photo and banner have fallbacks if stored values are empty
                photo: storedUser.photo || defaultUser.photo,
                banner: storedUser.banner || defaultUser.banner,
              };
            }
            return defaultUser;
          });
          
          // Add any new users from stored that aren't in defaults
          storedUsers.forEach(su => {
            if (!this.users.find(u => u.id === su.id)) {
              this.users.push(su);
            }
          });
          
          this.initialized = true;
          this.saveToStorage(); // Save merged data
          return;
        } catch (e) {
          console.error('Failed to parse stored users:', e);
        }
      }

      // Load from JSON file (first time)
      this.users = defaultUsers;
      this.initialized = true;
      this.saveToStorage();
    },

    // Save users to localStorage
    saveToStorage() {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.users));
    },

    // Update a user by slug
    updateUserBySlug(slug: string, updates: Partial<User>) {
      const index = this.users.findIndex(u => u.slug === slug);
      if (index !== -1) {
        this.users[index] = { ...this.users[index], ...updates };
        this.saveToStorage();
        return true;
      }
      return false;
    },

    // Update a user by id
    updateUserById(id: number, updates: Partial<User>) {
      const index = this.users.findIndex(u => u.id === id);
      if (index !== -1) {
        this.users[index] = { ...this.users[index], ...updates };
        this.saveToStorage();
        return true;
      }
      return false;
    },

    // Delete a user by id
    deleteUserById(id: number) {
      const index = this.users.findIndex(u => u.id === id);
      if (index !== -1) {
        this.users.splice(index, 1);
        this.saveToStorage();
        return true;
      }
      return false;
    },

    // Reset to original data from JSON
    resetToDefault() {
      this.users = usersData.map((u: User) => ({ ...u }));
      this.saveToStorage();
    },
  },
});
