import { request } from './apiClient';

export const getOrders = async (params = {}) => {
  const query = new URLSearchParams();
  if (params.status) query.append('status', params.status);
  if (params.delayStatus) query.append('delayStatus', params.delayStatus);
  if (params.search) query.append('search', params.search);
  if (params.page) query.append('page', params.page);
  if (params.limit) query.append('limit', params.limit);
  if (params.sort) query.append('sort', params.sort);

  const qs = query.toString();
  return request(`/api/orders${qs ? `?${qs}` : ''}`);
};

export const getOrderByNumber = async (orderNumber) => {
  return request(`/api/orders/${encodeURIComponent(orderNumber)}`);
};

export const updateOrder = async (orderNumber, updates) => {
  return request(`/api/orders/${encodeURIComponent(orderNumber)}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
};

export const createOrder = async (orderData) => {
  return request('/api/orders', {
    method: 'POST',
    body: JSON.stringify(orderData),
  });
};

export const deleteOrder = async (orderNumber) => {
  return request(`/api/orders/${encodeURIComponent(orderNumber)}`, {
    method: 'DELETE',
  });
};

export default {
  getOrders,
  getOrderByNumber,
  updateOrder,
  createOrder,
  deleteOrder,
};
