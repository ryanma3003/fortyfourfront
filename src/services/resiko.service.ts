import { api, ApiRequestError } from '@/config/api';

export interface SurveyRiskResponse {
    respondent: any | null;
    risks: any[];
    raw: any;
}

export interface SurveyRespondent {
    created_at?: string;
    email?: string;
    id: number | string;
    id_perusahaan?: string;
    jabatan?: string;
    nama_lengkap?: string;
    nama_perusahaan?: string;
    nama_sektor?: string;
    nama_sub_sektor?: string;
    no_telepon?: string;
    sertifikat_training?: string;
    updated_at?: string;
    user_id?: string;
    [key: string]: any;
}

const unwrap = (payload: any): any => {
    if (payload && typeof payload === 'object' && 'data' in payload) {
        const data = payload.data;
        if (typeof data === 'string') {
            try {
                return JSON.parse(data);
            } catch {
                return data;
            }
        }
        return data;
    }
    return payload;
};

const pickArray = (payload: any): any[] => {
    const data = unwrap(payload);
    if (Array.isArray(data)) return data;
    if (!data || typeof data !== 'object') return [];

    const candidates = [
        data.risiko,
        data.risikos,
        data.risks,
        data.risk,
        data.hasil,
        data.results,
        data.survey_risiko,
        data.surveyRisiko,
        data.jawaban,
        data.responses,
        data.items,
    ];

    const found = candidates.find(Array.isArray);
    if (found) return found;

    for (const value of Object.values(data)) {
        const parsed = unwrap(value);
        if (Array.isArray(parsed)) return parsed;
    }

    return [];
};

const pickRespondent = (payload: any): any | null => {
    const data = unwrap(payload);
    if (!data || typeof data !== 'object') return null;
    if (Array.isArray(data)) return data[0] || null;
    return data.responden || data.respondent || data;
};

const getRespondentId = (respondent: any): string => {
    const candidate = respondent?.id ?? respondent?.responden_id ?? respondent?.id_responden;
    return candidate !== undefined && candidate !== null ? String(candidate) : '';
};

const valueByKeys = (source: any, keys: string[]): any => {
    for (const key of keys) {
        const value = source?.[key];
        if (value !== undefined && value !== null && value !== '') return value;
    }
    return undefined;
};

const getRiskReferenceId = (row: any): string => {
    const candidate = valueByKeys(row, [
        'id_risiko',
        'risiko_id',
        'risk_id',
        'survey_risiko_id',
        'surveyRisikoId',
        'master_risiko_id',
        'masterRiskId',
        'id_master_risiko',
        'kode_risiko',
        'kodeRisiko',
    ]);
    return candidate !== undefined && candidate !== null ? String(candidate) : '';
};

const getMasterRiskId = (row: any): string => {
    const candidate = valueByKeys(row, [
        'id',
        'ID',
        'id_risiko',
        'risiko_id',
        'risk_id',
        'survey_risiko_id',
        'kode',
        'kode_risiko',
        'kodeRisiko',
    ]);
    return candidate !== undefined && candidate !== null ? String(candidate) : '';
};

const enrichRisksWithMaster = (risks: any[], masterRisks: any[]): any[] => {
    if (!risks.length || !masterRisks.length) return risks;

    const masterById = new Map<string, any>();
    masterRisks.forEach((risk) => {
        const id = getMasterRiskId(risk);
        if (id) masterById.set(id, risk);
    });

    return risks.map((risk) => {
        const referenceId = getRiskReferenceId(risk);
        const masterRisk = referenceId ? masterById.get(referenceId) : null;
        return masterRisk ? { ...masterRisk, ...risk, master_risiko: masterRisk } : risk;
    });
};

