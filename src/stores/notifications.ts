import { defineStore } from 'pinia';
import { notificationService } from '@/services/notification.service';
import { ENTITY_LABELS, ACTION_VERBS } from '@/types/notification.types';
import type { ServerEvent, NotificationStats } from '@/types/notification.types';

import { useAuthStore } from './auth';
import { useUsersStore } from './users';
import { useStakeholdersStore } from './stakeholders';
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

function normalizeNotificationText(value?: string): string {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ');
}

function isGenericIkasRequestEvent(event: Pick<ServerEvent, 'entity' | 'message' | 'entity_name'>): boolean {
    const entity = normalizeEntityKey(event.entity);
    const text = normalizeNotificationText(`${event.message || ''} ${event.entity_name || ''}`);
    return entity === 'ikas' && /ikas_request\s+baru.*berhasil\s+ditambahkan/i.test(text);
}

function isDetailedIkasRequestEvent(event: Pick<ServerEvent, 'entity' | 'message' | 'entity_name'>): boolean {
    const entity = normalizeEntityKey(event.entity);
    const text = normalizeNotificationText(`${event.message || ''} ${event.entity_name || ''}`);
    return entity === 'ikas' && /mengajukan\s+permintaan\s+edit\s+data\s+ikas|request\s*edit\s+data\s+ikas/i.test(text);
}

function getIkasRequestContextKey(event: Pick<ServerEvent, 'entity' | 'message' | 'entity_name'>): string {
    const entityName = normalizeNotificationText(
        inferRequestEditTarget(event.message)?.name
        || event.entity_name
        || getCompanyNameFromText(event.message)
    );
    return entityName;
}

function getEventSignature(event: ServerEvent): string {
    const requestTarget = inferRequestEditTarget(event.message);
    const entity = requestTarget?.entity || normalizeEntityKey(event.entity);
    const name = normalizeNotificationText(requestTarget?.name || event.entity_name);
    const message = normalizeNotificationText(event.message);
    const actor = normalizeNotificationText(event.user?.id || event.user?.name);
    const action = isRequestEditEvent(event) ? 'request-edit' : event.type;

    return [action, entity, name, message, actor].join('|');
}

function areSameNotification(a: ServerEvent, b: ServerEvent, windowMs = 120_000): boolean {
    if (a.id && b.id && a.id === b.id) return true;
    if (isGenericIkasRequestEvent(a) && isDetailedIkasRequestEvent(b) && getIkasRequestContextKey(a) === getIkasRequestContextKey(b)) return true;
    if (isDetailedIkasRequestEvent(a) && isGenericIkasRequestEvent(b) && getIkasRequestContextKey(a) === getIkasRequestContextKey(b)) return true;
    if (getEventSignature(a) !== getEventSignature(b)) return false;

    const at = new Date(a.timestamp).getTime();
    const bt = new Date(b.timestamp).getTime();
    if (Number.isNaN(at) || Number.isNaN(bt)) return true;

    return Math.abs(at - bt) <= windowMs;
}

