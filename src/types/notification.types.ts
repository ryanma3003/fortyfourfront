/**
 * Notification System Types
 * Types for SSE-based real-time notifications.
 */

/** A single field-level change within an update event */
export interface FieldChange {
    field: string;
    old_value?: string;
    new_value?: string;
}

/** The user who performed the action */
export interface EventActor {
    id: string;
    name: string;
    role: string;
    avatar?: string;
}

/**
 * A server-sent event representing a data change.
 * Received via EventSource from /api/events.
 */
export interface ServerEvent {
    id: string;
    api_id?: string;       // canonical notification id to send back to the backend
    type: 'created' | 'updated' | 'deleted';
    entity: string;        // e.g. 'stakeholder', 'user', 'kse', 'csirt', 'ikas'
    entity_id: string;
    entity_name: string;   // e.g. "PT Contoh Makmur"
    field_changes?: FieldChange[];
    user: EventActor;
    timestamp: string;     // ISO 8601
    message: string;       // human-readable summary from server
    is_read?: boolean;     // read state from backend
}

/** Statistics from GET /api/events/stats */
export interface NotificationStats {
    total?: number;
    unread?: number;
    active_connections?: number;
    connections?: number;
    users?: number;
    by_type?: {
        created?: number;
        updated?: number;
        deleted?: number;
    };
    by_entity?: Record<string, number>;
    [key: string]: any;
}

/**
 * Map entity keys to Indonesian display labels.
 */
export const ENTITY_LABELS: Record<string, string> = {
    stakeholder: 'Stakeholder',
    user: 'User',
    kse: 'Penilaian KSE',
    csirt: 'Data CSIRT',
    ikas: 'Penilaian IKAS',
    perusahaan: 'Perusahaan',
    role: 'Role',
    jabatan: 'Jabatan',
    pic: 'PIC',
    se: 'Sistem Elektronik',
    se_csirt: 'Sistem Elektronik CSIRT',
    sdm_csirt: 'SDM CSIRT',
    personel: 'Personel CSIRT',
    stakeholder_csirt: 'Stakeholder CSIRT',
    domain: 'Domain IKAS',
    category: 'Kategori IKAS',
    sub_category: 'Sub-Kategori IKAS',
    ruang_lingkup: 'Ruang Lingkup IKAS',
    pertanyaan_ikas: 'Pertanyaan IKAS',
    jawaban_ikas: 'Jawaban IKAS',
    sektor: 'Sektor',
    sub_sektor: 'Sub Sektor',
    kelas: 'Kelas LMS',
    materi: 'Materi LMS',
    file_pendukung: 'File Pendukung',
    kuis: 'Kuis LMS',
    soal: 'Soal Kuis',
    aktivitas: 'Aktivitas',
    kegiatan: 'Kegiatan',
    se_edit_request: 'Permintaan Edit SE',
    casbin_policy: 'Hak Akses',
};

/**
 * Map action types to Indonesian verbs.
 */
export const ACTION_VERBS: Record<string, string> = {
    created: 'menambahkan',
    updated: 'memperbarui',
    deleted: 'menghapus',
};
