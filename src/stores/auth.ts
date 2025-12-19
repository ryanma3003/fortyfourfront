// stores/auth.ts
import { defineStore } from 'pinia';
import users from '../utils/users.json';

interface LoginPayload {
  username: string;
  password: string;
}

interface User {
  id: number;
  username: string;
  password: string;
  name: string;
  role: string;
  token?: string;
}

interface CurrentUser {
  id: number;
  username: string;
  name: string;
  role: string;
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    authenticated: false,
    loading: false,
    currentUser: null as CurrentUser | null,
  }),

  getters: {
    isAdmin(): boolean {
      return this.currentUser?.role === 'Admin';
    },
    userRole(): string {
      return this.currentUser?.role || '';
    },
    userName(): string {
      return this.currentUser?.name || '';
    },
    userEmail(): string {
      return this.currentUser?.username || '';
    }
  },

  actions: {
    async authenticateUser({ username, password }: LoginPayload) {
      this.loading = true;

      // Simulate API authentication using mock data
      const user = users.find(
        (u: User) => u.username === username && u.password === password
      );

      if (user) {
        const token = this.generateToken(user as User);
        const userData: CurrentUser = {
          id: user.id,
          username: user.username,
          name: user.name,
          role: user.role,
        };
        
        localStorage.setItem('token', token);
        localStorage.setItem('currentUser', JSON.stringify(userData));
        
        this.authenticated = true;
        this.currentUser = userData;
        this.loading = false;
        return { authenticated: true };
      } else {
        localStorage.removeItem('token');
        localStorage.removeItem('currentUser');
        this.authenticated = false;
        this.currentUser = null;
        this.loading = false;
        return { authenticated: false };
      }
    },

    logUserOut() {
      localStorage.removeItem('token');
      localStorage.removeItem('currentUser');
      this.authenticated = false;
      this.currentUser = null;
    },

    generateToken(user: User): string {
      // Simulated token generation
      return `Bearer-${user.id}-${user.username}-${user.role}`;
    },

    checkAuthOnStartup() {
      const token = localStorage.getItem('token');
      const storedUser = localStorage.getItem('currentUser');
      
      if (token && storedUser) {
        this.authenticated = true;
        this.currentUser = JSON.parse(storedUser);
      } else {
        this.authenticated = false;
        this.currentUser = null;
      }
    }
  }
});
