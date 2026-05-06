<script setup>
import { computed, ref, onMounted, onUnmounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useNotificationStore } from '@/stores/notifications';

const router = useRouter();
const notifStore = useNotificationStore();
const props = defineProps({
    loading: { type: Boolean, default: false },
});
const isDarkMode = ref(false);
let themeObserver;

function syncThemeMode() {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const body = document.body;
    isDarkMode.value =
        root.getAttribute('data-theme-mode') === 'dark' ||
        body?.getAttribute('data-theme-mode') === 'dark' ||
        root.classList.contains('dark') ||
        body?.classList.contains('dark');
}

const initFeed = () => {
    notifStore.init();
};

onMounted(() => {
    syncThemeMode();
    themeObserver = new MutationObserver(syncThemeMode);
    themeObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['data-theme-mode', 'class'],
    });
    if (document.body) {
        themeObserver.observe(document.body, {
            attributes: true,
            attributeFilter: ['data-theme-mode', 'class'],
        });
    }
    if (!props.loading) initFeed();
});

onUnmounted(() => {
    themeObserver?.disconnect();
});

watch(() => props.loading, (loading) => {
    if (!loading) initFeed();
});

const recentEvents = computed(() => {
    if (props.loading) return [];
    return notifStore.enhancedEvents.slice(0, 20);
});

const eventStats = computed(() => {
    const events = recentEvents.value;
    const unread = events.filter(event => !event.isRead).length;
    const created = events.filter(event => event.type === 'created').length;
    const updated = events.filter(event => event.type === 'updated').length;
    const deleted = events.filter(event => event.type === 'deleted').length;

    return { unread, created, updated, deleted, total: events.length };
});

const feedGroups = computed(() => ([
    { key: 'all', label: 'Semua', count: recentEvents.value.length },
    { key: 'unread', label: 'Unread', count: eventStats.value.unread },
    { key: 'updated', label: 'Update', count: eventStats.value.updated },
    { key: 'critical', label: 'Hapus', count: eventStats.value.deleted },
]));

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

async function markAllRead() {
    await notifStore.markAllAsRead();
}
</script>

<template>
    <div class="dw-card dw-fade-up activity-dashboard-card" :class="{ 'is-dark': isDarkMode }">
        <div class="dw-card-header">
            <h6 class="dw-card-header-title">
                <div class="dw-card-header-icon" style="background: linear-gradient(135deg, #26bf94, #14b8a6); color: #fff;">
                    <i class="ri-pulse-line"></i>
                </div>
                <div>
                    <span>Activity Feed</span>
                    <div class="dw-card-header-sub">Perubahan terbaru dari sistem</div>
                </div>
            </h6>
            <div class="d-flex align-items-center gap-2 flex-wrap justify-content-end">
                <span v-if="notifStore.unreadCount > 0" class="dw-badge dw-badge-warning">
                    {{ notifStore.unreadCount }} unread
                </span>
                <button class="feed-top-button" @click="markAllRead" :disabled="notifStore.unreadCount === 0">
                    Tandai semua
                </button>
            </div>
        </div>
        <div class="dw-card-body feed-body">
            <div v-if="loading" class="dw-activity-scroll-container placeholder-glow">
                <div class="feed-stats-skeleton">
                    <span class="placeholder col-3" style="height:30px;border-radius:10px;"></span>
                    <span class="placeholder col-3" style="height:30px;border-radius:10px;"></span>
                    <span class="placeholder col-3" style="height:30px;border-radius:10px;"></span>
                </div>
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
                <div class="feed-stats">
                    <div v-for="group in feedGroups" :key="group.key" class="feed-stat-chip">
                        <strong>{{ group.count }}</strong>
                        <span>{{ group.label }}</span>
                    </div>
                </div>
                <div v-for="(event, idx) in recentEvents" :key="event.id"
                     class="dw-activity-item dw-slide-in"
                     :style="{ animationDelay: `${idx * 50}ms` }"
                     :class="{ 'is-unread': !event.isRead }"
                     @click="notifStore.markAsRead(event.id)">
                    <div class="dw-activity-avatar" :style="{ background: getAvatarColor(event.type) }">
                        {{ event.avatarInitials }}
                    </div>
                    <div class="feed-event-main">
                        <div class="d-flex align-items-center gap-1" style="flex-wrap: wrap;">
                            <span class="feed-actor">
                                {{ event.user?.name || 'Sistem' }}
                            </span>
                            <span class="feed-verb">
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
                        <div class="feed-target" v-if="event.targetLabel">
                            {{ event.targetLabel }}
                        </div>
                        <div v-if="event.details" class="feed-details">
                            {{ event.details }}
                        </div>
                    </div>
                    <div class="d-flex flex-column align-items-end gap-1 feed-meta">
                        <span class="dw-activity-time">{{ event.timeAgoStr }}</span>
                        <div v-if="!event.isRead" class="dw-live-dot" style="width:6px;height:6px;"></div>
                    </div>
                </div>
            </div>

            <!-- Footer -->
            <div class="text-center mt-2 mb-1" v-if="recentEvents.length > 0">
                <button class="feed-footer-button" @click="goToNotifications">
                    Lihat semua aktivitas <i class="ri-arrow-right-s-line"></i>
                </button>
            </div>
        </div>
    </div>
</template>

