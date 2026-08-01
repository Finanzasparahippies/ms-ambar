import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { getApiUrl } from './utils';

// Instancia única (Singleton) de Axios para todo el proyecto ms-ambar
const createApiInstance = (): AxiosInstance => {
  const created = typeof axios.create === 'function' ? axios.create({
    baseURL: typeof window !== 'undefined' ? getApiUrl() : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'),
    timeout: 15000,
    headers: {
      'Content-Type': 'application/json',
    },
  }) : null;

  return created || (axios as unknown as AxiosInstance);
};

const api: AxiosInstance = createApiInstance();

// Interceptor de Peticiones: inyecta token Bearer automáticamente si existe
api?.interceptors?.request?.use(
  (config) => {
    if (typeof window !== 'undefined') {
      // Dinámicamente asegura la URL base actualizada
      if (!config.baseURL || config.baseURL === 'http://localhost:8000/api') {
        config.baseURL = getApiUrl();
      }
      const token = localStorage.getItem('token');
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor de Respuestas: manejo centralizado de errores de autenticación y red
api?.interceptors?.response?.use(
  (response: AxiosResponse) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && typeof window !== 'undefined') {
      // Limpieza de sesión en expiración de token de forma segura
      const currentPath = window.location.pathname;
      if (!currentPath.startsWith('/login') && !currentPath.startsWith('/signup')) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = `/login?redirect=${encodeURIComponent(currentPath)}`;
      }
    }

    // Reintento único para fallos de red en peticiones GET idempotentes
    if (error.code === 'ECONNABORTED' && originalRequest && !originalRequest._retry && originalRequest.method === 'get') {
      originalRequest._retry = true;
      try {
        return await api(originalRequest);
      } catch (retryErr) {
        return Promise.reject(retryErr);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
