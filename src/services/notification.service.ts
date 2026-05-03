import { config } from '@/config/env';
import { api, ApiRequestError } from '@/config/api';
import type { NotificationStats } from '@/types/notification.types';

/**
 * Notification Service
 *
 * Handles SSE connection and REST API calls for persistent notifications.
 *
 * SSE Endpoints:
 *   GET  /api/events       → Server-Sent Events connection (real-time)
 *   GET  /api/events/stats  → SSE connection statistics
 *
 * Notification REST Endpoints:
 *   GET    /api/notifications           → Fetch all notifications (from DB)
 *   DELETE /api/notifications           → Delete all notifications
 *   PATCH  /api/notifications/read-all  → Mark all as read
 *   DELETE /api/notifications/{id}      → Delete single notification
 *   PATCH  /api/notifications/{id}      → Mark single notification as read
 *
 * IMPORTANT: The backend is responsible for saving notifications to the DB
 * during every CRUD mutation. The frontend NEVER creates notifications—it
 * only reads, marks-as-read, and deletes them.
 */

type EventCallback = (event: any) => void;

export type NotificationFetchResult = {
    notifications: any[];
    unread_count: number;
    ok: boolean;
    status?: number;
    error?: string;
};

/** Event types that are heartbeats, not real notifications */
const IGNORED_TYPES = new Set([
    'ping', 'heartbeat', 'keepalive', 'keep-alive',
    'connection', 'connected', 'welcome',
]);

/** Delay between SSE reconnect attempts in ms */
const RECONNECT_INTERVAL_MS = 10_000;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_COOLDOWN_MS = 5 * 60_000;
const SSE_EVENT_NAMES = [
    'notification',
    'notifications',
    'created',
    'updated',
    'deleted',
    'create',
    'update',
    'delete',
    'activity',
    'data-change',
    'database-change',
    'db-change',
];

class NotificationService {
    private eventSource: EventSource | null = null;
    private onEventCallback: EventCallback | null = null;
    private onConnectionChange: ((connected: boolean) => void) | null = null;
    private reconnectAttempt = 0;
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    private _connected = false;

    // ── SSE Connection ───────────────────────────────────────────────

