<script setup>
import { computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useNotificationStore } from '@/stores/notifications';

const router = useRouter();
const notifStore = useNotificationStore();
const props = defineProps({
    loading: { type: Boolean, default: false },
});

const initFeed = () => {
    notifStore.init();
};

onMounted(() => {
    if (!props.loading) initFeed();
});

watch(() => props.loading, (loading) => {
    if (!loading) initFeed();
});

const recentEvents = computed(() => {
    if (props.loading) return [];
    return notifStore.enhancedEvents.slice(0, 20);
});

function getAvatarColor(type) {
    switch (type) {
        case 'created': return 'linear-gradient(135deg, #26bf94, #6ee7b7)';
        case 'deleted': return 'linear-gradient(135deg, #e6533c, #f87171)';
        default: return 'linear-gradient(135deg, #1e40af, #3b82f6)';
    }
}

function goToNotifications() {
    router.push('/notif');
}
</script>

<template>
    <div class="dw-card dw-fade-up">
        <div class="dw-card-header">
            <h6 class="dw-card-header-title">
                <div class="dw-card-header-icon" style="background: linear-gradient(135deg, #26bf94, #14b8a6); color: #fff;">
                    <i class="ri-pulse-line"></i>
                </div>
                <div>
                    <span>Aktivitas Terbaru</span>
                    <div class="dw-card-header-sub">Real-time activity feed</div>
                </div>
            </h6>
            <div class="d-flex align-items-center gap-2">
                <span v-if="notifStore.unreadCount > 0" class="dw-badge dw-badge-warning">
                    {{ notifStore.unreadCount }} baru
                </span>
            </div>
        </div>
        <div class="dw-card-body" style="padding: 8px 16px;">
            <div v-if="loading" class="dw-activity-scroll-container placeholder-glow">
                <div v-for="n in 5" :key="'activity-skeleton-' + n" class="dw-activity-item">
                    <span class="placeholder" style="width:36px;height:36px;border-radius:10px;"></span>
                    <div class="flex-grow-1" style="min-width: 0;">
                        <span class="placeholder col-6 d-block mb-2" style="height:12px;border-radius:6px;"></span>
                        <span class="placeholder col-10 d-block" style="height:10px;border-radius:6px;"></span>
                    </div>
                    <span class="placeholder" style="width:58px;height:10px;border-radius:6px;"></span>
                </div>
            </div>
            <!-- Empty state -->
            <div v-else-if="recentEvents.length === 0" class="text-center py-4">
                <i class="ri-inbox-line" style="font-size:2rem; color:var(--dw-text-muted); opacity:0.5;"></i>
                <p style="font-size:0.8rem; color:var(--dw-text-muted); margin-top:8px;">Belum ada aktivitas</p>
            </div>

            <!-- Activity list -->
            <div v-else class="dw-activity-scroll-container">
                <div v-for="(event, idx) in recentEvents" :key="event.id"
                     class="dw-activity-item dw-slide-in"
                     :style="{ animationDelay: `${idx * 50}ms` }"
                     @click="notifStore.markAsRead(event.id)">
                    <div class="dw-activity-avatar" :style="{ background: getAvatarColor(event.type) }">
                        {{ event.avatarInitials }}
                    </div>
                    <div class="flex-grow-1" style="min-width: 0;">
                        <div class="d-flex align-items-center gap-1" style="flex-wrap: wrap;">
                            <span style="font-size:0.82rem; font-weight:600; color:var(--dw-text);">
                                {{ event.user?.name || 'Sistem' }}
                            </span>
                            <span style="font-size:0.75rem; color:var(--dw-text-secondary);">
                                {{ event.actionVerb }}
                            </span>
                            <span class="dw-badge" :class="{
                                'dw-badge-success': event.type === 'created',
                                'dw-badge-info': event.type === 'updated',
                                'dw-badge-critical': event.type === 'deleted',
                            }" style="padding:2px 6px; font-size:0.62rem;">
                                {{ event.entityLabel }}
                            </span>
                        </div>
                        <div v-if="event.entity_name" style="font-size:0.72rem; color:var(--dw-text-muted); margin-top:2px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                            {{ event.entity_name }}
                        </div>
                        <div v-if="event.details" style="font-size:0.68rem; color:var(--dw-text-muted); margin-top:1px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                            {{ event.details }}
                        </div>
                    </div>
                    <div class="d-flex flex-column align-items-end gap-1">
                        <span class="dw-activity-time">{{ event.timeAgoStr }}</span>
                        <div v-if="!event.isRead" class="dw-live-dot" style="width:6px;height:6px;"></div>
                    </div>
                </div>
            </div>

            <!-- Footer -->
            <div class="text-center mt-2 mb-1" v-if="recentEvents.length > 0">
                <button class="btn btn-sm btn-light" style="font-size:0.75rem; border-radius:8px; font-weight:600;" @click="goToNotifications">
                    Lihat Semua Aktivitas <i class="ri-arrow-right-s-line"></i>
                </button>
            </div>
        </div>
    </div>
</template>

<style scoped>
.dw-activity-scroll-container {
    max-height: 290px; /* Approximately 5 items height */
    overflow-y: auto;
    overflow-x: hidden;
    padding-right: 4px;
    margin-right: -4px;
}

/* Custom scrollbar for a premium look */
.dw-activity-scroll-container::-webkit-scrollbar {
    width: 4px;
}
.dw-activity-scroll-container::-webkit-scrollbar-track {
    background: transparent;
}
.dw-activity-scroll-container::-webkit-scrollbar-thumb {
    background: rgba(0,0,0,0.05);
    border-radius: 10px;
}
.dw-activity-scroll-container:hover::-webkit-scrollbar-thumb {
    background: rgba(0,0,0,0.1);
}
</style>
