<script>
import Pageheader from "../../shared/components/pageheader/pageheader.vue";
import { useNotificationStore } from "../../stores/notifications";
import { ENTITY_LABELS } from "../../types/notification.types";

export default {
    name: 'Notifications',
    components: {
        Pageheader
    },
    setup() {
        const notifStore = useNotificationStore();
        notifStore.init();
        return { notifStore, ENTITY_LABELS };
    },
    data() {
        return {
            dataToPass: {
                title: { label: "Dashboards", path: "/dashboards" },
                currentpage: "Notifikasi",
                activepage: "Notifikasi"
            },
            activeTab: 'Semua',
            tabs: ['Semua', 'Belum Dibaca', 'Pembaruan Data', 'Sistem'],
        };
    },
    computed: {
        filteredNotifications() {
            return this.notifStore.filteredByTab(this.activeTab);
        },
        stats() {
            return this.notifStore.statCounts;
        }
    },
    methods: {
        markAsRead(id) {
            this.notifStore.markAsRead(id);
        },
        markAllAsRead() {
            this.notifStore.markAllAsRead();
        },
        deleteNotification(id) {
            this.notifStore.deleteEvent(id);
        },
        clearAllNotifications() {
            this.notifStore.clearAll();
        },
        getActionIcon(type) {
            switch(type) {
                case 'created': return 'ri-add-circle-line';
                case 'updated': return 'ri-edit-box-line';
                case 'deleted': return 'ri-delete-bin-line';
                default: return 'ri-notification-3-line';
            }
        },
        getActionBgClass(type) {
            switch(type) {
                case 'created': return 'action-bg-create';
                case 'updated': return 'action-bg-update';
                case 'deleted': return 'action-bg-delete';
                default: return 'action-bg-default';
            }
        },
        getAvatarColor(name) {
            const colors = ['avatar-blue','avatar-indigo','avatar-violet','avatar-purple','avatar-teal','avatar-cyan','avatar-green','avatar-amber','avatar-orange','avatar-red'];
            let hash = 0;
            for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
            return colors[Math.abs(hash) % colors.length];
        }
    }
}
</script>

