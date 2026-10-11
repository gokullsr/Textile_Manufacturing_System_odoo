import { request } from './apiClient';

/**
 * Corrective Actions (CAPA) Service.
 */
export const correctiveActionService = {
  getActions: async (params = {}) => {
    const query = new URLSearchParams();
    if (params.status) query.append('status', params.status);
    if (params.stage) query.append('stage', params.stage);
    if (params.machineCode) query.append('machineCode', params.machineCode);
    if (params.overdue) query.append('overdue', params.overdue);
    if (params.page) query.append('page', params.page);
    if (params.limit) query.append('limit', params.limit);
    const qs = query.toString();
    return request(`/api/corrective-actions${qs ? `?${qs}` : ''}`);
  },

  createAction: async (payload) => {
    return request('/api/corrective-actions', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  getActionByNumber: async (actionNumber) => {
    return request(`/api/corrective-actions/${encodeURIComponent(actionNumber.trim().toUpperCase())}`);
  },

  updateAction: async (actionNumber, payload) => {
    return request(`/api/corrective-actions/${encodeURIComponent(actionNumber.trim().toUpperCase())}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },
};

export default correctiveActionService;
