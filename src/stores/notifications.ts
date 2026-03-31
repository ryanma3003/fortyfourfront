import { defineStore } from 'pinia';
import { notificationService } from '@/services/notification.service';
import { ENTITY_LABELS, ACTION_VERBS } from '@/types/notification.types';
import type { ServerEvent, NotificationStats } from '@/types/notification.types';

import { useAuthStore } from './auth';
import { useUsersStore } from './users';
import { formatImageUrl } from '@/utils/media';

/** Maximum events kept in memory */
const MAX_EVENTS = 200;

/**
 * Format an ISO timestamp to a relative Indonesian time string.
 */
function timeAgo(isoDate: string): string {
    const now = Date.now();
    const then = new Date(isoDate).getTime();
    if (isNaN(then)) return '';
    const diff = Math.max(0, now - then);

    const seconds = Math.floor(diff / 1000);
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

/**
 * Dictionary to map database column names to human-readable Indonesian labels
 */
const FIELD_LABELS: Record<string, string> = {
    name: 'nama',
    nama: 'nama',
    username: 'username',
    email: 'email',
    jabatan: 'jabatan',
    id_jabatan: 'posisi/jabatan',
    role: 'hak akses',
    role_name: 'hak akses',
    phone: 'nomor telepon',
    no_telepon: 'nomor telepon',
    location: 'lokasi',
    alamat: 'alamat',
    photo: 'foto profil',
    foto_profile: 'foto profil',
    banner: 'banner profil',
    password: 'kata sandi',
    // CSIRT specific
    nama_csirt: 'nama CSIRT',
    id_perusahaan: 'instansi/perusahaan',
    dikutip_dari: 'sumber kutipan',
    photo_csirt: 'logo CSIRT',
    file_rfc2350: 'dokumen RFC2350',
    file_public_key_pgp: 'Public Key PGP',
    // IKAS / KSE specific
    domain: 'domain',
    kategori: 'kategori',
    sub_kategori: 'sub-kategori',
    identifikasi: 'identifikasi',
    proteksi: 'proteksi',
    nilai: 'nilai',
    status: 'status',
    keterangan: 'keterangan'
};

/**
 * Format a value for display (handles nulls, booleans, objects)
 */
function formatValue(val: any): string {
    if (val === null || val === undefined) return 'kosong';
    if (typeof val === 'boolean') return val ? 'ya' : 'tidak';
    if (typeof val === 'object') return 'data kompleks';
    const str = String(val);
    if (str.length > 30) return `'${str.substring(0, 30)}...'`;
    return `'${str}'`;
}

/**
 * Build a specific detail string from field changes.
 * Handles arrays of {field, old_value, new_value} OR object diffs { field: { old, new } }
 * e.g. "Mengubah nama dari 'PT Lama' menjadi 'PT Baru', nomor_telepon dari '08xx' menjadi '08yy'"
 */
function buildFieldChangeDetail(changes: any): string {
    if (!changes) return '';

    let parsedChanges: Array<{ field: string, old_value: any, new_value: any }> = [];

    // If it's the standard array format
    if (Array.isArray(changes)) {
        if (typeof changes[0] === 'string') {
            return changes.join(', '); // fallback for simple string arrays
        }
        parsedChanges = changes;
    } 
    // If it's an object dict format: { "name": { old: "A", new: "B" } } or { "name": "B" }
    else if (typeof changes === 'object') {
        for (const [key, val] of Object.entries(changes)) {
            if (val && typeof val === 'object' && ('old' in val || 'new' in val || 'old_value' in val)) {
                parsedChanges.push({ 
                    field: key, 
                    old_value: (val as any).old || (val as any).old_value, 
                    new_value: (val as any).new || (val as any).new_value 
                });
            } else {
                parsedChanges.push({ field: key, old_value: null, new_value: val });
            }
        }
    }

    if (parsedChanges.length === 0) return '';

    // Ignore noisy fields like updated_at
    const ignoredFields = ['updated_at', 'created_at', 'id', 'user_id', 'actor_id'];
    const validChanges = parsedChanges.filter(c => c.field && !ignoredFields.includes(c.field.toLowerCase()));

    if (validChanges.length === 0) return '';

    return validChanges
        .slice(0, 3)
        .map(c => {
            const rawField = c.field.toLowerCase();
            const fieldLabel = FIELD_LABELS[rawField] || c.field.replace(/_/g, ' ');
            
            if (c.old_value !== undefined && c.old_value !== null && c.new_value !== undefined && c.new_value !== null) {
                return `mengubah ${fieldLabel} dari ${formatValue(c.old_value)} menjadi ${formatValue(c.new_value)}`;
            }
            if (c.new_value !== undefined && c.new_value !== null) {
                return `mengatur ${fieldLabel} menjadi ${formatValue(c.new_value)}`;
            }
            return `menghapus data ${fieldLabel}`;
        })
        .join(', ') + (validChanges.length > 3 ? `, dan ${validChanges.length - 3} kolom lainnya` : '');
}

/**
 * Normalize an incoming SSE event or history item to our ServerEvent interface.
 * Handles flexible backend payloads with many possible shapes.
 */
function normalizeEvent(raw: any): ServerEvent | null {
    if (!raw || typeof raw !== 'object') return null;

    // -- Extract type --
    const rawType = (raw.type || raw.action || raw.event_type || '').toLowerCase();

    // Helper: raw message text
    const rawMsgStr = String(raw.message || raw.description || raw.detail || '').toLowerCase();

    // Skip ping / heartbeat / system noise
    const ignoreTypes = ['ping', 'heartbeat', 'keepalive', 'keep-alive', 'connection', 'connected'];
    if (ignoreTypes.includes(rawType) || ignoreTypes.includes(rawMsgStr)) return null;

    // Map to our standard types by checking both type and message strings
    let type: 'created' | 'updated' | 'deleted' = 'updated'; // default
    const combinedActionText = `${rawType} ${rawMsgStr}`;
    
    // Check for deletion keywords first (strongest signal)
    if (combinedActionText.includes('delet') || combinedActionText.includes('remov') || combinedActionText.includes('hapus') || combinedActionText.includes('destroy') || combinedActionText.includes('cabut') || combinedActionText.includes('lepas') || combinedActionText.includes('hilang')) {
        type = 'deleted';
    // Then creation keywords
    } else if (combinedActionText.includes('creat') || combinedActionText.includes('add') || combinedActionText.includes('insert') || combinedActionText.includes('tambah') || combinedActionText.includes('daftar') || combinedActionText.includes('buat')) {
        type = 'created';
    // Fallback to update keywords
    } else if (combinedActionText.includes('updat') || combinedActionText.includes('edit') || combinedActionText.includes('modif') || combinedActionText.includes('ubah') || combinedActionText.includes('perbarui')) {
        type = 'updated';
    }

    // -- Extract user --
    let user = { id: '', name: '', role: '' };
    if (raw.user && typeof raw.user === 'object') {
        user = {
            id: String(raw.user.id || raw.user.user_id || ''),
            name: raw.user.name || raw.user.username || raw.user.nama || '',
            role: raw.user.role || raw.user.role_name || raw.user.jabatan || '',
        };
        const rawAvatar = raw.user.avatar || raw.user.photo || raw.user.foto_profile;
        if (rawAvatar) user.avatar = formatImageUrl(rawAvatar);
    } else if (raw.user_name || raw.username || raw.actor_name) {
        user = {
            id: String(raw.user_id || raw.actor_id || ''),
            name: raw.user_name || raw.username || raw.actor_name || '',
            role: raw.user_role || raw.role || '',
        };
        const rawAvatar = raw.avatar || raw.photo || raw.foto_profile;
        if (rawAvatar) user.avatar = formatImageUrl(rawAvatar);
    } else if (typeof raw.user === 'string') {
        user.name = raw.user;
    }

    // Attempt to extract an actor ID from generic fields if user object was entirely missing
    if (!user.id && (raw.user_id || raw.actor_id || raw.created_by || raw.updated_by || raw.deleted_by || raw.by)) {
        user.id = String(raw.user_id || raw.actor_id || raw.created_by || raw.updated_by || raw.deleted_by || raw.by);
    }

    // Fetch precise user name/role from the users store if we have an ID
    if (user.id) {
        try {
            const usersStore = useUsersStore();
            // If users aren't loaded yet, the store will just return undefined and we keep the fallback.
            const foundUser = usersStore.getUserById(user.id);
            if (foundUser) {
                user.name = foundUser.name || foundUser.username || user.name || 'Unknown';
                user.role = foundUser.role || user.role || 'user';
                const rawAvatar = foundUser.photo || (foundUser as any).foto_profile;
                if (rawAvatar) user.avatar = formatImageUrl(rawAvatar);
            }
        } catch (e) {
            // ignore store errors during early init
        }
    }

    // Fallback ONLY if we still have absolutely no name and no ID
    if (!user.name || user.name === 'System' || user.name === 'Sistem') {
        try {
            const authStore = useAuthStore();
            if (authStore.currentUser) {
                user.id = authStore.currentUser.id || '';
                user.name = authStore.currentUser.name || authStore.currentUser.username || 'Admin';
                user.role = authStore.currentUser.role || 'admin';
                const rawAvatar = (authStore.currentUser as any).photo || authStore.currentUser.foto_profile || authStore.currentUser.avatar;
                if (rawAvatar) user.avatar = formatImageUrl(rawAvatar);
            } else {
                user.name = 'Sistem';
                user.role = 'system';
            }
        } catch (e) {
            user.name = 'Sistem';
            user.role = 'system';
        }
    }

    // Final sanity check
    if (!user.name) user.name = 'Sistem';
    if (!user.role) user.role = 'system';

    // -- Extract entity --
    let entity = String(raw.entity || raw.resource || raw.model || raw.table || 'unknown').toLowerCase();
    
    // Normalize variations from backend for CSIRT
    if (entity === 'csirts' || entity === 'csirtmember' || entity === 'csirt_member') entity = 'csirt';
    if (entity === 'sdms' || entity === 'sdmcsirt' || entity === 'sdm') entity = 'sdm_csirt';
    if (entity === 'ses' || entity === 'secsirt' || entity === 'se') entity = 'se_csirt';

    let entityName = raw.entity_name || raw.resource_name || raw.name || raw.title || raw.nama || '';
    const entityId = String(raw.entity_id || raw.resource_id || raw.model_id || raw.record_id || '');

    // -- Build message with field change specifics --
    let message: string = typeof raw.message === 'string' ? raw.message : (raw.description || raw.detail || '');
    const fieldChanges = raw.field_changes || raw.changes || raw.fields || raw.changed_fields || undefined;

    // Try to extract entity_name from generic messages like "Sdm_csirt baru [NAMA] berhasil ditambahkan" or "Sdm_csirt [NAMA] berhasil diperbarui"
    if (!entityName && message) {
        // Match anything before "berhasil"
        const match = message.match(/(.*?)\s+(berhasil|telah)/i);
        if (match && match[1]) {
            // Remove generic prefixes
            let extracted = match[1].trim();
            extracted = extracted.replace(/^(?:data\s+|baru\s+|sdm_csirt\s+|se_csirt\s+|csirt\s+|stakeholder\s+|kse\s+|user\s+|personel\s+|sistem\s+elektronik\s+)/i, '').trim();
            if (extracted) entityName = extracted;
        }
    }

    // If no message but there are field changes, build one
    if (!message && fieldChanges && Array.isArray(fieldChanges) && fieldChanges.length > 0) {
        message = buildFieldChangeDetail(fieldChanges);
    }

    // If still no message, create a generic one
    if (!message) {
        const verb = ACTION_VERBS[type] || type;
        const label = ENTITY_LABELS[entity] || entity;
        message = `${verb} data ${entityName || label}`;
    }

    // Clean up message: if it just says "Entity baru Name berhasil ditambahkan",
    // we don't need to show it as the detail text since the title already contains the action.
    if (message.includes('berhasil ditambahkan') && type === 'created') {
        message = ''; // hide redundant text
    } else if (message.includes('berhasil dihapus') && type === 'deleted') {
        message = ''; // hide redundant text
    } else if (message.includes('berhasil diperbarui') && type === 'updated' && (!fieldChanges || fieldChanges.length === 0)) {
        message = 'Data berhasil diperbarui (tidak ada detail perubahan dari server)'; 
    }

    return {
        id: String(raw.id || raw.event_id || raw.notification_id || `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`),
        type,
        entity,
        entity_id: entityId,
        entity_name: entityName,
        field_changes: fieldChanges,
        user,
        timestamp: raw.timestamp || raw.created_at || raw.time || raw.date || new Date().toISOString(),
        message,
    };
}

export const useNotificationStore = defineStore('notifications', {
    state: () => ({
        events: [] as ServerEvent[],
        readIds: new Set<string>() as Set<string>,
        stats: null as NotificationStats | null,
        connected: false,
        initialized: false,
        loading: false,
    }),

    getters: {
        unreadCount(state): number {
            return state.events.filter(e => !state.readIds.has(e.id)).length;
        },

        recentForDropdown(state): Array<ServerEvent & { timeAgoStr: string; isRead: boolean }> {
            return state.events.slice(0, 5).map(e => ({
                ...e,
                timeAgoStr: timeAgo(e.timestamp),
                isRead: state.readIds.has(e.id),
            }));
        },

        enhancedEvents(state): Array<ServerEvent & {
            timeAgoStr: string;
            isRead: boolean;
            entityLabel: string;
            actionVerb: string;
            details: string;
            avatarInitials: string;
        }> {
            return state.events.map(e => ({
                ...e,
                timeAgoStr: timeAgo(e.timestamp),
                isRead: state.readIds.has(e.id),
                entityLabel: ENTITY_LABELS[e.entity] || e.entity,
                actionVerb: ACTION_VERBS[e.type] || e.type,
                details: e.field_changes ? buildFieldChangeDetail(e.field_changes) : e.message,
                avatarInitials: (e.user?.name || 'S')
                    .split(' ')
                    .map((w: string) => w.charAt(0))
                    .join('')
                    .substring(0, 2)
                    .toUpperCase(),
            }));
        },

        statCounts(state): { total: number; unread: number; updates: number; deletes: number; creates: number } {
            const events = state.events;
            return {
                total: events.length,
                unread: events.filter(e => !state.readIds.has(e.id)).length,
                updates: events.filter(e => e.type === 'updated').length,
                deletes: events.filter(e => e.type === 'deleted').length,
                creates: events.filter(e => e.type === 'created').length,
            };
        },
    },

    actions: {
        /**
         * Initialize: load history from backend, then open SSE.
         * Notifications persist on the server — reload fetches them again.
         */
        async init() {
            if (this.initialized) return;
            this.initialized = true;
            this.loading = true;

            // 1. Ensure users are loaded for proper attribution mapping
            try {
                const usersStore = useUsersStore();
                if (!usersStore.initialized) {
                    await usersStore.initialize();
                }
            } catch (err) {
                console.warn('[NotificationStore] Failed to load users for attribution mapping', err);
            }

            // 2. Load notification history from backend (persistence)
            try {
                const history = await notificationService.getHistory();
                if (Array.isArray(history) && history.length > 0) {
                    const normalized = history
                        .map((raw: any) => normalizeEvent(raw))
                        .filter((e): e is ServerEvent => e !== null);

                    // Newest first — sort by timestamp descending
                    normalized.sort((a, b) =>
                        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
                    );

                    this.events = normalized.slice(0, MAX_EVENTS);
                }
            } catch (err) {
                console.warn('[NotificationStore] Failed to load history from backend:', err);
            }

            // 3. Load stats (best-effort)
            try {
                this.stats = await notificationService.getStats();
            } catch (err) {
                console.warn('[NotificationStore] Failed to load stats:', err);
            }

            this.loading = false;

            // 4. Open SSE for real-time events
            notificationService.connect(
                (raw: any) => this.onEvent(raw),
                (connected: boolean) => { this.connected = connected; },
            );
        },

        /** Handle an incoming SSE event — normalize and prepend */
        onEvent(raw: any) {
            const event = normalizeEvent(raw);
            if (!event) return; // filtered out (ping, etc.)

            // Avoid duplicates (by id)
            if (this.events.some(e => e.id === event.id)) return;

            this.events.unshift(event);
            if (this.events.length > MAX_EVENTS) {
                this.events = this.events.slice(0, MAX_EVENTS);
            }
        },

        markAsRead(id: string) {
            this.readIds.add(id);
        },

        markAllAsRead() {
            this.events.forEach(e => this.readIds.add(e.id));
        },

        /**
         * Delete notification at backend level.
         */
        async deleteEvent(id: string) {
            // Remove locally first for instant UI feedback
            this.events = this.events.filter(e => e.id !== id);
            this.readIds.delete(id);
            
            // Then delete from backend (fire-and-forget)
            try {
                await notificationService.deleteNotification(id);
            } catch(e) {}
        },

        /**
         * Clear all notifications at backend level.
         */
        async clearAll() {
            this.events = [];
            this.readIds = new Set();
            try {
                await notificationService.clearAll();
            } catch(e) {}
        },

        filteredByTab(tab: string) {
            const all = this.enhancedEvents;
            switch (tab) {
                case 'Belum Dibaca':
                    return all.filter(e => !e.isRead);
                case 'Pembaruan Data':
                    return all.filter(e => e.type === 'updated');
                case 'Sistem':
                    return all.filter(e => e.type === 'deleted' || e.type === 'created');
                default:
                    return all;
            }
        },

        disconnect() {
            notificationService.disconnect();
            this.connected = false;
            this.initialized = false;
            this.events = [];
            this.readIds = new Set();
            this.stats = null;
        },
    },
});
