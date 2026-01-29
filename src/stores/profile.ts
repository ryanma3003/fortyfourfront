// stores/profile.ts
import { defineStore } from 'pinia';
import { useAuthStore } from './auth';
import { usersService } from '@/services/users.service';
import type { UpdateUserPayload } from '@/types/user.types';

export interface ProfileData {
  name: string;
  title: string;
  role: string;
  location: string;
  email: string;
  jabatan: string;
  phone: string;
  website: string;
  joined: string;
  bio: string;
  address: string;
  avatarUrl: string;
  bannerUrl: string;
  // Image position properties (percentage values 0-100)
  bannerPositionX: number;
  bannerPositionY: number;
  avatarPositionX: number;
  avatarPositionY: number;
  // Loading state
  isLoading: boolean;
  stats: {
    projects: string;
    followers: string;
    following: string;
  };
}

export const useProfileStore = defineStore('profile', {
  state: (): ProfileData => ({
    name: '',
    title: 'Senior Product Designer',
    role: '',
    location: 'Jakarta, Indonesia',
    email: '',
    phone: '+62 812-3456-7890',
    jabatan: 'Senior Product Designer',
    website: 'www.yourwebsite.com',
    joined: '',
    bio: 'Passionate about creating delightful user experiences and solving complex design challenges. Love to collaborate with teams to bring ideas to life.',
    address: 'Jl. Sudirman No. 123, Jakarta Pusat',
    avatarUrl: '/images/faces/9.jpg',
    bannerUrl: '/images/media/media-3.jpg',
    // Default positions (centered)
    bannerPositionX: 50,
    bannerPositionY: 50,
    avatarPositionX: 50,
    avatarPositionY: 50,
    isLoading: false,
    stats: {
      projects: '47',
      followers: '2.4K',
      following: '892',
    },
  }),

  getters: {
    // Get display name
    displayName(): string {
      const authStore = useAuthStore();
      return this.name || authStore.currentUser?.name || 'User';
    },
    
    // Get display email
    displayEmail(): string {
      const authStore = useAuthStore();
      return this.email || authStore.currentUser?.email || authStore.currentUser?.username || '';
    },

    // Get display jabatan
    displayJabatan(): string {
      return this.jabatan || 'Belum diatur';
    },
    
    // Get display role - always from auth store (not editable by user)
    displayRole(): string {
      const authStore = useAuthStore();
      return authStore.currentUser?.role || 'User';
    },
    
    // Get display phone
    displayPhone(): string {
      return this.phone || 'Belum diatur';
    },
    
    // Get display location
    displayLocation(): string {
      return this.location || 'Belum diatur';
    },

    // Get formatted join date from auth store
    displayJoined(): string {
      const authStore = useAuthStore();
      return authStore.formattedJoinDate || this.joined || 'Tidak diketahui';
    },
  },

  actions: {
    /**
     * Fetch user profile data from API
     */
    async fetchFromApi() {
      const authStore = useAuthStore();
      if (!authStore.currentUser?.id) {
        console.warn('fetchFromApi: No current user ID');
        return;
      }

      this.isLoading = true;
      try {
        const userData = await usersService.getById(authStore.currentUser.id);
        
        // Map API response to profile state
        this.name = userData.name || '';
        this.email = userData.email || '';
        this.jabatan = userData.jabatan || '';
        this.phone = userData.phone || '';
        this.location = userData.location || '';
        this.joined = userData.joined || '';
        this.avatarUrl = userData.photo || '/images/faces/9.jpg';
        this.bannerUrl = userData.banner || '/images/media/media-3.jpg';
        
        console.log('Profile fetched from API:', userData);
      } catch (error) {
        console.error('Failed to fetch profile from API:', error);
        // Fallback to auth data if API fails
        this.initFromAuth();
      } finally {
        this.isLoading = false;
      }
    },

    /**
     * Save profile data to API
     */
    async saveToApi(data: Partial<ProfileData> | FormData): Promise<{ success: boolean; error?: string }> {
      const authStore = useAuthStore();
      if (!authStore.currentUser?.id) {
        return { success: false, error: 'User not authenticated' };
      }

      this.isLoading = true;
      try {
        let payload: UpdateUserPayload | FormData;

        if (data instanceof FormData) {
            payload = data;
        } else {
            // Map profile data to API payload
            payload = {
            name: data.name || this.name,
            email: data.email || this.email,
            jabatan: data.jabatan || this.jabatan,
            phone: data.phone || this.phone,
            location: data.location || this.location,
            photo: data.avatarUrl || this.avatarUrl,
            banner: data.bannerUrl || this.bannerUrl,
            };
        }

        await usersService.update(authStore.currentUser.id, payload);
        
        // Update local state if it's not FormData (or handle partial updates if needed, but for FormData typically we reload or assume success)
        if (!(data instanceof FormData)) {
             Object.assign(this, data);
        } else {
             // Ideally we should fetch the updated profile here to ensure sync, 
             // but for now we rely on the component to update the preview or reload.
             // We can also try to update local state from FormData entries if needed.
             // For now, let's just re-fetch to be safe and ensure consistency.
             await this.fetchFromApi(); 
        }
        
        console.log('Profile saved to API');
        return { success: true };
      } catch (error: any) {
        console.error('Failed to save profile to API:', error);
        return { success: false, error: error.message || 'Failed to save profile' };
      } finally {
        this.isLoading = false;
      }
    },

    // Initialize profile with auth data
    initFromAuth() {
      const authStore = useAuthStore();
      if (authStore.currentUser) {
        this.name = authStore.currentUser.name || this.name;
        this.email = authStore.currentUser.email || authStore.currentUser.username || this.email;
        this.role = authStore.currentUser.role || this.role;
      }
    },

    // Update profile data locally (for preview before save)
    updateProfile(data: Partial<ProfileData>) {
      Object.assign(this, data);
    },

    // Reset profile to defaults (call when switching users)
    resetToDefaults() {
      this.name = '';
      this.title = 'Senior Product Designer';
      this.role = '';
      this.location = 'Jakarta, Indonesia';
      this.email = '';
      this.phone = '+62 812-3456-7890';
      this.jabatan = 'Senior Product Designer';
      this.website = 'www.yourwebsite.com';
      this.joined = '';
      this.bio = 'Passionate about creating delightful user experiences and solving complex design challenges. Love to collaborate with teams to bring ideas to life.';
      this.address = 'Jl. Sudirman No. 123, Jakarta Pusat';
      this.avatarUrl = '/images/faces/9.jpg';
      this.bannerUrl = '/images/media/media-3.jpg';
      this.bannerPositionX = 50;
      this.bannerPositionY = 50;
      this.avatarPositionX = 50;
      this.avatarPositionY = 50;
      this.isLoading = false;
      this.stats = {
        projects: '47',
        followers: '2.4K',
        following: '892',
      };
    },

    // Reinitialize profile for new user (call after login)
    async switchUser() {
      // Reset to defaults first
      this.resetToDefaults();
      // Fetch user data from API
      await this.fetchFromApi();
    },

    // Update avatar
    updateAvatar(url: string) {
      this.avatarUrl = url;
    },

    // Reset avatar to default
    resetAvatar() {
      this.avatarUrl = '/images/faces/9.jpg';
    },

    // Update banner
    updateBanner(url: string) {
      this.bannerUrl = url;
    },

    // Reset banner to default
    resetBanner() {
      this.bannerUrl = '/images/media/media-3.jpg';
    },
  },
});

// Re-export User type for backward compatibility
export type { User } from '@/types/user.types';
