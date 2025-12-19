<script setup>
import { useRouter } from "vue-router";

const props = defineProps({
  analyticData: Object,
  csirtId: {
    type: [Number, String],
    default: null,
  },
  stakeholderSlug: {
    type: String,
    default: null,
  },
});

const router = useRouter();

const handleIkas = () => {
  if (props.stakeholderSlug) {
    router.push({ path: "/ikas", query: { slug: props.stakeholderSlug } });
  } else {
    router.push("/ikas");
  }
};
const handleCsirt = () => {
  if (props.csirtId) {
    router.push(`/csirt/${props.csirtId}`);
  } else {
    router.push("/csirt");
  }
};
</script>

<template>
  <div
    v-for="(item, index) in analyticData"
    :key="index"
    class="col-xxl-3 col-lg-6"
  >
    <div class="card custom-card">
      <div class="card-body">
        <div class="d-flex align-items-start gap-3">
          <div>
            <span
              :class="`avatar avatar-lg bg-${item.svgColor} svg-white`"
              v-html="item.svgIcon"
            ></span>
          </div>

          <div
            class="flex-grow-1 d-flex justify-content-between align-items-center"
          >
            <div>
              <span class="d-block text-muted">{{ item.title }}</span>
              <h5 class="fw-semibold mb-2">{{ item.value }}</h5>
            </div>
            <button
              v-if="item.title === 'IKAS'"
              class="btn btn-sm btn-outline-primary ms-2"
              @click="handleIkas"
            >
              Lihat Detail
            </button>
            <button
              v-if="item.title === 'CSIRT'"
              class="btn btn-sm btn-outline-primary ms-2"
              @click="handleCsirt"
            >
              Lihat Detail
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