export const resikoService = {
    async getRespondents(): Promise<SurveyRespondent[]> {
        const payload = await api.get<any>('/api/survey/responden');
        return pickArray(payload) as SurveyRespondent[];
    },

    async getRespondentById(id: string | number): Promise<SurveyRespondent | null> {
        const payload = await api.get<any>(`/api/survey/responden/${id}`);
        return pickRespondent(payload) as SurveyRespondent | null;
    },

    async getRiskPayloadByRespondentId(id: string | number): Promise<any> {
        try {
            return await api.get<any>(`/api/survey/risiko/${id}`);
        } catch (error) {
            if (error instanceof ApiRequestError && error.status === 404) {
                return api.get<any>(`/api/suvery/risiko/${id}`);
            }
            throw error;
        }
    },

    async getRiskByRespondentId(id: string | number): Promise<any[]> {
        const payload = await this.getRiskPayloadByRespondentId(id);
        return pickArray(payload);
    },

    async getMasterRisks(): Promise<any[]> {
        const payload = await api.get<any>('/api/survey/risiko');
        return pickArray(payload);
    },

    buildSurveyResponseFromRespondent(respondent: SurveyRespondent, riskPayload: any): SurveyRiskResponse {
        return {
            respondent,
            risks: pickArray(riskPayload),
            raw: { respondent, riskPayload },
        };
    },

    async getSurveyByRespondentId(id: string | number): Promise<SurveyRiskResponse> {
        const respondent = await this.getRespondentById(id);

        if (!respondent) {
            return { respondent: null, risks: [], raw: { respondent: null, riskPayload: null } };
        }

        let riskPayload: any = null;
        try {
            riskPayload = await this.getRiskPayloadByRespondentId(id);
        } catch (error) {
            if (!(error instanceof ApiRequestError && error.status === 404)) {
                throw error;
            }
        }

        const masterRisks = await this.getMasterRisks().catch(() => []);
        const result = this.buildSurveyResponseFromRespondent(respondent, riskPayload);
        return {
            ...result,
            risks: enrichRisksWithMaster(result.risks, masterRisks),
            raw: { ...result.raw, masterRisks },
        };
    },

    async getSurveyByRespondentOrCompanyId(id: string | number): Promise<SurveyRiskResponse> {
        const respondentPayload = await api.get<any>(`/api/survey/responden/${id}`);
        const respondent = pickRespondent(respondentPayload);
        let risks = pickArray(respondentPayload);

        const respondentId = getRespondentId(respondent);
        let riskPayload: any = null;
        if (respondentId) {
            try {
                riskPayload = await this.getRiskPayloadByRespondentId(respondentId);
                const riskRows = pickArray(riskPayload);
                if (riskRows.length > 0) {
                    risks = riskRows;
                } else if (!risks.length) {
                    risks = pickArray(unwrap(riskPayload));
                }
            } catch (error) {
                if (!(error instanceof ApiRequestError && error.status === 404)) {
                    throw error;
                }
            }
        }

        const masterRisks = await this.getMasterRisks().catch(() => []);

        return {
            respondent,
            risks: enrichRisksWithMaster(risks, masterRisks),
            raw: { respondentPayload, riskPayload, masterRisks },
        };
    },

    async getSurveyByCompanyId(companyId: string | number): Promise<SurveyRiskResponse> {
        const respondents = await this.getRespondents();
        const respondent = respondents.find((item) => String(item.id_perusahaan) === String(companyId)) || null;

        if (!respondent?.id) {
            return { respondent: null, risks: [], raw: respondents };
        }

        let risks: any[] = [];
        let riskPayload: any = null;
        try {
            riskPayload = await this.getRiskPayloadByRespondentId(respondent.id);
            risks = pickArray(riskPayload);
        } catch (error) {
            if (!(error instanceof ApiRequestError && error.status === 404)) {
                throw error;
            }
        }
        const masterRisks = await this.getMasterRisks().catch(() => []);

        return {
            respondent,
            risks: enrichRisksWithMaster(risks, masterRisks),
            raw: { respondents, respondent, riskPayload, masterRisks },
        };
    },
};