function dedupeEvents(events: ServerEvent[]): ServerEvent[] {
    const result: ServerEvent[] = [];

    for (const event of events) {
        const existing = result.find(item => areSameNotification(item, event));
        if (!existing) {
            result.push(event);
            continue;
        }

        if (isGenericIkasRequestEvent(existing) && isDetailedIkasRequestEvent(event)) {
            Object.assign(existing, event);
        } else if (isTemporarySseId(existing.id) && !isTemporarySseId(event.id) && !isDetailedIkasRequestEvent(existing)) {
            Object.assign(existing, event);
        } else if (isPlaceholderName(existing.user?.name) && !isPlaceholderName(event.user?.name)) {
            existing.user = event.user;
        }

        existing.is_read = !!(existing.is_read && event.is_read);
    }

    return result;
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

function normalizeRoleKey(role?: string): string {
    const normalized = String(role || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/-/g, '_');

    if (!normalized) return '';

    const aliases: Record<string, string> = {
        pic: 'user_pic',
        userpic: 'user_pic',
        'user_pic': 'user_pic',
        'user-pic': 'user_pic',
        staff: 'staff',
        administrator: 'admin',
        system: 'system',
        sistem: 'system',
    };

    return aliases[normalized] || normalized;
}

function normalizeIdentityToken(value?: string): string {
    return String(value || '').trim().toLowerCase();
}

function getRoleDisplayLabel(role?: string): string {
    const key = normalizeRoleKey(role);
    if (!key || key === 'system') return '';

    const labels: Record<string, string> = {
        admin: 'Admin',
        staff: 'Staff',
        user: 'User',
        user_pic: 'User PIC',
        pic: 'PIC',
    };

    return labels[key] || String(role || '').trim();
}

function getBestUserDisplayName(user: any, fallback = 'User'): string {
    return user?.display_name || user?.displayName || user?.nama_lengkap || user?.full_name || user?.name || user?.username || fallback;
}

function getUserCompanyToken(user: any): string {
    return normalizeIdentityToken(
        user?.id_perusahaan
        || user?.perusahaan?.id
        || user?.perusahaan_id
        || user?.company_id
        || ''
    );
}

function getCompanyNameFromText(text: string): string {
    const match = String(text || '').match(/\(Perusahaan\s*:\s*(.+?)\s*\)/i);
    return match?.[1]?.trim() || '';
}

function getRespondentNameFromText(text: string): string {
    const match = String(text || '').match(/^User\s+(.+?)\s*\(Perusahaan\s*:/i);
    return match?.[1]?.trim() || '';
}

function isPlaceholderName(name?: string): boolean {
    const normalized = normalizeIdentityToken(name);
    return !normalized || normalized === 'system' || normalized === 'sistem' || normalized === 'unknown';
}

function inferFallbackActor(event: Pick<ServerEvent, 'entity' | 'message' | 'user'>): { name: string; role: string } {
    const entity = normalizeEntityKey(event.entity);
    const message = String(event.message || '').toLowerCase();
    const currentUser = getCurrentUser();
    const currentRole = normalizeRoleKey(currentUser?.role || '');

    if (currentRole && currentRole !== 'admin' && currentRole !== 'system') {
        return {
            name: currentUser?.name || getRoleDisplayLabel(currentRole) || 'User',
            role: currentRole,
        };
    }

    if (
        entity === 'ikas'
        || entity === 'kse'
        || entity === 'se_edit_request'
        || /request|permintaan|mengajukan|diajukan|penilaian ikas|penilaian kse|ikas_request|kse_request/i.test(message)
    ) {
        return { name: 'User PIC', role: 'user_pic' };
    }

    if (entity === 'user' || /user\s+.+perusahaan|pengguna/i.test(message)) {
        return { name: 'User', role: 'user' };
    }

    return { name: 'Staff', role: 'staff' };
}

function ensureReadableActor(event: ServerEvent): ServerEvent {
    if (!isPlaceholderName(event.user?.name)) {
        event.user.role = normalizeRoleKey(event.user.role);
        return event;
    }

    const fallback = inferFallbackActor(event);
    event.user = {
        ...event.user,
        name: fallback.name,
        role: normalizeRoleKey(event.user?.role || fallback.role),
    };

    return event;
}

function extractActorFromMessage(message: string): { name: string; role: string } | null {
    const text = String(message || '').trim();
    if (!text) return null;

    const submittedByMatch = text.match(/diajukan\s+oleh\s+(.+?)(?:\.|,|$|Catatan\s*:|Alasan\s*:)/i);
    if (submittedByMatch?.[1]) {
        return {
            name: submittedByMatch[1].trim(),
            role: 'user_pic',
        };
    }

    const requestUserMatch = text.match(/^User\s+(.+?)\s*\(Perusahaan\s*:/i);
    if (requestUserMatch?.[1]) {
        const companyName = getCompanyNameFromText(text);
        const isIkasMessage = /\bIKAS\b|ikas_request/i.test(text);
        const resolved = isIkasMessage
            ? resolveUserByCompanyName(companyName) || resolveUserByName(requestUserMatch[1].trim(), { preferRequesterRoles: true, companyName })
            : resolveUserByName(requestUserMatch[1].trim(), { preferRequesterRoles: true, companyName }) || resolveUserByCompanyName(companyName);

        if (!resolved) return null;

        return {
            name: resolved.name,
            role: resolved.role,
        };
    }

    const requestActorMatch = text.match(/^(.+?)\s+(?:mengajukan|melakukan\s+request|request)\s+(?:permintaan\s+)?(?:edit|ubah)/i);
    if (requestActorMatch?.[1]) {
        const name = requestActorMatch[1].replace(/^User\s+/i, '').trim();
        return {
            name,
            role: /perusahaan/i.test(text) ? 'user_pic' : 'user',
        };
    }

    const actionActorMatch = text.match(/^(.+?)\s+(memperbarui|menambahkan|menghapus|mengubah|updated|created|deleted)\s+/i);
    if (actionActorMatch?.[1] && !/^(ikas_request|kse_request|sdm_csirt|se_csirt)\b/i.test(actionActorMatch[1])) {
        return {
            name: actionActorMatch[1].replace(/^User\s+/i, '').trim(),
            role: '',
        };
    }

    return null;
}

function isRequesterRole(role?: string): boolean {
    const normalized = normalizeRoleKey(role);
    return normalized === 'user' || normalized === 'user_pic' || normalized === 'pic' || normalized === 'staff';
}

function isAdminActor(actor?: { role?: string } | null): boolean {
    return normalizeRoleKey(actor?.role) === 'admin';
}

function isKnownAdminName(name?: string): boolean {
    const lookup = normalizeIdentityToken(name).replace(/^user\s+/i, '').trim();
    if (!lookup) return false;

    try {
        const usersStore = useUsersStore();
        return usersStore.allUsers.some((u: any) => {
            if (normalizeRoleKey(u.role || u.role_name || '') !== 'admin') return false;

            return normalizeIdentityToken(u.name) === lookup
                || normalizeIdentityToken(u.display_name) === lookup
                || normalizeIdentityToken(u.username) === lookup
                || normalizeIdentityToken(u.name) === normalizeIdentityToken(name)
                || normalizeIdentityToken(u.display_name) === normalizeIdentityToken(name)
                || normalizeIdentityToken(u.username) === normalizeIdentityToken(name);
        });
    } catch {
        return false;
    }
}

function extractRequestEditActorFromObject(source: any): { id: string; name: string; role: string; avatar?: string } | null {
    if (!source || typeof source !== 'object') return null;

    const requesterObject = source.requester
        || source.requested_by_user
        || source.requestedByUser
        || source.requested_by
        || source.requestedBy
        || source.submitted_by_user
        || source.submittedByUser
        || source.pemohon
        || source.pengaju;

    if (requesterObject && typeof requesterObject === 'object') {
        const av = requesterObject.avatar || requesterObject.photo || requesterObject.foto_profile;
        return {
            id: String(requesterObject.id || requesterObject.user_id || requesterObject.userId || requesterObject.uuid || ''),
            name: getBestUserDisplayName(requesterObject, ''),
            role: normalizeRoleKey(requesterObject.role || requesterObject.role_name || requesterObject.jabatan || 'user_pic'),
            avatar: av ? formatImageUrl(av) : undefined,
        };
    }

    const id = source.requester_id || source.requesterId
        || source.requested_by_id || source.requestedById
        || source.requested_by_user_id || source.requestedByUserId
        || source.submitted_by || source.submittedBy
        || source.submitted_by_id || source.submittedById
        || source.created_by_user_id || source.createdByUserId;

    const name = source.requester_display_name || source.requesterDisplayName
        || source.requester_name || source.requesterName
        || source.requested_by_display_name || source.requestedByDisplayName
        || source.requested_by_name || source.requestedByName
        || source.submitted_by_display_name || source.submittedByDisplayName
        || source.submitted_by_name || source.submittedByName
        || source.pemohon_name || source.pengaju_name;

    if (!id && !name) return null;

    return {
        id: String(id || ''),
        name: String(name || ''),
        role: normalizeRoleKey(source.requester_role || source.requesterRole || source.requested_by_role || source.requestedByRole || source.submitted_by_role || source.submittedByRole || 'user_pic'),
        avatar: source.requester_avatar || source.requested_by_avatar || source.submitted_by_avatar
            ? formatImageUrl(source.requester_avatar || source.requested_by_avatar || source.submitted_by_avatar)
            : undefined,
    };
}

function extractActorFromObject(source: any): { id: string; name: string; role: string; avatar?: string } | null {
    if (!source || typeof source !== 'object') return null;

    const actorObject = source.actor
        || source.causer
        || source.requester
        || source.requested_by_user
        || source.requestedByUser
        || source.created_by_user
        || source.updated_by_user
        || source.user;

    if (actorObject && typeof actorObject === 'object') {
        const av = actorObject.avatar || actorObject.photo || actorObject.foto_profile;
        return {
            id: String(actorObject.id || actorObject.user_id || actorObject.userId || actorObject.uuid || ''),
            name: getBestUserDisplayName(actorObject, ''),
            role: normalizeRoleKey(actorObject.role || actorObject.role_name || actorObject.jabatan || ''),
            avatar: av ? formatImageUrl(av) : undefined,
        };
    }

    const id = source.actor_id || source.actorId
        || source.causer_id || source.causerId
        || source.requested_by || source.requestedBy
        || source.requester_id || source.requesterId
        || source.user_id || source.userId
        || source.created_by || source.updated_by;

    const name = source.actor_display_name || source.display_name || source.displayName
        || source.nama_user || source.user_display_name || source.user_name || source.username
        || source.requester_name || source.requested_by_name || source.causer_name
        || source.created_by_name || source.updated_by_name;

    if (!id && !name) return null;

    return {
        id: String(id || ''),
        name: String(name || ''),
        role: normalizeRoleKey(source.actor_role || source.user_role || source.requester_role || source.role || source.role_name || ''),
        avatar: source.avatar || source.photo || source.actor_avatar ? formatImageUrl(source.avatar || source.photo || source.actor_avatar) : undefined,
    };
}

function inferRequestEditTarget(message: string): { entity: string; name: string } | null {
    const text = String(message || '').trim();
    if (!text || !/request\s*edit|permintaan\s*edit|mengajukan.*edit|diajukan\s+oleh|ikas_request|kse_request/i.test(text)) {
        return null;
    }

    const ikasUserCompanyMatch = text.match(/^User\s+.+?\s*\(Perusahaan\s*:\s*(.+?)\s*\)\s+mengajukan\s+permintaan\s+edit\s+data\s+IKAS/i);
    if (ikasUserCompanyMatch?.[1]) {
        return { entity: 'ikas', name: ikasUserCompanyMatch[1].trim() };
    }

    const ikasCreatedMatch = text.match(/ikas_request\s+baru\s+(.+?)\s+berhasil\s+ditambahkan/i);
    if (ikasCreatedMatch?.[1]) {
        return { entity: 'ikas', name: ikasCreatedMatch[1].trim() };
    }

    const seMatch = text.match(/request\s*edit\s+data\s+SE\s+(.+?)\s+diajukan\s+oleh/i);
    if (seMatch?.[1]) {
        return { entity: 'se_csirt', name: seMatch[1].trim() };
    }

    const ikasMatch = text.match(/(?:request\s*edit|permintaan\s*edit)\s+(?:data\s+)?IKAS\s+(.+?)\s+(?:diajukan\s+oleh|berhasil|$)/i);
    if (ikasMatch?.[1]) {
        return { entity: 'ikas', name: ikasMatch[1].trim() };
    }

    const kseMatch = text.match(/(?:request\s*edit|permintaan\s*edit)\s+(?:data\s+)?KSE\s+(.+?)\s+(?:diajukan\s+oleh|berhasil|$)/i);
    if (kseMatch?.[1]) {
        return { entity: 'kse', name: kseMatch[1].trim() };
    }

    if (/\bSE\b|sistem elektronik/i.test(text)) return { entity: 'se_csirt', name: '' };
    if (/\bIKAS\b/i.test(text)) return { entity: 'ikas', name: '' };
    if (/\bKSE\b/i.test(text)) return { entity: 'kse', name: '' };

    return null;
}

function isRequestEditEvent(event: Pick<ServerEvent, 'entity' | 'message' | 'entity_name'>): boolean {
    const entity = normalizeEntityKey(event.entity);
    const text = `${event.message || ''} ${event.entity_name || ''}`.toLowerCase();

    return entity === 'se_edit_request'
        || /request\s*edit|permintaan\s*edit|mengajukan.*edit|diajukan.*edit/i.test(text);
}

function getActionVerbForEvent(event: ServerEvent): string {
    if (isRequestEditEvent(event)) return 'melakukan request edit';
    return ACTION_VERBS[event.type] || event.type;
}

function collectExplicitAudience(value: any, userIds: Set<string>, roles: Set<string>, mode: 'id' | 'role' = 'id'): void {
    if (!value) return;

    if (Array.isArray(value)) {
        value.forEach(item => collectExplicitAudience(item, userIds, roles, mode));
        return;
    }

    if (typeof value === 'object') {
        const id = value.id || value.user_id || value.userId || value.recipient_id || value.target_user_id;
        if (id && mode !== 'role') userIds.add(String(id));

        const role = value.role || value.role_name || value.recipient_role || value.target_role;
        const normalizedRole = normalizeRoleKey(role);
        if (normalizedRole && mode !== 'id') roles.add(normalizedRole);
        return;
    }

    if (typeof value === 'string' || typeof value === 'number') {
        if (mode === 'role') roles.add(normalizeRoleKey(String(value)));
        else userIds.add(String(value));
    }
}

function extractAudienceHints(raw: any, parsedData: any): { userIds: Set<string>; roles: Set<string> } {
    const userIds = new Set<string>();
    const roles = new Set<string>();

    const idFields = [
        raw.recipient_id, raw.recipient_user_id, raw.target_user_id, raw.to_user_id, raw.for_user_id,
        raw.recipient_ids, raw.user_ids, raw.recipients,
        parsedData?.recipient_id, parsedData?.recipient_user_id, parsedData?.target_user_id, parsedData?.to_user_id, parsedData?.for_user_id,
        parsedData?.recipient_ids, parsedData?.user_ids, parsedData?.recipients,
    ];
    const roleFields = [
        raw.recipient_role, raw.target_role, raw.audience_role, raw.recipient_roles, raw.target_roles, raw.audience_roles,
        parsedData?.recipient_role, parsedData?.target_role, parsedData?.audience_role, parsedData?.recipient_roles, parsedData?.target_roles, parsedData?.audience_roles,
    ];

    idFields.forEach(value => collectExplicitAudience(value, userIds, roles, 'id'));
    roleFields.forEach(value => collectExplicitAudience(value, userIds, roles, 'role'));

    return { userIds, roles };
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
                name: getBestUserDisplayName(found, 'User'),
                role: normalizeRoleKey(found.role || found.role_name || 'user'),
                avatar: formatImageUrl(found.photo || (found as any).foto_profile) || undefined,
            };
        }
    } catch { /* store not ready */ }

    try {
        const authStore = useAuthStore();
        if (authStore.currentUser && String(authStore.currentUser.id) === String(userId)) {
            return {
                id: String(authStore.currentUser.id),
                name: getBestUserDisplayName(authStore.currentUser, 'Saya'),
                role: normalizeRoleKey(authStore.currentUser.role || 'user'),
                avatar: authStore.currentUser.foto_profile ? formatImageUrl(authStore.currentUser.foto_profile) : undefined,
            };
        }
    } catch { /* store not ready */ }

    return null;
}

