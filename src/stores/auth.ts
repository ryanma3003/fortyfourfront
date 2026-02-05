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

// Session storage key ONLY for user info (NOT token)
const USER_SESSION_KEY = "auth_user_session";

// ================================
// TOKEN MEMORY ONLY (NOT STORAGE)
// ================================
let accessToken: string | null = null;

function setToken(token: string) {
  accessToken = token;
}

function clearToken() {
  accessToken = null;
}

function getToken() {
  return accessToken;
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
    // LOGIN
    // ================================
    async authenticateUser(payload: LoginPayload) {
      this.loading = true;
      this.error = null;

      try {
        const response = await authService.login(payload);

        // ================================
        // TOKEN ONLY IN MEMORY
        // ================================
        setToken(response.access_token);

        // Attach token to axios/fetch client
        authService.setAuthToken(response.access_token);

        // User info safe to store
        const userData: CurrentUser = {
          id: response.user.id,
          username: response.user.username,
          name: response.user.username,
          email: response.user.email,
          role: response.user.role_name || "user",
          createdAt: response.user.created_at,
        };

        // Store ONLY user info (no token)
        sessionStorage.setItem(USER_SESSION_KEY, JSON.stringify(userData));

        this.authenticated = true;
        this.currentUser = userData;

        // Load profile
        const profileStore = useProfileStore();
        await profileStore.switchUser();

        return { authenticated: true };
      } catch (error: any) {
        this.error = error.message || "Login failed";

        clearToken();
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
    // LOGOUT
    // ================================
    logUserOut() {
      const profileStore = useProfileStore();
      profileStore.resetToDefaults();

      // Clear memory token
      clearToken();

      // Clear API header
      authService.logout();

      // Clear user info
      sessionStorage.removeItem(USER_SESSION_KEY);

      this.authenticated = false;
      this.currentUser = null;
      this.error = null;
    },

    // ================================
    // CHECK AUTH ON STARTUP
    // ================================
    checkAuthOnStartup() {
      const storedUser = sessionStorage.getItem(USER_SESSION_KEY);

      if (!storedUser) {
        this.authenticated = false;
        this.currentUser = null;
        return;
      }

      try {
        // Restore user info
        this.currentUser = JSON.parse(storedUser);
        this.authenticated = true;

        // Token cannot be restored because it's memory-only
        // User must login again after reload
        console.warn("Token is memory-only, please login again after refresh.");
      } catch (err) {
        this.logUserOut();
      }
    },

    // ================================
    // OPTIONAL: GET TOKEN (INTERNAL)
    // ================================
    getAccessToken() {
      return getToken();
    },
  },
});
