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
</style>