<template>
    <!-- Page Header -->
    <Pageheader :propData="dataToPass" />

    <div class="row">
        <div class="col-xl-12">
            <div class="card custom-card gradient-header-card">
                <!-- Gradient Header -->
                <div class="card-header d-flex align-items-center justify-content-between gap-3 notif-header">
                    <div class="d-flex align-items-center gap-3">
                        <div class="header-icon-box">
                            <i class="ri-notification-3-line"></i>
                        </div>
                        <div>
                            <div class="card-title mb-0 text-white fw-bold header-card-title">Aktivitas Sistem</div>
                            <div class="header-subtitle mt-1">Pantau semua perubahan data dan aktivitas pengguna secara real-time</div>
                        </div>
                    </div>
                    <div class="d-flex align-items-center gap-2">
                        <span v-if="notifStore.connected" class="d-none d-sm-inline-flex align-items-center gap-1" style="font-size: 11px; color: rgba(255,255,255,0.6);">
                          
                        </span>
                        <button @click="markAllAsRead" class="notif-action-btn">
                            <i class="ri-check-double-line"></i> Tandai Semua Dibaca
                        </button>
                        <button @click="clearAllNotifications" class="notif-action-btn" title="Hapus Semua Notifikasi" style="color: #f87171;">
                            <i class="ri-delete-bin-line"></i> Hapus Semua
                        </button>
                    </div>
                </div>

                <div class="card-body p-4">
                    <!-- Stats Strip -->
                    <div class="stats-strip mb-4">
                        <div class="stat-card">
                            <div class="stat-icon stat-icon-blue"><i class="ri-notification-3-line"></i></div>
                            <div>
                                <div class="stat-value">{{ stats.total }}</div>
                                <div class="stat-label">Total Notifikasi</div>
                            </div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-icon stat-icon-violet"><i class="ri-mail-unread-line"></i></div>
                            <div>
                                <div class="stat-value">{{ stats.unread }}</div>
                                <div class="stat-label">Belum Dibaca</div>
                            </div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-icon stat-icon-teal"><i class="ri-edit-box-line"></i></div>
                            <div>
                                <div class="stat-value">{{ stats.updates }}</div>
                                <div class="stat-label">Pembaruan</div>
                            </div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-icon stat-icon-amber"><i class="ri-add-circle-line"></i></div>
                            <div>
                                <div class="stat-value">{{ stats.creates }}</div>
                                <div class="stat-label">Penambahan</div>
                            </div>
                        </div>
                    </div>

                    <!-- Tabs -->
                    <div class="notif-tabs mb-4">
                        <button v-for="tab in tabs" :key="tab" @click="activeTab = tab"
                            :class="['notif-tab-btn', { active: activeTab === tab }]">
                            {{ tab }}
                            <span v-if="tab === 'Belum Dibaca' && stats.unread > 0" class="notif-tab-badge">
                                {{ stats.unread }}
                            </span>
                        </button>
                    </div>

                    <!-- Loading -->
                    <div v-if="notifStore.loading" class="text-center py-5">
                        <div class="spinner-border text-primary" role="status">
                            <span class="visually-hidden">Loading...</span>
                        </div>
                        <p class="text-muted mt-2 fs-13">Memuat notifikasi...</p>
                    </div>

                    <!-- Notification List -->
                    <div v-else class="notif-list-wrap">
                        <template v-if="filteredNotifications.length > 0">
                            <div v-for="notif in filteredNotifications" :key="notif.id"
                                :class="['notif-item align-items-start', { 'notif-item-unread': !notif.isRead }]">

                                <!-- Unread bar -->
                                <div v-if="!notif.isRead" class="notif-unread-bar"></div>

                                <!-- Avatar + Action Badge -->
                                <div class="notif-avatar">
                                    <img v-if="notif.user?.avatar" :src="notif.user.avatar" alt="avatar" class="notif-avatar-circle object-fit-cover border border-1 border-light" />
                                    <div v-else :class="['notif-avatar-circle', getAvatarColor(notif.user?.name || 'U')]">
                                        {{ notif.avatarInitials }}
                                    </div>
                                    <div :class="['notif-action-badge', getActionBgClass(notif.type)]">
                                        <i :class="getActionIcon(notif.type)"></i>
                                    </div>
                                </div>

                                <!-- Content -->
                                <div class="notif-content">
                                    <div class="d-flex justify-content-between align-items-start gap-2 mb-1">
                                        <div>
                                            <span class="notif-action-text">
                                                <span class="notif-user-name">{{ notif.user?.name || 'Sistem' }}</span>
                                                <span class="notif-dept-badge">{{ notif.user?.role || 'system' }}</span>
                                                <span>{{ notif.actionVerb }}</span>
                                                <span class="notif-target">{{ notif.entity_name || 'data' }}</span>
                                                <span class="text-muted"> di {{ notif.entityLabel }}</span>
                                            </span>
                                        </div>
                                        <!-- Time (desktop) -->
                                        <div class="notif-time d-none d-sm-flex">
                                            <i class="ri-time-line"></i> {{ notif.timeAgoStr }}
                                        </div>
                                    </div>

                                    <!-- Info Box (field changes / message) -->
                                    <div v-if="notif.details" class="notif-details-box">
                                        {{ notif.details }}
                                    </div>

                                    <!-- Actions & Mobile Time -->
                                    <div class="d-flex align-items-center justify-content-between mt-2">
                                        <!-- Mobile time -->
                                        <div class="notif-time d-flex d-sm-none">
                                            <i class="ri-time-line"></i> {{ notif.timeAgoStr }}
                                        </div>

                                        <!-- Hover actions -->
                                        <div class="notif-hover-actions ms-auto">
                                            <button v-if="!notif.isRead" @click="markAsRead(notif.id)" class="notif-hover-btn notif-hover-btn-read">
                                                <i class="ri-check-line"></i> Tandai Dibaca
                                            </button>
                                            <button @click="deleteNotification(notif.id)" class="notif-hover-btn notif-hover-btn-delete" title="Hapus notifikasi ini">
                                                <i class="ri-delete-bin-line"></i> Hapus
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </template>

                        <!-- Empty State -->
                        <template v-else>
                            <div class="notif-empty">
                                <div class="empty-icon-ring mb-3">
                                    <div class="empty-icon-inner">
                                        <i class="ri-notification-off-line"></i>
                                    </div>
                                </div>
                                <h6 class="fw-semibold mb-1 empty-state-title">Tidak ada notifikasi</h6>
                                <p class="text-muted fs-13 mb-0" style="max-width: 320px;">
                                    <template v-if="notifStore.connected">
                                        Menunggu aktivitas sistem... Notifikasi akan muncul secara real-time.
                                    </template>
                                    <template v-else>
                                        Menghubungkan ke server notifikasi...
                                    </template>
                                </p>
                            </div>
                        </template>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>