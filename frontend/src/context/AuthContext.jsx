import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import apiClient from '../services/apiClient';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionExpiredNotice, setSessionExpiredNotice] = useState(false);

  const checkAuth = useCallback(async () => {
    try {
      const data = await apiClient.get('/auth/me');
      if (data && data.user) {
        setUser(data.user);
        setPermissions(data.permissions || []);
      } else {
        setUser(null);
        setPermissions([]);
      }
    } catch (err) {
      setUser(null);
      setPermissions([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();

    const handleSessionExpired = (e) => {
      setUser(null);
      setPermissions([]);
      setSessionExpiredNotice(true);
      const currentPath = e.detail?.path || window.location.pathname;
      if (!currentPath.startsWith('/login') && !currentPath.startsWith('/accept-invite')) {
        window.location.href = `/login?next=${encodeURIComponent(currentPath)}&expired=1`;
      }
    };

    window.addEventListener('loomiq:session-expired', handleSessionExpired);
    return () => {
      window.removeEventListener('loomiq:session-expired', handleSessionExpired);
    };
  }, [checkAuth]);

  const login = async (email, password) => {
    const data = await apiClient.post('/auth/login', { email, password });
    if (data && data.user) {
      setUser(data.user);
      setPermissions(data.permissions || []);
      setSessionExpiredNotice(false);
    }
    return data;
  };

  const logout = async () => {
    try {
      await apiClient.post('/auth/logout', {});
    } catch (err) {
      // Continue client cleanup even if network fails
    } finally {
      setUser(null);
      setPermissions([]);
      window.location.href = '/login';
    }
  };

  const changePassword = async (currentPassword, newPassword) => {
    return apiClient.post('/auth/change-password', { currentPassword, newPassword });
  };

  const hasPermission = (permission) => {
    if (!permissions || !Array.isArray(permissions)) return false;
    return permissions.includes(permission);
  };

  const value = {
    user,
    permissions,
    isAuthenticated: !!user,
    isLoading,
    sessionExpiredNotice,
    setSessionExpiredNotice,
    login,
    logout,
    changePassword,
    checkAuth,
    hasPermission,
    isOwner: user?.role === 'owner',
    isManager: user?.role === 'manager',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
