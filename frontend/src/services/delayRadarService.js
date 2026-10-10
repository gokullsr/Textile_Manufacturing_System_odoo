import { request } from './apiClient';

/**
 * Fetches all active production orders with Delay Radar assessments, summary KPIs, and assumptions.
 */
export const getDelayRadarAssessments = async (params = {}) => {
  const query = new URLSearchParams();
  if (params.status) query.append('status', params.status);
  if (params.search) query.append('search', params.search);
  if (params.sort) query.append('sort', params.sort);

  const qs = query.toString();
  return request(`/api/delay-radar${qs ? `?${qs}` : ''}`);
};

/**
 * Fetches a single order's full Delay Radar assessment including mathematical calculation steps.
 */
export const getOrderAssessment = async (orderNumber) => {
  if (!orderNumber) throw new Error('Order number is required');
  return request(`/api/delay-radar/${encodeURIComponent(orderNumber.trim().toUpperCase())}`);
};

export default {
  getDelayRadarAssessments,
  getOrderAssessment,
};
