import { request } from './apiClient';

export const getRolls = async (params = {}) => {
  const query = new URLSearchParams();
  if (params.qualityStatus) query.append('qualityStatus', params.qualityStatus);
  if (params.dispatchStatus) query.append('dispatchStatus', params.dispatchStatus);
  if (params.orderNumber) query.append('orderNumber', params.orderNumber);
  if (params.machineCode) query.append('machineCode', params.machineCode);
  if (params.search) query.append('search', params.search);
  if (params.page) query.append('page', params.page);
  if (params.limit) query.append('limit', params.limit);
  if (params.sort) query.append('sort', params.sort);

  const qs = query.toString();
  return request(`/api/rolls${qs ? `?${qs}` : ''}`);
};

export const createRoll = async (rollData) => {
  return request('/api/rolls', {
    method: 'POST',
    body: JSON.stringify(rollData),
  });
};

export const getRollByRollId = async (rollId) => {
  return request(`/api/rolls/${encodeURIComponent(rollId.trim().toUpperCase())}`);
};

export const submitInspection = async (rollId, inspectionData) => {
  return request(`/api/rolls/${encodeURIComponent(rollId.trim().toUpperCase())}/inspection`, {
    method: 'PATCH',
    body: JSON.stringify(inspectionData),
  });
};

export const updateDispatchStatus = async (rollId, dispatchData) => {
  return request(`/api/rolls/${encodeURIComponent(rollId.trim().toUpperCase())}/dispatch`, {
    method: 'PATCH',
    body: JSON.stringify(dispatchData),
  });
};

export default {
  getRolls,
  createRoll,
  getRollByRollId,
  submitInspection,
  updateDispatchStatus,
};
