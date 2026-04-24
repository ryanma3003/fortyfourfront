import { config } from '@/config/env';
import { api } from '@/config/api';
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

/** Event types that are heartbeats, not real notifications */
const IGNORED_TYPES = new Set([
    'ping', 'heartbeat', 'keepalive', 'keep-alive',
    'connection', 'connected', 'welcome',
]);

/** Reconnect backoff steps in ms */
const BACKOFF_MS = [2000, 5000, 10000, 30000];

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

    /**
     * Open the SSE connection to /api/events.
     * @param onEvent Called for each real (non-ping) incoming event.
     * @param onConnectionChange Called when connected/disconnected.
     */
    connect(onEvent: EventCallback, onConnectionChange?: (connected: boolean) => void): void {
        if (this.eventSource) return;
        this.onEventCallback = onEvent;
        this.onConnectionChange = onConnectionChange ?? null;
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
        const delay = BACKOFF_MS[Math.min(this.reconnectAttempt, BACKOFF_MS.length - 1)];
        this.reconnectAttempt++;
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.openConnection();
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
     * { notifications: [{id, message, type, read, created_at, user_id?, ...}], unread_count: number }
     */
    async fetchAll(): Promise<{ notifications: any[]; unread_count: number }> {
        try {
            const res = await api.get<any>('/api/notifications');

            // Shape: { notifications: [...], unread_count: X }
            if (res && typeof res === 'object' && 'notifications' in res) {
                return {
                    notifications: Array.isArray(res.notifications) ? res.notifications : [],
                    unread_count: typeof res.unread_count === 'number' ? res.unread_count : 0,
                };
            }

            // Fallback: backend returned a flat array
            if (Array.isArray(res)) {
                return {
                    notifications: res,
                    unread_count: res.filter((n: any) => !n.read).length,
                };
            }

            return { notifications: [], unread_count: 0 };
        } catch (err) {
            console.warn('[NotifService] fetchAll failed:', err);
            return { notifications: [], unread_count: 0 };
        }
    }

    /**
     * Mark a single notification as read.
     * PATCH /api/notifications/{id}/read
     */
    async markAsRead(id: string): Promise<boolean> {
        const cleanId = encodeURIComponent(id);
        const paths = [
            { method: 'PATCH', url: `/api/notifications/${cleanId}/read` },
            { method: 'POST',  url: `/api/notifications/${cleanId}/mark-as-read` },
            { method: 'PATCH', url: `/api/notifications/${cleanId}`, body: { is_read: true, read: true } }
        ];

        for (const p of paths) {
            try {
                if (p.method === 'PATCH') await api.patch(p.url, p.body || {});
                else await api.post(p.url, p.body || {});
                return true;
            } catch { /* try next */ }
        }
        console.warn('[NotifService] markAsRead failed for all paths:', id);
        return false;
    }

    /**
     * Mark all notifications as read.
     * PATCH /api/notifications/read-all
     */
    async markAllAsRead(): Promise<boolean> {
        const paths = [
            { method: 'PATCH', url: '/api/notifications/read-all' },
            { method: 'POST',  url: '/api/notifications/mark-all-as-read' },
            { method: 'PATCH', url: '/api/notifications', body: { is_read: true, read: true } }
        ];

        for (const p of paths) {
            try {
                if (p.method === 'PATCH') await api.patch(p.url, p.body || {});
                else await api.post(p.url, p.body || {});
                return true;
            } catch { /* try next */ }
        }
        console.warn('[NotifService] markAllAsRead failed for all paths');
        return false;
    }

    /**
     * Delete a single notification.
     * DELETE /api/notifications/{id}
     */
    async deleteOne(id: string): Promise<boolean> {
        const cleanId = encodeURIComponent(id);
        try {
            // 1. Try standard DELETE
            await api.delete(`/api/notifications/${cleanId}`);
            return true;
        } catch (err) {
            try {
                // 2. Try POST fallback for environments where DELETE is restricted
                await api.post(`/api/notifications/${cleanId}/delete`, {});
                return true;
            } catch {
                console.warn('[NotifService] deleteOne failed:', id, err);
                return false;
            }
        }
    }

    /**
     * Delete all notifications.
     * DELETE /api/notifications
     */
    async deleteAll(): Promise<boolean> {
        try {
            // 1. Try standard bulk DELETE
            await api.delete('/api/notifications');
            return true;
        } catch (err) {
            try {
                // 2. Try POST fallback
                await api.post('/api/notifications/delete-all', {});
                return true;
            } catch {
                console.warn('[NotifService] deleteAll failed:', err);
                return false;
            }
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
