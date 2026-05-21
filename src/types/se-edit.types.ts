import type { SeCsirt } from "./csirt.types";
import type { User } from "./user.types";

export type SeEditRequestStatus = 'pending' | 'approved' | 'rejected';

export interface SeEditRequest {
    id: string | number;
    id_se: string | number;
    id_user: string | number;
    status: SeEditRequestStatus;
    proposed_changes: Partial<SeCsirt>;
    admin_notes?: string;
    created_at: string;
    updated_at: string;
    
    // Flat fields from API response
    nama_user?: string;
    nama_se?: string;
    data_perubahan?: Record<string, any>;
    catatan?: string;
    catatan_user?: string;

    // Relations (if provided by backend)
    user?: User;
    se?: SeCsirt;
}

export interface ReviewSeEditRequestPayload {
    status: 'approved' | 'rejected';
    admin_notes?: string;
}
