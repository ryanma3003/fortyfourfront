<script setup>
import { useRouter } from 'vue-router';

const router = useRouter();
const emit = defineEmits(['refresh-data']);

const actions = [
    { icon: 'ri-refresh-line', label: 'Refresh Data', event: 'refresh-data', primary: false },
];

function handleAction(action) {
    if (action.route) {
        router.push(action.route);
    } else if (action.event) {
        emit(action.event);
    }
}
</script>

<template>
    <div class="dw-quick-actions">
        <button v-for="action in actions" :key="action.label"
                class="dw-quick-btn"
                :class="{ 'dw-quick-btn-primary': action.primary }"
                @click="handleAction(action)">
            <i :class="action.icon"></i>
            <span class="d-none d-md-inline">{{ action.label }}</span>
        </button>
    </div>
</template>
