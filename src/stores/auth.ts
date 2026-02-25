// stores/auth.ts
import { defineStore } from "pinia";
import { useProfileStore } from "./profile";
import { authService } from "@/services/auth.service";
import type { LoginPayload, RegisterPayload } from "@/types/auth.types";

interface CurrentUser {
  id: string;
  username: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
}

// Session storage key for user info (UI display only, no token)
const USER_SESSION_KEY = "auth_user_session";

/**
 * Helper: map a backend user response to CurrentUser.
 * Handles both flat `{ id, username, ... }` and nested `{ user: { ... } }` shapes.
 */
function mapToCurrentUser(data: any): CurrentUser {
  const u = data?.user ?? data;
  return {
    id: u.id,
    username: u.username,
    name: u.name || u.username,
    email: u.email,
    role: u.role || u.role_name || "user",
    createdAt: u.created_at || u.createdAt || "",
  };
}

export const useAuthStore = defineStore("auth", {
  state: () => ({
    authenticated: false,
    loading: false,
    currentUser: null as CurrentUser | null,
    error: null as string | null,

    // MFA temporary state — never persisted to localStorage/sessionStorage
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
        sessionStorage.setItem(USER_SESSION_KEY, JSON.stringify(userData));
        this.authenticated = true;
        this.currentUser = userData;

        // Load profile data
        const profileStore = useProfileStore();
        await profileStore.switchUser();

        return { authenticated: true };
      } catch (error: any) {
        this.error = error.message || "Login failed";
        this.clearMfaState();
        sessionStorage.removeItem(USER_SESSION_KEY);
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
      const userData = mapToCurrentUser(response);
      sessionStorage.setItem(USER_SESSION_KEY, JSON.stringify(userData));
      this.authenticated = true;
      this.currentUser = userData;
      this.clearMfaState();
    },

    // ================================
    // MFA VERIFY COMPLETE — after successful /api/mfa/verify
    // ================================
    completeMfaVerify(response: any) {
      const userData = mapToCurrentUser(response);
      sessionStorage.setItem(USER_SESSION_KEY, JSON.stringify(userData));
      this.authenticated = true;
      this.currentUser = userData;
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

      await authService.logout();

      sessionStorage.removeItem(USER_SESSION_KEY);
      this.authenticated = false;
      this.currentUser = null;
      this.error = null;
      this.clearMfaState();
    },

    // ================================
    // CHECK AUTH ON STARTUP / REFRESH
    // Restore user data from sessionStorage if present.
    // Without a valid session, user stays unauthenticated.
    // ================================
    checkAuthOnStartup() {
      const storedUser = sessionStorage.getItem(USER_SESSION_KEY);

      if (!storedUser) {
        this.authenticated = false;
        this.currentUser = null;
        return;
      }

      try {
        this.currentUser = JSON.parse(storedUser);
        this.authenticated = true;
      } catch {
        sessionStorage.removeItem(USER_SESSION_KEY);
        this.authenticated = false;
        this.currentUser = null;
      }
    },
  },
});
