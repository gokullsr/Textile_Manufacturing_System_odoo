import { apiClient } from './apiClient';

export const getStock = async (params = {}) => {
  return apiClient.get('/stock', { params: typeof params === 'string' ? { level: params } : params });
};

export const getStockSummary = async () => {
  return apiClient.get('/stock/summary');
};

export const createStock = async (stockData) => {
  return apiClient.post('/stock', stockData);
};

export const updateStock = async (id, updateData) => {
  return apiClient.patch(`/stock/${id}`, updateData);
};

export const deleteStock = async (id) => {
  return apiClient.delete(`/stock/${id}`);
};

export const receiveStock = async (id, payload) => {
  return apiClient.post(`/stock/${id}/receive`, payload);
};

export const useStock = async (id, payload) => {
  return apiClient.post(`/stock/${id}/use`, payload);
};

export const adjustStock = async (id, payload) => {
  return apiClient.post(`/stock/${id}/adjust`, payload);
};

export const markOrdered = async (id, payload) => {
  return apiClient.post(`/stock/${id}/mark-ordered`, payload);
};

export const getStockMovements = async (id) => {
  return apiClient.get(`/stock/${id}/movements`);
};

export default {
  getStock,
  getStockSummary,
  createStock,
  updateStock,
  deleteStock,
  receiveStock,
  useStock,
  adjustStock,
  markOrdered,
  getStockMovements,
};
