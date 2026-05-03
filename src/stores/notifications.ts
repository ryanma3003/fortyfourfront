import { defineStore } from 'pinia';
import { notificationService } from '@/services/notification.service';
import { ENTITY_LABELS, ACTION_VERBS } from '@/types/notification.types';
import type { ServerEvent, NotificationStats } from '@/types/notification.types';

import { useAuthStore } from './auth';
import { useUsersStore } from './users';
import { formatImageUrl } from '@/utils/media';

// ─── Constants ───────────────────────────────────────────────────────
const MAX_EVENTS = 200;
const POLL_INTERVAL_MS = 30_000;

/**
 * Frontend-generated SSE items always use the "sse-" prefix.
 * Anything else is treated as a backend-owned notification ID and
 * should be allowed for mark-read / delete API calls.
 */
function isTemporarySseId(id: string): boolean {
    return String(id).startsWith('sse-');
}

function isRealDbId(id: string): boolean {
    return !!id && !isTemporarySseId(id);
}

function getBackendNotificationId(event?: Pick<ServerEvent, 'id' | 'api_id'> | null): string {
    if (!event) return '';
    const candidate = String(event.api_id || event.id || '');
    return isRealDbId(candidate) ? candidate : '';
}

// ─── Helpers ─────────────────────────────────────────────────────────

