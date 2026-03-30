// stores/auth.ts
import { defineStore } from "pinia";
import { useProfileStore } from "./profile";
import { authService } from "@/services/auth.service";
import { api } from "@/config/api";
import router from "@/router/index";
import type { LoginPayload, RegisterPayload } from "@/types/auth.types";

interface CurrentUser {
  id: string;
  slug: string;
  username: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  phone?: string;
  location?: string;
  jabatan?: string;
  id_jabatan?: string;
  id_perusahaan?: string;
  foto_profile?: string;
  banner?: string;
}

function setSessionActiveCookie() {
  document.cookie = 'session_active=1; path=/; SameSite=Lax';
}

function getSessionActiveCookie() {
  return document.cookie.split('; ').some(row => row.startsWith('session_active='));
}

function clearSessionActiveCookie() {
  document.cookie = 'session_active=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax';
}

/**
 * Store the mapped CurrentUser object (display data only — no tokens)
 * in localStorage so it can be shared across tabs.
 * We use a session cookie (session_active=1) to detect if the browser was closed.
 * The HTTP-only cookie is the real auth proof on every API request.
 */
const AUTH_USER_KEY = "auth_user";

/**
 * Helper: map a backend user response to CurrentUser.
 * Handles both flat `{ id, username, ... }` and nested `{ user: { ... } }` shapes.
 */
function mapToCurrentUser(data: any): CurrentUser {
  const u = data?.user ?? data;

  const formatImageUrl = (path: string | undefined | null) => {
    if (!path) return '';
    if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:') || path.startsWith('/images/')) {
        return path;
    }
    const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
    const cleanBaseUrl = baseUrl ? baseUrl.replace(/\/$/, '') : '';
    const cleanPath = path.replace(/^\//, '');
    return cleanBaseUrl ? `${cleanBaseUrl}/${cleanPath}` : `/${cleanPath}`;
  };

  return {
    id: u.id,
    slug: u.slug || "",
    username: u.username,
    name: u.name || u.username,
    email: u.email,
    role: u.role || u.role_name || "user",
    createdAt: u.created_at || u.createdAt || "",
    phone: u.phone || u.telepon || "",
    location: u.location || u.alamat || "",
    jabatan: u.jabatan || u.jabatan_name || "",
    id_jabatan: u.id_jabatan || "",
    id_perusahaan: u.id_perusahaan || u.perusahaan_id || u.perusahaan?.id || "",
    foto_profile: formatImageUrl(u.photo || u.foto_profile),
    banner: formatImageUrl(u.banner),
  };
}

