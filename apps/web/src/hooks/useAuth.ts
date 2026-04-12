import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/auth.store.js';

export function useAuth({ requireAuth = true } = {}) {
  const { user, isAuthenticated, isLoading, checkSession } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!isAuthenticated && !isLoading) {
      checkSession();
    }
  }, [isAuthenticated, isLoading, checkSession]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated && requireAuth) {
      navigate('/login', { replace: true, state: { from: location.pathname } });
    }
  }, [isLoading, isAuthenticated, requireAuth, navigate, location.pathname]);

  return { user, isAuthenticated, isLoading };
}
