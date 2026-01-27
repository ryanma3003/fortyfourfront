// stores/auth.ts
import { defineStore } from 'pinia';
import { useProfileStore } from './profile';
import { authService } from '@/services/auth.service';
import { TokenStorage } from '@/config/api';
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

        // Store token in memory (not localStorage, so it's not visible in DevTools)
        const token = response.access_token;
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
        TokenStorage.clearToken();
        localStorage.removeItem('currentUser');
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
     * Token is now stored in encrypted sessionStorage, so it persists across reloads
     */
    checkAuthOnStartup() {
      const hasToken = TokenStorage.hasToken();
      const storedUser = localStorage.getItem('currentUser');

      if (hasToken && storedUser) {
        try {
          this.authenticated = true;
          this.currentUser = JSON.parse(storedUser);

          // Restore token to API client
          const token = TokenStorage.getToken();
          if (token) {
            authService.setAuthToken(token);
          }
        } catch (error) {
          console.error('Failed to restore auth state:', error);
          this.logUserOut();
        }
      } else {
        // No valid session - clear any stale data
        if (storedUser && !hasToken) {
          localStorage.removeItem('currentUser');
        }
        this.authenticated = false;
        this.currentUser = null;
      }
    }
  }
});
