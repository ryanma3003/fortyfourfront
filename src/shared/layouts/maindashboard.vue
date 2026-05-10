<script setup>
import {
  ref,
  reactive,
  onMounted,
  onBeforeUnmount,
  computed,
  watch
} from 'vue'
import { useRoute } from 'vue-router'

import { switcherStore } from '../../stores/switcher'
import Header from '../components/header/header.vue'
import Sidebar from '../components/sidebar/sidebar.vue'
import Footer from '../components/footer/footer.vue'
import Switcher from '../components/switcher/switcher.vue'
import BackToTop from '../components/backtotop/backtotop.vue'
import NotificationToast from '../../components/notifications/NotificationToast.vue'
import { useAuthStore } from '../../stores/auth'
import { useNotificationStore } from '../../stores/notifications'

// Reactive store
const switcher = reactive(switcherStore())
const authStore = useAuthStore()
const notifStore = useNotificationStore()
const route = useRoute()

// Computed class
const customClass = computed(() =>
  switcher.pageStyles === 'flat' ? 'main-body-container' : ''
)

const isFullWidthPage = computed(() => route.meta?.fullWidth === true)

// Scroll progress logic
const progressRef = ref(null)

const handleScroll = () => {
  const scrollTop = document.documentElement.scrollTop || document.body.scrollTop
  const scrollHeight =
    document.documentElement.scrollHeight - document.documentElement.clientHeight

  if (scrollHeight === 0) return

  const scrollPercent = (scrollTop / scrollHeight) * 100

  if (progressRef.value) {
    progressRef.value.style.width = `${scrollPercent}%`
  }
}

const startNotifications = () => {
  if (authStore.authenticated && authStore.isAdmin) {
    notifStore.init()
  }
}

onMounted(() => {
  window.addEventListener('scroll', handleScroll)
  switcher.retrieveFromLocalStorage()
  startNotifications()
})

watch(
  () => [authStore.authenticated, authStore.isAdmin],
  ([isAuthenticated, isAdmin]) => {
    if (isAuthenticated && isAdmin) {
      notifStore.init()
    } else if (!isAuthenticated) {
      notifStore.disconnect()
    }
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  window.removeEventListener('scroll', handleScroll)
})
</script>

<template>
  <div ref="progressRef" class="progress-top-bar"></div>
  <Switcher />
  <div class="page">
    <Header />
    <Sidebar />

    <!-- Start::app-content -->
    <div :class="['main-content', 'app-content', { 'dashboard-full-width-content': isFullWidthPage }]">
      <div :class="['container-fluid', 'page-container', customClass, { 'dashboard-full-width-container': isFullWidthPage }]">
        <router-view />
      </div>
    </div>
    <!-- End::app-content -->

    <Footer />
  </div>
  <BackToTop />
  <NotificationToast />
</template>

<style scoped lang="scss">
:global(html[data-theme-mode="dark"]),
:global(html[data-theme-mode="dark"] body) {
  background: rgb(var(--body-bg-rgb2, 5, 9, 20)) !important;
}

:global(html[data-theme-mode="dark"] .page),
:global(html[data-theme-mode="dark"] .main-content.app-content),
:global(html[data-theme-mode="dark"] .main-content.app-content > .page-container) {
  background-color: rgb(var(--body-bg-rgb2, 5, 9, 20)) !important;
}

:global(html[data-theme-mode="dark"] .app-content .main-body-container) {
  background-color: rgb(var(--body-bg-rgb, 11, 18, 32)) !important;
  border-color: rgba(255, 255, 255, 0.1) !important;
}

:global([data-width=default] .main-content.app-content.dashboard-full-width-content),
:global(.main-content.app-content.dashboard-full-width-content) {
  padding-inline: 0.75rem !important;
}

:global(.main-content.app-content > .page-container.dashboard-full-width-container) {
  background: transparent !important;
  border: 0 !important;
  border-radius: 0 !important;
  box-shadow: none !important;
  max-width: none !important;
  width: 100% !important;
  margin-inline: 0 !important;
}

:global(.main-content.app-content > .page-container.dashboard-full-width-container.main-body-container) {
  padding: 0 !important;
  padding-block-end: 0 !important;
}

@media (min-width: 1800px) {
  :global(.main-content.app-content > .container-fluid.dashboard-full-width-container) {
    max-width: none !important;
    padding-inline: 1.5rem !important;
  }
}

@media (max-width: 991.98px) {
  :global(.main-content.app-content.dashboard-full-width-content) {
    padding-inline: 0 !important;
  }
}
</style>