export const useAuthStore = defineStore("auth", {
  state: () => ({
    authenticated: false,
    loading: false,
    currentUser: null as CurrentUser | null,
    error: null as string | null,

    // MFA temporary state — in-memory only, never persisted
    setupToken: null as string | null,
    mfaToken: null as string | null,
  }),

  getters: {
    isAdmin(): boolean {
      return this.currentUser?.role === "admin";
    },
    userRole(): string {
      return this.currentUser?.role || "";
    },
    userName(): string {
      return this.currentUser?.name || "";
    },
    userEmail(): string {
      return this.currentUser?.email || "";
    },
    formattedJoinDate(): string {
      if (!this.currentUser?.createdAt) return "";
      try {
        const date = new Date(this.currentUser.createdAt);
        return date.toLocaleDateString("id-ID", {
          day: "numeric",
          month: "long",
          year: "numeric",
        });
      } catch {
        return this.currentUser.createdAt;
      }
    },
    /** True when login returned setup_token (first-time MFA setup) */
    isMfaSetupRequired(): boolean {
      return !!this.setupToken;
    },
    /** True when login returned mfa_token (returning user verify) */
    isMfaVerifyRequired(): boolean {
      return !!this.mfaToken;
    },
  },

  actions: {
    // ================================
    // LOGIN — returns MFA state or authenticated
    // ================================
    async authenticateUser(payload: LoginPayload) {
      this.loading = true;
      this.error = null;
      this.clearMfaState();

      try {
        const response = await authService.login(payload);

        // Case 1: MFA first-time setup required
        if (response.setup_token) {
          this.setupToken = response.setup_token;
          return { authenticated: false, mfaSetup: true };
        }

        // Case 2: MFA verification required (returning user)
        if (response.mfa_token) {
          this.mfaToken = response.mfa_token;
          return { authenticated: false, mfaVerify: true };
        }

        // Case 3: Direct login (access_token or cookie-based)
        const userData = mapToCurrentUser(response);
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(userData));
        setSessionActiveCookie();
        this.authenticated = true;
        this.currentUser = userData;

        // Load profile data
        const profileStore = useProfileStore();
        await profileStore.switchUser();

        return { authenticated: true };
      } catch (error: any) {
        this.error = error.message || "Login failed";
        this.clearMfaState();
        this.authenticated = false;
        this.currentUser = null;
        return { authenticated: false, error: this.error };
      } finally {
        this.loading = false;
      }
    },

    // ================================
    // MFA SETUP COMPLETE — after successful /api/mfa/enable
    // ================================
    completeMfaSetup(response: any) {
      this.authenticated = true;
      this.currentUser = mapToCurrentUser(response);
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(this.currentUser));
      setSessionActiveCookie();
      this.clearMfaState();
    },

    // ================================
    // MFA VERIFY COMPLETE — after successful /api/mfa/verify
    // ================================
    completeMfaVerify(response: any) {
      this.authenticated = true;
      this.currentUser = mapToCurrentUser(response);
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(this.currentUser));
      setSessionActiveCookie();
      this.clearMfaState();
    },

    // ================================
    // CLEAR MFA STATE — wipe temporary tokens
    // ================================
    clearMfaState() {
      this.setupToken = null;
      this.mfaToken = null;
    },

    // ================================
    // REGISTER
    // ================================
    async registerUser(payload: RegisterPayload) {
      this.loading = true;
      this.error = null;
      try {
        await authService.register(payload);
        return { success: true };
      } catch (error: any) {
        this.error = error.message || "Registration failed";
        return { success: false, error: this.error };
      } finally {
        this.loading = false;
      }
    },

    // ================================
    // LOGOUT — backend clears cookie
    // ================================
    async logUserOut() {
      const profileStore = useProfileStore();
      profileStore.resetToDefaults();

      // Disconnect SSE notifications
      try {
        const { useNotificationStore } = await import('./notifications');
        const notifStore = useNotificationStore();
        notifStore.disconnect();
      } catch { /* ignore if store not loaded */ }

      await authService.logout();

      localStorage.removeItem(AUTH_USER_KEY);
      clearSessionActiveCookie();
      this.authenticated = false;
      this.currentUser = null;
      this.error = null;
      this.clearMfaState();
    },

    // ================================
    // CHECK AUTH ON STARTUP / NEW TAB
    // Reads CurrentUser from localStorage and checks session_active cookie.
    // This allows sessions to be shared across tabs but deleted on browser close.
    // The HTTP-only cookie is the real auth proof — it's sent automatically
    // The HTTP-only cookie is the real auth proof — it's sent automatically
    // by the browser on every request. If expired, the first API call
    // triggers the refresh flow (api.ts) or forces logout.
    // ================================
    checkAuthOnStartup() {
      const stored = localStorage.getItem(AUTH_USER_KEY);
      if (!stored || !getSessionActiveCookie()) {
        localStorage.removeItem(AUTH_USER_KEY);
        clearSessionActiveCookie();
        this.authenticated = false;
        this.currentUser = null;
        return;
      }
      try {
        this.currentUser = JSON.parse(stored);
        this.authenticated = true;
      } catch {
        localStorage.removeItem(AUTH_USER_KEY);
        clearSessionActiveCookie();
        this.authenticated = false;
        this.currentUser = null;
      }
    },

    // ================================
    // SETUP API HOOKS
    // Register the onUnauthorized callback on the api client.
    // When the refresh token is expired/invalid (double 401),
    // the api client calls this — we log out and redirect to login.
    // Call this once after Pinia is initialized (main.ts).
    // ================================
    setupApiHooks() {
      api.onUnauthorized = async () => {
        const profileStore = useProfileStore();
        profileStore.resetToDefaults();

        // Best-effort backend logout (cookie cleanup)
        try { await authService.logout(); } catch { /* ignore */ }

        localStorage.removeItem(AUTH_USER_KEY);
        clearSessionActiveCookie();
        this.authenticated = false;
        this.currentUser = null;
        this.error = null;
        this.clearMfaState();

        // Redirect to login
        router.push('/');
      };
    },
  },
});
       
