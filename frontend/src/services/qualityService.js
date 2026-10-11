import { request } from './apiClient';

/**
 * Quality Service for Stage Gates & Control Tower.
 */
export const qualityService = {
  getConfig: async () => {
    return request('/api/quality/config');
  },

  getSummary: async (params = {}) => {
    const query = new URLSearchParams();
    const days = params.windowDays || params.days;
    if (days) query.append('windowDays', days);
    if (params.stage) query.append('stage', params.stage);
    if (params.machineCode) query.append('machineCode', params.machineCode);
    const qs = query.toString();
    return request(`/api/quality/summary${qs ? `?${qs}` : ''}`);
  },

  getAlerts: async (type = null) => {
    const query = new URLSearchParams();
    if (type) query.append('type', type);
    const qs = query.toString();
    return request(`/api/quality/alerts${qs ? `?${qs}` : ''}`);
  },

  previewInspection: async (rollId, payload) => {
    return request(`/api/rolls/${encodeURIComponent(rollId.trim().toUpperCase())}/inspection/preview`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  advanceStage: async (rollId, payload = {}) => {
    return request(`/api/rolls/${encodeURIComponent(rollId.trim().toUpperCase())}/advance`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};

export default qualityService;
