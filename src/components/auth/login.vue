<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import { useRouter } from "vue-router";
import { toast } from "vue3-toastify";
import "vue3-toastify/dist/index.css";
import ParticlesJs from "../../shared/components/@spk/reuseble-plugin/particles-js.vue";
import { useAuthStore } from "../../stores/auth";

const router = useRouter();
const authStore = useAuthStore();

// State
const user = ref({ identifier: "", password: "" });
const showPassword = ref(false);
const isLoading = ref(false);

// Toast helper
const showToast = (type: "success" | "error", message: string) => {
  toast[type](message, {
    theme: "auto",
    icon: true,
    hideProgressBar: true,
    autoClose: true,
    position: "top-right",
  });
};

// Admin redirect
const redirectPath = "/dashboard";

// Login handler
const login = async () => {
  if (isLoading.value) return;
  isLoading.value = true;

  try {
    const result = await authStore.authenticateUser(user.value);

    // Case 1: MFA first-time setup required
    if (result.mfaSetup) {
      showToast("success", "MFA setup required");
      router.push("/pages/authentication/two-step-verification/basic?mode=setup");
      return;
    }

    // Case 2: MFA verification required (returning user)
    if (result.mfaVerify) {
      showToast("success", "MFA verification required");
      router.push("/pages/authentication/two-step-verification/basic?mode=verify");
      return;
    }

    // Case 3: Direct login success
    if (result.authenticated) {
      if (!authStore.isAdmin) {
        await authStore.logUserOut();
        showToast("error", "Akses ditolak. Hanya untuk admin.");
        return;
      }
      
      showToast("success", "Logged In");
      setTimeout(() => {
        router.push(redirectPath);
      }, 1500);
      return;
    }

    // Login failed
    showToast("error", "Invalid credentials" + (result.error ? `: ${result.error}` : ""));
  } catch (error: any) {
    showToast("error", "An error occurred");
  } finally {
    isLoading.value = false;
  }
};

// Body class management
const setBodyClass = (add: boolean) => {
  document.body.classList[add ? "add" : "remove"]("authentication-background");
};

const cleanup = () => {
  setBodyClass(false);
};

onMounted(() => {
  setBodyClass(true);
  router.beforeEach(() => setBodyClass(false));
  window.addEventListener("beforeunload", cleanup, { passive: true });
});

onUnmounted(() => {
  window.removeEventListener("beforeunload", cleanup);
  setBodyClass(false);
});
</script>

<template>
  <div class="authentication-background">
    <ParticlesJs />
    <div class="container">
      <div class="row justify-content-center align-items-center authentication authentication-basic h-100">
        <div class="col-xxl-5 col-xl-6 col-lg-7 col-md-8 col-sm-10 col-12">
          <div class="card custom-card auth-card border-0 my-4">
            <div class="card-header-accent"></div>
            <div class="card-body p-4 p-md-5">
              <!-- Logo -->
              <div class="mb-4 d-flex justify-content-center">
                <img src="/images/brand-logos/logoLight.svg" alt="logo" id="logo-light" style="height: 50px"/>
                <img src="/images/brand-logos/logoDark.svg" alt="logo" id="logo-dark" style="height: 50px"/>
              </div>

              <!-- Header -->
              <div class="text-center mb-4">
                <h4 class="mb-2 fw-bold login-title">Welcome</h4>
                <p class="text-muted fw-normal fs-14">Sign in to access your dashboard</p>
              </div>

              <!-- Form -->
              <form @submit.prevent="login">
                <div class="row gy-3">
                  <!-- Email -->
                  <div class="col-12">
                    <label for="signin-ident" class="form-label">Username</label>
                    <div class="input-group input-group-modern">
                      <span class="input-group-text"><i class="ri-user-line"></i></span>
                      <input type="text" class="form-control form-control-lg" id="signin-username" v-model="user.identifier" placeholder="Enter your username" autocomplete="username" />
                    </div>
                  </div>

                  <!-- Password -->
                  <div class="col-12">
                    <label for="signin-password" class="form-label">Password</label>
                    <div class="input-group input-group-modern">
                      <span class="input-group-text"><i class="ri-lock-password-line"></i></span>
                      <input :type="showPassword ? 'text' : 'password'" class="form-control form-control-lg" id="signin-password" v-model="user.password" placeholder="Enter your password" autocomplete="current-password" />
                      <button @click="showPassword = !showPassword" class="btn btn-toggle-password" type="button">
                        <i :class="showPassword ? 'ri-eye-off-line' : 'ri-eye-line'"></i>
                      </button>
                    </div>
                  </div>

                  <!-- Remember & Forgot -->
                  <div class="col-12">
                    <div class="d-flex justify-content-between align-items-center">
                      <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="rememberMe" checked/>
                        <label class="form-check-label" for="rememberMe">Remember me</label>
                      </div>
                      <router-link to="/pages/authentication/reset-password/basic" class="auth-link fs-12">Forgot password?</router-link>
                    </div>
                  </div>
                </div>

                <!-- Submit Button -->
                <div class="d-grid mt-4">
                  <button type="submit" class="btn btn-auth-submit btn-lg" :disabled="isLoading">
                    <span v-if="!isLoading"><i class="ri-login-box-line me-2"></i>Sign In</span>
                    <span v-else><span class="spinner-border spinner-border-sm me-2"></span>Signing in...</span>
                  </button>
                </div>
              </form>

              <!-- Register Link -->
              <div class="text-center mt-4">
                <span class="text-muted">Don't have an account?</span>
                <router-link to="/pages/authentication/sign-up/basic" class="auth-link ms-1"><i class="ri-user-add-line me-1"></i>Register</router-link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use './login.scss';

/* Title - black in light mode, white in dark mode */
.login-title {
  color: #111827;
}

/* Dark mode overrides */
[data-theme-mode="dark"],
.dark-mode {
  .login-title {
    color: #ffffff;
  }
}
</style>