function timeAgo(isoDate: string, nowOverride?: number): string {
    const now = nowOverride || Date.now();
    let then = new Date(isoDate).getTime();
    if (isNaN(then)) return '';

    // Calculate diff
    let diff = now - then;

    // Timezone mismatch detection:
    // If the date is more than 1 minute in the future, it's likely that the server 
    // sent a local time string but labeled it as UTC (with 'Z').
    // We try to fix this by parsing it as local time.
    if (diff < -60000) {
        const localThen = new Date(isoDate.replace('Z', '')).getTime();
        if (!isNaN(localThen)) {
            const localDiff = now - localThen;
            // If localDiff is more "sensible" (positive and not too old), use it.
            if (localDiff >= 0 && localDiff < 24 * 60 * 60 * 1000) {
                then = localThen;
                diff = localDiff;
            }
        }
    }

    const seconds = Math.floor(diff / 1000);
    
    // Treat any remaining slight future or very recent past as 'Baru saja'
    if (seconds < 60) return 'Baru saja';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} menit yang lalu`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} jam yang lalu`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} hari yang lalu`;
    const weeks = Math.floor(days / 7);
    if (weeks < 4) return `${weeks} minggu yang lalu`;
    const months = Math.floor(days / 30);
    return `${months} bulan yang lalu`;
}

const FIELD_LABELS: Record<string, string> = {
    name: 'nama', nama: 'nama', username: 'username', email: 'email',
    jabatan: 'jabatan', id_jabatan: 'posisi/jabatan',
    role: 'hak akses', role_name: 'hak akses',
    phone: 'nomor telepon', no_telepon: 'nomor telepon',
    location: 'lokasi', alamat: 'alamat',
    photo: 'foto profil', foto_profile: 'foto profil',
    banner: 'banner profil', password: 'kata sandi',
    nama_csirt: 'nama CSIRT', id_perusahaan: 'instansi/perusahaan',
    dikutip_dari: 'sumber kutipan', photo_csirt: 'logo CSIRT',
    file_rfc2350: 'dokumen RFC2350', file_public_key_pgp: 'Public Key PGP',
    domain: 'domain', kategori: 'kategori', sub_kategori: 'sub-kategori',
    identifikasi: 'identifikasi', proteksi: 'proteksi',
    nilai: 'nilai', status: 'status', keterangan: 'keterangan',
};

const ENTITY_ALIASES: Record<string, string> = {
    stakeholders: 'stakeholder',
    users: 'user',
    roles: 'role',
    pics: 'pic',
    pic_perusahaan: 'pic',
    picperusahaan: 'pic',
    person_in_charge: 'pic',
    'person-in-charge': 'pic',
    csirts: 'csirt',
    csirtmember: 'csirt',
    csirt_member: 'csirt',
    sdms: 'sdm_csirt',
    sdmcsirt: 'sdm_csirt',
    sdm: 'sdm_csirt',
    ses: 'se_csirt',
    secsirt: 'se_csirt',
    se: 'se_csirt',
    'sistem elektronik': 'se_csirt',
    sistem_elektronik: 'se_csirt',
    se_edit_requests: 'se_edit_request',
    se_edit_request: 'se_edit_request',
    edit_request_se: 'se_edit_request',
    sektors: 'sektor',
    sub_sektors: 'sub_sektor',
    subsektor: 'sub_sektor',
    sub_sektor: 'sub_sektor',
    kelas: 'kelas',
    materi: 'materi',
    file_pendukung: 'file_pendukung',
    'file-pendukung': 'file_pendukung',
    kuis: 'kuis',
    quiz: 'kuis',
    quizzes: 'kuis',
    soal: 'soal',
    aktivitas: 'aktivitas',
    kegiatans: 'kegiatan',
    kegiatan: 'kegiatan',
    ruang_lingkup: 'ruang_lingkup',
    'ruang-lingkup': 'ruang_lingkup',
    kategori: 'category',
    kategoris: 'category',
    sub_kategori: 'sub_category',
    'sub-kategori': 'sub_category',
    pertanyaan_identifikasi: 'pertanyaan_ikas',
    pertanyaan_proteksi: 'pertanyaan_ikas',
    pertanyaan_deteksi: 'pertanyaan_ikas',
    pertanyaan_gulih: 'pertanyaan_ikas',
    jawaban_identifikasi: 'jawaban_ikas',
    jawaban_proteksi: 'jawaban_ikas',
    jawaban_deteksi: 'jawaban_ikas',
    jawaban_gulih: 'jawaban_ikas',
    identifikasi: 'ikas',
    proteksi: 'ikas',
    deteksi: 'ikas',
    gulih: 'ikas',
    casbin: 'casbin_policy',
    policy: 'casbin_policy',
    policies: 'casbin_policy',
};

function normalizeEntityKey(value: any): string {
    const key = String(value || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '_');

    if (!key) return 'unknown';
    return ENTITY_ALIASES[key] || key;
}

function getEntityDisplayLabel(entity: string): string {
    if (!entity || entity === 'unknown') return 'Data';
    return ENTITY_LABELS[entity] || entity.replace(/_/g, ' ');
}

function isPlaceholderRole(role?: string): boolean {
    const normalized = String(role || '').trim().toLowerCase();
    return !normalized || normalized === 'system' || normalized === 'sistem' || normalized === 'unknown';
}

function buildNotificationTarget(entity: string, entityName?: string): string {
    const label = getEntityDisplayLabel(entity);
    const name = String(entityName || '').trim();
    if (!name) return entity === 'unknown' ? 'data' : label;

    return name.toLowerCase().startsWith(label.toLowerCase())
        ? name
        : `${label} ${name}`;
}

function formatValue(val: any): string {
    if (val === null || val === undefined) return 'kosong';
    if (typeof val === 'boolean') return val ? 'ya' : 'tidak';
    if (typeof val === 'object') return 'data kompleks';
    const str = String(val);
    return str.length > 30 ? `'${str.substring(0, 30)}...'` : `'${str}'`;
}

function buildFieldChangeDetail(changes: any): string {
    if (!changes) return '';
    let parsed: Array<{ field: string; old_value: any; new_value: any }> = [];
    if (Array.isArray(changes)) {
        if (typeof changes[0] === 'string') return changes.join(', ');
        parsed = changes;
    } else if (typeof changes === 'object') {
        for (const [key, val] of Object.entries(changes)) {
            if (val && typeof val === 'object' && ('old' in val || 'new' in val || 'old_value' in val)) {
                parsed.push({ field: key, old_value: (val as any).old ?? (val as any).old_value, new_value: (val as any).new ?? (val as any).new_value });
            } else {
                parsed.push({ field: key, old_value: null, new_value: val });
            }
        }
    }
    const ignored = ['updated_at', 'created_at', 'id', 'user_id', 'actor_id'];
    const valid = parsed.filter(c => c.field && !ignored.includes(c.field.toLowerCase()));
    if (valid.length === 0) return '';
    return valid.slice(0, 3).map(c => {
        const label = FIELD_LABELS[c.field.toLowerCase()] || c.field.replace(/_/g, ' ');
        if (c.old_value != null && c.new_value != null) return `mengubah ${label} dari ${formatValue(c.old_value)} menjadi ${formatValue(c.new_value)}`;
        if (c.new_value != null) return `mengatur ${label} menjadi ${formatValue(c.new_value)}`;
        return `menghapus data ${label}`;
    }).join(', ') + (valid.length > 3 ? `, dan ${valid.length - 3} kolom lainnya` : '');
}

// ─── User Resolution ─────────────────────────────────────────────────

function resolveUser(userId: string): { id: string; name: string; role: string; avatar?: string } | null {
    if (!userId) return null;

    try {
        const usersStore = useUsersStore();
        const found = usersStore.getUserById(userId);
        if (found) {
            return {
                id: String(found.id),
                name: found.name || found.username || 'User',
                role: found.role || 'user',
                avatar: formatImageUrl(found.photo || (found as any).foto_profile) || undefined,
            };
        }
    } catch { /* store not ready */ }

    try {
        const authStore = useAuthStore();
        if (authStore.currentUser && String(authStore.currentUser.id) === String(userId)) {
            return {
                id: String(authStore.currentUser.id),
                name: authStore.currentUser.name || authStore.currentUser.username || 'Saya',
                role: authStore.currentUser.role || 'user',
                avatar: authStore.currentUser.foto_profile ? formatImageUrl(authStore.currentUser.foto_profile) : undefined,
            };
        }
    } catch { /* store not ready */ }

    return null;
}

/** Get the current user's info from authStore */
function getCurrentUser(): { id: string; name: string; role: string; avatar?: string } | null {
    try {
        const authStore = useAuthStore();
        if (authStore.currentUser) {
            return {
                id: String(authStore.currentUser.id),
                name: authStore.currentUser.name || authStore.currentUser.username || 'Saya',
                role: authStore.currentUser.role || 'user',
                avatar: authStore.currentUser.foto_profile ? formatImageUrl(authStore.currentUser.foto_profile) : undefined,
            };
        }
    } catch { /* ignore */ }
    return null;
}

// ─── Normalizer ──────────────────────────────────────────────────────

const NOISE_TYPES = new Set(['ping', 'heartbeat', 'keepalive', 'keep-alive', 'connection', 'connected', 'welcome']);

/**
 * Normalize a raw notification (from DB or SSE) into our ServerEvent interface.
 *
 * Handles two shapes:
 *  A. Minimal DB record: { id, message, type, read, created_at, user_id? }
 *  B. Rich SSE event:    { type, entity, entity_id, message, ... } — often NO id, NO user
 */
function normalizeToServerEvent(raw: any): ServerEvent | null {
    if (!raw || typeof raw !== 'object') return null;

    let parsedData = raw.data;
    if (typeof parsedData === 'string') {
        try { parsedData = JSON.parse(parsedData); } catch { /* ignore */ }
    }

    const rawRecordId = raw.id != null ? String(raw.id) : '';
    const notificationApiId = String(
        raw.notification_id
        || raw.notificationId
        || raw.id_notification
        || raw.id_notif
        || raw.notif_id
        || raw.notifId
        || parsedData?.id_notification
        || parsedData?.id_notif
        || parsedData?.notification_id
        || parsedData?.notificationId
        || parsedData?.notif_id
        || parsedData?.notifId
        || raw.id
        || raw.event_id
        || raw.id_event
        || ''
    );

    // ── ID ── Prefer dedicated notification id over generic record id.
    const id = String(
        notificationApiId
        || `sse-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    );

    // ── Skip noise ──
    const rawType = String(raw.type || raw.action || raw.event_type || '').toLowerCase();
    if (NOISE_TYPES.has(rawType)) return null;
    const rawMsg = String(raw.message || raw.description || raw.detail || '');
    if (NOISE_TYPES.has(rawMsg.toLowerCase())) return null;

    // ── Read state ──
    const is_read = !!(raw.read || raw.is_read || raw.read_at);

    // ── Type classification ──
    let type: 'created' | 'updated' | 'deleted' = 'updated';
    const hint = `${rawType} ${rawMsg.toLowerCase()}`;
    if (/delet|remov|hapus|destroy/i.test(hint)) type = 'deleted';
    else if (/creat|add|insert|tambah|buat/i.test(hint)) type = 'created';
    else if (/updat|edit|modif|ubah|perbarui/i.test(hint)) type = 'updated';

    // ── User extraction ──
    let user = { id: '', name: '', role: '' } as { id: string; name: string; role: string; avatar?: string };

    if (raw.user && typeof raw.user === 'object') {
        user.id = String(raw.user.id || raw.user.user_id || '');
        user.name = raw.user.name || raw.user.username || raw.user.nama || '';
        user.role = raw.user.role || raw.user.role_name || '';
        const av = raw.user.avatar || raw.user.photo || raw.user.foto_profile;
        if (av) user.avatar = formatImageUrl(av);
    } else if (raw.actor_name || raw.user_name || raw.username) {
        user.id = String(raw.user_id || raw.actor_id || '');
        user.name = raw.actor_name || raw.user_name || raw.username || '';
        user.role = raw.user_role || raw.actor_type || raw.role || '';
        const av = raw.avatar || raw.photo || raw.actor_avatar;
        if (av) user.avatar = formatImageUrl(av);
    }

    // Extract user_id from any available field
    if (!user.id) {
        const uid = raw.user_id || raw.userId || raw.userID
            || raw.actor_id || raw.actorId || raw.actorID
            || raw.causer_id || raw.causerId 
            || raw.created_by || raw.updated_by || raw.deleted_by
            || parsedData?.user_id || parsedData?.userId || parsedData?.actor_id || parsedData?.causer_id
            || raw.by;
            
        if (uid) user.id = String(uid);
    }

    // Resolve user name from usersStore if we have an ID but no name
    if (user.id && (!user.name || user.name === 'system' || user.name === 'System' || user.name === 'Sistem')) {
        const resolved = resolveUser(user.id);
        if (resolved) user = resolved;
    }

    // Final fallback
    if (!user.name || user.name === 'system' || user.name === 'System') {
        const nameMatch = rawMsg.match(/^([A-Z][a-zA-Z\s]+?)\s+(memperbarui|menambahkan|menghapus|updated|created|deleted|mengubah)/);
        if (nameMatch) {
            user.name = nameMatch[1].trim();
        }
        // NOTE: Don't force "Sistem" here — the store will handle attribution for SSE events
    }

    // ── Entity ──
    let entity = normalizeEntityKey(
        raw.entity
        || raw.resource
        || raw.model
        || raw.table
        || raw.target
        || parsedData?.entity
        || parsedData?.resource
        || parsedData?.model
        || parsedData?.table
        || parsedData?.target
    );

    if (entity === 'unknown' && rawMsg) {
        const entityMatch = rawMsg.match(/(pic|stakeholders?|users?|roles?|jabatan|csirts?|csirt|ikas|kse|sdm_csirt|sdm csirt|se_csirt|sistem elektronik|sektor|sub sektor|sub_sektor|kelas|materi|file pendukung|file_pendukung|kuis|quiz|soal|aktivitas|kegiatan|domain|kategori|sub kategori|sub_kategori|ruang lingkup|ruang_lingkup|pertanyaan|jawaban|perusahaan)/i);
        if (entityMatch) entity = normalizeEntityKey(entityMatch[1]);
    }

    let entityName = String(
        raw.entity_name
        || raw.resource_name
        || raw.title
        || raw.nama
        || parsedData?.entity_name
        || parsedData?.resource_name
        || parsedData?.title
        || parsedData?.nama
        || ''
    );

    if (!entityName && rawMsg) {
        const nameExtracted = rawMsg.match(/(?:pic|stakeholders?|users?|roles?|jabatan|csirts?|ikas|kse|sdm_csirt|sdm csirt|se_csirt|sistem elektronik|sektor|sub sektor|sub_sektor|kelas|materi|file pendukung|file_pendukung|kuis|quiz|soal|aktivitas|kegiatan|domain|kategori|sub kategori|sub_kategori|ruang lingkup|ruang_lingkup|pertanyaan|jawaban|perusahaan)\s+(?:baru\s+)?([a-zA-Z0-9_.\-\s]+?)\s+berhasil/i);
        if (nameExtracted) {
            entityName = nameExtracted[1].trim();
        }
    }

    const entityId = String(
        raw.entity_id
        || raw.resource_id
        || raw.model_id
        || raw.record_id
        || raw.data?.id
        || parsedData?.entity_id
        || parsedData?.resource_id
        || parsedData?.model_id
        || parsedData?.record_id
        || parsedData?.id
        || (raw.notification_id || raw.notificationId ? rawRecordId : '')
        || ''
    );

    // ── Message ──
    let message = typeof raw.message === 'string' ? raw.message : (raw.description || raw.detail || '');
    const fieldChanges = raw.field_changes || raw.changes || raw.fields || raw.changed_fields || undefined;

    if (!message && fieldChanges) message = buildFieldChangeDetail(fieldChanges);
    if (!message) {
        const verb = ACTION_VERBS[type] || type;
        const label = getEntityDisplayLabel(entity);
        message = `${verb} data ${entityName || label}`;
    }

    let timestamp = String(
        raw.timestamp
        || raw.created_at
        || raw.time
        || raw.date
        || new Date().toISOString()
    );
    
    // Ensure proper ISO format for database-style timestamps (e.g. "2023-01-01 12:00:00")
    if (/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(timestamp)) {
        timestamp = timestamp.replace(' ', 'T') + 'Z';
    } else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(timestamp) && !timestamp.includes('Z') && !timestamp.includes('+')) {
        timestamp += 'Z';
    }

    return {
        id,
        api_id: notificationApiId || undefined,
        type,
        entity,
        entity_id: entityId,
        entity_name: entityName,
        field_changes: fieldChanges,
        user,
        timestamp,
        message,
        is_read,
    };
}

