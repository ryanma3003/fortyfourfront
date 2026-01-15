<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import { toast } from "vue3-toastify";
import "vue3-toastify/dist/index.css";
import ParticlesJs from "../../../../shared/components/@spk/reuseble-plugin/particles-js.vue";

const router = useRouter();

// State
const currentPassword = ref("");
const newPassword = ref("");
const confirmPassword = ref("");
const showCurrentPassword = ref(false);
const showNewPassword = ref(false);
const showConfirmPassword = ref(false);
const isLoading = ref(false);
const showHint = ref(false);
const passwordTouched = ref(false);

// Password Validation Rules
const passwordRules = computed(() => [
  { label: "Minimum 8 characters", valid: newPassword.value.length >= 8 },
  { label: "Uppercase letter (A-Z)", valid: /[A-Z]/.test(newPassword.value) },
  { label: "Lowercase letter (a-z)", valid: /[a-z]/.test(newPassword.value) },
  { label: "Number (0-9)", valid: /[0-9]/.test(newPassword.value) },
  { label: "Symbol (!@#$%)", valid: /[!@#$%^&*(),.?"':{}|<>_\-+=\[\]\\/`~;']/.test(newPassword.value) },
]);

const isPasswordValid = computed(() => passwordRules.value.every((r) => r.valid));
const doPasswordsMatch = computed(() => newPassword.value === confirmPassword.value && confirmPassword.value !== "");

const passwordStrength = computed(() => {
  const pwd = newPassword.value;
  if (!pwd) return { label: "", color: "#e2e8f0", width: "0%", score: 0 };
  
  let score = 0;
  
  // Base rules (0-5 points each = max 25)
  if (pwd.length >= 8) score += 5;
  if (/[A-Z]/.test(pwd)) score += 5;
  if (/[a-z]/.test(pwd)) score += 5;
  if (/[0-9]/.test(pwd)) score += 5;
  if (/[!@#$%^&*(),.?"':{}|<>_\-+=\[\]\\/`~;']/.test(pwd)) score += 5;
  
  // Length bonus (0-25 points)
  if (pwd.length >= 10) score += 5;
  if (pwd.length >= 12) score += 5;
  if (pwd.length >= 14) score += 5;
  if (pwd.length >= 16) score += 5;
  if (pwd.length >= 20) score += 5;
  
  // Variety bonus (0-15 points)
  const uniqueChars = new Set(pwd).size;
  if (uniqueChars >= 6) score += 5;
  if (uniqueChars >= 8) score += 5;
  if (uniqueChars >= 10) score += 5;
  
  // Penalties
  if (/(.)\\1{2,}/.test(pwd)) score -= 10;
  if (/012|123|234|345|456|567|678|789|890|987|876|765|654|543|432|321|210/.test(pwd)) score -= 5;
  if (/abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz/i.test(pwd)) score -= 5;
  if (/password|123456|qwerty|admin|letmein|welcome|monkey|dragon/i.test(pwd)) score -= 20;
  
  score = Math.max(0, Math.min(75, score));
  
  if (score < 15) return { label: "Very Weak", color: "#ef4444", width: "20%", score };
  if (score < 30) return { label: "Weak", color: "#f97316", width: "40%", score };
  if (score < 45) return { label: "Moderate", color: "#eab308", width: "60%", score };
  if (score < 60) return { label: "Strong", color: "#22c55e", width: "80%", score };
  return { label: "Very Strong", color: "#10b981", width: "100%", score };
});

// Helpers
const hideHint = () => {
  setTimeout(() => (showHint.value = false), 200);
  if (newPassword.value) {
    passwordTouched.value = true;
  }
};

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

// Reset password handler
const resetPassword = async () => {
  if (isLoading.value) return;

  // Validation
  if (!currentPassword.value) {
    showToast("error", "Current password is required");
    return;
  }
  
  if (!isPasswordValid.value) {
    showToast("error", "Password does not meet requirements");
    return;
  }
  
  if (!doPasswordsMatch.value) {
    showToast("error", "Passwords do not match");
    return;
  }

  isLoading.value = true;

  try {
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    showToast("success", "Password reset successfully");
    setTimeout(() => {
      isLoading.value = false;
      router.push("/auth/login");
    }, 1000);
  } catch {
    isLoading.value = false;
    showToast("error", "Failed to reset password");
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
                <h4 class="mb-2 fw-bold reset-title">Reset Password</h4>
                <p class="text-muted fw-normal fs-14">Set your new password here</p>
              </div>

              <!-- Form -->
              <div class="row gy-3">
                <!-- Current Password -->
                <div class="col-12">
                  <label for="current-password" class="form-label"><i class="ri-lock-line me-1 text-primary"></i>Current Password</label>
                  <div class="input-group input-group-modern">
                    <span class="input-group-text"><i class="ri-lock-password-line"></i></span>
                    <input :type="showCurrentPassword ? 'text' : 'password'" class="form-control form-control-lg" id="current-password" v-model="currentPassword" placeholder="Enter current password" @keyup.enter="resetPassword"/>
                    <button @click="showCurrentPassword = !showCurrentPassword" class="btn btn-toggle-password" type="button">
                      <i :class="showCurrentPassword ? 'ri-eye-off-line' : 'ri-eye-line'"></i>
                    </button>
                  </div>
                </div>

                <!-- New Password -->
                <div class="col-12">
                  <label for="new-password" class="form-label"><i class="ri-lock-line me-1 text-primary"></i>New Password</label>
                  <div class="input-group input-group-modern">
                    <span class="input-group-text"><i class="ri-lock-2-line"></i></span>
                    <input :type="showNewPassword ? 'text' : 'password'" class="form-control form-control-lg" id="new-password" v-model="newPassword" placeholder="Create a strong password" @focus="showHint = true" @blur="hideHint" @keyup.enter="resetPassword"/>
                    <button @click="showNewPassword = !showNewPassword" class="btn btn-toggle-password" type="button">
                      <i :class="showNewPassword ? 'ri-eye-off-line' : 'ri-eye-line'"></i>
                    </button>
                  </div>

                  <!-- Password Strength -->
                  <div v-if="newPassword" class="password-strength mt-2">
                    <div class="strength-bar-bg">
                      <div class="strength-bar" :style="{ width: passwordStrength.width, background: passwordStrength.color }"></div>
                    </div>
                    <div class="d-flex justify-content-between align-items-center mt-1">
                      <small class="strength-label" :style="{ color: passwordStrength.color }">
                        <i class="ri-shield-check-line me-1"></i>{{ passwordStrength.label }}
                      </small>
                      <small class="text-muted">{{ newPassword.length }} characters</small>
                    </div>
                  </div>

                  <!-- Password Rules -->
                  <div v-if="showHint || newPassword" class="password-rules mt-2">
                    <div class="rules-grid">
                      <div v-for="(rule, i) in passwordRules" :key="i" class="rule-item" :class="rule.valid ? 'valid' : 'invalid'">
                        <i :class="rule.valid ? 'ri-checkbox-circle-fill' : 'ri-close-circle-fill'" class="rule-icon"></i>
                        <span>{{ rule.label }}</span>
                      </div>
                    </div>
                  </div>

                  <!-- Password Error Alert -->
                  <div v-if="passwordTouched && newPassword && !isPasswordValid" class="match-indicator text-danger mt-1">
                    <i class="ri-close-circle-fill me-1"></i>Password does not meet requirements
                  </div>
                </div>

                <!-- Confirm Password -->
                <div class="col-12">
                  <label for="confirm-password" class="form-label"><i class="ri-lock-line me-1 text-primary"></i>Confirm Password</label>
                  <div class="input-group input-group-modern">
                    <span class="input-group-text"><i class="ri-lock-check-line"></i></span>
                    <input :type="showConfirmPassword ? 'text' : 'password'" class="form-control form-control-lg" id="confirm-password" v-model="confirmPassword" placeholder="Repeat new password" @keyup.enter="resetPassword"/>
                    <button @click="showConfirmPassword = !showConfirmPassword" class="btn btn-toggle-password" type="button">
                      <i :class="showConfirmPassword ? 'ri-eye-off-line' : 'ri-eye-line'"></i>
                    </button>
                  </div>
                  <div v-if="confirmPassword && !doPasswordsMatch" class="match-indicator text-danger mt-1">
                    <i class="ri-close-circle-fill me-1"></i>Passwords do not match
                  </div>
                  <div v-if="doPasswordsMatch" class="match-indicator text-success mt-1">
                    <i class="ri-checkbox-circle-fill me-1"></i>Passwords match
                  </div>
                </div>
              </div>

              <!-- Submit Button -->
              <div class="d-grid mt-4">
                <button class="btn btn-auth-submit btn-lg" @click="resetPassword" :disabled="isLoading || !isPasswordValid || !doPasswordsMatch || !currentPassword">
                  <span v-if="!isLoading"><i class="ri-lock-unlock-line me-2"></i>Reset Password</span>
                  <span v-else><span class="spinner-border spinner-border-sm me-2"></span>Resetting...</span>
                </button>
              </div>

              <!-- Back to Login -->
              <div class="text-center mt-4">
                <span class="text-muted">Remember your password?</span>
                <router-link to="/auth/login" class="auth-link ms-1"><i class="ri-login-box-line me-1"></i>Sign In</router-link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@import '../../../auth/login.scss';

/* Title - black in light mode, white in dark mode */
.reset-title {
  color: #111827;
}

/* Form labels - black in light mode */
.form-label {
  color: #111827 !important;
}

/* Dark mode overrides */
[data-theme-mode="dark"],
.dark-mode {
  .reset-title {
    color: #ffffff;
  }
  
  .form-label {
    color: #ffffff !important;
  }
}
</style>
