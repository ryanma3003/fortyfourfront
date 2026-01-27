<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import { toast } from "vue3-toastify";
import "vue3-toastify/dist/index.css";
import ParticlesJs from "../../../../shared/components/@spk/reuseble-plugin/particles-js.vue";
import { useAuthStore } from "@/stores/auth";

const router = useRouter();

const authStore = useAuthStore();
// Form State
const fullName = ref("");
const email = ref("");
const password = ref("");
const confirmPassword = ref("");
const showPassword = ref(false);
const showConfirmPassword = ref(false);
const showHint = ref(false);
const passwordTouched = ref(false);
const isLoading = ref(false);
const agreeToTerms = ref(false);

// Password Generator State
const passwordLength = ref(16);
const generatedPassword = ref("");
const showGeneratedPassword = ref(false);
const copiedToClipboard = ref(false);
const showGenerator = ref(false);

// Computed: Password Validation
const passwordRules = computed(() => [
  { label: "Minimum 8 characters", valid: password.value.length >= 8 },
  { label: "Uppercase letter (A-Z)", valid: /[A-Z]/.test(password.value) },
  { label: "Lowercase letter (a-z)", valid: /[a-z]/.test(password.value) },
  { label: "Number (0-9)", valid: /[0-9]/.test(password.value) },
  { label: "Symbol (!@#$%)", valid: /[!@#$%^&*(),.?"':{}|<>_\-+=\[\]\\/`~;']/.test(password.value) },
]);

const isPasswordValid = computed(() => passwordRules.value.every((r) => r.valid));
const isPasswordLengthValid = computed(() => passwordLength.value >= 8 && passwordLength.value <= 32);
const doPasswordsMatch = computed(() => password.value === confirmPassword.value && confirmPassword.value !== "");

const passwordStrength = computed(() => {
  const pwd = password.value;
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
  
  // Multiple character types bonus (0-10 points)
  const hasMultipleUpper = (pwd.match(/[A-Z]/g) || []).length >= 2;
  const hasMultipleLower = (pwd.match(/[a-z]/g) || []).length >= 2;
  const hasMultipleDigit = (pwd.match(/[0-9]/g) || []).length >= 2;
  const hasMultipleSymbol = (pwd.match(/[!@#$%^&*(),.?"':{}|<>_\-+=\[\]\\/`~;']/g) || []).length >= 2;
  if (hasMultipleUpper) score += 2.5;
  if (hasMultipleLower) score += 2.5;
  if (hasMultipleDigit) score += 2.5;
  if (hasMultipleSymbol) score += 2.5;
  
  // Penalties
  // Repeated characters penalty
  if (/(.)\1{2,}/.test(pwd)) score -= 10;
  // Sequential numbers penalty (123, 321)
  if (/012|123|234|345|456|567|678|789|890|987|876|765|654|543|432|321|210/.test(pwd)) score -= 5;
  // Sequential letters penalty (abc, cba)
  if (/abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz/i.test(pwd)) score -= 5;
  // Common patterns penalty
  if (/password|123456|qwerty|admin|letmein|welcome|monkey|dragon/i.test(pwd)) score -= 20;
  
  // Ensure score is between 0-75
  score = Math.max(0, Math.min(75, score));
  
  // Determine level based on score
  if (score < 15) return { label: "Very Weak", color: "#ef4444", width: "20%", score };
  if (score < 30) return { label: "Weak", color: "#f97316", width: "40%", score };
  if (score < 45) return { label: "Moderate", color: "#eab308", width: "60%", score };
  if (score < 60) return { label: "Strong", color: "#22c55e", width: "80%", score };
  return { label: "Very Strong", color: "#10b981", width: "100%", score };
});

// Helpers
const hideHint = () => {
  setTimeout(() => (showHint.value = false), 200);
  if (password.value) {
    passwordTouched.value = true;
  }
};

const showToast = (type: "success" | "error", msg: string) => {
  toast[type](msg, { theme: "auto", icon: true, hideProgressBar: true, autoClose: true, position: "top-right" });
};

// Password Generator
const generatePassword = () => {
  if (!isPasswordLengthValid.value) return;
  const chars = { upper: "ABCDEFGHJKLMNPQRSTUVWXYZ", lower: "abcdefghjkmnpqrstuvwxyz", num: "23456789", sym: "!@#$%^&*_+-=?" };
  let pwd = [chars.upper, chars.upper, chars.lower, chars.lower, chars.num, chars.num, chars.sym, chars.sym]
    .map((c) => c[Math.floor(Math.random() * c.length)]).join("");
  const all = Object.values(chars).join("");
  while (pwd.length < passwordLength.value) pwd += all[Math.floor(Math.random() * all.length)];
  const arr = pwd.split("");
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  generatedPassword.value = arr.join("");
  showGeneratedPassword.value = true;
  copiedToClipboard.value = false;
};

const copyToClipboard = async () => {
  try {
    await navigator.clipboard.writeText(generatedPassword.value);
  } catch {
    const t = document.createElement("textarea");
    t.value = generatedPassword.value;
    document.body.appendChild(t);
    t.select();
    document.execCommand("copy");
    document.body.removeChild(t);
  }
  copiedToClipboard.value = true;
  showToast("success", "Password copied to clipboard!");
  setTimeout(() => (copiedToClipboard.value = false), 2000);
};

const useGeneratedPassword = () => {
  password.value = generatedPassword.value;
  confirmPassword.value = generatedPassword.value;
  showHint.value = true;
  showToast("success", "Password applied successfully!");
};

// Sign Up Handler
const signUp = async () => {
  if (isLoading.value) return;

  if (!fullName.value.trim()) return showToast("error", "Full name is required");
  if (!email.value) return showToast("error", "Email is required");
  if (!isPasswordValid.value) return showToast("error", "Password does not meet requirements");
  if (!doPasswordsMatch.value) return showToast("error", "Passwords do not match");
  if (!agreeToTerms.value) return showToast("error", "You must agree to the terms and conditions");

  isLoading.value = true;
  isLoading.value = true;
  
  const result = await authStore.registerUser({
    username: fullName.value,
    email: email.value,
    password: password.value
  });

  if (result.success) {
    showToast("success", "Account created successfully! Please login.");
    setTimeout(() => {
        isLoading.value = false;
        router.push("/");
    }, 1500);
  } else {
    isLoading.value = false;
    showToast("error", result.error || "Failed to create account");
  }
};

// Lifecycle
const setBodyClass = (add: boolean) => document.body.classList[add ? "add" : "remove"]("authentication-background");
const cleanup = () => { setBodyClass(false); localStorage.removeItem("visited"); };

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
        <div class="col-xxl-5 col-xl-6 col-lg-7 col-md-8 col-sm-10 col-12">
          <div class="card custom-card auth-card signup-card border-0 my-4">
            <div class="card-header-accent"></div>
            <div class="card-body p-4 p-md-5">
              <!-- Logo -->
              <div class="mb-4 d-flex justify-content-center">
                <img src="/images/brand-logos/logoLight.svg" alt="logo" id="logo-light" style="height: 50px" />
                <img src="/images/brand-logos/logoDark.svg" alt="logo" id="logo-dark" style="height: 50px" />
              </div>

              <!-- Header -->
              <div class="text-center mb-4">
                <h4 class="mb-2 fw-bold signup-title">Create New Account</h4>
                <p class="text-muted fw-normal fs-14">Secure access to your enterprise dashboard</p>
              </div>

              <!-- Form -->
              <div class="row gy-3">
                <!-- Full Name -->
                <div class="col-12">
                  <label for="signup-name" class="form-label">Username</label>
                  <div class="input-group input-group-modern">
                    <span class="input-group-text"><i class="ri-user-3-line"></i></span>
                    <input type="text" class="form-control form-control-lg" id="signup-name" v-model="fullName" placeholder="Enter your Username" @keyup.enter="signUp" />
                  </div>
                </div>

                <!-- Email -->
                <div class="col-12">
                  <label for="signup-email" class="form-label">Email</label>
                  <div class="input-group input-group-modern">
                    <span class="input-group-text"><i class="ri-at-line"></i></span>
                    <input type="email" class="form-control form-control-lg" id="signup-email" v-model="email" placeholder="contoh@email.com" @keyup.enter="signUp" />
                  </div>
                </div>

                <!-- Password -->
                <div class="col-12">
                  <label for="signup-password" class="form-label">Password</label>
                  <div class="input-group input-group-modern">
                    <span class="input-group-text"><i class="ri-lock-password-line"></i></span>
                    <input :type="showPassword ? 'text' : 'password'" class="form-control form-control-lg" id="signup-password" v-model="password" placeholder="Create a strong password" @focus="showHint = true" @blur="hideHint" @keyup.enter="signUp" />
                    <button @click="showPassword = !showPassword" class="btn btn-toggle-password" type="button">
                      <i :class="showPassword ? 'ri-eye-off-line' : 'ri-eye-line'"></i>
                    </button>
                  </div>

                  <!-- Password Strength -->
                  <div v-if="password" class="password-strength mt-2">
                    <div class="strength-bar-bg">
                      <div class="strength-bar" :style="{ width: passwordStrength.width, backgroundColor: passwordStrength.color }"></div>
                    </div>
                    <div class="d-flex justify-content-between mt-1">
                      <small class="strength-label" :style="{ color: passwordStrength.color }">
                        <i class="ri-shield-check-line me-1"></i>{{ passwordStrength.label }}
                      </small>
                      <small class="text-muted">{{ password.length }} characters</small>
                    </div>
                  </div>

                  <!-- Password Rules -->
                  <div v-if="showHint && password" class="password-rules mt-3">
                    <div class="rules-grid">
                      <div v-for="(rule, i) in passwordRules" :key="i" class="rule-item" :class="rule.valid ? 'valid' : 'invalid'">
                        <i :class="rule.valid ? 'ri-checkbox-circle-fill' : 'ri-close-circle-fill'" class="rule-icon"></i>
                        <span>{{ rule.label }}</span>
                      </div>
                    </div>
                  </div>

                  <!-- Password Error Alert -->
                  <div v-if="passwordTouched && password && !isPasswordValid" class="match-indicator text-danger mt-1">
                    <i class="ri-close-circle-fill me-1"></i>Password does not meet requirements
                  </div>
                </div>

                <!-- Confirm Password -->
                <div class="col-12">
                  <label for="signup-confirm-password" class="form-label">Confirm Password</label>
                  <div class="input-group input-group-modern">
                    <span class="input-group-text"><i class="ri-lock-2-line"></i></span>
                    <input :type="showConfirmPassword ? 'text' : 'password'" class="form-control form-control-lg" id="signup-confirm-password" v-model="confirmPassword" placeholder="Repeat password" @keyup.enter="signUp" />
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

                <!-- Password Generator -->
                <div class="col-12">
                  <button @click="showGenerator = !showGenerator" class="btn btn-generator-toggle w-100" type="button">
                    <i class="ri-key-2-line me-2"></i><span>Password Generator</span>
                    <i :class="showGenerator ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'" class="ms-auto"></i>
                  </button>

                  <div v-if="showGenerator" class="generator-panel mt-3">
                    <div class="generator-header"><i class="ri-magic-line me-2"></i>Auto Generate Password</div>
                    <div class="generator-body">
                      <div class="length-control">
                        <div class="d-flex justify-content-between mb-2">
                          <label class="form-label small mb-0">Password Length</label>
                          <span class="length-value">{{ passwordLength }}</span>
                        </div>
                        <input type="range" v-model.number="passwordLength" min="8" max="32" class="form-range" />
                        <div class="d-flex justify-content-between"><small class="text-muted">8</small><small class="text-muted">32</small></div>
                      </div>
                      <button @click="generatePassword" class="btn btn-generate w-100 mb-3" :disabled="!isPasswordLengthValid">
                        <i class="ri-refresh-line me-2"></i>Generate Password
                      </button>
                      <div v-if="generatedPassword" class="generated-result">
                        <div class="result-display">
                          <code class="password-display">{{ showGeneratedPassword ? generatedPassword : "•".repeat(generatedPassword.length) }}</code>
                        </div>
                        <div class="result-actions">
                          <button @click="showGeneratedPassword = !showGeneratedPassword" class="btn btn-action" type="button">
                            <i :class="showGeneratedPassword ? 'ri-eye-off-line' : 'ri-eye-line'"></i>
                          </button>
                          <button @click="copyToClipboard" class="btn btn-action" :class="{ copied: copiedToClipboard }" type="button">
                            <i :class="copiedToClipboard ? 'ri-check-line' : 'ri-file-copy-line'"></i>
                          </button>
                          <button @click="useGeneratedPassword" class="btn btn-use-password" type="button">
                            <i class="ri-check-double-line me-1"></i>Use
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Terms -->
                <div class="col-12">
                  <div class="form-check terms-check">
                    <input class="form-check-input" type="checkbox" id="agreeTerms" v-model="agreeToTerms" />
                    <label class="form-check-label" for="agreeTerms">
                      I agree to the <a href="javascript:void(0);" class="terms-link">Terms & Conditions</a> and <a href="javascript:void(0);" class="terms-link">Privacy Policy</a>
                    </label>
                  </div>
                </div>
              </div>

              <!-- Submit -->
              <div class="d-grid mt-4">
                <button class="btn btn-auth-submit btn-lg" @click="signUp" :disabled="isLoading || !isPasswordValid || !doPasswordsMatch || !agreeToTerms">
                  <span v-if="!isLoading"><i class="ri-user-add-line me-2"></i>Sign Up Now</span>
                  <span v-else><span class="spinner-border spinner-border-sm me-2"></span>Creating account...</span>
                </button>
              </div>

              <!-- Login Link -->
              <div class="text-center mt-4">
                <span class="text-muted">Already have an account?</span>
                <router-link to="/" class="auth-link ms-1"><i class="ri-login-box-line me-1"></i>Sign In</router-link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use "../../../auth/login.scss";

/* Note: Most auth form styles are now in src/assets/css/styles.css
   under "REUSABLE AUTHENTICATION FORM STYLES" section.
   Other forms (login, reset-password, etc.) can use the same classes:
   - .auth-card, .auth-title
   - .input-group-modern, .btn-toggle-password
   - .password-strength, .password-rules
   - .btn-generator-toggle, .generator-panel
   - .generated-result, .length-control
   - .terms-check, .btn-auth-submit, .auth-link
*/

/* Title - black in light mode, white in dark mode */
.signup-title {
  color: #111827;
  -webkit-text-fill-color: #111827;
}

/* Form labels - black in light mode */
.form-label {
  color: #111827 !important;
}

/* Dark mode overrides */
[data-theme-mode="dark"],
.dark-mode {
  .signup-title {
    color: #ffffff;
    -webkit-text-fill-color: #ffffff;
  }
  
  .form-label {
    color: #ffffff !important;
  }
}

/* Slider Range Styling for Password Length */
.form-range {
  -webkit-appearance: none;
  width: 100%;
  height: 6px;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 5px;
  outline: none;
}

.form-range::-webkit-slider-runnable-track {
  width: 100%;
  height: 6px;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 5px;
}

.form-range::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 18px;
  height: 18px;
  background: #0d47a1;
  border-radius: 50%;
  cursor: pointer;
  border: 2px solid #ffffff;
  margin-top: -6px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
}

.form-range::-moz-range-track {
  width: 100%;
  height: 6px;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 5px;
}

.form-range::-moz-range-thumb {
  width: 18px;
  height: 18px;
  background: #0d47a1;
  border-radius: 50%;
  cursor: pointer;
  border: 2px solid #ffffff;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
}
</style>