function resolveUserByName(name: string, options: { preferRequesterRoles?: boolean; companyName?: string } = {}): { id: string; name: string; role: string; avatar?: string } | null {
    const rawLookup = normalizeIdentityToken(name);
    const lookup = rawLookup.replace(/^user\s+/i, '').trim();
    if (!lookup) return null;

    try {
        const usersStore = useUsersStore();
        const isAllowedRole = (u: any): boolean => {
            if (!options.preferRequesterRoles) return true;
            return isRequesterRole(u.role || u.role_name || '');
        };
        let candidates = usersStore.allUsers.filter(isAllowedRole);
        const companyLookup = normalizeIdentityToken(options.companyName);
        if (companyLookup) {
            try {
                const stakeholdersStore = useStakeholdersStore();
                const company = stakeholdersStore.allStakeholders.find((s: any) =>
                    normalizeIdentityToken(s.nama_perusahaan || s.nama || s.name) === companyLookup
                );
                const companyId = normalizeIdentityToken(company?.id);
                if (companyId) {
                    const sameCompany = candidates.filter((u: any) => getUserCompanyToken(u) === companyId);
                    if (sameCompany.length > 0) candidates = sameCompany;
                }
            } catch { /* stakeholder store not ready */ }
        }
        const found = candidates.find((u: any) =>
            normalizeIdentityToken(u.name) === lookup
            || normalizeIdentityToken(u.display_name) === lookup
            || normalizeIdentityToken(u.username) === lookup
            || normalizeIdentityToken(u.name) === rawLookup
            || normalizeIdentityToken(u.display_name) === rawLookup
            || normalizeIdentityToken(u.username) === rawLookup
        );

        if (found) {
            return {
                id: String(found.id),
                name: getBestUserDisplayName(found, 'User'),
                role: normalizeRoleKey(found.role || found.role_name || 'user'),
                avatar: formatImageUrl(found.photo || (found as any).foto_profile) || undefined,
            };
        }

        if (lookup.length === 1) {
            const initialMatches = candidates.filter((u: any) => {
                const role = normalizeRoleKey(u.role || u.role_name || '');
                if (role === 'admin') return false;

                return [u.display_name, u.name, u.username]
                    .map(normalizeIdentityToken)
                    .some(value => value.startsWith(lookup));
            });

            if (initialMatches.length === 1) {
                const match = initialMatches[0] as any;
                return {
                    id: String(match.id),
                    name: getBestUserDisplayName(match, 'User'),
                    role: normalizeRoleKey(match.role || match.role_name || 'user'),
                    avatar: formatImageUrl(match.photo || match.foto_profile) || undefined,
                };
            }
        }
    } catch { /* store not ready */ }

    return null;
}

