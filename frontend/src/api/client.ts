const API_BASE =
  import.meta.env.VITE_API_URL ??
  (import.meta.env.DEV ? '' : 'http://127.0.0.1:8000');
const API_PREFIX = import.meta.env.DEV && !import.meta.env.VITE_API_URL ? '/api' : '';

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${API_PREFIX}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { detail?: string })?.detail ?? res.statusText);
  return data as T;
}

async function requestWithFormData<T>(
  path: string,
  formData: FormData
): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${API_PREFIX}${path}`;
  const res = await fetch(url, {
    method: 'POST',
    body: formData,
    credentials: 'include',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { detail?: string })?.detail ?? res.statusText);
  return data as T;
}

export const api = {
  getUsers: () => request<Array<{ user_id: number; login: string; email: string; phone: string; role: string; created_at: string }>>('/users'),
  register: (body: { login: string; password: string; email: string; phone: string }) =>
    request<{ ok: boolean; message: string }>('/registration', { method: 'POST', body: JSON.stringify(body) }),
  login: (body: { login: string; password: string }) =>
    request<{ ok: boolean }>('/login', { method: 'POST', body: JSON.stringify(body) }),
  getAppeals: () =>
    request<Appeal[]>('/get_appeals'),
  getMyAppeals: (login: string) =>
    request<Appeal[]>(`/my_appeals?login=${encodeURIComponent(login)}`),
  getAppeal: (id: number) =>
    request<Appeal>(`/get_appeals/${id}`),
  updateAppealStatus: (id: number, status: string) =>
    request<{ ok: boolean; message: string }>(`/get_appeals/${id}?status=${encodeURIComponent(status)}`, { method: 'PUT' }),
  createAppeal: (formData: FormData) =>
    requestWithFormData<{ ok: boolean; message: string; appeal_id: number; category: string; subcategory: string | null; confidence: number; photos: string[] }>('/new_appeal', formData),
  createUserByAdmin: (body: {
    admin_login: string;
    admin_password: string;
    login: string;
    password: string;
    email: string;
    phone: string;
    role: 'admin' | 'user' | 'superadmin';
  }) =>
    request<{ ok: boolean; message: string }>('/admin/create_user', { method: 'POST', body: JSON.stringify(body) }),
  getAdminCategories: () => request<string[]>('/admin/categories'),
  getMyTasks: (login: string) => request<Appeal[]>(`/admin/my_tasks?login=${encodeURIComponent(login)}`),
  getAdminAssignments: (login: string) =>
    request<Array<{ user_id: number; login: string; categories: string[] }>>(`/admin/assignments?login=${encodeURIComponent(login)}`),
  setAdminAssignments: (body: { admin_login: string; admin_password: string; user_id: number; categories: string[] }) =>
    request<{ ok: boolean; message: string }>('/admin/assignments', { method: 'POST', body: JSON.stringify(body) }),
};

export interface Appeal {
  appeal_id: number;
  topic: string;
  main_text: string;
  appeal_date: string;
  status: string;
  category: string;
  subcategory: string | null;
  confidence: number;
  routing_debug?: string;
  address?: string | null;
  address_normalized?: string | null;
  lat?: number | null;
  lon?: number | null;
  tag?: string | null;
  photos?: string[];
}

export const PRIORITY_TAGS = [
  'Критический',
  'Массовая проблема',
  'Высокий приоритет',
  'Отложено',
  'Единичный случай',
  'Требует проверки',
] as const
