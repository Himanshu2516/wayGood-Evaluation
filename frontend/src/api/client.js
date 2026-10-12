const BASE_URL = import.meta.env.VITE_API_URL || "/api";

const TOKEN_KEY = "waygood_auth_token";
const USER_KEY = "waygood_auth_user";

export const authStorage = {
  getToken: () => localStorage.getItem(TOKEN_KEY),
  setToken: (token) => {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  },
  getUser: () => {
    try {
      const stored = localStorage.getItem(USER_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  },
  setUser: (user) => {
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_KEY);
  },
  clear: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },
};

async function request(endpoint, options = {}) {
  const token = authStorage.getToken();
  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const config = {
    ...options,
    headers,
  };

  let response;
  try {
    response = await fetch(`${BASE_URL}${endpoint}`, config);
  } catch (netErr) {
    throw new Error(`Network error connecting to API: ${netErr.message}`);
  }

  let payload;
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    payload = await response.json();
  } else {
    payload = { message: await response.text() };
  }

  if (!response.ok) {
    const errorMsg =
      payload?.message ||
      payload?.error ||
      `Request failed with status ${response.status}`;
    const error = new Error(errorMsg);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}

export const api = {
  login: async (email, password) => {
    const res = await request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    if (res.data?.token) {
      authStorage.setToken(res.data.token);
      authStorage.setUser(res.data.user);
    }
    return res.data;
  },

  register: async (userData) => {
    const res = await request("/auth/register", {
      method: "POST",
      body: JSON.stringify(userData),
    });
    if (res.data?.token) {
      authStorage.setToken(res.data.token);
      authStorage.setUser(res.data.user);
    }
    return res.data;
  },

  getMe: async () => {
    const res = await request("/auth/me");
    const user = res.data?.user || res.data;
    if (user) {
      authStorage.setUser(user);
    }
    return user;
  },

  getProfile: async () => {
    const res = await request("/auth/profile");
    return res.data?.student || res.data?.user || res.data;
  },

  updateProfile: async (profileData) => {
    const res = await request("/auth/profile", {
      method: "PUT",
      body: JSON.stringify(profileData),
    });
    const user = res.data?.student || res.data?.user || res.data;
    if (user) {
      authStorage.setUser(user);
    }
    return user;
  },

  uploadDocument: async (documentData) => {
    const res = await request("/auth/documents", {
      method: "POST",
      body: JSON.stringify(documentData),
    });
    const user = res.data?.student || res.data?.user || res.data;
    if (user) {
      authStorage.setUser(user);
    }
    return user;
  },

  deleteDocument: async (documentId) => {
    const res = await request(`/auth/documents/${documentId}`, {
      method: "DELETE",
    });
    const user = res.data?.student || res.data?.user || res.data;
    if (user) {
      authStorage.setUser(user);
    }
    return user;
  },

  getUniversities: async (params = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== "") {
        query.append(key, val);
      }
    });
    const qs = query.toString() ? `?${query.toString()}` : "";
    const res = await request(`/universities${qs}`);
    return {
      universities: Array.isArray(res.data) ? res.data : (res.data?.universities || []),
      meta: res.meta || {},
    };
  },

  getUniversityById: async (id) => {
    const res = await request(`/universities/${id}`);
    return res.data?.university || res.data;
  },

  getPrograms: async (params = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== "") {
        query.append(key, val);
      }
    });
    const qs = query.toString() ? `?${query.toString()}` : "";
    const res = await request(`/programs${qs}`);
    return {
      programs: Array.isArray(res.data) ? res.data : (res.data?.programs || []),
      meta: res.meta || {},
    };
  },

  getProgramById: async (id) => {
    const res = await request(`/programs/${id}`);
    return res.data?.program || res.data;
  },

  getRecommendations: async (studentId, params = {}) => {
    const query = new URLSearchParams();
    if (params.limit) query.append("limit", params.limit);
    const qs = query.toString() ? `?${query.toString()}` : "";
    const endpoint = studentId
      ? `/recommendations/${studentId}${qs}`
      : `/recommendations${qs}`;
    const res = await request(endpoint);
    return res.data?.recommendations || (Array.isArray(res.data) ? res.data : []);
  },

  getApplications: async () => {
    const res = await request("/applications");
    return Array.isArray(res.data) ? res.data : (res.data?.applications || []);
  },

  createApplication: async ({ programId, intake }) => {
    const res = await request("/applications", {
      method: "POST",
      body: JSON.stringify({ programId, intake }),
    });
    return res.data?.application || res.data;
  },

  advanceApplicationStatus: async (id, nextStatus, notes = "") => {
    const res = await request(`/applications/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: nextStatus, notes }),
    });
    return res.data?.application || res.data;
  },

  withdrawApplication: async (id, notes = "") => {
    const res = await request(`/applications/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: "withdrawn", notes }),
    });
    return res.data?.application || res.data;
  },

  getDashboardOverview: async () => {
    const res = await request("/dashboard/overview");
    return res.data || {};
  },

  generateStudyPlan: async ({ profile, topRecommendations } = {}) => {
    const res = await request("/ai/study-plan", {
      method: "POST",
      body: JSON.stringify({ profile, topRecommendations }),
    });
    return res.data?.studyPlan
      ? { ...res.data.studyPlan, meta: res.meta }
      : res.data?.studyPlan;
  },

  getRecommendationInsights: async () => {
    const res = await request("/ai/recommendation-insights", {
      method: "POST",
      body: JSON.stringify({}),
    });
    return {
      insights: res.data?.insights || [],
      overallAdvice: res.data?.overallAdvice || "",
      meta: res.meta,
    };
  },
};
