import { request } from './apiClient';

export const getStock = async (level) => {
  const qs = level ? `?level=${encodeURIComponent(level)}` : '';
  return request(`/api/stock${qs}`);
};

export const createStock = async (stockData) => {
  return request('/api/stock', {
    method: 'POST',
    body: JSON.stringify(stockData),
  });
};

export const updateStock = async (id, updateData) => {
  return request(`/api/stock/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updateData),
  });
};

export const deleteStock = async (id) => {
  return request(`/api/stock/${id}`, {
    method: 'DELETE',
  });
};

export default {
  getStock,
  createStock,
  updateStock,
  deleteStock,
};
