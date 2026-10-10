import { request } from './apiClient';

export const getDashboardSummary = async () => {
  return request('/api/dashboard/summary');
};

export default {
  getDashboardSummary,
};