function resolveUserByCompanyName(companyName: string): { id: string; name: string; role: string; avatar?: string } | null {
    const companyLookup = normalizeIdentityToken(companyName);
    if (!companyLookup) return null;

    try {
        const stakeholdersStore = useStakeholdersStore();
        const usersStore = useUsersStore();
        const company = stakeholdersStore.allStakeholders.find((s: any) =>
            normalizeIdentityToken(s.nama_perusahaan || s.nama || s.name) === companyLookup
        );
        const companyId = normalizeIdentityToken(company?.id);
        if (!companyId) return null;

        const candidates = usersStore.allUsers
            .filter((u: any) => getUserCompanyToken(u) === companyId)
            .sort((a: any, b: any) => {
                const rank = (role?: string) => {
                    const normalized = normalizeRoleKey(role);
                    if (normalized === 'user_pic' || normalized === 'pic') return 0;
                    if (normalized === 'user') return 1;
                    if (normalized === 'staff') return 2;
                    if (normalized === 'admin') return 3;
                    return 4;
                };
                return rank(a.role || a.role_name) - rank(b.role || b.role_name);
            });

        const found = candidates[0] as any;
        if (!found) return null;

        return {
            id: String(found.id),
            name: getBestUserDisplayName(found, 'User'),
            role: normalizeRoleKey(found.role || found.role_name || 'user'),
            avatar: formatImageUrl(found.photo || found.foto_profile) || undefined,
        };
    } catch {
        return null;
    }
}

