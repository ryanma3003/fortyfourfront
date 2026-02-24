<script lang="ts" setup>
import { ref, computed, onMounted, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import ParticlesJs from '@/shared/components/@spk/reuseble-plugin/particles-js.vue';
import QrcodeVue from 'qrcode.vue';

const router = useRouter();
const authStore = useAuthStore();

// TOTP Configuration
const secret = 'JBSWY3DPEHPK3PXP';
const issuer = 'KSSIndustri';
const account = 'admin@example.com';
const otpauthUrl = `otpauth://totp/${issuer}:${account}?secret=${secret}&issuer=${issuer}`;

// State
const inputs = ref<string[]>(['', '', '', '', '', '']);
const inputRefs = ref<HTMLInputElement[]>([]);
const loading = ref(false);
const error = ref('');
const timer = ref(0);
const resendDisabled = computed(() => timer.value > 0);

// Input handling
const handleInput = (index: number, event: Event) => {
  const target = event.target as HTMLInputElement;
  const val = target.value;

  // Ensure numeric only
  if (!/^\d*$/.test(val)) {
    inputs.value[index] = '';
    return;
  }

  // Auto-focus next
  if (val && index < 5) {
    nextTick(() => {
      inputRefs.value[index + 1]?.focus();
    });
  }
  
  // Clear error on input
  if (error.value) error.value = '';
};

const handleKeydown = (index: number, event: KeyboardEvent) => {
  if (event.key === 'Backspace' && !inputs.value[index] && index > 0) {
    // Backspace: move to previous if current is empty
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

// Verification Logic
const isComplete = computed(() => inputs.value.every(v => v.length === 1));

const verifyCode = async () => {
  if (!isComplete.value) return;

  loading.value = true;
  error.value = '';
  
  const code = inputs.value.join('');

  // Simulate network delay
  setTimeout(async () => {
    if (code === '123456') {
      await authStore.verifyMfa();
      router.push('/dashboard');
    } else {
      error.value = 'Invalid verification code. Please try again.';
      loading.value = false;
      // Clear inputs on error
      inputs.value = ['', '', '', '', '', ''];
      nextTick(() => inputRefs.value[0]?.focus());
    }
  }, 1000);
};

// Resend / Timer Logic
const startTimer = () => {
  timer.value = 30;
  const interval = setInterval(() => {
    timer.value--;
    if (timer.value <= 0) clearInterval(interval);
  }, 1000);
};

const resendSetup = () => {
  // logic to regenerate secret would go here
  startTimer();
  inputs.value = ['', '', '', '', '', ''];
  error.value = '';
  nextTick(() => inputRefs.value[0]?.focus());
};

// Lifecycle
onMounted(() => {
  startTimer(); // Start timer on mount
  nextTick(() => {
    inputRefs.value[0]?.focus();
  });
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
                        <div class="text-center mb-4">
                            <h4 class="fw-bold mb-2">Two-Step Verification</h4>
                            <p class="text-muted mb-4">Scan this QR Code with Google Authenticator app</p>
                            
                            <!-- QR Code Section -->
                            <div class="mb-4 p-3 bg-light rounded d-inline-block">
                                <QrcodeVue :value="otpauthUrl" :size="200" level="H" />
                            </div>

                            <p class="text-muted mb-2 small">Can't scan the code?</p>
                            <p class="fw-bold font-monospace bg-light p-2 rounded d-inline-block user-select-all border">
                                {{ secret }}
                            </p>
                        </div>

                        <div class="text-center mb-4">
                            <p class="mb-1 text-muted">Enter the 6-digit code from the app</p>
                        </div>

                        <!-- 6 Digit Input -->
                        <div class="row gx-2 justify-content-center mb-4">
                            <div v-for="(input, index) in inputs" :key="index" class="col-2 col-sm-2">
                                <input 
                                    :ref="el => { if (el) inputRefs[index] = el as HTMLInputElement }"
                                    v-model="inputs[index]"
                                    type="text" 
                                    class="form-control form-control-lg text-center fs-4 fw-bold p-0" 
                                    style="height: 50px;"
                                    maxlength="1"
                                    inputmode="numeric"
                                    @input="handleInput(index, $event)"
                                    @keydown="handleKeydown(index, $event)"
                                    @paste="handlePaste"
                                    :class="{ 'is-invalid': error }"
                                >
                            </div>
                        </div>

                        <!-- Error Message -->
                        <div v-if="error" class="alert alert-danger text-center mb-4 py-2" role="alert">
                            {{ error }}
                        </div>

                        <!-- Verify Button -->
                        <div class="d-grid mb-3">
                            <button 
                                @click="verifyCode" 
                                class="btn btn-lg btn-primary" 
                                :disabled="!isComplete || loading"
                            >
                                <span v-if="loading" class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                {{ loading ? 'Verifying...' : 'Verify Code' }}
                            </button>
                        </div>

                        <!-- Resend Section -->
                        <div class="text-center">
                            <p class="text-muted mb-0">
                                Trouble setting up? 
                                <button 
                                    @click="resendSetup" 
                                    class="btn btn-link text-primary text-decoration-none fw-medium p-0 ms-1"
                                    :disabled="resendDisabled"
                                >
                                    Resend Setup {{ resendDisabled ? `(${timer}s)` : '' }}
                                </button>
                            </p>
                        </div>
                        
                        <div class="text-center mt-4">
                            <p class="text-danger mb-0 fw-medium small">
                                <i class="ri-lock-2-line me-1"></i>
                                Keep your secret key private!
                            </p>
                        </div>
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
