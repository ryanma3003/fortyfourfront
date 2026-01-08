<script lang="ts">
import { defineComponent, ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import ParticlesJs from '../../../../shared/components/@spk/reuseble-plugin/particles-js.vue';

export default defineComponent({
  components: {
    ParticlesJs,
  },
  setup() {
    const email = ref('');
    const password = ref('');
    const showPassword = ref(false);

    const router = useRouter();

    const signUp = () => {
      // Add your sign up logic here
      router.push('/dashboards');
    };

    const setBodyClass = (action: string) => {
      if (action === 'add') {
        document.body.classList.add('authentication-background');
      } else {
        document.body.classList.remove('authentication-background');
      }
    };

    onMounted(() => {
      if (localStorage.getItem('visited') === 'true') {
        setBodyClass('add');
      } else {
        setBodyClass('add');
        localStorage.setItem('visited', 'true');
      }

      router.beforeEach(() => {
        setBodyClass('remove');
      });

      const handleBeforeUnload = () => {
        setBodyClass('remove');
        localStorage.removeItem('visited');
      };

      window.addEventListener('beforeunload', handleBeforeUnload, {
        passive: true,
      });

      return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload);
        setBodyClass('remove');
      };
    });

    return {
      email,
      password,
      showPassword,
      signUp,
    };
  },
});
</script>

<template>
  <div class="authentication-background">
    <ParticlesJs />
    <div class="container">
      <div class="row justify-content-center align-items-center authentication authentication-basic h-100">
        <div class="col-xxl-4 col-xl-5 col-lg-6 col-md-6 col-sm-8 col-12">
          <div class="card custom-card border-0 my-4">
            <div class="card-body p-5">
              <div class="mb-4 align-items-center d-flex justify-content-center">
                <img src="/images/brand-logos/logoLight.svg" alt="logo" id="logo-light" style="height: 50px; width: auto"/>
                <img src="/images/brand-logos/logoDark.svg" alt="logo" id="logo-dark" style="height: 50px; width: auto"/>
              </div>
              <div>
                <h4 class="mb-1 fw-semibold">Sign Up</h4>
                <p class="mb-4 text-muted fw-normal">
                  Join us by creating a free account!
                </p>
              </div>
              <div class="row gy-3">
                <div class="col-xl-12">
                  <label for="signup-email" class="form-label text-default">Email</label>
                  <input type="email" class="form-control form-control-lg" id="signup-email" v-model="email" placeholder="Enter Email" @keyup.enter="signUp"/>
                </div>
                <div class="col-xl-12 mb-2">
                  <label for="signup-password" class="form-label text-default d-block">Password</label>
                  <div class="position-relative">
                    <input :type="showPassword ? 'text' : 'password'" class="form-control form-control-lg" id="signup-password" v-model="password" placeholder="Password" @keyup.enter="signUp"/>
                    <a href="javascript:void(0);" @click="showPassword = !showPassword" class="show-password-button text-muted">
                      <i class="align-middle" :class="showPassword ? 'ri-eye-line' : 'ri-eye-off-line'"></i>
                    </a>
                  </div>
                </div>
              </div>
              <div class="d-grid mt-3">
                <button class="btn btn-primary btn-lg" @click="signUp">
                  Sign Up
                </button>
              </div>
              <div class="text-center mt-3 fw-medium">
                Already have an account?
                <router-link to="/auth/login" class="text-primary">Sign In</router-link>
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
</style>
