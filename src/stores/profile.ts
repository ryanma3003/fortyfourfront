// stores/profile.ts
import { defineStore } from 'pinia';
import { useAuthStore } from './auth';
import { usersService } from '@/services/users.service';
import { jabatanService } from '@/services/jabatan.service';
import { stakeholdersService } from '@/services/stakeholders.service';
import { formatImageUrl } from '@/utils/media';
import type { Jabatan } from '@/types/jabatan.types';
import type { Stakeholder } from '@/types/stakeholders.types';

export interface ProfileData {
  name: string;
  display_name: string;
  title: string;
  role: string;
  location: string;
  email: string;
  jabatan: string;
  idJabatan: string;
  phone: string;
  website: string;
  joined: string;
  bio: string;
  address: string;
  fotoProfileUrl: string;
  bannerUrl: string;
  // Stakeholder / Perusahaan
  idPerusahaan: string;
  namaPerusahaan: string;
  // Sub Sektor
  idSubSektor: string;
  namaSubSektor: string;
  // Image position properties (percentage values 0-100)
  bannerPositionX: number;
  bannerPositionY: number;
  fotoProfilePositionX: number;
  fotoProfilePositionY: number;
  // Loading state
  isLoading: boolean;
  loadedUserId: string;
  lastFetchedAt: number;
  fetchPromise: Promise<void> | null;
  stats: {
    projects: string;
    followers: string;
    following: string;
  };
}