/** Get the current user's info from authStore */
function getCurrentUser(): { id: string; name: string; role: string; avatar?: string } | null {
    try {
        const authStore = useAuthStore();
        if (authStore.currentUser) {
            return {
                id: String(authStore.currentUser.id),
                name: getBestUserDisplayName(authStore.currentUser, 'Saya'),
                role: normalizeRoleKey(authStore.currentUser.role || 'user'),
                avatar: authStore.currentUser.foto_profile ? formatImageUrl(authStore.currentUser.foto_profile) : undefined,
            };
        }
    } catch { /* ignore */ }
    return null;
}

function isNotificationVisibleForCurrentUser(event: ServerEvent, raw: any): boolean {
    try {
        const currentUser = getCurrentUser();
        if (!currentUser) return true;

        const currentUserId = String(currentUser.id || '').trim();
        const currentUserName = normalizeIdentityToken(currentUser.name);
        const currentUserRole = normalizeRoleKey(currentUser.role);
        const currentUsername = normalizeIdentityToken(
            useAuthStore().currentUser?.username || useAuthStore().currentUser?.slug || ''
        );

        const actorId = String(event.user?.id || '').trim();
        const actorName = normalizeIdentityToken(event.user?.name);
        const actorRole = normalizeRoleKey(event.user?.role);
        const actorIsOtherAdmin = actorRole === 'admin';

        if (currentUserId && actorId && actorId === currentUserId) return true;
        if (currentUserName && actorName && (actorName === currentUserName || actorName === currentUsername)) return true;

        const audience = extractAudienceHints(raw, raw?.data && typeof raw.data === 'object' ? raw.data : raw);
        if (audience.userIds.size > 0 || audience.roles.size > 0) {
            if (currentUserId && audience.userIds.has(currentUserId)) return true;
            if (currentUserRole && audience.roles.has(currentUserRole)) return true;
            return false;
        }

        if ((currentUserRole === 'admin' || currentUserRole === 'staff')) {
            return !actorIsOtherAdmin;
        }

        if (currentUserRole === 'user' || currentUserRole === 'user_pic' || currentUserRole === 'pic') {
            return !actorIsOtherAdmin;
        }

        return true;
    } catch {
        return true;
    }
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
    const requestTargetForActor = inferRequestEditTarget(rawMsg);
    let user = { id: '', name: '', role: '' } as { id: string; name: string; role: string; avatar?: string };
    const isRequestEdit = isRequestEditEvent({
        entity: raw.entity || parsedData?.entity || '',
        message: rawMsg,
        entity_name: raw.entity_name || parsedData?.entity_name || '',
    });
    const requestEditActorFromObject = isRequestEdit
        ? extractRequestEditActorFromObject(raw) || extractRequestEditActorFromObject(parsedData)
        : null;

    const actorFromRaw = requestEditActorFromObject || extractActorFromObject(raw) || extractActorFromObject(parsedData);

    if (actorFromRaw) {
        user = actorFromRaw;
    } else if (raw.user && typeof raw.user === 'object') {
        user.id = String(raw.user.id || raw.user.user_id || raw.user.userId || raw.user.uuid || '');
        user.name = getBestUserDisplayName(raw.user, '');
        user.role = normalizeRoleKey(raw.user.role || raw.user.role_name || raw.user.jabatan || '');
        const av = raw.user.avatar || raw.user.photo || raw.user.foto_profile;
        if (av) user.avatar = formatImageUrl(av);
    } else if (
        raw.actor_name || raw.user_name || raw.username || raw.display_name || raw.causer_name ||
        raw.created_by_name || raw.updated_by_name || raw.deleted_by_name || parsedData?.actor_name || parsedData?.user_name
    ) {
        user.id = String(raw.user_id || raw.actor_id || raw.causer_id || parsedData?.user_id || parsedData?.actor_id || parsedData?.causer_id || '');
        user.name = raw.actor_display_name || raw.display_name || raw.actor_name || raw.user_display_name || raw.user_name || raw.username || raw.causer_name
            || raw.created_by_name || raw.updated_by_name || raw.deleted_by_name
            || parsedData?.actor_display_name || parsedData?.display_name || parsedData?.actor_name || parsedData?.user_display_name || parsedData?.user_name || parsedData?.username || '';
        user.role = normalizeRoleKey(raw.user_role || raw.actor_role || raw.actor_type || raw.role || parsedData?.user_role || parsedData?.actor_role || parsedData?.role || '');
        const av = raw.avatar || raw.photo || raw.actor_avatar;
        if (av) user.avatar = formatImageUrl(av);
    }

    // Extract user_id from any available field
    if (!user.id) {
        const uid = raw.user_id || raw.userId || raw.userID
            || raw.actor_id || raw.actorId || raw.actorID
            || raw.causer_id || raw.causerId 
            || raw.performed_by || raw.performedBy || raw.initiator_id || raw.initiatorId
            || raw.created_by || raw.updated_by || raw.deleted_by
            || parsedData?.user_id || parsedData?.userId || parsedData?.actor_id || parsedData?.causer_id
            || parsedData?.performed_by || parsedData?.initiator_id
            || raw.by;
            
        if (uid) user.id = String(uid);
    }

    // Resolve user name from usersStore if we have an ID but no name
    if (user.id && isPlaceholderName(user.name)) {
        const resolved = resolveUser(user.id);
        if (resolved) user = resolved;
    }

    if (requestEditActorFromObject && isAdminActor(user)) {
        user = {
            ...user,
            ...requestEditActorFromObject,
            role: isRequesterRole(requestEditActorFromObject.role) ? requestEditActorFromObject.role : 'user_pic',
        };
    }

    if (user.name && isPlaceholderRole(user.role)) {
        const resolved = resolveUserByName(user.name);
        if (resolved) user = resolved;
    }

    if (isPlaceholderName(user.name)) {
        const actorFromMessage = extractActorFromMessage(rawMsg);
        if (actorFromMessage) {
            user.name = actorFromMessage.name;
            user.role = actorFromMessage.role;
        }
    }

    const requestActorFromMessage = extractActorFromMessage(rawMsg);
    if (requestActorFromMessage && isRequestEdit) {
        if (!isKnownAdminName(requestActorFromMessage.name)) {
            const resolvedRequester = resolveUserByName(requestActorFromMessage.name, {
                preferRequesterRoles: true,
                companyName: getCompanyNameFromText(rawMsg) || requestTargetForActor?.name,
            });
            user.id = resolvedRequester?.id || '';
            user.name = resolvedRequester?.name || requestActorFromMessage.name;
            user.role = normalizeRoleKey(resolvedRequester?.role || requestActorFromMessage.role || 'user_pic');
            if (resolvedRequester?.avatar) user.avatar = resolvedRequester.avatar;
        }
    }

    if (isRequestEdit && (isAdminActor(user) || isKnownAdminName(user.name))) {
        user = { id: '', name: '', role: 'user_pic' };
    }

    const respondentName = getRespondentNameFromText(rawMsg);
    if (requestTargetForActor?.entity === 'ikas' || /\bIKAS\b|ikas_request/i.test(rawMsg)) {
        if (
            respondentName
            && (
                normalizeIdentityToken(user.name) === normalizeIdentityToken(respondentName)
                || normalizeIdentityToken(user.name) === normalizeIdentityToken(`User ${respondentName}`)
            )
        ) {
            const resolvedByCompany = resolveUserByCompanyName(getCompanyNameFromText(rawMsg) || requestTargetForActor?.name || '');
            if (resolvedByCompany) {
                user = resolvedByCompany;
            } else {
                user = { id: '', name: '', role: 'user_pic' };
            }
        } else if (isPlaceholderName(user.name)) {
            const resolvedByCompany = resolveUserByCompanyName(getCompanyNameFromText(rawMsg) || requestTargetForActor?.name || '');
            if (resolvedByCompany) user = resolvedByCompany;
        }
    }

    // Final fallback
    if (isPlaceholderName(user.name) && !isRequestEdit) {
        const nameMatch = rawMsg.match(/^([A-Z][a-zA-Z\s]+?)\s+(memperbarui|menambahkan|menghapus|updated|created|deleted|mengubah)/);
        if (nameMatch) {
            user.name = nameMatch[1].trim();
        }
        // NOTE: Don't force "Sistem" here — the store will handle attribution for SSE events
    }

    user.role = normalizeRoleKey(user.role);

    const requestTarget = inferRequestEditTarget(rawMsg);

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

    if (requestTarget?.entity) {
        entity = requestTarget.entity;
    }

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

    if (requestTarget?.name) {
        entityName = requestTarget.name;
    }

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
        const verb = getActionVerbForEvent(event);
        const label = getEntityDisplayLabel(event.entity);
        const actor = isPlaceholderName(event.user?.name) ? inferFallbackActor(event).name : event.user.name;
        new Notification(`${actor} ${verb} ${label}`, {
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
                actionVerb: getActionVerbForEvent(e),
                details: e.field_changes ? buildFieldChangeDetail(e.field_changes) : e.message,
                avatarInitials: (e.user?.name || 'S')
                    .split(' ')
                    .map((w: string) => w.charAt(0))
                    .join('')
                    .substring(0, 2)
                    .toUpperCase(),
                actorName: isPlaceholderName(e.user?.name) ? inferFallbackActor(e).name : e.user.name,
                actorRole: isPlaceholderRole(e.user?.role) ? '' : getRoleDisplayLabel(e.user?.role),
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
                actionVerb: getActionVerbForEvent(e),
                details: e.field_changes ? buildFieldChangeDetail(e.field_changes) : e.message,
                avatarInitials: (e.user?.name || 'S')
                    .split(' ')
                    .map((w: string) => w.charAt(0))
                    .join('')
                    .substring(0, 2)
                    .toUpperCase(),
                actorName: isPlaceholderName(e.user?.name) ? inferFallbackActor(e).name : e.user.name,
                actorRole: isPlaceholderRole(e.user?.role) ? '' : getRoleDisplayLabel(e.user?.role),
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

            try {
                const usersStore = useUsersStore();
                if (!usersStore.initialized && !usersStore.loading) {
                    await usersStore.initialize();
                }
                const stakeholdersStore = useStakeholdersStore();
                if (!stakeholdersStore.initialized && !stakeholdersStore.loading) {
                    await stakeholdersStore.initialize();
                }
            } catch {
                // Best-effort only; notifications still load if identity caches are unavailable.
            }

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
            this.currentTime = Date.now();
            this.clockTimer = setInterval(() => {
                this.currentTime = Date.now();
            }, 10_000); // 10s for more frequent updates
        },

        stopClock() {
            if (this.clockTimer) {
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

                const normalized = notifications
                    .map(raw => {
                        const event = normalizeToServerEvent(raw);
                        return event && isNotificationVisibleForCurrentUser(event, raw) ? event : null;
                    })
                    .filter((e): e is ServerEvent => e !== null);
                const deduped = dedupeEvents(normalized);

                // Ensure all DB notifications have proper user attribution
                for (const evt of deduped) {
                    if (isPlaceholderName(evt.user.name)) {
                        if (evt.user.id) {
                            const resolved = resolveUser(evt.user.id);
                            if (resolved) evt.user = resolved;
                        }
                    }
                    ensureReadableActor(evt);
                }

                deduped.sort((a, b) =>
                    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
                );

                this.events = deduped.slice(0, MAX_EVENTS);
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
                    .map(raw => {
                        const event = normalizeToServerEvent(raw);
                        return event && isNotificationVisibleForCurrentUser(event, raw) ? event : null;
                    })
                    .filter((e): e is ServerEvent => e !== null);
                const deduped = dedupeEvents(normalized);

                // Resolve user names for DB records
                for (const evt of deduped) {
                    if (isPlaceholderName(evt.user.name) || evt.user.name === 'Test') {
                        if (evt.user.id) {
                            const resolved = resolveUser(evt.user.id);
                            if (resolved) evt.user = resolved;
                        }
                    }
                    ensureReadableActor(evt);
                }

                const dbIdSet = new Set(deduped.map(n => n.id));
                const localIdSet = new Set(this.events.map(e => e.id));

                // ADD new DB items
                const newFromDb: ServerEvent[] = [];
                for (const dbEvt of deduped) {
                    if (!localIdSet.has(dbEvt.id) && !this.events.some(local => areSameNotification(local, dbEvt))) {
                        newFromDb.push(dbEvt);
                    }
                }

                // UPDATE read states + user info of existing items
                for (const dbEvt of deduped) {
                    const local = this.events.find(e => e.id === dbEvt.id);
                    if (local) {
                        // Optimistic UI: If locally marked as read, keep it read 
                        // even if the backend poll still shows it as unread.
                        if (local.is_read) {
                            // already read locally, keep it that way
                        } else {
                            local.is_read = dbEvt.is_read;
                        }
                        
                if (isPlaceholderName(local.user.name) && !isPlaceholderName(dbEvt.user.name)) {
                    local.user = dbEvt.user;
                }
                    }
                }

                // REPLACE SSE-pending events with their DB counterparts
                // Find SSE events that now have a matching DB record (by entity+entity_id+type)
                for (const sseId of this.pendingSSEIds) {
                    const sseEvt = this.events.find(e => e.id === sseId);
                    if (!sseEvt) continue;

                    const dbMatch = deduped.find(db => areSameNotification(db, sseEvt));

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
                this.events = dedupeEvents(this.events);
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
            const actorFromMessage = extractActorFromMessage(event.message);
            if (actorFromMessage) {
                const resolvedRequester = resolveUserByName(actorFromMessage.name, { preferRequesterRoles: true });
                event.user = {
                    ...event.user,
                    id: resolvedRequester?.id || '',
                    name: resolvedRequester?.name || actorFromMessage.name,
                    role: normalizeRoleKey(resolvedRequester?.role || actorFromMessage.role || 'user_pic'),
                    avatar: resolvedRequester?.avatar,
                };
            }

            // ── USER ATTRIBUTION ──
            // If SSE arrived without user info, try to attribute it
            if (isPlaceholderName(event.user.name) && !extractActorFromMessage(event.message)) {
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
            ensureReadableActor(event);

            if (!isNotificationVisibleForCurrentUser(event, raw)) return;

            // ── DEDUPLICATION ──
            const isDup = this.events.some(e => areSameNotification(e, event));

            if (isDup) {
                const existing = this.events.find(e => areSameNotification(e, event));
                if (existing && isGenericIkasRequestEvent(existing) && isDetailedIkasRequestEvent(event)) {
                    Object.assign(existing, event);
                } else if (existing && isPlaceholderName(existing.user.name) && !isPlaceholderName(event.user.name)) {
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
