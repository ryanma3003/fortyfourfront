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
  display_name?: string;
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
 * in sessionStorage so it is cleared when the tab is closed.
 * We use cross-tab communication (BroadcastChannel) to sync this to new tabs.
 * The HTTP-only cookie is the real auth proof on every API request.
 */
const AUTH_USER_KEY = "auth_user";

// Ensure cross-tab communication for sessionStorage without using localStorage
if (typeof window !== 'undefined') {
  const syncChannel = new BroadcastChannel('auth_sync_channel');
  syncChannel.onmessage = (event) => {
    // If a new tab is asking for the current session state
    if (event.data?.type === 'REQUEST_SESSION') {
      const sessionData = sessionStorage.getItem(AUTH_USER_KEY);
      if (sessionData) {
        // Send the data back via the channel
        syncChannel.postMessage({
          type: 'PROVIDE_SESSION',
          sessionData
        });
      }
    }
  };
}

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
    display_name: u.display_name || '',
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
    /** True for both 'admin' and 'staff' — they share the admin dashboard */
    isAdmin(): boolean {
      return this.currentUser?.role === "admin" || this.currentUser?.role === "staff";
    },
    /** True ONLY for role === 'admin' — full privileges (delete, user list, role management) */
    isFullAdmin(): boolean {
      return this.currentUser?.role === "admin";
    },
    /** True ONLY for role === 'staff' */
    isStaff(): boolean {
      return this.currentUser?.role === "staff";
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
        sessionStorage.setItem(AUTH_USER_KEY, JSON.stringify(userData));
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
      sessionStorage.setItem(AUTH_USER_KEY, JSON.stringify(this.currentUser));
      setSessionActiveCookie();
      this.clearMfaState();
    },

    // ================================
    // MFA VERIFY COMPLETE — after successful /api/mfa/verify
    // ================================
    completeMfaVerify(response: any) {
      this.authenticated = true;
      this.currentUser = mapToCurrentUser(response);
      sessionStorage.setItem(AUTH_USER_KEY, JSON.stringify(this.currentUser));
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

      sessionStorage.removeItem(AUTH_USER_KEY);
      clearSessionActiveCookie();
      this.authenticated = false;
      this.currentUser = null;
      this.error = null;
      this.clearMfaState();
    },

    // ================================
    // CHECK AUTH ON STARTUP / NEW TAB
    // Reads CurrentUser from sessionStorage first, then tries to cross-tab sync 
    // if empty (i.e. a newly opened tab). 
    // This allows sessions to be closed when a tab is closed, but seamlessly
    // authenticated when opening a new tab from an existing session.
    // The HTTP-only cookie is the real auth proof — it's sent automatically
    // by the browser on every request.
    // ================================
    checkAuthOnStartup(): Promise<void> | void {
      // 1. Check if we already have it in sessionStorage (e.g., page refresh)
      const stored = sessionStorage.getItem(AUTH_USER_KEY);
      
      if (stored && getSessionActiveCookie()) {
        try {
          this.currentUser = JSON.parse(stored);
          this.authenticated = true;
          return;
        } catch {
          sessionStorage.removeItem(AUTH_USER_KEY);
          clearSessionActiveCookie();
          this.authenticated = false;
          this.currentUser = null;
        }
      } 
      
      // 2. If new tab (sessionStorage missing) but cookie exists, ask other tabs
      else if (!stored && getSessionActiveCookie()) {
        return new Promise((resolve) => {
          const authChannel = new BroadcastChannel('auth_sync_channel');

          const timeout = setTimeout(() => {
            authChannel.close();
            if (!this.authenticated) {
              clearSessionActiveCookie();
              this.authenticated = false;
              this.currentUser = null;
            }
            resolve();
          }, 1000); // Stop listening after 1s if no other tabs respond

          authChannel.onmessage = (event) => {
            if (event.data?.type === 'PROVIDE_SESSION' && event.data.sessionData) {
              try {
                const userData = JSON.parse(event.data.sessionData);
                sessionStorage.setItem(AUTH_USER_KEY, event.data.sessionData);
                this.currentUser = userData;
                this.authenticated = true;
                
                clearTimeout(timeout);
                authChannel.close();
                resolve();
              } catch {
                // Ignore parse errors from other tabs
              }
            }
          };

          // Emit request for session data
          authChannel.postMessage({ type: 'REQUEST_SESSION' });
        });
      } 
      
      // 3. Complete logout state (no session, no cookie)
      else {
        sessionStorage.removeItem(AUTH_USER_KEY);
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

        sessionStorage.removeItem(AUTH_USER_KEY);
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
       