export const useProfileStore = defineStore('profile', {
  state: (): ProfileData => ({
    name: '',
    display_name: '',
    title: '',
    role: '',
    location: '',
    email: '',
    phone: '',
    jabatan: '',
    idJabatan: '',
    website: '',
    joined: '',
    bio: '',
    address: '',
    fotoProfileUrl: '',
    bannerUrl: '',
    idPerusahaan: '',
    namaPerusahaan: '',
    idSubSektor: '',
    namaSubSektor: '',
    bannerPositionX: 50,
    bannerPositionY: 50,
    fotoProfilePositionX: 50,
    fotoProfilePositionY: 50,
    isLoading: false,
    loadedUserId: '',
    lastFetchedAt: 0,
    fetchPromise: null,
    stats: { projects: '47', followers: '2.4K', following: '892' },
  }),

  getters: {
    displayName(): string {
      const authStore = useAuthStore();
      return this.display_name || this.name || authStore.currentUser?.display_name || authStore.currentUser?.name || authStore.currentUser?.username || 'User';
    },
    displayEmail(): string {
      const authStore = useAuthStore();
      return this.email || authStore.currentUser?.email || authStore.currentUser?.username || '';
    },
    displayJabatan(): string { return this.jabatan || 'Belum diatur'; },
    displayRole(): string {
      const authStore = useAuthStore();
      return authStore.currentUser?.role || 'User';
    },
    displayPhone(): string { return this.phone || 'Belum diatur'; },
    displayLocation(): string { return this.location || 'Belum diatur'; },
    displayPerusahaan(): string { return this.namaPerusahaan || 'Belum diatur'; },
    displaySubSektor(): string { return this.namaSubSektor || 'Belum diatur'; },
    displayJoined(): string {
      const authStore = useAuthStore();
      return authStore.formattedJoinDate || this.joined || 'Tidak diketahui';
    },
  },

  actions: {
    /** Map raw API response → normalised field names */
    _mapApiUser(raw: any) {
      const u = raw?.user ?? raw?.data ?? raw;

      return {
        name:           u.name          || u.username       || '',
        display_name:   u.display_name                      || '',
        email:          u.email                             || '',
        jabatan:        u.jabatan       || u.jabatan_name   || '',
        idJabatan:      u.id_jabatan                        || '',
        role:           u.role          || u.role_name      || '',
        phone:          u.phone         || u.telepon        || '',
        location:       u.location      || u.alamat         || '',
        joined:         u.joined        || u.created_at     || '',
        photo:          formatImageUrl(u.photo || u.foto_profile),
        banner:         formatImageUrl(u.banner),
        idPerusahaan:   u.id_perusahaan                     || '',
        bannerPositionX: u.banner_position_x !== null && u.banner_position_x !== undefined ? Number(u.banner_position_x) : 50,
        bannerPositionY: u.banner_position_y !== null && u.banner_position_y !== undefined ? Number(u.banner_position_y) : 50,
        fotoProfilePositionX: u.foto_profile_position_x !== null && u.foto_profile_position_x !== undefined ? Number(u.foto_profile_position_x) : 50,
        fotoProfilePositionY: u.foto_profile_position_y !== null && u.foto_profile_position_y !== undefined ? Number(u.foto_profile_position_y) : 50,
      };
    },



    /* ── API actions ── */

    async fetchFromApi() {
      const authStore = useAuthStore();
      const userId = authStore.currentUser?.id;
      if (!userId) { this.initFromAuth(); return; }

      const cacheFresh = this.loadedUserId === String(userId) && Date.now() - this.lastFetchedAt < 5 * 60 * 1000;
      if (cacheFresh) return;
      if (this.fetchPromise) return this.fetchPromise;

      this.fetchPromise = this._fetchFromApi();
      try {
        await this.fetchPromise;
      } finally {
        this.fetchPromise = null;
      }
    },

    async _fetchFromApi() {
      const authStore = useAuthStore();
      const userId = authStore.currentUser?.id;
      if (!userId) { this.initFromAuth(); return; }

      // Non-admin users (including staff): fetch from /api/me
      if (!authStore.isFullAdmin) {
        this.isLoading = true;
        try {
          const response = await usersService.getCurrentUser();
          const mapped = this._mapApiUser(response);

          this.name       = mapped.name;
          this.display_name = mapped.display_name;
          this.email      = mapped.email;
          this.jabatan    = mapped.jabatan;
          this.idJabatan  = mapped.idJabatan;
          this.joined     = mapped.joined;
          this.fotoProfileUrl  = mapped.photo  || '/images/faces/9.jpg';
          this.bannerUrl  = mapped.banner || '/images/media/media-3.jpg';
          this.idPerusahaan = mapped.idPerusahaan;
          this.bannerPositionX = mapped.bannerPositionX;
          this.bannerPositionY = mapped.bannerPositionY;
          this.fotoProfilePositionX = mapped.fotoProfilePositionX;
          this.fotoProfilePositionY = mapped.fotoProfilePositionY;

          // Extract perusahaan/sub-sektor from /api/me response if available
          const meData = (response as any)?.user ?? (response as any)?.data ?? response;
          if (meData.perusahaan) {
            this.namaPerusahaan = meData.perusahaan.nama_perusahaan || '';
            this.location       = meData.perusahaan.alamat          || this.location;
            this.phone          = meData.perusahaan.telepon         || this.phone;
            this.website        = meData.perusahaan.website         || this.website;
            if (meData.perusahaan.sub_sektor) {
              this.idSubSektor   = meData.perusahaan.sub_sektor.id || '';
              this.namaSubSektor = meData.perusahaan.sub_sektor.nama_sub_sektor || '';
            }
          } else if (this.idPerusahaan) {
            // Fallback: use dropdown endpoint (accessible to all users)
            try {
              const dropdownList = await stakeholdersService.getDropdown();
              const found = dropdownList.find(c => c.id.toString() === this.idPerusahaan.toString());
              if (found) {
                this.namaPerusahaan = found.nama_perusahaan || '';
              }
            } catch {
              console.warn('Failed to fetch company dropdown for user.');
            }
          }

          // Keep auth store in sync
          if (authStore.currentUser) {
            authStore.currentUser.name  = mapped.name  || authStore.currentUser.name;
            authStore.currentUser.email = mapped.email || authStore.currentUser.email;
            authStore.currentUser.id_perusahaan = mapped.idPerusahaan || authStore.currentUser.id_perusahaan;
          }
          this.loadedUserId = String(userId);
          this.lastFetchedAt = Date.now();
        } catch (err: any) {
          console.warn('GET /api/me failed, falling back to auth store:', err);

          // If session is truly expired, force logout. Rate limits should fall back to cached/auth data.
          if (err?.status === 401) {
            import('@/config/api').then(({ api }) => {
              if (api.onUnauthorized) api.onUnauthorized();
            });
            return; // Abort further execution
          }

          this.initFromAuth();
          this.loadedUserId = String(userId);
          this.lastFetchedAt = Date.now();
        } finally {
          this.isLoading = false;
        }
        return;
      }

      this.isLoading = true;
      try {
        // Admin only: fetch full user details from /api/users/{id}
        const response = await usersService.getById(userId);

        const mapped = this._mapApiUser(response);

        this.name       = mapped.name;
        this.display_name = mapped.display_name;
        this.email      = mapped.email;
        this.jabatan    = mapped.jabatan;
        this.idJabatan  = mapped.idJabatan;
        this.joined     = mapped.joined;
        this.fotoProfileUrl  = mapped.photo  || '/images/faces/9.jpg';
        this.bannerUrl  = mapped.banner || '/images/media/media-3.jpg';
        this.idPerusahaan = mapped.idPerusahaan;
        this.bannerPositionX = mapped.bannerPositionX;
        this.bannerPositionY = mapped.bannerPositionY;
        this.fotoProfilePositionX = mapped.fotoProfilePositionX;
        this.fotoProfilePositionY = mapped.fotoProfilePositionY;



        // 2. Fetch stakeholder data (perusahaan) if linked
        //    Requires backend to return id_perusahaan in /api/users/{id} response
        if (this.idPerusahaan) {
          try {
            const company = await stakeholdersService.getById(this.idPerusahaan);

            const c = (company as any)?.data ?? company;
            this.namaPerusahaan = c.nama_perusahaan || '';
            this.location       = c.alamat          || '';
            this.phone          = c.telepon         || '';
            this.website        = c.website         || '';
            // Extract sub-sektor from stakeholder
            if (c.sub_sektor) {
              this.idSubSektor   = c.sub_sektor.id || '';
              this.namaSubSektor = c.sub_sektor.nama_sub_sektor || '';
            }
          } catch (err) {
            console.warn('Failed to fetch stakeholder data:', err);
          }
        }

        if (authStore.currentUser) {
          authStore.currentUser.name  = mapped.name  || authStore.currentUser.name;
          authStore.currentUser.email = mapped.email || authStore.currentUser.email;
          authStore.currentUser.role  = mapped.role  || authStore.currentUser.role;
          authStore.currentUser.id_perusahaan = mapped.idPerusahaan || authStore.currentUser.id_perusahaan;
        }
        this.loadedUserId = String(userId);
        this.lastFetchedAt = Date.now();
      } catch (error: any) {
        console.error('Failed to fetch profile:', error);
        
        // If session is truly expired, force logout. Rate limits should fall back to cached/auth data.
        if (error?.status === 401) {
          import('@/config/api').then(({ api }) => {
            if (api.onUnauthorized) api.onUnauthorized();
          });
        } else {
          this.initFromAuth();
          this.loadedUserId = String(userId);
          this.lastFetchedAt = Date.now();
        }
      } finally {
        this.isLoading = false;
      }
    },

    /**
     * Save profile data to backend.
     * - Admin: PUT /api/users/{id}, POST /api/users/{id}/profile-photo, POST /api/users/{id}/banner
     * - User:  PUT /api/me,        POST /api/me/profile-photo,         POST /api/me/banner
     * - New jabatan → POST /api/jabatan (admin only, falls back to local name)
     * All API calls are attempted for every role; falls back to localStorage on 403.
     */
    async saveToApi(data: Partial<ProfileData> & { newJabatanName?: string }): Promise<{ success: boolean; error?: string }> {
      const authStore = useAuthStore();
      if (!authStore.currentUser?.id) {
        return { success: false, error: 'User not authenticated' };
      }
      const id = authStore.currentUser.id;
      const isAdmin = authStore.isFullAdmin;

      this.isLoading = true;
      try {
        let jabatanId = data.idJabatan ?? this.idJabatan;
        let jabatanName = data.jabatan ?? this.jabatan;

        // ── 1. Handle new jabatan ──
        if (data.newJabatanName && data.newJabatanName.trim()) {
          try {
            const created = await jabatanService.create({ nama_jabatan: data.newJabatanName.trim() });
            const j = (created as any)?.data ?? created;
            jabatanId   = j.id || '';
            jabatanName = j.nama_jabatan || data.newJabatanName.trim();
          } catch {
            // POST /api/jabatan restricted — store as local label only
            jabatanId   = '';
            jabatanName = data.newJabatanName.trim();
          }
        }

        // ── 2. PUT text fields (attempted for all roles) ──
        try {
          const textPayload: Record<string, any> = {
            username:   data.name     ?? this.name,
            display_name: data.display_name ?? this.display_name,
            email:      data.email    ?? this.email,
            phone:      data.phone    ?? this.phone,
            location:   data.location ?? this.location,
            website:    data.website  ?? this.website,
            bio:        data.bio      ?? this.bio,
            address:    data.address  ?? this.address,
            id_jabatan: jabatanId || undefined,
            banner_position_x: data.bannerPositionX ?? this.bannerPositionX,
            banner_position_y: data.bannerPositionY ?? this.bannerPositionY,
            foto_profile_position_x: data.fotoProfilePositionX ?? this.fotoProfilePositionX,
            foto_profile_position_y: data.fotoProfilePositionY ?? this.fotoProfilePositionY,
          };
          // Use /api/me for non-admin, /api/users/{id} for admin
          const updatedUser = isAdmin
            ? await usersService.update(id, textPayload as any)
            : await usersService.updateMe(textPayload as any);

          // ── 3. Apply API response to store ──
          const mapped = this._mapApiUser(updatedUser);
          this.name      = mapped.name      || data.name     || this.name;
          this.display_name = mapped.display_name || data.display_name || this.display_name;
          this.email     = mapped.email     || data.email    || this.email;
          this.jabatan   = mapped.jabatan   || jabatanName   || this.jabatan;
          this.idJabatan = mapped.idJabatan || jabatanId     || this.idJabatan;
          this.phone     = mapped.phone     || data.phone    || this.phone;
          this.location  = mapped.location  || data.location || this.location;
          this.joined    = mapped.joined    || this.joined;
          if (mapped.photo)  this.fotoProfileUrl = mapped.photo;
          if (mapped.banner) this.bannerUrl = mapped.banner;
        } catch (err: any) {
          // API returned 403/404 — apply changes locally instead
          if (data.name     !== undefined) this.name     = data.name;
          if (data.display_name !== undefined) this.display_name = data.display_name;
          if (data.email    !== undefined) this.email    = data.email;
          if (data.phone    !== undefined) this.phone    = data.phone;
          if (data.location !== undefined) this.location = data.location;
          if (data.website  !== undefined) this.website  = data.website;
          if (data.bio      !== undefined) this.bio      = data.bio;
          if (data.address  !== undefined) this.address  = data.address;
          if (jabatanId)   this.idJabatan = jabatanId;
          if (jabatanName) this.jabatan   = jabatanName;
        }

        // ── 4. Profile photo ──
        const newFotoProfile = data.fotoProfileUrl ?? '';
        if (newFotoProfile && newFotoProfile !== this.fotoProfileUrl && newFotoProfile.startsWith('data:')) {
          try {
            const photoForm = new FormData();
            const blob = await (await fetch(newFotoProfile)).blob();
            photoForm.append('profile_photo', blob, 'foto_profile.jpg');

            const pr = isAdmin
              ? await usersService.updateProfilePhoto(id, photoForm)
              : await usersService.updateMePhoto(photoForm);

            this.fotoProfileUrl = this._mapApiUser(pr).photo || newFotoProfile;
          } catch (photoErr) {
            console.error('Photo upload failed:', photoErr);
            this.fotoProfileUrl = newFotoProfile;
          }
        }

        // ── 5. Banner ──
        const newBanner = data.bannerUrl ?? '';
        if (newBanner && newBanner !== this.bannerUrl && newBanner.startsWith('data:')) {
          try {
            const bannerForm = new FormData();
            const blob = await (await fetch(newBanner)).blob();
            bannerForm.append('banner', blob, 'banner.jpg');

            const br = isAdmin
              ? await usersService.updateBanner(id, bannerForm)
              : await usersService.updateMeBanner(bannerForm);

            this.bannerUrl = this._mapApiUser(br).banner || newBanner;
          } catch (bannerErr) {
            console.error('Banner upload failed:', bannerErr);
            this.bannerUrl = newBanner;
          }
        }

        // ── 6. Image positions (local only) ──
        if (data.bannerPositionX !== undefined) this.bannerPositionX = data.bannerPositionX;
        if (data.bannerPositionY !== undefined) this.bannerPositionY = data.bannerPositionY;
        if (data.fotoProfilePositionX !== undefined) this.fotoProfilePositionX = data.fotoProfilePositionX;
        if (data.fotoProfilePositionY !== undefined) this.fotoProfilePositionY = data.fotoProfilePositionY;

        // ── 7. Sync auth store ──
        if (authStore.currentUser) {
          authStore.currentUser.name  = this.name  || authStore.currentUser.name;
          authStore.currentUser.email = this.email || authStore.currentUser.email;
          authStore.currentUser.id_perusahaan = this.idPerusahaan || authStore.currentUser.id_perusahaan;
        }

        // ── 8. Re-fetch from API to confirm full server state ──
        try { await this.fetchFromApi(); } catch { /* keep saved data */ }

        return { success: true };
      } catch (error: any) {
        console.error('Failed to save profile:', error);
        return { success: false, error: error.message || 'Failed to save profile' };
      } finally {
        this.isLoading = false;
      }
    },

    /** Fetches all jabatan from /api/jabatan for dropdown use */
    async fetchJabatanList(): Promise<Jabatan[]> {
      try {
        const raw = await jabatanService.getAll();
        // Handle potential wrapping: { data: [...] } or direct [...]
        const list = (raw as any)?.data ?? raw;
        return Array.isArray(list) ? list : [];
      } catch (err) {
        console.error('Failed to fetch jabatan list:', err);
        return [];
      }
    },

    /** Fetches stakeholder data for the current user's company */
    async fetchStakeholderData(): Promise<Stakeholder | null> {
      if (!this.idPerusahaan) return null;
      try {
        const company = await stakeholdersService.getById(this.idPerusahaan);
        return (company as any)?.data ?? company;
      } catch {
        return null;
      }
    },

    initFromAuth() {
      const authStore = useAuthStore();
      if (authStore.currentUser) {
        this.name  = authStore.currentUser.name || this.name;
        this.display_name = (authStore.currentUser as any).display_name || this.display_name;
        this.email = authStore.currentUser.email || authStore.currentUser.username || this.email;
        this.role  = authStore.currentUser.role || this.role;
        this.phone = authStore.currentUser.phone || this.phone;
        this.location = authStore.currentUser.location || this.location;
        this.jabatan = authStore.currentUser.jabatan || this.jabatan;
        this.idJabatan = authStore.currentUser.id_jabatan || this.idJabatan;
        this.idPerusahaan = authStore.currentUser.id_perusahaan || this.idPerusahaan;
        if (authStore.currentUser.foto_profile) this.fotoProfileUrl = authStore.currentUser.foto_profile;
        if (authStore.currentUser.banner)       this.bannerUrl = authStore.currentUser.banner;
      }
    },

    updateProfile(data: Partial<ProfileData>) {
      Object.assign(this, data);
    },

    resetToDefaults() {

      this.name = ''; this.display_name = ''; this.title = ''; this.role = '';
      this.location = ''; this.email = ''; this.phone = '';
      this.jabatan = ''; this.idJabatan = ''; this.website = '';
      this.joined = ''; this.bio = ''; this.address = '';
      this.idPerusahaan = ''; this.namaPerusahaan = '';
      this.fotoProfileUrl = '/images/faces/9.jpg';
      this.bannerUrl = '/images/media/media-3.jpg';
      this.bannerPositionX = 50; this.bannerPositionY = 50;
      this.fotoProfilePositionX = 50; this.fotoProfilePositionY = 50;
      this.isLoading = false;
      this.loadedUserId = '';
      this.lastFetchedAt = 0;
      this.fetchPromise = null;
      this.stats = { projects: '47', followers: '2.4K', following: '892' };
    },

    async switchUser() {
      const authStore = useAuthStore();
      const userId = String(authStore.currentUser?.id || '');
      if (userId && this.loadedUserId === userId && Date.now() - this.lastFetchedAt < 5 * 60 * 1000) return;
      if (this.fetchPromise) return this.fetchPromise;
      this.resetToDefaults();
      this.initFromAuth();
      await this.fetchFromApi();
    },

    updateFotoProfile(url: string)  { this.fotoProfileUrl = url; },
    resetFotoProfile()              { this.fotoProfileUrl = '/images/faces/9.jpg'; },
    updateBanner(url: string)  { this.bannerUrl = url; },
    resetBanner()              { this.bannerUrl = '/images/media/media-3.jpg'; },
  },
});

// Re-export User type for backward compatibility
export type { User } from '@/types/user.types';
