<script setup lang="ts">
// Session expiration is now handled natively by the api.ts interceptor
// when the backend returns 401 due to expired HTTP-only cookies.
</script>
<template>
  <router-view />
</template>