// ─── Browser Notification ────────────────────────────────────────────

function showBrowserNotification(event: ServerEvent): void {
    if (document.hasFocus()) return;
    if (!('Notification' in window)) return;
    if (Notification.permission === 'granted') {
        const verb = ACTION_VERBS[event.type] || event.type;
        const label = getEntityDisplayLabel(event.entity);
        new Notification(`${event.user?.name || 'Sistem'} ${verb} ${label}`, {
            body: event.entity_name ? `${event.entity_name} — ${event.message}` : event.message,
            icon: '/images/brand-logos/logoD4.svg',
            tag: event.id,
        });
    } else if (Notification.permission !== 'denied') {
        Notification.requestPermission();
    }
}

// ─── Store ───────────────────────────────────────────────────────────

export const useNotificationStore = defineStore('notifications', {
    state: () => ({
        /** All notifications — merged from DB + SSE */
        events: [] as ServerEvent[],
        /** IDs of events that came from SSE and might not be in the DB yet */
        pendingSSEIds: new Set<string>(),
        /** Connection state */
        connected: false,
        initialized: false,
        loading: false,
        /** Backend-reported unread count */
        backendUnreadCount: 0,
        /** Toast queue */
        toastQueue: [] as ServerEvent[],
        /** Polling timer */
        pollTimer: null as ReturnType<typeof setInterval> | null,
        /** Stats */
        stats: null as NotificationStats | null,
        /**
         * Recent actions performed by the current user.
         * Used to attribute SSE events that arrive without user info.
         */
        trackedActions: [] as Array<{ entity: string; entity_id: string; timestamp: number }>,
        /** Current time for reactive 'time ago' updates */
        currentTime: Date.now(),
        /** Timer for updating currentTime */
        clockTimer: null as ReturnType<typeof setInterval> | null,
    }),

    getters: {
        unreadCount(state): number {
            return state.events.filter(e => !e.is_read).length;
        },

        recentForDropdown(state): Array<ServerEvent & {
            timeAgoStr: string;
            isRead: boolean;
            entityLabel: string;
            actionVerb: string;
            details: string;
            avatarInitials: string;
            actorName: string;
            actorRole: string;
            targetLabel: string;
        }> {
            return state.events.slice(0, 5).map(e => ({
                ...e,
                timeAgoStr: timeAgo(e.timestamp, state.currentTime),
                isRead: !!e.is_read,
                entityLabel: getEntityDisplayLabel(e.entity),
                actionVerb: ACTION_VERBS[e.type] || e.type,
                details: e.field_changes ? buildFieldChangeDetail(e.field_changes) : e.message,
                avatarInitials: (e.user?.name || 'S')
                    .split(' ')
                    .map((w: string) => w.charAt(0))
                    .join('')
                    .substring(0, 2)
                    .toUpperCase(),
                actorName: e.user?.name || 'Sistem',
                actorRole: isPlaceholderRole(e.user?.role) ? '' : (e.user?.role || ''),
                targetLabel: buildNotificationTarget(e.entity, e.entity_name),
            }));
        },

        enhancedEvents(state): Array<ServerEvent & {
            timeAgoStr: string;
            isRead: boolean;
            entityLabel: string;
            actionVerb: string;
            details: string;
            avatarInitials: string;
            actorName: string;
            actorRole: string;
            targetLabel: string;
        }> {
            const now = state.currentTime;
            return state.events.map(e => ({
                ...e,
                timeAgoStr: timeAgo(e.timestamp, now),
                isRead: !!e.is_read,
                entityLabel: getEntityDisplayLabel(e.entity),
                actionVerb: ACTION_VERBS[e.type] || e.type,
                details: e.field_changes ? buildFieldChangeDetail(e.field_changes) : e.message,
                avatarInitials: (e.user?.name || 'S')
                    .split(' ')
                    .map((w: string) => w.charAt(0))
                    .join('')
                    .substring(0, 2)
                    .toUpperCase(),
                actorName: e.user?.name || 'Sistem',
                actorRole: isPlaceholderRole(e.user?.role) ? '' : (e.user?.role || ''),
                targetLabel: buildNotificationTarget(e.entity, e.entity_name),
            }));
        },

        statCounts(state): { total: number; unread: number; updates: number; deletes: number; creates: number } {
            return {
                total: state.events.length,
                unread: state.events.filter(e => !e.is_read).length,
                updates: state.events.filter(e => e.type === 'updated').length,
                deletes: state.events.filter(e => e.type === 'deleted').length,
                creates: state.events.filter(e => e.type === 'created').length,
            };
        },

        nextToast(state): ServerEvent | null {
            return state.toastQueue.length > 0 ? state.toastQueue[0] : null;
        },
    },

    actions: {
        // ═══════════════════════════════════════════════════════════
        // INIT
        // ═══════════════════════════════════════════════════════════
        async init() {
            if (this.initialized) return;
            const authStore = useAuthStore();
            if (!authStore.authenticated || !authStore.isAdmin) return;

            this.initialized = true;
            this.loading = true;
            console.log('[NotifStore] Initializing...');

            if ('Notification' in window && Notification.permission === 'default') {
                Notification.requestPermission();
            }

            const canContinue = await this.loadFromDatabase();
            if (!canContinue || !authStore.authenticated) {
                this.loading = false;
                this.initialized = false;
                return;
            }
            await this.refreshStats();
            if (!authStore.authenticated) {
                this.loading = false;
                this.initialized = false;
                return;
            }
            this.loading = false;

            // Start reactive clock for time-ago updates
            this.startClock();

            notificationService.connect(
                (raw: any) => this.handleSSEEvent(raw),
                (connected: boolean) => {
                    this.connected = connected;
                    if (!connected && !this.pollTimer) this.startPolling();
                    else if (connected && this.pollTimer) this.stopPolling();
                    if (connected) this.refreshStats();
                },
            );

            this.startPolling();
        },

        async refreshStats() {
            this.stats = await notificationService.getStats();
        },

        startClock() {
            if (this.clockTimer) return;
            console.log('[NotifStore] Starting reactive clock...');
            this.currentTime = Date.now();
            this.clockTimer = setInterval(() => {
                this.currentTime = Date.now();
            }, 10_000); // 10s for more frequent updates
        },

        stopClock() {
            if (this.clockTimer) {
                console.log('[NotifStore] Stopping reactive clock...');
                clearInterval(this.clockTimer);
                this.clockTimer = null;
            }
        },

        // ═══════════════════════════════════════════════════════════
        // LOAD FROM DATABASE — Full load on init
        // ═══════════════════════════════════════════════════════════
        async loadFromDatabase(): Promise<boolean> {
            try {
                const { notifications, unread_count, ok, error, status } = await notificationService.fetchAll();
                if (!ok) {
                    console.warn('[NotifStore] DB load skipped:', error);
                    if (status === 401) return false;
                    return true;
                }
                console.log('[NotifStore] DB load:', notifications.length, 'items, unread:', unread_count);

                const normalized = notifications
                    .map(raw => normalizeToServerEvent(raw))
                    .filter((e): e is ServerEvent => e !== null);

                // Ensure all DB notifications have proper user attribution
                for (const evt of normalized) {
                    if (!evt.user.name || evt.user.name === 'Sistem') {
                        if (evt.user.id) {
                            const resolved = resolveUser(evt.user.id);
                            if (resolved) evt.user = resolved;
                        }
                    }
                }

                normalized.sort((a, b) =>
                    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
                );

                this.events = normalized.slice(0, MAX_EVENTS);
                this.backendUnreadCount = unread_count;
                this.pendingSSEIds.clear();
                return true;
            } catch (err) {
                console.warn('[NotifStore] DB load failed:', err);
                return true;
            }
        },

        // ═══════════════════════════════════════════════════════════
        // MERGE FROM DATABASE — Smart merge during polling
        // ═══════════════════════════════════════════════════════════
        async mergeFromDatabase() {
            try {
                const { notifications, unread_count, ok, error, status } = await notificationService.fetchAll();
                if (!ok) {
                    console.warn('[NotifStore] DB merge skipped:', error);
                    if (status === 401) this.disconnect();
                    return;
                }
                if (!notifications || notifications.length === 0) {
                    // DB empty — keep only SSE-pending events
                    this.events = this.events.filter(e => this.pendingSSEIds.has(e.id));
                    this.backendUnreadCount = 0;
                    return;
                }

                const normalized = notifications
                    .map(raw => normalizeToServerEvent(raw))
                    .filter((e): e is ServerEvent => e !== null);

                // Resolve user names for DB records
                for (const evt of normalized) {
                    if (!evt.user.name || evt.user.name === 'Test') {
                        if (evt.user.id) {
                            const resolved = resolveUser(evt.user.id);
                            if (resolved) evt.user = resolved;
                        }
                    }
                }

                const dbIdSet = new Set(normalized.map(n => n.id));
                const localIdSet = new Set(this.events.map(e => e.id));

                // ADD new DB items
                const newFromDb: ServerEvent[] = [];
                for (const dbEvt of normalized) {
                    if (!localIdSet.has(dbEvt.id)) {
                        newFromDb.push(dbEvt);
                    }
                }

                // UPDATE read states + user info of existing items
                for (const dbEvt of normalized) {
                    const local = this.events.find(e => e.id === dbEvt.id);
                    if (local) {
                        // Optimistic UI: If locally marked as read, keep it read 
                        // even if the backend poll still shows it as unread.
                        if (local.is_read) {
                            // already read locally, keep it that way
                        } else {
                            local.is_read = dbEvt.is_read;
                        }
                        
                        if (local.user.name === 'Sistem' && dbEvt.user.name !== 'Sistem') {
                            local.user = dbEvt.user;
                        }
                    }
                }

                // REPLACE SSE-pending events with their DB counterparts
                // Find SSE events that now have a matching DB record (by entity+entity_id+type)
                for (const sseId of this.pendingSSEIds) {
                    const sseEvt = this.events.find(e => e.id === sseId);
                    if (!sseEvt) continue;

                    const dbMatch = normalized.find(db =>
                        db.entity === sseEvt.entity &&
                        db.entity_id === sseEvt.entity_id &&
                        db.type === sseEvt.type &&
                        Math.abs(new Date(db.timestamp).getTime() - new Date(sseEvt.timestamp).getTime()) < 30000
                    );

                    if (dbMatch && !localIdSet.has(dbMatch.id)) {
                        // Replace SSE event with the DB version (has real UUID)
                        const idx = this.events.findIndex(e => e.id === sseId);
                        if (idx !== -1) {
                            this.events[idx] = dbMatch;
                            this.pendingSSEIds.delete(sseId);
                            dbIdSet.add(dbMatch.id); // prevent re-adding
                        }
                    } else if (dbMatch && localIdSet.has(dbMatch.id)) {
                        // DB version already exists — just remove the SSE duplicate
                        this.events = this.events.filter(e => e.id !== sseId);
                        this.pendingSSEIds.delete(sseId);
                    }
                }

                // REMOVE items not in DB and not SSE-pending
                this.events = this.events.filter(e =>
                    dbIdSet.has(e.id) || this.pendingSSEIds.has(e.id)
                );

                // Clear pending SSE IDs that are now in DB
                for (const id of this.pendingSSEIds) {
                    if (dbIdSet.has(id)) this.pendingSSEIds.delete(id);
                }

                // Merge new DB items
                if (newFromDb.length > 0) {
                    this.events.push(...newFromDb);
                    for (const evt of newFromDb) {
                        if (!evt.is_read) {
                            this.toastQueue.push(evt);
                            showBrowserNotification(evt);
                        }
                    }
                }

                // Re-sort and trim
                this.events.sort((a, b) =>
                    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
                );
                if (this.events.length > MAX_EVENTS) {
                    this.events = this.events.slice(0, MAX_EVENTS);
                }

                this.backendUnreadCount = unread_count;
            } catch {
                // Silent fail
            }
        },

        // ═══════════════════════════════════════════════════════════
        // HANDLE SSE EVENT
        //
        // SSE events often arrive WITHOUT a real DB id and WITHOUT
        // user info. We:
        //  1. Attribute to the current user if it matches a tracked action
        //  2. Mark it with a generated ID (sse-xxx) 
        //  3. The next poll will replace it with the DB version
        // ═══════════════════════════════════════════════════════════
        handleSSEEvent(raw: any) {
            const event = normalizeToServerEvent(raw);
            if (!event) return;

            // ── USER ATTRIBUTION ──
            // If SSE arrived without user info, try to attribute it
            if (!event.user.name || event.user.name === 'Sistem' || event.user.name === 'system') {
                const now = Date.now();

                // 1. Check tracked actions — did the current user just do this?
                const matchIdx = this.trackedActions.findIndex(a => {
                    const actionEntity = normalizeEntityKey(a.entity);
                    const eventEntity = normalizeEntityKey(event.entity);
                    const actionId = String(a.entity_id || '');
                    const eventId = String(event.entity_id || '');

                    return actionEntity === eventEntity
                        && (!actionId || !eventId || actionId === eventId)
                        && (now - a.timestamp) < 20_000; // 20s window
                });

                if (matchIdx !== -1) {
                    const currentUser = getCurrentUser();
                    if (currentUser) {
                        console.log('[NotifStore] Attributing SSE event to current user:', currentUser.name);
                        event.user = currentUser;
                    }
                    this.trackedActions.splice(matchIdx, 1);
                }
                // 2. If the SSE payload has a user_id, try resolving it
                else if (event.user.id) {
                    const resolved = resolveUser(event.user.id);
                    if (resolved) event.user = resolved;
                }
                // 3. If we still don't have a user, try the current user as last resort
                //    (only if we have tracked actions recently, meaning the user IS active)
                else if (this.trackedActions.length > 0 && (now - this.trackedActions[this.trackedActions.length - 1].timestamp) < 10_000) {
                    const currentUser = getCurrentUser();
                    if (currentUser) {
                        event.user = currentUser;
                    }
                }
            }

            // If still no name, set fallback
            if (!event.user.name) {
                event.user.name = 'Sistem';
                event.user.role = event.user.role || 'system';
            }

            console.log('[NotifStore] Processed SSE event:', event);

            // ── DEDUPLICATION ──
            const isDup = this.events.some(e =>
                e.id === event.id ||
                (e.entity === event.entity && e.entity_id === event.entity_id &&
                 e.type === event.type && Math.abs(new Date(e.timestamp).getTime() - new Date(event.timestamp).getTime()) < 5000)
            );

            if (isDup) {
                const existing = this.events.find(e =>
                    e.id === event.id ||
                    (e.entity === event.entity && e.entity_id === event.entity_id && e.type === event.type)
                );
                if (existing && existing.user.name === 'Sistem' && event.user.name !== 'Sistem') {
                    existing.user = event.user;
                }
                return;
            }

            // ── ADD TO LIST ──
            this.events.unshift(event);
            if (this.events.length > MAX_EVENTS) {
                this.events = this.events.slice(0, MAX_EVENTS);
            }

            // Track only frontend-generated SSE placeholders as pending.
            if (isTemporarySseId(event.id)) {
                this.pendingSSEIds.add(event.id);
                // Auto-expire pending status after 90s
                setTimeout(() => {
                    this.pendingSSEIds.delete(event.id);
                }, 90_000);
            }

            this.toastQueue.push(event);
            showBrowserNotification(event);
        },

        // ═══════════════════════════════════════════════════════════
        // POLLING
        // ═══════════════════════════════════════════════════════════
        startPolling() {
            if (this.pollTimer) return;
            this.pollTimer = setInterval(() => {
                this.mergeFromDatabase();
            }, POLL_INTERVAL_MS);
        },

        stopPolling() {
            if (this.pollTimer) {
                clearInterval(this.pollTimer);
                this.pollTimer = null;
            }
        },

        // ═══════════════════════════════════════════════════════════
        // TOAST
        // ═══════════════════════════════════════════════════════════
        dismissToast() {
            this.toastQueue.shift();
        },

        // ═══════════════════════════════════════════════════════════
        // MARK AS READ — Single
        // PATCH /api/notifications/{id}
        //
        // Only calls backend for real DB IDs. SSE-only events
        // are marked as read locally only.
        // ═══════════════════════════════════════════════════════════
        async markAsRead(id: string) {
            const evt = this.events.find(e => e.id === id);
            if (!evt || evt.is_read) return;

            const previousState = evt.is_read;
            const backendId = getBackendNotificationId(evt);
            if (evt) evt.is_read = true;
            if (this.backendUnreadCount > 0) {
                this.backendUnreadCount -= 1;
            }

            // Only call backend if this is a real DB ID
            if (backendId) {
                const ok = await notificationService.markAsRead(backendId);
                if (!ok) {
                    evt.is_read = previousState;
                    if (!previousState) {
                        this.backendUnreadCount += 1;
                    }
                }
            }
        },

        // ═══════════════════════════════════════════════════════════
        // MARK ALL AS READ
        // PATCH /api/notifications/read-all
        // ═══════════════════════════════════════════════════════════
        async markAllAsRead() {
            const unreadBefore = this.events.filter(e => !e.is_read).length;
            if (unreadBefore === 0) return;

            const previousStates = this.events.map(e => ({ id: e.id, was: e.is_read }));
            this.events.forEach(e => { e.is_read = true; });
            this.backendUnreadCount = 0;

            const ok = await notificationService.markAllAsRead();
            if (!ok) {
                previousStates.forEach(({ id, was }) => {
                    const evt = this.events.find(e => e.id === id);
                    if (evt) evt.is_read = was;
                });
                this.backendUnreadCount = unreadBefore;
            }
        },

        // ═══════════════════════════════════════════════════════════
        // DELETE — Single
        // DELETE /api/notifications/{id}
        //
        // Only calls backend for real DB IDs. SSE-only events
        // are just removed from local state.
        // ═══════════════════════════════════════════════════════════
        async deleteEvent(id: string) {
            const removed = this.events.find(e => e.id === id);
            const backendId = getBackendNotificationId(removed);
            this.events = this.events.filter(e => e.id !== id);
            this.pendingSSEIds.delete(id);

            // Only call backend if this is a real DB ID
            if (backendId) {
                const ok = await notificationService.deleteOne(backendId);
                if (!ok && removed) {
                    this.events.unshift(removed);
                    this.events.sort((a, b) =>
                        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
                    );
                }
            }
        },

        // ═══════════════════════════════════════════════════════════
        // CLEAR ALL
        // DELETE /api/notifications
        // ═══════════════════════════════════════════════════════════
        async clearAll() {
            const backup = [...this.events];
            this.events = [];
            this.backendUnreadCount = 0;
            this.pendingSSEIds.clear();

            const ok = await notificationService.deleteAll();
            if (!ok) {
                this.events = backup;
            }
        },

        // ═══════════════════════════════════════════════════════════
        // TAB FILTER
        // ═══════════════════════════════════════════════════════════
        filteredByTab(tab: string) {
            const all = this.enhancedEvents;
            switch (tab) {
                case 'Belum Dibaca': return all.filter(e => !e.isRead);
                case 'Pembaruan Data': return all.filter(e => e.type === 'updated');
                case 'Sistem': return all.filter(e => e.type === 'deleted' || e.type === 'created');
                default: return all;
            }
        },

        // ═══════════════════════════════════════════════════════════
        // TRACK SELF ACTION
        //
        // Call BEFORE making a CRUD API call. When the resulting
        // SSE event arrives (usually without user info), this
        // allows us to attribute it to the current user.
        // ═══════════════════════════════════════════════════════════
        trackSelfAction(entity: string, entity_id: string) {
            const normalizedEntity = normalizeEntityKey(entity);
            const normalizedId = String(entity_id || '');
            const now = Date.now();
            const duplicate = this.trackedActions.some(a =>
                normalizeEntityKey(a.entity) === normalizedEntity
                && String(a.entity_id || '') === normalizedId
                && (now - a.timestamp) < 2_000
            );
            if (duplicate) return;

            this.trackedActions.push({
                entity: normalizedEntity,
                entity_id: normalizedId,
                timestamp: now,
            });
            // Cleanup old entries (> 30s)
            if (this.trackedActions.length > 30) {
                this.trackedActions = this.trackedActions.filter(a => (now - a.timestamp) < 30_000);
            }
        },

        // ═══════════════════════════════════════════════════════════
        // DISCONNECT
        // ═══════════════════════════════════════════════════════════
        disconnect() {
            notificationService.disconnect();
            this.stopPolling();
            this.stopClock();
            this.connected = false;
            this.initialized = false;
            this.events = [];
            this.pendingSSEIds.clear();
            this.stats = null;
            this.toastQueue = [];
            this.backendUnreadCount = 0;
            this.trackedActions = [];
        },
    },
});
