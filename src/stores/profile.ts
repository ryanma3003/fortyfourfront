// stores/profile.ts
import { defineStore } from 'pinia';
import { useAuthStore } from './auth';

export interface ProfileData {
  name: string;
  title: string;
  location: string;
  email: string;
  phone: string;
  website: string;
  joined: string;
  bio: string;
  address: string;
  avatarUrl: string;
  bannerUrl: string;
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
    location: 'Jakarta, Indonesia',
    email: '',
    phone: '+62 812-3456-7890',
    website: 'www.yourwebsite.com',
    joined: 'Januari 2022',
    bio: 'Passionate about creating delightful user experiences and solving complex design challenges. Love to collaborate with teams to bring ideas to life.',
    address: 'Jl. Sudirman No. 123, Jakarta Pusat',
    avatarUrl: '/images/faces/9.jpg',
    bannerUrl: '/images/media/media-3.jpg',
    stats: {
      projects: '47',
      followers: '2.4K',
      following: '892',
    },
  }),

  getters: {
    // Get display name from auth store or profile
    displayName(): string {
      const authStore = useAuthStore();
      return authStore.currentUser?.name || this.name || 'Alexandra Chen';
    },
    
    // Get display email from auth store or profile
    displayEmail(): string {
      const authStore = useAuthStore();
      return authStore.currentUser?.username || this.email || 'alexandra.chen@email.com';
    },
    
    // Get display role from auth store or profile
    displayRole(): string {
      const authStore = useAuthStore();
      return authStore.currentUser?.role || this.title;
    },
    
    // Get display phone from auth store or profile
    displayPhone(): string {
      const authStore = useAuthStore();
      return authStore.currentUser?.phone || this.phone;
    },
    
    // Get display location from auth store or profile
    displayLocation(): string {
      const authStore = useAuthStore();
      return authStore.currentUser?.location || this.location;
    },
  },

  actions: {
    // Initialize profile with auth data
    initFromAuth() {
      const authStore = useAuthStore();
      if (authStore.currentUser) {
        this.name = authStore.currentUser.name || this.name;
        this.email = authStore.currentUser.username || this.email;
        this.title = authStore.currentUser.role || this.title;
      }
    },

    // Update profile data
    updateProfile(data: Partial<ProfileData>) {
      Object.assign(this, data);
      // Save to localStorage for persistence
      this.saveToStorage();
    },

    // Save profile to localStorage
    saveToStorage() {
      localStorage.setItem('userProfile', JSON.stringify(this.$state));
    },

    // Load profile from localStorage
    loadFromStorage() {
      const stored = localStorage.getItem('userProfile');
      if (stored) {
        const data = JSON.parse(stored);
        Object.assign(this, data);
      }
    },

    // Update avatar
    updateAvatar(url: string) {
      this.avatarUrl = url;
      this.saveToStorage();
    },

    // Reset avatar to default
    resetAvatar() {
      this.avatarUrl = '/images/faces/9.jpg';
      this.saveToStorage();
    },

    // Update banner
    updateBanner(url: string) {
      this.bannerUrl = url;
      this.saveToStorage();
    },

    // Reset banner to default
    resetBanner() {
      this.bannerUrl = '/images/media/media-3.jpg';
      this.saveToStorage();
    },
  },
});
