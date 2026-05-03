import { api, ApiRequestError } from '@/config/api';

export interface SurveyRiskResponse {
    respondent: any | null;
    risks: any[];
    raw: any;
}

const unwrap = (payload: any): any => {
    if (payload && typeof payload === 'object' && 'data' in payload) {
        return payload.data;
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
};
