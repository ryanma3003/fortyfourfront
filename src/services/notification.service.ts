import { config } from '@/config/env';
import { api } from '@/config/api';
import type { ServerEvent, NotificationStats } from '@/types/notification.types';

/**
 * Notification Service
 *
 * 1. SSE connection to /api/events for real-time event streaming.
 *    Filters out ping/heartbeat events before dispatching.
 * 2. REST calls for stats, history, and deletion.
 */

type EventCallback = (event: ServerEvent) => void;

/** Event types that are heartbeats, not real notifications */
const IGNORED_TYPES = new Set(['ping', 'heartbeat', 'keepalive', 'keep-alive', 'connection', 'connected']);

/** Reconnect backoff steps in ms */
const BACKOFF_MS = [3000, 6000, 12000, 30000];

class NotificationService {
    private eventSource: EventSource | null = null;
    private onEventCallback: EventCallback | null = null;
    private onConnectionChange: ((connected: boolean) => void) | null = null;
    private reconnectAttempt = 0;
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    private _connected = false;

    /** Build the full URL for a given API path */
    private buildUrl(path: string): string {
        const base = config.api.baseUrl.replace(/\/$/, '');
        const clean = path.replace(/^\//, '');
        return base ? `${base}/${clean}` : `/${clean}`;
    }

    /**
     * Check if an SSE message is a ping/heartbeat that should be ignored.
     */
    private isPingEvent(data: any): boolean {
        if (!data) return true;

        // Check by type field
        const type = (data.type || data.event_type || data.action || '').toLowerCase();
        if (IGNORED_TYPES.has(type)) return true;

        // Check by entity field
        const entity = (data.entity || data.resource || data.model || '').toLowerCase();
        if (entity === 'ping' || entity === 'heartbeat') return true;

        // Check if it's a bare ping string
        if (typeof data === 'string' && IGNORED_TYPES.has(data.toLowerCase())) return true;

        return false;
    }

    /**
     * Open the SSE connection.
     * @param onEvent  Called for each real (non-ping) incoming event.
     * @param onConnectionChange  Called when connected/disconnected.
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
                console.log('[NotificationService] SSE connected');
            };

            this.eventSource.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);

                    // Skip ping / heartbeat events
                    if (this.isPingEvent(data)) {
                        return;
                    }

                    this.onEventCallback?.(data);
                } catch (err) {
                    // If it's not JSON, it's likely a ping string — ignore
                    console.debug('[NotificationService] Non-JSON SSE message (ignored):', event.data);
                }
            };

            this.eventSource.onerror = () => {
                console.warn('[NotificationService] SSE error, will reconnect...');
                this.closeConnection();
                this.setConnected(false);
                this.scheduleReconnect();
            };
        } catch (err) {
            console.error('[NotificationService] Failed to create EventSource:', err);
            this.setConnected(false);
            this.scheduleReconnect();
        }
    }

    private scheduleReconnect(): void {
        const delay = BACKOFF_MS[Math.min(this.reconnectAttempt, BACKOFF_MS.length - 1)];
        this.reconnectAttempt++;
        console.log(`[NotificationService] Reconnecting in ${delay / 1000}s (attempt ${this.reconnectAttempt})...`);

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
        console.log('[NotificationService] SSE disconnected');
    }

    /** Whether the SSE connection is currently open. */
    get connected(): boolean {
        return this._connected;
    }

    // ── REST endpoints ──────────────────────────────────

    /** Fetch notification statistics. */
    async getStats(): Promise<NotificationStats> {
        return api.get<NotificationStats>('/api/events/stats');
    }

    /**
     * Fetch notification history from backend.
     * Events persist server-side — reload does not lose them.
     */
    async getHistory(): Promise<any[]> {
        try {
            const res = await api.get<any>('/api/events/history');
            // Backend might return { data: [...] } or [...] directly
            return Array.isArray(res) ? res : (res?.data || res?.events || res?.notifications || []);
        } catch (err) {
            console.warn('[NotificationService] Failed to fetch history:', err);
            return [];
        }
    }

    /**
     * Delete a notification on the backend (admin action).
     */
    async deleteNotification(id: string): Promise<void> {
        try {
            await api.delete(`/api/events/${id}`);
        } catch (err) {
            console.warn('[NotificationService] Failed to delete notification:', err);
        }
    }

    /**
     * Delete all notifications on the backend (admin action).
     */
    async clearAll(): Promise<void> {
        try {
            await api.delete('/api/events/all');
        } catch (err) {
            console.warn('[NotificationService] Failed to clear all:', err);
        }
    }
}

/** Singleton instance */
export const notificationService = new NotificationService();
