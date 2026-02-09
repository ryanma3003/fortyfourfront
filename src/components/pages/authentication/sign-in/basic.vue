<script lang="ts" setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import PasswordInput from '@/shared/UI/passwordInput.vue';

const router = useRouter();
const authStore = useAuthStore();

const email = ref('');
const password = ref('');
const rememberMe = ref(false);

const handleLogin = async () => {
    if (!email.value || !password.value) {
        return;
    }

    const result = await authStore.authenticateUser({
        email: email.value,
        password: password.value,
    });
    
    console.log('Login result:', result);

    if (result.authenticated) {
        console.log('Authenticated! Redirecting based on role...');
        try {
            // Redirect based on user role
            const userRole = authStore.userRole;
            const redirectPath = userRole === 'admin' ? '/admin' : '/dashboard';
            await router.push(redirectPath);
            console.log(`Redirect called to ${redirectPath}`);
        } catch (e) {
            console.error('Redirect failed:', e);
        }
    } else {
        console.log('Not authenticated.');
    }
};

const updatePassword = (val: string) => {
    password.value = val;
};
</script>

<template>
    <div class="authentication-background">
        
        <div class="container">
            <div class="row justify-content-center align-items-center authentication authentication-basic h-100">
                <div class="col-xxl-4 col-xl-5 col-lg-6 col-md-6 col-sm-8 col-12">
                    <div class="card custom-card border-0 my-4">
                        <div class="card-body p-5">
                            <div class="mb-4 align-items-center d-flex justify-content-center">
                                <img src="/images/brand-logos/logoLight.svg" alt="logo" id="logo-desktop" style="height:50px; width:auto;">
                            </div>
                            <div>
                                <h4 class="mb-1 fw-semibold">Hi,Welcome back!</h4>
                                <p class="mb-4 text-muted fw-normal">Please enter your credentials</p>
                            </div>
                            <div v-if="authStore.error" class="alert alert-danger mb-3">
                                {{ authStore.error }}
                            </div>
                            <div class="row gy-3">
                                <div class="col-xl-12">
                                    <label for="signin-email" class="form-label text-default">Email</label>
                                    <input v-model="email" type="email" class="form-control" id="signin-email" placeholder="Enter Email">
                                </div>
                                <div class="col-xl-12 mb-2">
                                    <label for="signin-password"
                                        class="form-label text-default d-block">Password</label>
                                    <div class="position-relative">
                                        <PasswordInput 
                                            :initialValue="password" 
                                            name="password" 
                                            id="password"
                                            placeholder="Enter Password" 
                                            @input="updatePassword"
                                        />
                                    </div>
                                    <div class="mt-2">
                                        <div class="form-check custom-login">
                                            <input v-model="rememberMe" class="form-check-input" type="checkbox" id="rememberMe">
                                            <label class="form-check-label" for="rememberMe">
                                                Remember me
                                            </label>
                                            <router-link to="/pages/authentication/reset-password/basic"
                                                class="float-end link-danger fw-medium fs-12">Forget password
                                                ?</router-link>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="d-grid mt-3">
                                <button 
                                    @click="handleLogin" 
                                    class="btn btn-primary" 
                                    :disabled="authStore.loading"
                                >
                                    <span v-if="authStore.loading" class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                    {{ authStore.loading ? 'Signing In...' : 'Sign In' }}
                                </button>
                            </div>
                            <div class="text-center mt-3 fw-medium">
                                Dont have an account? <router-link to="/pages/authentication/sign-up/basic"
                                    class="text-primary">Register Here</router-link>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
/* Add your styles here */
</style>