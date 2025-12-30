// stores/profile.ts
import { defineStore } from 'pinia';
import { useAuthStore } from './auth';

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
  // Flag to track if profile has been customized
  isCustomized: boolean;
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
    joined: 'Januari 2022',
    bio: 'Passionate about creating delightful user experiences and solving complex design challenges. Love to collaborate with teams to bring ideas to life.',
    address: 'Jl. Sudirman No. 123, Jakarta Pusat',
    avatarUrl: '/images/faces/9.jpg',
    bannerUrl: '/images/media/media-3.jpg',
    isCustomized: false,
    stats: {
      projects: '47',
      followers: '2.4K',
      following: '892',
    },
  }),

  getters: {
    // Get display name - prioritize profile store if customized
    displayName(): string {
      const authStore = useAuthStore();
      // If profile has been customized and has a name, use it
      if (this.isCustomized && this.name) {
        return this.name;
      }
      return authStore.currentUser?.name || this.name || 'Alexandra Chen';
    },
    
    // Get display email - prioritize profile store if customized
    displayEmail(): string {
      const authStore = useAuthStore();
      if (this.isCustomized && this.email) {
        return this.email;
      }
      return authStore.currentUser?.username || this.email || 'alexandra.chen@email.com';
    },

    // Get display jabatan - prioritize profile store if customized
    displayJabatan(): string {
      const authStore = useAuthStore();
      // If profile has been customized, always use profile jabatan
      if (this.isCustomized) {
        return this.jabatan;
      }
      return authStore.currentUser?.jabatan || this.jabatan || 'Senior Product Designer';
    },
    
    // Get display role - always from auth store (not editable by user)
    displayRole(): string {
      const authStore = useAuthStore();
      // Role comes from auth system, not user-editable
      return authStore.currentUser?.role || 'User';
    },
    
    // Get display phone - prioritize profile store if customized
    displayPhone(): string {
      const authStore = useAuthStore();
      if (this.isCustomized && this.phone) {
        return this.phone;
      }
      return authStore.currentUser?.phone || this.phone;
    },
    
    // Get display location - prioritize profile store if customized
    displayLocation(): string {
      const authStore = useAuthStore();
      if (this.isCustomized && this.location) {
        return this.location;
      }
      return authStore.currentUser?.location || this.location;
    },
  },

  actions: {
    // Initialize profile with auth data (only if not customized)
    initFromAuth() {
      // If profile has been customized, don't overwrite with auth data
      if (this.isCustomized) {
        return;
      }
      
      const authStore = useAuthStore();
      if (authStore.currentUser) {
        this.name = authStore.currentUser.name || this.name;
        this.email = authStore.currentUser.username || this.email;
        this.jabatan = authStore.currentUser.jabatan || this.jabatan;
        this.role = authStore.currentUser.role || this.role;
      }
    },

    // Update profile data
    updateProfile(data: Partial<ProfileData>) {
      console.log('updateProfile called with:', data);
      Object.assign(this, data);
      // Mark profile as customized
      this.isCustomized = true;
      console.log('After update - jabatan:', this.jabatan, 'isCustomized:', this.isCustomized);
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
      console.log('loadFromStorage - raw:', stored);
      if (stored) {
        const data = JSON.parse(stored);
        console.log('loadFromStorage - parsed jabatan:', data.jabatan, 'isCustomized:', data.isCustomized);
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
