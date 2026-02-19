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
 * Helper: map a /api/me (or login) response to CurrentUser.
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
  },

  actions: {
    // ================================
    // LOGIN — Full Cookie Auth
    // ================================
    async authenticateUser(payload: LoginPayload) {
      this.loading = true;
      this.error = null;

      try {
        // 1. Login — backend sets HTTP-only cookie + returns user info in body
        const response = await authService.login(payload);

        // 2. Build user data from login response (no separate /api/me call needed)
        const userData = mapToCurrentUser(response);

        // Store user info in sessionStorage for UI (no token!)
        sessionStorage.setItem(USER_SESSION_KEY, JSON.stringify(userData));

        this.authenticated = true;
        this.currentUser = userData;

        // 3. Load profile data
        const profileStore = useProfileStore();
        await profileStore.switchUser();

        return { authenticated: true };
      } catch (error: any) {
        this.error = error.message || "Login failed";
        sessionStorage.removeItem(USER_SESSION_KEY);
        this.authenticated = false;
        this.currentUser = null;
        return { authenticated: false, error: this.error };
      } finally {
        this.loading = false;
      }
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
    },

    // ================================
    // CHECK AUTH ON STARTUP / REFRESH
    // Restore user data from sessionStorage (no backend call needed).
    // The HTTP-only cookie handles actual API auth automatically.
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
