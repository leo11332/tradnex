import { supabase, SUPABASE_URL } from "@/lib/auth";

// Edge function base URL
const EDGE_URL = `${SUPABASE_URL}/functions/v1`;

export const BACKEND_URL = EDGE_URL;

export const isBackendConfigured = (): boolean => true;

async function getAuthHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

export const apiCall = async <T = any>(
  endpoint: string,
  options?: RequestInit
): Promise<T> => {
  const authHeaders = await getAuthHeader();
  const url = endpoint.startsWith("http") ? endpoint : `${EDGE_URL}${endpoint}`;

  const fetchOptions: RequestInit = {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders,
      ...options?.headers,
    },
  };

  const response = await fetch(url, fetchOptions);

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API error: ${response.status} - ${text}`);
  }

  return response.json();
};

export const apiGet = <T = any>(endpoint: string): Promise<T> =>
  apiCall<T>(endpoint, { method: "GET" });

export const apiPost = <T = any>(endpoint: string, data: any): Promise<T> =>
  apiCall<T>(endpoint, { method: "POST", body: JSON.stringify(data) });

export const apiPut = <T = any>(endpoint: string, data: any): Promise<T> =>
  apiCall<T>(endpoint, { method: "PUT", body: JSON.stringify(data) });

export const apiPatch = <T = any>(endpoint: string, data: any): Promise<T> =>
  apiCall<T>(endpoint, { method: "PATCH", body: JSON.stringify(data) });

export const apiDelete = <T = any>(
  endpoint: string,
  data: any = {}
): Promise<T> =>
  apiCall<T>(endpoint, { method: "DELETE", body: JSON.stringify(data) });

// Authenticated variants (same as above — auth header is always injected)
export const authenticatedApiCall = apiCall;
export const authenticatedGet = apiGet;
export const authenticatedPost = apiPost;
export const authenticatedPut = apiPut;
export const authenticatedPatch = apiPatch;
export const authenticatedDelete = apiDelete;

// Convenience helpers for TRADNEX endpoints
export const profileApi = {
  get: () => apiGet("/api-profile"),
  update: (data: { stress_threshold?: number; heart_rate_threshold?: number }) =>
    apiPut("/api-profile", data),
  startTrial: () => apiPost("/api-profile/start-trial", {}),
};

export const healthApi = {
  getEntries: (params?: { days?: number; type?: string }) => {
    const qs = new URLSearchParams();
    if (params?.days) qs.set("days", String(params.days));
    if (params?.type) qs.set("type", params.type);
    const query = qs.toString() ? `?${qs.toString()}` : "";
    return apiGet(`/api-health/entries${query}`);
  },
  getLatest: () => apiGet("/api-health/latest"),
  addEntry: (data: {
    stress_score?: number;
    heart_rate?: number;
    hrv?: number;
    sleep_score?: number;
    sleep_duration_minutes?: number;
    sleep_date?: string;
    recorded_at?: string;
    source?: string;
  }) => apiPost("/api-health/entries", data),
};

export const aiApi = {
  getRecommendation: (data: {
    stress_score?: number;
    heart_rate?: number;
    hrv?: number;
    sleep_score?: number;
    sleep_duration_minutes?: number;
  }) => apiPost("/api-ai-recommendation", data),
};
