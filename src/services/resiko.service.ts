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
    ];

    const found = candidates.find(Array.isArray);
    return found || [];
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
        return api.get<any>(`/api/survey/risiko/${id}`);
    },

    async getRiskByRespondentId(id: string | number): Promise<any[]> {
        const payload = await this.getRiskPayloadByRespondentId(id);
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

        return this.buildSurveyResponseFromRespondent(respondent, riskPayload);
    },

    async getSurveyByRespondentOrCompanyId(id: string | number): Promise<SurveyRiskResponse> {
        const respondentPayload = await api.get<any>(`/api/survey/responden/${id}`);
        const respondent = pickRespondent(respondentPayload);
        let risks = pickArray(respondentPayload);

        const respondentId = getRespondentId(respondent);
        if (respondentId) {
            try {
                const riskPayload = await api.get<any>(`/api/survey/risiko/${respondentId}`);
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

        return {
            respondent,
            risks,
            raw: respondentPayload,
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

        return {
            respondent,
            risks,
            raw: { respondents, respondent, riskPayload },
        };
    },
};