    /** Build the full URL for a given API path */
    private buildUrl(path: string): string {
        const base = config.api.baseUrl.replace(/\/$/, '');
        const clean = path.replace(/^\//, '');
        return base ? `${base}/${clean}` : `/${clean}`;
    }

    /** Normalize incoming event to include read status */
    private normalizeToServerEvent(raw: any) {
        return {
            ...raw,
            is_read: !!(raw.read || raw.is_read || raw.read_at)
        };
    }

    /** Check if an SSE message is a ping/heartbeat that should be ignored. */
    private isPingEvent(data: any): boolean {
        if (!data) return true;
        const type = String(data.type || data.event_type || data.action || '').toLowerCase();
        if (IGNORED_TYPES.has(type)) return true;
        const entity = String(data.entity || data.resource || data.model || '').toLowerCase();
        if (entity === 'ping' || entity === 'heartbeat') return true;
        if (typeof data === 'string' && IGNORED_TYPES.has(data.toLowerCase())) return true;
        return false;
    }

    private parseEventPayload(event: MessageEvent): any | null {
        const rawData = event.data;
        if (rawData == null || rawData === '') return null;

        let parsed: any = rawData;
        if (typeof rawData === 'string') {
            try {
                parsed = JSON.parse(rawData);
            } catch {
                if (IGNORED_TYPES.has(rawData.toLowerCase())) return null;
                parsed = { message: rawData };
            }
        }

        const sseEventType = event.type && event.type !== 'message' ? event.type : '';
        if (parsed && typeof parsed === 'object' && sseEventType) {
            const hasActionType = !!(parsed.type || parsed.event_type || parsed.action);
            parsed = {
                ...parsed,
                ...(hasActionType ? {} : { type: sseEventType }),
            };
        }

        if (parsed && typeof parsed === 'object' && parsed.data && typeof parsed.data === 'object') {
            const envelopeType = parsed.type || parsed.event_type || parsed.action || sseEventType;
            const payloadType = parsed.data.type || parsed.data.event_type || parsed.data.action;
            parsed = {
                ...parsed.data,
                ...(payloadType ? {} : { type: envelopeType }),
                notification_id: parsed.notification_id || parsed.id_notification || parsed.data.notification_id || parsed.data.id_notification,
            };
        }

        return this.normalizeToServerEvent(parsed);
    }

    private handleIncomingEvent = (event: MessageEvent): void => {
        const data = this.parseEventPayload(event);
        if (!data || this.isPingEvent(data)) return;
        this.onEventCallback?.(data);
    };

    /**
     * Open the SSE connection to /api/events.
     * @param onEvent Called for each real (non-ping) incoming event.
     * @param onConnectionChange Called when connected/disconnected.
     */
    connect(onEvent: EventCallback, onConnectionChange?: (connected: boolean) => void): void {
        this.onEventCallback = onEvent;
        this.onConnectionChange = onConnectionChange ?? null;
        if (this.eventSource || this.reconnectTimer) return;
        this.openConnection();
    }

    private openConnection(): void {
        const url = this.buildUrl('/api/events');
        try {
            this.eventSource = new EventSource(url, { withCredentials: true });

            this.eventSource.onopen = () => {
                this.reconnectAttempt = 0;
                this.setConnected(true);
                console.log('[NotifService] SSE connected →', url);
            };

            this.eventSource.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (this.isPingEvent(data)) return;
                    this.onEventCallback?.(data);
                } catch {
                    // Non-JSON message (likely a ping string) — ignore
                }
            };

            this.eventSource.onmessage = this.handleIncomingEvent;

            SSE_EVENT_NAMES.forEach((eventName) => {
                this.eventSource?.addEventListener(eventName, this.handleIncomingEvent as EventListener);
            });

            this.eventSource.onerror = () => {
                console.warn('[NotifService] SSE error, reconnecting...');
                this.closeConnection();
                this.setConnected(false);
                this.scheduleReconnect();
            };
        } catch (err) {
            console.error('[NotifService] Failed to create EventSource:', err);
            this.setConnected(false);
            this.scheduleReconnect();
        }
    }

    private scheduleReconnect(): void {
        if (this.reconnectTimer) return;
        this.reconnectAttempt++;

        if (this.reconnectAttempt > MAX_RECONNECT_ATTEMPTS) {
            console.warn('[NotifService] SSE unavailable; falling back to polling for now.');
            this.reconnectTimer = setTimeout(() => {
                this.reconnectTimer = null;
                this.reconnectAttempt = 0;
                if (this.onEventCallback) this.openConnection();
            }, RECONNECT_COOLDOWN_MS);
            return;
        }

        const delay = Math.min(RECONNECT_INTERVAL_MS * this.reconnectAttempt, 60_000);
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            if (this.onEventCallback) this.openConnection();
        }, delay);
    }

    private setConnected(value: boolean): void {
        this._connected = value;
        this.onConnectionChange?.(value);
    }

    private closeConnection(): void {
        if (this.eventSource) {
            this.eventSource.close();
            this.eventSource = null;
        }
    }

    /** Disconnect and stop reconnect attempts. */
    disconnect(): void {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        this.closeConnection();
        this.setConnected(false);
        this.reconnectAttempt = 0;
        this.onEventCallback = null;
        this.onConnectionChange = null;
    }

    /** Whether the SSE connection is currently open. */
    get connected(): boolean {
        return this._connected;
    }

    // ── REST API Endpoints ───────────────────────────────────────────

    /**
     * Fetch all notifications from the database.
     * GET /api/notifications
     *
     * Expected response:
     * { data: [{id, message, type, read, created_at, user_id?, ...}], unread_count?: number }
     */
    async fetchAll(): Promise<NotificationFetchResult> {
        try {
            const res = await api.get<any>('/api/notifications');

            if (res && typeof res === 'object' && res.status === 'error') {
                return {
                    notifications: [],
                    unread_count: 0,
                    ok: false,
                    error: res.message || 'Notification API returned an error',
                };
            }
            
            let notifsArray: any[] = [];
            
            if (Array.isArray(res)) {
                notifsArray = res;
            } else if (res && typeof res === 'object') {
                if (Array.isArray(res.data)) {
                    notifsArray = res.data;
                } else if (Array.isArray(res.notifications)) {
                    notifsArray = res.notifications;
                } else if (res.data && Array.isArray(res.data.notifications)) {
                    notifsArray = res.data.notifications;
                }
            }

            let unreadCount = 0;
            if (res && typeof res === 'object' && typeof res.unread_count === 'number') {
                unreadCount = res.unread_count;
            } else if (res && res.data && typeof res.data.unread_count === 'number') {
                unreadCount = res.data.unread_count;
            } else {
                unreadCount = notifsArray.filter((n: any) => !(n.read || n.is_read || n.read_at)).length;
            }

            return {
                notifications: notifsArray,
                unread_count: unreadCount,
                ok: true,
            };
        } catch (err) {
            console.warn('[NotifService] fetchAll failed:', err);
            return {
                notifications: [],
                unread_count: 0,
                ok: false,
                status: err instanceof ApiRequestError ? err.status : undefined,
                error: err instanceof Error ? err.message : 'Failed to fetch notifications',
            };
        }
    }

    /**
     * Mark a single notification as read.
     * PATCH /api/notifications/{id}/read
     */
    async markAsRead(id: string): Promise<boolean> {
        const cleanId = encodeURIComponent(id);
        try {
            await api.patch(`/api/notifications/${cleanId}/read`, {});
            return true;
        } catch (err) {
            console.warn('[NotifService] markAsRead failed:', id, err);
            return false;
        }
    }

    /**
     * Mark all notifications as read.
     * PATCH /api/notifications/read-all
     */
    async markAllAsRead(): Promise<boolean> {
        try {
            await api.patch('/api/notifications/read-all', {});
            return true;
        } catch (err) {
            console.warn('[NotifService] markAllAsRead failed:', err);
            return false;
        }
    }

    /**
     * Delete a single notification.
     * DELETE /api/notifications/{id}
     */
    async deleteOne(id: string): Promise<boolean> {
        const cleanId = encodeURIComponent(id);
        try {
            await api.delete(`/api/notifications/${cleanId}`);
            return true;
        } catch (err) {
            console.warn('[NotifService] deleteOne failed:', id, err);
            return false;
        }
    }

    /**
     * Delete all notifications.
     * DELETE /api/notifications
     */
    async deleteAll(): Promise<boolean> {
        try {
            await api.delete('/api/notifications');
            return true;
        } catch (err) {
            console.warn('[NotifService] deleteAll failed:', err);
            return false;
        }
    }

    /**
     * Fetch SSE statistics.
     * GET /api/events/stats
     */
    async getStats(): Promise<NotificationStats | null> {
        try {
            return await api.get<NotificationStats>('/api/events/stats');
        } catch (err) {
            console.warn('[NotifService] getStats failed:', err);
            return null;
        }
    }
}

/** Singleton instance */
export const notificationService = new NotificationService();
