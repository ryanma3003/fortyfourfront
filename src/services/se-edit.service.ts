import { api } from '@/config/api';
import type { SeEditRequest, ReviewSeEditRequestPayload } from '@/types/se-edit.types';
import { useNotificationStore } from '@/stores/notifications';

/**
 * SE Edit Request Service
 * Handles workflows for requesting and reviewing edits to Sistem Elektronik (SE).
 */
export const seEditService = {
    /**
     * Get list of SE edit requests.
     * Backend logic:
     * - Admin: Returns all pending/all requests.
     * - User: Returns only requests created by the user.
     */
    async getRequests(): Promise<SeEditRequest[]> {
        const res = await api.get<any>('/api/se/edit-requests');
        // Standard unwrap if backend returns { data: [] }
        return Array.isArray(res) ? res : (res.data || []);
    },

    /**
     * Submit a new edit request for an SE.
     * @param seId The ID of the SE to edit.
     * @param proposedChanges The new data values.
     */
    async createRequest(seId: string | number, proposedChanges: any): Promise<SeEditRequest> {
        return api.post<SeEditRequest>('/api/se/edit-requests', {
            id_se: seId,
            proposed_changes: proposedChanges
        });
    },

    /**
     * Review an edit request (Admin only).
     * @param requestId The ID of the request.
     * @param payload status (approved/rejected) and optional notes.
     */
    async reviewRequest(requestId: string | number, payload: ReviewSeEditRequestPayload): Promise<SeEditRequest> {
        useNotificationStore().trackSelfAction('se_edit_request', String(requestId));
        return api.put<SeEditRequest>(`/api/se/edit-requests/${requestId}/review`, payload);
    },

    /**
     * Get a specific request by ID.
     */
    async getRequestById(id: string | number): Promise<SeEditRequest> {
        return api.get<SeEditRequest>(`/api/se/edit-requests/${id}`);
    }
};
