// stores/auth.ts
import { defineStore } from 'pinia';
import { useProfileStore } from './profile';
import { authService } from '@/services/auth.service';
import type { LoginPayload, RegisterPayload } from '@/types/auth.types';

interface CurrentUser {
  id: string;
  username: string;
  name: string;
  email: string;
  role: string;
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    authenticated: false,
    loading: false,
    currentUser: null as CurrentUser | null,
    error: null as string | null,
  }),

  getters: {
    isAdmin(): boolean {
      return this.currentUser?.role === 'admin';
    },
    userRole(): string {
      return this.currentUser?.role || '';
    },
    userName(): string {
      return this.currentUser?.name || '';
    },
    userEmail(): string {
      return this.currentUser?.email || '';
    },
  },

  actions: {
    /**
     * Authenticate user with backend API
     */
    async authenticateUser(payload: LoginPayload) {
      this.loading = true;
      this.error = null;

      try {
        const response = await authService.login(payload);

        // Store token
        const token = response.access_token;
        localStorage.setItem('auth_token', token);

        // Set token for future API requests
        authService.setAuthToken(token);

        // Store user data
        const userData: CurrentUser = {
          id: response.user.id,
          username: response.user.username,
          name: response.user.username, // Using username as name
          email: response.user.email,
          role: response.user.role_name || 'user',
        };

        // Standardize key to 'currentUser' as expected by router and other stores
        localStorage.setItem('currentUser', JSON.stringify(userData));

        this.authenticated = true;
        this.currentUser = userData;
        this.loading = false;

        // Switch profile to new user (loads user-specific profile data)
        const profileStore = useProfileStore();
        try {
          profileStore.switchUser();
        } catch (e) {
          console.error('switchUser failed:', e);
        }

        console.log('authenticateUser success, returning true');
        return { authenticated: true };
      } catch (error: any) {
        console.error('Login failed:', error);

        this.error = error.message || 'Login failed';
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
        this.authenticated = false;
        this.currentUser = null;
        this.loading = false;

        return { authenticated: false, error: this.error };
      }
    },

    /**
     * Register new user with backend API
     */
    async registerUser(payload: RegisterPayload) {
      this.loading = true;
      this.error = null;

      try {
        await authService.register(payload);

        this.loading = false;

        // Registration successful, but don't auto-login
        // User should login with their credentials
        return { success: true };
      } catch (error: any) {
        console.error('Registration failed:', error);

        this.error = error.message || 'Registration failed';
        this.loading = false;

        return { success: false, error: this.error };
      }
    },

    /**
     * Logout user
     */
    logUserOut() {
      // Reset profile before clearing user data
      const profileStore = useProfileStore();
      profileStore.resetToDefaults();

      // Clear auth data
      authService.logout();

      this.authenticated = false;
      this.currentUser = null;
      this.error = null;
    },

    /**
     * Check authentication status on app startup
     */
    checkAuthOnStartup() {
      const token = localStorage.getItem('auth_token');
      const storedUser = localStorage.getItem('currentUser');

      if (token && storedUser) {
        try {
          this.authenticated = true;
          this.currentUser = JSON.parse(storedUser);

          // Set token for API requests
          authService.setAuthToken(token);
        } catch (error) {
          console.error('Failed to restore auth state:', error);
          this.logUserOut();
        }
      } else {
        this.authenticated = false;
        this.currentUser = null;
      }
    }
  }
});
