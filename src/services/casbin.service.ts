import { api } from '@/config/api';

export interface CasbinPermission {
    id: string;
    obj: string;
    act: string;
    label: string;
    group: string;
}

export interface CasbinPolicy {
    id: string;
    sub: string;
    obj: string;
    act: string;
}

type RawRecord = Record<string, any>;

const asArray = (payload: any): any[] => {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload?.items)) return payload.items;
    if (Array.isArray(payload?.permissions)) return payload.permissions;
    if (Array.isArray(payload?.policies)) return payload.policies;
    return [];
};

const pickString = (record: RawRecord, keys: string[]) => {
    for (const key of keys) {
        const value = record?.[key];
        if (typeof value === 'string' && value.trim()) return value.trim();
    }
    return '';
};

const toPolicyPayload = (sub: string, obj: string, act: string) => ({
    sub,
    obj,
    act,
});

class CasbinService {
    async getPermissions(role?: string): Promise<CasbinPermission[]> {
        const url = role ? `/api/casbin/permissions?role=${encodeURIComponent(role)}` : '/api/casbin/permissions';
        const response = await api.get<any>(url);
        return asArray(response)
            .map((entry: any) => {
                if (Array.isArray(entry)) {
                    const obj = String(entry[0] ?? '').trim();
                    const act = String(entry[1] ?? '').trim();
                    if (!obj || !act) return null;
                    return {
                        id: `${obj}::${act}`,
                        obj,
                        act,
                        label: `${obj}.${act}`,
                        group: obj,
                    } satisfies CasbinPermission;
                }

                const record = entry as RawRecord;
                const obj = pickString(record, ['obj', 'object', 'resource', 'permission', 'name']);
                const act = pickString(record, ['act', 'action', 'method', 'verb']) || 'read';
                if (!obj) return null;

                return {
                    id: pickString(record, ['id']) || `${obj}::${act}`,
                    obj,
                    act,
                    label: pickString(record, ['label', 'description']) || `${obj}.${act}`,
                    group: pickString(record, ['group', 'module', 'category']) || obj,
                } satisfies CasbinPermission;
            })
            .filter(Boolean) as CasbinPermission[];
    }

    async getPolicies(): Promise<CasbinPolicy[]> {
        const response = await api.get<any>('/api/casbin/policies');
        return asArray(response)
            .map((entry: any) => {
                if (Array.isArray(entry)) {
                    const sub = String(entry[0] ?? '').trim();
                    const obj = String(entry[1] ?? '').trim();
                    const act = String(entry[2] ?? '').trim();
                    if (!sub || !obj || !act) return null;
                    return {
                        id: `${sub}::${obj}::${act}`,
                        sub,
                        obj,
                        act,
                    } satisfies CasbinPolicy;
                }

                const record = entry as RawRecord;
                const sub = pickString(record, ['sub', 'subject', 'role', 'role_name']);
                const obj = pickString(record, ['obj', 'object', 'resource', 'permission', 'name']);
                const act = pickString(record, ['act', 'action', 'method', 'verb']) || 'read';
                if (!sub || !obj) return null;

                return {
                    id: pickString(record, ['id']) || `${sub}::${obj}::${act}`,
                    sub,
                    obj,
                    act,
                } satisfies CasbinPolicy;
            })
            .filter(Boolean) as CasbinPolicy[];
    }

    async addPolicy(policy: { sub: string; obj: string; act: string; label?: string; group?: string }) {
        const variants = [
            { 
                role: policy.sub, 
                resource: policy.obj, 
                action: policy.act,
                label: policy.label,
                group: policy.group
            },
            { 
                ...toPolicyPayload(policy.sub, policy.obj, policy.act),
                label: policy.label,
                group: policy.group
            },
            { subject: policy.sub, object: policy.obj, action: policy.act },
            { role: policy.sub, permission: { obj: policy.obj, act: policy.act } },
        ];

        let lastError: unknown;
        for (const payload of variants) {
            try {
                return await api.post('/api/casbin/policies/add', payload);
            } catch (error) {
                lastError = error;
            }
        }
        throw lastError;
    }

    async bulkUpsertPolicies(roleName: string, policies: Array<{ obj: string; act: string }>) {
        const normalized = policies.map((policy) => toPolicyPayload(roleName, policy.obj, policy.act));
        const normalizedAlt = policies.map((p) => ({ role: roleName, resource: p.obj, action: p.act }));
        
        const variants = [
            { role: roleName, policies: normalizedAlt },
            { role: roleName, policies: normalized },
            { subject: roleName, policies: normalized },
            { policies: normalizedAlt },
            { policies: normalized },
            normalizedAlt,
            normalized,
        ];

        let lastError: unknown;
        for (const payload of variants) {
            try {
                return await api.post('/api/casbin/policies/bulk', payload);
            } catch (error) {
                lastError = error;
            }
        }
        throw lastError;
    }

    async removePolicy(policy: { sub: string; obj: string; act: string }) {
        const payload = {
            role: policy.sub,
            resource: policy.obj,
            action: policy.act
        };
        return await api.delete('/api/casbin/policies/remove', payload);
    }
}

export const casbinService = new CasbinService();
