import { request } from './apiClient';

export const getMachines = async (status) => {
  const qs = status ? `?status=${encodeURIComponent(status)}` : '';
  return request(`/api/machines${qs}`);
};

export default {
  getMachines,
};
