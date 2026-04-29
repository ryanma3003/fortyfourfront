<template>
  <div class="page-header-breadcrumb mb-3">
    <div class="d-flex align-center justify-content-between flex-wrap gap-1">
      <h1 class="page-title fw-medium fs-18 mb-0">
        {{ propData?.activepage }}
      </h1>

      <ol class="breadcrumb mb-0">
        <!-- TITLE (CLICKABLE) -->
        <li class="breadcrumb-item">
          <a
            href="javascript:void(0);"
            class="text-primary"
            style="cursor:pointer"
            @click="goToTitle"
          >
            {{ propData?.title?.label }}
          </a>
        </li>

        <!-- SUBTITLE -->
        <li class="breadcrumb-item" v-if="propData?.subtitle">
          <a href="javascript:void(0);">
            {{ propData?.subtitle }}
          </a>
        </li>

        <!-- CURRENT PAGE -->
        <li class="breadcrumb-item active" aria-current="page">
          {{ propData?.currentpage }}
        </li>
      </ol>
    </div>
  </div>
</template>

<script setup>
import { useRouter } from "vue-router";

const props = defineProps({
  propData: Object,
});

const router = useRouter();

const goToTitle = () => {
  if (props.propData?.title?.path) {
    router.push(props.propData.title.path);
  }
};
</script>

<style>
/* optional */
.breadcrumb-item a:hover {
  text-decoration: underline;
}

/* Dark mode overrides for breadcrumb */
[data-theme-mode='dark'] .breadcrumb-item a.text-primary {
  color: #60a5fa !important; /* Lighter, readable blue */
}
[data-theme-mode='dark'] .page-title,
[data-theme-mode='dark'] .breadcrumb-item.active,
[data-theme-mode='dark'] .breadcrumb-item::before {
  color: #f1f5f9 !important;
}
</style>
