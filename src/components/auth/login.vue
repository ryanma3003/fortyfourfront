<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import { useRouter } from "vue-router";
import { toast } from "vue3-toastify";
import "vue3-toastify/dist/index.css";
import ParticlesJs from "../../shared/components/@spk/reuseble-plugin/particles-js.vue";
import { useAuthStore } from "../../stores/auth";

const router = useRouter();
const { authenticateUser } = useAuthStore();

// State
const user = ref({ username: "", password: "" });
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

// Login handler
const login = async () => {
  if (isLoading.value) return;
  isLoading.value = true;

  const result = await authenticateUser(user.value);

  if (result.authenticated) {
    showToast("success", "Logged In");
    setTimeout(() => {
      isLoading.value = false;
      router.push("/dashboards");
    }, 1000);
  } else {
    isLoading.value = false;
    showToast("error", "Invalid credentials");
  }
};

// Body class management
const setBodyClass = (add: boolean) => {
  document.body.classList[add ? "add" : "remove"]("authentication-background");
};

const cleanup = () => {
  setBodyClass(false);
  localStorage.removeItem("visited");
};

onMounted(() => {
  setBodyClass(true);
  localStorage.setItem("visited", "true");
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
        <div class="col-xxl-4 col-xl-5 col-lg-6 col-md-8 col-sm-10 col-12">
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
                <h4 class="mb-2 fw-bold login-title">Welcome Back</h4>
                <p class="text-muted fw-normal fs-14">Sign in to access your dashboard</p>
              </div>

              <!-- Form -->
              <div class="row gy-3">
                <!-- Email -->
                <div class="col-12">
                  <label for="signin-email" class="form-label"><i class="ri-mail-line me-1 text-primary"></i>Email</label>
                  <div class="input-group input-group-modern">
                    <span class="input-group-text"><i class="ri-at-line"></i></span>
                    <input type="text" class="form-control form-control-lg" id="signin-email" v-model="user.username" placeholder="Enter your email" @keyup.enter="login"/>
                  </div>
                </div>

                <!-- Password -->
                <div class="col-12">
                  <label for="signin-password" class="form-label"><i class="ri-lock-line me-1 text-primary"></i>Password</label>
                  <div class="input-group input-group-modern">
                    <span class="input-group-text"><i class="ri-lock-password-line"></i></span>
                    <input :type="showPassword ? 'text' : 'password'" class="form-control form-control-lg" id="signin-password" v-model="user.password" placeholder="Enter your password" @keyup.enter="login"/>
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
                <button class="btn btn-auth-submit btn-lg" @click="login" :disabled="isLoading">
                  <span v-if="!isLoading"><i class="ri-login-box-line me-2"></i>Sign In</span>
                  <span v-else><span class="spinner-border spinner-border-sm me-2"></span>Signing in...</span>
                </button>
              </div>

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
@import './login.scss';

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