<style scoped>
.feed-body {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    padding: 8px 16px;
}

.activity-dashboard-card.is-dark {
    color-scheme: dark;
    background: #151a2b;
    border-color: rgba(148, 163, 184, 0.22);
    box-shadow:
        0 16px 38px rgba(0, 0, 0, 0.26),
        inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.activity-dashboard-card.is-dark .dw-card-header {
    border-bottom-color: rgba(148, 163, 184, 0.16);
    background: linear-gradient(180deg, rgba(23, 30, 48, 0.98), rgba(21, 26, 43, 0.96));
}

.activity-dashboard-card.is-dark .dw-card-header-title,
.activity-dashboard-card.is-dark .feed-stat-chip strong,
.activity-dashboard-card.is-dark .feed-actor {
    color: #eef4ff;
}

.activity-dashboard-card.is-dark .dw-card-header-sub,
.activity-dashboard-card.is-dark .feed-stat-chip span,
.activity-dashboard-card.is-dark .feed-verb,
.activity-dashboard-card.is-dark .feed-target,
.activity-dashboard-card.is-dark .feed-details,
.activity-dashboard-card.is-dark .dw-activity-time {
    color: #94a3b8;
}

.activity-dashboard-card.is-dark .dw-card-header-icon {
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1);
}

.activity-dashboard-card.is-dark .dw-card-body {
    background:
        radial-gradient(circle at 12% 0%, rgba(20, 184, 166, 0.12), transparent 34%),
        linear-gradient(180deg, #151a2b 0%, #111827 100%);
}

.activity-dashboard-card.is-dark .feed-top-button,
.activity-dashboard-card.is-dark .feed-footer-button {
    background: rgba(15, 23, 42, 0.86);
    border-color: rgba(147, 197, 253, 0.22);
    color: #93c5fd;
}

.activity-dashboard-card.is-dark .feed-top-button:not(:disabled):hover,
.activity-dashboard-card.is-dark .feed-footer-button:hover {
    background: #2563eb;
    border-color: #60a5fa;
    color: #ffffff;
}

.activity-dashboard-card.is-dark .feed-stat-chip {
    background: rgba(15, 23, 42, 0.78);
    border-color: rgba(148, 163, 184, 0.16);
}

.activity-dashboard-card.is-dark .dw-activity-item {
    border-bottom-color: rgba(148, 163, 184, 0.14);
}

.activity-dashboard-card.is-dark .dw-activity-item:hover {
    background: rgba(37, 99, 235, 0.1);
}

.activity-dashboard-card.is-dark .dw-activity-item.is-unread {
    background: linear-gradient(90deg, rgba(37, 99, 235, 0.16), rgba(15, 23, 42, 0.18) 34%, transparent 70%);
    border-radius: 10px;
}

.activity-dashboard-card.is-dark .dw-activity-avatar {
    box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.12),
        0 8px 18px rgba(0, 0, 0, 0.22);
}

.activity-dashboard-card.is-dark .dw-activity-scroll-container {
    scrollbar-color: rgba(96, 165, 250, 0.42) transparent;
}

.activity-dashboard-card.is-dark .dw-activity-scroll-container::-webkit-scrollbar-thumb {
    background: rgba(96, 165, 250, 0.28);
}

.activity-dashboard-card.is-dark .dw-activity-scroll-container:hover::-webkit-scrollbar-thumb {
    background: rgba(96, 165, 250, 0.48);
}

.activity-dashboard-card {
    height: 100%;
    max-height: 608px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

.feed-top-button,
.feed-footer-button {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    border: 1px solid rgba(var(--dw-primary-rgb), 0.16);
    background: rgba(var(--dw-primary-rgb), 0.06);
    color: var(--dw-primary);
    border-radius: 8px;
    font-size: 0.73rem;
    font-weight: 700;
    padding: 0.4rem 0.7rem;
}

.feed-top-button:disabled {
    opacity: 0.5;
}

.feed-stats,
.feed-stats-skeleton {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
    margin-bottom: 10px;
}

.feed-stat-chip {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
    padding: 8px 10px;
    border-radius: 10px;
    border: 1px solid var(--dw-card-border);
    background: rgba(var(--dw-primary-rgb), 0.03);
}

.feed-stat-chip strong {
    font-size: 0.9rem;
    color: var(--dw-text);
}

.feed-stat-chip span,
.feed-verb,
.feed-target,
.feed-details {
    font-size: 0.7rem;
    color: var(--dw-text-muted);
}

.feed-event-main {
    flex: 1;
    min-width: 0;
}

.feed-actor {
    font-size: 0.82rem;
    font-weight: 700;
    color: var(--dw-text);
}

.feed-target,
.feed-details {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    margin-top: 2px;
}

.dw-activity-item.is-unread {
    padding-left: 10px;
    background: linear-gradient(90deg, rgba(37, 99, 235, 0.06), transparent 28%);
    border-radius: 10px;
}

.feed-meta {
    flex-shrink: 0;
}

.feed-footer-button {
    justify-content: center;
    width: 100%;
    margin-top: 4px;
}

.dw-activity-scroll-container {
    flex: 1;
    min-height: 0;
    max-height: none;
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

@media (max-width: 480px) {
    .feed-stats {
        grid-template-columns: 1fr;
    }

    .dw-activity-item {
        align-items: flex-start;
    }
}
</style>
