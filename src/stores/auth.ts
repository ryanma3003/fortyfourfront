// stores/auth.ts
import { defineStore } from 'pinia';
import { useProfileStore } from './profile';

interface LoginPayload {
  username: string;
  password: string;
}

interface User {
  id: number;
  slug: string;
  username: string;
  jabatan: string;
  password: string;
  name: string;
  role: string;
  phone?: string;
  location?: string;
  token?: string;
}

interface CurrentUser {
  id: number;
  slug: string;
  username: string;
  jabatan: string;
  name: string;
  role: string;
  phone: string;
  location: string;
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
    },
    userJabatan(): string {
      return this.currentUser?.jabatan || '';
    }
  },

  actions: {
    async authenticateUser({ username, password }: LoginPayload) {
      this.loading = true;

      // Import usersStore dynamically to avoid circular dependency
      const { useUsersStore } = await import('./users');
      const usersStore = useUsersStore();
      
      // Initialize usersStore to load from localStorage (which has updated roles)
      usersStore.initialize();
      
      // Use usersStore for authentication (has updated data from admin changes)
      const user = usersStore.allUsers.find(
        (u) => u.username === username && u.password === password
      );

      if (user) {
        const token = this.generateToken(user as User);
        const userData: CurrentUser = {
          id: user.id,
          slug: user.slug,
          username: user.username,
          name: user.name,
          role: user.role, // This will now reflect admin's role changes
          jabatan: user.jabatan,
          phone: user.phone || '',
          location: user.location || '',
        };
        
        localStorage.setItem('token', token);
        localStorage.setItem('currentUser', JSON.stringify(userData));
        
        this.authenticated = true;
        this.currentUser = userData;
        this.loading = false;
        
        // Switch profile to new user (loads user-specific profile data)
        const profileStore = useProfileStore();
        profileStore.switchUser();
        
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
      // Reset profile before clearing user data
      const profileStore = useProfileStore();
      profileStore.resetToDefaults();
      
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
