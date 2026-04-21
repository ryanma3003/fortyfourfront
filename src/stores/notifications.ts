import { defineStore } from 'pinia';
import { notificationService } from '@/services/notification.service';
import { ENTITY_LABELS, ACTION_VERBS } from '@/types/notification.types';
import type { ServerEvent, NotificationStats } from '@/types/notification.types';

import { useAuthStore } from './auth';
import { useUsersStore } from './users';
import { formatImageUrl } from '@/utils/media';

/** Maximum events kept in memory */
const MAX_EVENTS = 200;

/** How often to poll for new notifications (ms) — fallback when SSE is unavailable */
const POLL_INTERVAL_MS = 30_000;

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

    // -- Extract read state from backend --
    const isRead = !!(raw.read || raw.is_read || raw.read_at);

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
    } else if (raw.user_name || raw.username || raw.actor_name || raw.actorName) {
        user = {
            id: String(raw.user_id || raw.actor_id || raw.actorID || ''),
            name: raw.user_name || raw.username || raw.actor_name || raw.actorName || '',
            role: raw.user_role || raw.role || raw.actor_type || raw.actorType || '',
        };
        const rawAvatar = raw.avatar || raw.photo || raw.foto_profile || raw.actor_avatar || raw.actorAvatar;
        if (rawAvatar) user.avatar = formatImageUrl(rawAvatar);
    } else if (typeof raw.user === 'string') {
        user.name = raw.user;
    }

     // Attempt to extract an actor ID from generic fields if user object was entirely missing
    if (!user.id) {
        user.id = String(
            raw.user_id || 
            raw.userID || 
            raw.userId || 
            raw.actor_id || 
            raw.actorID || 
            raw.actorId || 
            raw.created_by || 
            raw.updated_by || 
            raw.deleted_by || 
            raw.data?.user_id || 
            raw.data?.userId || 
            raw.data?.userID ||
            raw.by || 
            ''
        );
    }

    // Fetch precise user name/role from the users store if we have an ID
    if (user.id) {
        try {
            const usersStore = useUsersStore();
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

    // Final sanity check for anonymous events
    if (!user.name || user.name === 'System' || user.name === 'Sistem') {
        user.name = 'Sistem';
        user.role = 'system';
    }

    // -- Extract entity --
    let entity = String(raw.entity || raw.resource || raw.model || raw.table || 'unknown').toLowerCase();
    
    // Normalize variations from backend for CSIRT
    if (entity === 'csirts' || entity === 'csirtmember' || entity === 'csirt_member') entity = 'csirt';
    if (entity === 'sdms' || entity === 'sdmcsirt' || entity === 'sdm') entity = 'sdm_csirt';
    if (entity === 'ses' || entity === 'secsirt' || entity === 'se') entity = 'se_csirt';

    let entityName = raw.entity_name || raw.resource_name || raw.name || raw.title || raw.nama || '';
    const entityId = String(raw.entity_id || raw.resource_id || raw.model_id || raw.record_id || raw.data?.id || '');

    // -- Generate a stable ID if backend didn't provide one --
    const signature = entityId && rawType ? `notif-${entityId}-${rawType}` : `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const id = String(raw.id || raw.event_id || raw.notification_id || signature);

    // -- Build message --
    let message: string = typeof raw.message === 'string' ? raw.message : (raw.description || raw.detail || '');
    const fieldChanges = raw.field_changes || raw.changes || raw.fields || raw.changed_fields || undefined;

    // Use type from raw data if available and valid
    if (!message && raw.type && typeof raw.type === 'string' && raw.type.length > 5) {
        message = raw.type;
    }

    // Try to extract entity_name from generic messages
    if (!entityName && message) {
        const match = message.match(/(.*?)\s+(berhasil|telah)/i);
        if (match && match[1]) {
            let extracted = match[1].trim();
            extracted = extracted.replace(/^(?:data\s+|baru\s+|sdm_csirt\s+|se_csirt\s+|csirt\s+|stakeholder\s+|kse\s+|user\s+|personel\s+|sistem\s+elektronik\s+)/i, '').trim();
            if (extracted) entityName = extracted;
        }
    }

    if (!message && fieldChanges && Array.isArray(fieldChanges) && fieldChanges.length > 0) {
        message = buildFieldChangeDetail(fieldChanges);
    }

    if (!message) {
        const verb = ACTION_VERBS[type] || type;
        const label = ENTITY_LABELS[entity] || entity;
        message = `${verb} data ${entityName || label}`;
    }

    return {
        id,
        type,
        entity,
        entity_id: entityId,
        entity_name: entityName,
        field_changes: fieldChanges,
        user,
        timestamp: raw.timestamp || raw.created_at || raw.time || raw.date || new Date().toISOString(),
        message,
        is_read: isRead,
    };
}

/**
 * Show a browser toast notification.
 * Uses the browser's built-in Notification API if permission is granted.
 */
function showBrowserNotification(event: ServerEvent): void {
    // Don't show if page is focused and visible
    if (document.hasFocus()) return;

    if (!('Notification' in window)) return;
    if (Notification.permission === 'granted') {
        const verb = ACTION_VERBS[event.type] || event.type;
        const label = ENTITY_LABELS[event.entity] || event.entity;
        const title = `${event.user?.name || 'Sistem'} ${verb} ${label}`;
        const body = event.entity_name ? `${event.entity_name}${event.message ? ' — ' + event.message : ''}` : event.message || '';

        new Notification(title, {
            body,
            icon: '/images/brand-logos/logoD4.svg',
            tag: event.id,
        });
    } else if (Notification.permission !== 'denied') {
        Notification.requestPermission();
    }
}

export const useNotificationStore = defineStore('notifications', {
    state: () => ({
        events: [] as ServerEvent[],
        readIds: new Set<string>() as Set<string>,
        stats: null as NotificationStats | null,
        connected: false,
        initialized: false,
        loading: false,
        /** Toast queue — consumed by the header/UI to show in-app toasts */
        toastQueue: [] as ServerEvent[],
        pollTimer: null as ReturnType<typeof setInterval> | null,
        /** 
         * Actions recently performed by THIS user. 
         * Used to attribute anonymous "system" SSE events back to the current user.
         */
        trackedActions: [] as Array<{ entity: string; entity_id: string; timestamp: number }>,
    }),

    getters: {
        unreadCount(state): number {
            return state.events.filter(e => !e.is_read && !state.readIds.has(e.id)).length;
        },

        recentForDropdown(state): Array<ServerEvent & { timeAgoStr: string; isRead: boolean }> {
            return state.events.slice(0, 5).map(e => ({
                ...e,
                timeAgoStr: timeAgo(e.timestamp),
                isRead: !!(e.is_read || state.readIds.has(e.id)),
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
                isRead: !!(e.is_read || state.readIds.has(e.id)),
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
                unread: events.filter(e => !e.is_read && !state.readIds.has(e.id)).length,
                updates: events.filter(e => e.type === 'updated').length,
                deletes: events.filter(e => e.type === 'deleted').length,
                creates: events.filter(e => e.type === 'created').length,
            };
        },

        /** Pop the next toast to display */
        nextToast(state): ServerEvent | null {
            return state.toastQueue.length > 0 ? state.toastQueue[0] : null;
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
            console.log('[NotificationStore] Initializing...');

            // Request browser notification permission
            if ('Notification' in window && Notification.permission === 'default') {
                Notification.requestPermission();
            }

            // 1. Ensure users are loaded for proper attribution mapping
            try {
                const usersStore = useUsersStore();
                if (!usersStore.initialized) {
                    await usersStore.initialize();
                }
            } catch (err) {
                console.warn('[NotificationStore] Failed to load users for attribution mapping', err);
            }

            // 2. Load notification history from backend (GET /api/notifications)
            try {
                const history = await notificationService.getAll();
                console.log('[NotificationStore] Loaded history:', history?.length || 0, 'items');
                if (Array.isArray(history) && history.length > 0) {
                    const normalized = history
                        .map((raw: any) => normalizeEvent(raw))
                        .filter((e): e is ServerEvent => e !== null);

                    // Newest first — sort by timestamp descending
                    normalized.sort((a, b) =>
                        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
                    );

                    this.events = normalized.slice(0, MAX_EVENTS);

                    // Sync read state from backend
                    normalized.forEach(e => {
                        if (e.is_read) this.readIds.add(e.id);
                    });
                }
            } catch (err) {
                console.warn('[NotificationStore] Failed to load history from backend:', err);
            }

            this.loading = false;

            // 3. Open SSE for real-time events
            console.log('[NotificationStore] Connecting to SSE...');
            notificationService.connect(
                (raw: any) => this.onEvent(raw),
                (connected: boolean) => { 
                    this.connected = connected;
                    console.log('[NotificationStore] SSE connection state:', connected ? 'CONNECTED' : 'DISCONNECTED');
                    // If SSE fails, start polling as fallback
                    if (!connected && !this.pollTimer) {
                        this.startPolling();
                    } else if (connected && this.pollTimer) {
                        this.stopPolling();
                    }
                },
            );

            // 4. Start polling as safety net (SSE might not be available on backend)
            this.startPolling();
        },

        /** Start polling as a fallback mechanism */
        startPolling() {
            if (this.pollTimer) return;
            this.pollTimer = setInterval(async () => {
                try {
                    const all = await notificationService.getAll();
                    if (Array.isArray(all) && all.length > 0) {
                        const normalized = all
                            .map((raw: any) => normalizeEvent(raw))
                            .filter((e): e is ServerEvent => e !== null);

                        // Find truly new notifications (not in current events)
                        const existingIds = new Set(this.events.map(e => e.id));
                        const newEvents = normalized.filter(e => !existingIds.has(e.id));

                        // Add new events and trigger toast
                        newEvents.forEach(e => {
                            this.events.unshift(e);
                            if (!e.is_read) {
                                this.toastQueue.push(e);
                                showBrowserNotification(e);
                            }
                        });

                        // Update read states from server
                        normalized.forEach(e => {
                            if (e.is_read) this.readIds.add(e.id);
                        });

                        // Trim
                        if (this.events.length > MAX_EVENTS) {
                            this.events = this.events.slice(0, MAX_EVENTS);
                        }
                    }
                } catch (err) {
                    // Silent fail for polling
                }
            }, POLL_INTERVAL_MS);
        },

        /** Stop polling */
        stopPolling() {
            if (this.pollTimer) {
                clearInterval(this.pollTimer);
                this.pollTimer = null;
            }
        },

        /** Handle an incoming SSE event — normalize, prepend, and persist */
        async onEvent(raw: any) {
            console.log('[NotificationStore] Incoming event:', raw);
            const event = normalizeEvent(raw);
            if (!event) {
                console.log('[NotificationStore] Event ignored (ping or invalid)');
                return;
            }

            // --- SELF-ACTION ATTRIBUTION (Frontend Safety) ---
            // If the event arrives as "system" but we have an actor_id or it matches our local tracking,
            // we attribute it to "Saya" or the real user identity.
            const isSystemActor = event.user.name === 'Sistem' || raw.actor_type === 'system';
            
            if (isSystemActor && event.entity_id) {
                const now = Date.now();
                console.log(`[NotificationStore] Anonymous ${event.entity} event detected. Checking fallback...`);
                
                // 1. Cross-reference with our 'Self-Action Tracking' (The user just did it)
                const myActionIndex = this.trackedActions.findIndex(a => {
                    const match = String(a.entity) === String(event.entity) && String(a.entity_id) === String(event.entity_id);
                    return match && (now - a.timestamp) < 20000; // 20s window
                });

                if (myActionIndex !== -1) {
                    const authStore = useAuthStore();
                    if (authStore.currentUser) {
                        console.log('[NotificationStore] Safety Fallback: Attributing anonymous action to Current User (Action Tracked)');
                        event.user = {
                            id: authStore.currentUser.id || '',
                            name: authStore.currentUser.name || authStore.currentUser.username || 'Saya',
                            role: authStore.currentUser.role || 'user',
                            avatar: formatImageUrl((authStore.currentUser as any).photo || authStore.currentUser.foto_profile)
                        };
                        this.trackedActions.splice(myActionIndex, 1);
                    }
                } 
                // 2. Logic Fallback: If we have an actor_id that isn't null, but backend incorrectly said 'system'
                else if (raw.actor_id && raw.actor_id !== 'system') {
                    console.log('[NotificationStore] Safety Fallback: Recovering user from actor_id field');
                    const usersStore = useUsersStore();
                    const found = usersStore.getUserById(String(raw.actor_id));
                    if (found) {
                        event.user = {
                            id: String(found.id),
                            name: found.name || found.username || 'User',
                            role: found.role || 'user',
                            avatar: formatImageUrl(found.photo || (found as any).foto_profile)
                        };
                    }
                }
            }

            // --- SMART DEDUPLICATION ---
            // If the same entity action arrived just recently (within 5s), ignore it.
            // This specifically handles the case where the backend sends a "system" event 
            // and a "user" event for the same database record.
            const duplicate = this.events.find(e => 
                (e.id === event.id) || 
                (e.entity === event.entity && e.entity_id === event.entity_id && e.message === event.message)
            );

            if (duplicate) {
                // If the new event has better user info than the duplicate we already have, 
                // we "upgrade" the existing one rather than adding a new one.
                if (duplicate.user.name === 'Sistem' && event.user.name !== 'Sistem') {
                    console.log('[NotificationStore] Upgrading duplicate with real user info:', event.user.name);
                    duplicate.user = event.user;
                } else {
                    console.log('[NotificationStore] Duplicate event ignored:', event.id);
                }
                return;
            }

            this.events.unshift(event);
            if (this.events.length > MAX_EVENTS) {
                this.events = this.events.slice(0, MAX_EVENTS);
            }

            // -- PERSISTENCE TO DATABASE --
            try {
                const authStore = useAuthStore();
                const currentUserId = authStore.currentUser?.id;
                const eventUserId = String(raw.user_id || raw.actor_id || '');

                // Only the triggering user saves to DB
                if (eventUserId === currentUserId) {
                    console.log('[NotificationStore] Saving our own action to database...');
                    await notificationService.saveNotification(event);
                }
            } catch (err) {
                console.error('[NotificationStore] Error during persistence check:', err);
            }

            // Push to toast queue
            this.toastQueue.push(event);

            // Show browser notification
            showBrowserNotification(event);
        },

        /** Dismiss the oldest toast from the queue */
        dismissToast() {
            this.toastQueue.shift();
        },

        /**
         * Mark a single notification as read — persists to backend.
         * PATCH /api/notifications/{id}/read
         */
        async markAsRead(id: string) {
            this.readIds.add(id);
            // Update the event's is_read flag locally
            const evt = this.events.find(e => e.id === id);
            if (evt) evt.is_read = true;

            // Persist to backend
            await notificationService.markAsRead(id);
        },

        /**
         * Mark all notifications as read — persists to backend.
         * PATCH /api/notifications/read-all
         */
        async markAllAsRead() {
            this.events.forEach(e => {
                this.readIds.add(e.id);
                e.is_read = true;
            });

            // Persist to backend
            await notificationService.markAllAsRead();
        },

        /**
         * Delete notification at backend level.
         * DELETE /api/notifications/{id}
         */
        async deleteEvent(id: string) {
            // Remove locally first for instant UI feedback
            this.events = this.events.filter(e => e.id !== id);
            this.readIds.delete(id);
            
            // Then delete from backend
            try {
                await notificationService.deleteNotification(id);
            } catch(e) {}
        },

        /**
         * Clear all notifications at backend level.
         * DELETE /api/notifications
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

        /**
         * Track an action performed by the current user.
         * Call this before making an API request that will trigger an SSE event.
         */
        trackSelfAction(entity: string, entity_id: string) {
            console.log(`[NotificationStore] Tracking self action: ${entity} (id: ${entity_id})`);
            this.trackedActions.push({ 
                entity, 
                entity_id: String(entity_id), 
                timestamp: Date.now() 
            });
            // Cleanup old tracking data (> 30s)
            if (this.trackedActions.length > 50) {
                const now = Date.now();
                this.trackedActions = this.trackedActions.filter(a => (now - a.timestamp) < 30000);
            }
        },

        disconnect() {
            notificationService.disconnect();
            this.stopPolling();
            this.connected = false;
            this.initialized = false;
            this.events = [];
            this.readIds = new Set();
            this.stats = null;
            this.toastQueue = [];
        },
    },
});
