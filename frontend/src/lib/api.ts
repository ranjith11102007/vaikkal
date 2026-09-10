import axios, { AxiosAdapter, AxiosError, AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/store';
import { routeMockRequest, parseQuery } from '@/lib/mock/router';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api/backend/api/v1';

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK !== 'false';

const mockAdapter: AxiosAdapter = (config) =>
  new Promise((resolve, reject) => {
    setTimeout(() => {
      try {
        const method = (config.method ?? 'get').toLowerCase();
        const base = String(config.baseURL ?? '').replace(/\/$/, '');
        const rawUrl = String(config.url ?? '');
        const [pathPart, qs] = rawUrl.split('?');
        const path = `${base}/${pathPart.replace(/^\//, '')}`;
        const params: Record<string, unknown> = { ...parseQuery(qs ?? '') };
        if (config.params && typeof config.params === 'object') {
          Object.entries(config.params as Record<string, unknown>).forEach(([k, v]) => {
            if (v !== undefined && v !== null) params[k] = v;
          });
        }
        let body: unknown = config.data;
        if (typeof body === 'string') {
          try {
            body = JSON.parse(body);
          } catch {
            // keep raw string body
          }
        }
        const headers = config.headers as Record<string, unknown>;
        const authHeader = String(headers.Authorization ?? headers.authorization ?? '');
        const { status, data } = routeMockRequest({ method, path, params, body, authHeader });
        const response: AxiosResponse = {
          data,
          status,
          statusText: status >= 400 ? 'Error' : 'OK',
          headers: {},
          config,
          request: {},
        };
        if (status >= 200 && status < 300) {
          resolve(response);
        } else {
          reject(
            new AxiosError(
              `Request failed with status code ${status}`,
              String(status),
              config,
              {},
              response
            )
          );
        }
      } catch (err) {
        reject(err instanceof Error ? err : new AxiosError('Mock adapter error'));
      }
    }, 200 + Math.random() * 300);
  });

const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
  adapter: USE_MOCK ? mockAdapter : undefined,
});

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: AxiosError) => Promise.reject(error)
);

let isRefreshing = false;
let failedQueue: Array<{ resolve: (value?: unknown) => void; reject: (reason?: unknown) => void }> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/login') &&
      !originalRequest.url?.includes('/refresh')
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = useAuthStore.getState().refreshToken;
      if (!refreshToken) {
        useAuthStore.getState().logout();
        return Promise.reject(error);
      }

      try {
        const { data } = await api.post('/auth/refresh', {
          refresh_token: refreshToken,
        });
        const newAccessToken: string = data.accessToken ?? data.access_token;
        const newRefreshToken: string = data.refreshToken ?? data.refresh_token ?? refreshToken;
        useAuthStore.getState().setTokens(newAccessToken, newRefreshToken);
        processQueue(null, newAccessToken);
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        useAuthStore.getState().logout();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const err = error as AxiosError<{ message?: string; detail?: string; error?: string }>;
    const data = err.response?.data;
    if (typeof data === 'string') {
      return 'Service unavailable. Please try again.';
    }
    return (
      data?.message ??
      data?.detail ??
      data?.error ??
      'Something went wrong. Please try again.'
    );
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Something went wrong. Please try again.';
}

export function isNetworkError(error: unknown): boolean {
  return axios.isAxiosError(error) && !error.response;
}

export async function apiGet<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const { data } = await api.get<T>(url, config);
  return data;
}

export async function apiPost<T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> {
  const { data } = await api.post<T>(url, body, config);
  return data;
}

export async function apiPut<T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> {
  const { data } = await api.put<T>(url, body, config);
  return data;
}

export async function apiPatch<T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> {
  const { data } = await api.patch<T>(url, body, config);
  return data;
}

export async function apiDelete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const { data } = await api.delete<T>(url, config);
  return data;
}

export default api;