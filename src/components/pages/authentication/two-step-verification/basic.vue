<script lang="ts" setup>
import { ref, computed, onMounted, nextTick, watch, onUnmounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { authService } from '@/services/auth.service';
import ParticlesJs from '@/shared/components/@spk/reuseble-plugin/particles-js.vue';
import QrcodeVue from 'qrcode.vue';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();

// =====================
// MODE: 'setup' or 'verify'
// =====================
const mode = computed(() => (route.query.mode as string) || 'verify');
const isSetupMode = computed(() => mode.value === 'setup');

// =====================
// SETUP MODE STATE
// =====================
const otpauthUrl = ref('');
const secret = ref('');
const setupLoading = ref(false);
const setupError = ref('');

// =====================
// CODE INPUT STATE
// =====================
const inputs = ref<string[]>(['', '', '', '', '', '']);
const inputRefs = ref<HTMLInputElement[]>([]);
const loading = ref(false);
const error = ref('');

// =====================
// REDIRECT HELPER
// =====================
const redirectByRole = () => {
  const role = authStore.userRole;
  return role === 'admin' ? '/admin/dashboard' : '/dashboards';
};

// =====================
// GUARD: Validate tokens on mount
// =====================
onMounted(async () => {
  if (isSetupMode.value) {
    if (!authStore.setupToken) {
      router.replace('/');
      return;
    }
    await fetchMfaSetup();
  } else {
    if (!authStore.mfaToken) {
      router.replace('/');
      return;
    }
  }

  nextTick(() => {
    inputRefs.value[0]?.focus();
  });
});

// =====================
// COUNTDOWN TIMER
// =====================
const timeLeft = ref(30)
let interval: any = null

const updateTimer = () => {
  const epoch = Math.floor(Date.now() / 1000)
  timeLeft.value = 30 - (epoch % 30)
}

onMounted(() => {
  updateTimer()
  interval = setInterval(updateTimer, 1000)
})

onUnmounted(() => {
  clearInterval(interval)
})

// =====================
// SETUP: Fetch QR code data from backend
// =====================
async function fetchMfaSetup() {
  setupLoading.value = true;
  setupError.value = '';

  try {
    const response = await authService.mfaSetup(authStore.setupToken!);

    otpauthUrl.value = response.provisioning_uri?.trim() || '';
    secret.value = response.secret || '';

  } catch (err: any) {
    setupError.value = err.message || 'Failed to load MFA setup. Please try again.';
  } finally {
    setupLoading.value = false;
  }
}

// =====================
// INPUT HANDLING
// =====================
const handleInput = (index: number, event: Event) => {
  const target = event.target as HTMLInputElement;
  const val = target.value;

  // Ensure numeric only
  if (!/^\d*$/.test(val)) {
    inputs.value[index] = '';
    return;
  }

  // Take only the last character if multiple entered
  if (val.length > 1) {
    inputs.value[index] = val.slice(-1);
  }

  // Auto-focus next
  if (inputs.value[index] && index < 5) {
    nextTick(() => {
      inputRefs.value[index + 1]?.focus();
    });
  }

  // Clear error on input
  if (error.value) error.value = '';
};

const handleKeydown = (index: number, event: KeyboardEvent) => {
  if (event.key === 'Backspace' && !inputs.value[index] && index > 0) {
    nextTick(() => {
      inputRefs.value[index - 1]?.focus();
    });
  }
};

const handlePaste = (event: ClipboardEvent) => {
  event.preventDefault();
  const pastedData = event.clipboardData?.getData('text') || '';
  const numbers = pastedData.replace(/\D/g, '').split('').slice(0, 6);

  numbers.forEach((num, i) => {
    inputs.value[i] = num;
  });

  if (numbers.length === 6) {
    inputRefs.value[5]?.focus();
  }
};

// =====================
// VERIFICATION LOGIC
// =====================
const isComplete = computed(() => inputs.value.every(v => /^\d$/.test(v)));

// Auto-submit when all 6 digits are filled
watch(isComplete, (complete) => {
  if (complete && !loading.value) {
    verifyCode();
  }
});

async function verifyCode() {
  if (!isComplete.value || loading.value) return;

  loading.value = true;
  error.value = '';

  const code = inputs.value.join('');

  try {
    if (isSetupMode.value) {
      // MFA Enable (first-time setup)
      const response = await authService.mfaEnable(authStore.setupToken!, code);
      authStore.completeMfaSetup(response);
      router.push(redirectByRole());
    } else {
      // MFA Verify (returning user)
      const response = await authService.mfaVerify(authStore.mfaToken!, code);
      authStore.completeMfaVerify(response);
      router.push(redirectByRole());
    }
  } catch (err: any) {
    if (err.response?.status === 401) {
      error.value = "The verification code you entered is incorrect."
    } else {
      error.value = "Something went wrong. Please try again."
    }
    loading.value = false;
    }
    // Clear inputs on error
    inputs.value = ['', '', '', '', '', ''];
    nextTick(() => inputRefs.value[0]?.focus());
}

// =====================
// RESEND / RETRY SETUP
// =====================
const resendSetup = async () => {
  if (!authStore.setupToken) return;
  inputs.value = ['', '', '', '', '', ''];
  error.value = '';
  await fetchMfaSetup();
  nextTick(() => inputRefs.value[0]?.focus());
};
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

            <!-- Title -->
            <div class="text-center mb-4">
              <h4 class="fw-bold mb-2">
                {{ isSetupMode ? 'Setup Two-Factor Authentication' : 'Two-Step Verification' }}
              </h4>
              <p class="text-muted mb-0">
                {{ isSetupMode
                  ? 'Scan this QR Code with Google Authenticator app'
                  : 'Enter the 6-digit code from your authenticator app' }}
              </p>
            </div>

            <!-- Setup Loading -->
            <div v-if="isSetupMode && setupLoading" class="text-center py-5">
              <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Loading...</span>
              </div>
              <p class="text-muted mt-3">Loading MFA setup...</p>
            </div>

            <!-- Setup Error -->
            <div v-else-if="isSetupMode && setupError" class="text-center py-4">
              <div class="alert alert-danger" role="alert">
                {{ setupError }}
              </div>
              <button class="btn btn-outline-primary" @click="resendSetup">
                <i class="ri-refresh-line me-1"></i>Retry Setup
              </button>
            </div>

            <!-- Main Content -->
            <template v-else>
              <!-- QR Code Section (Setup mode only) -->
              <div v-if="isSetupMode" class="text-center mb-4">
                <div class="mb-4 p-3 bg-light rounded d-inline-block">
                  <QrcodeVue :value="otpauthUrl" :size="200" level="H" />
                </div>
                <p class="text-muted mb-2 small">Can't scan the code? Enter this key manually:</p>
                <p class="fw-bold font-monospace bg-light p-2 rounded d-inline-block user-select-all border">
                  {{ secret }}
                </p>
              </div>
              <!-- Code Input Label -->
              <div class="text-center mb-4">
                <p class="mb-1 text-muted">Enter the 6-digit code from the app</p>
              </div>

              <!-- 6 Digit Input -->
              <div class="row gx-2 justify-content-center mb-4">
                <div v-for="(_input, index) in inputs" :key="index" class="col-2 col-sm-2">
                  <input
                    :ref="el => { if (el) inputRefs[index] = el as HTMLInputElement }"
                    v-model="inputs[index]"
                    type="text"
                    class="form-control form-control-lg text-center fs-4 fw-bold p-0"
                    style="height: 50px;"
                    maxlength="1"
                    inputmode="numeric"
                    pattern="[0-9]*"
                    autocomplete="one-time-code"
                    @input="handleInput(index, $event)"
                    @keydown="handleKeydown(index, $event)"
                    @paste="handlePaste"
                    :class="{ 'is-invalid': error }"
                    :disabled="loading"
                  >
                </div>
              </div>
              
               <!-- Countdown -->
              <div class="mb-3 text-muted">
                Code refresh in {{ timeLeft }}s
              </div>

              <!-- Error Message -->
              <div v-if="error" class="alert alert-danger text-center mb-4 py-2" role="alert">
                <i class="ri-error-warning-line me-1"></i>{{ error }}
              </div>

              <!-- Verify Button -->
              <div class="d-grid mb-3">
                <button
                  @click="verifyCode"
                  class="btn btn-lg btn-primary"
                  :disabled="!isComplete || loading"
                >
                  <span v-if="loading" class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                  {{ loading ? 'Verifying...' : (isSetupMode ? 'Enable MFA' : 'Verify Code') }}
                </button>
              </div>

              <!-- Retry Setup (Setup mode only) -->
              <div v-if="isSetupMode" class="text-center">
                <p class="text-muted mb-0">
                  Trouble setting up?
                  <button
                    @click="resendSetup"
                    class="btn btn-link text-primary text-decoration-none fw-medium p-0 ms-1"
                  >
                    Retry Setup
                  </button>
                </p>
              </div>

              <!-- Back to Login -->
              <div class="text-center mt-3">
                <router-link to="/" class="text-muted text-decoration-none">
                  <i class="ri-arrow-left-line me-1"></i>Back to Login
                </router-link>
              </div>

              <!-- Security Notice -->
              <div class="text-center mt-4">
                <p class="text-danger mb-0 fw-medium small">
                  <i class="ri-lock-2-line me-1"></i>
                  {{ isSetupMode ? 'Keep your secret key private!' : 'Do not share your verification code' }}
                </p>
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
</template>

<style scoped lang="scss">
@use '@/components/auth/login.scss';

/* Chrome, Safari, Edge, Opera */
input::-webkit-outer-spin-button,
input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

/* Firefox */
input[type=number] {
  -moz-appearance: textfield;
  appearance: textfield;
}
</style>
