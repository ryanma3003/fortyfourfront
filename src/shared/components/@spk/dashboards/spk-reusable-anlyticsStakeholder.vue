<script setup>
defineProps({
    analyticData: Object,
})


</script>

<template>
    <div v-for="(item, index) in analyticData" :key="index" class="col-xxl-3 col-lg-6">
    <div class="card custom-card">
        <div class="card-body">
            <div class="d-flex align-items-start gap-3">
                <div>
                    <span :class="`avatar avatar-lg bg-${item.svgColor} svg-white`" v-html="item.svgIcon">
                        
                    </span>
                </div>
                <div>
                    <span class="d-block text-muted">{{ item.title }}</span>
                    <h5 class="fw-semibold mb-1">{{ item.value }}</h5>
                </div>
            </div>
        </div>
    </div>
</div>
</template>