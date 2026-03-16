import axios from "axios";

// Endpoints that must never carry an Authorization header.
// Sending a stale token on these causes the server to reject
// the request before it even checks the submitted credentials.
const PUBLIC_ENDPOINTS = ["/auth/login/", "/auth/refresh/", "/auth/register/"];

const API = axios.create({
  baseURL: "http://127.0.0.1:8000/api/",
});

API.interceptors.request.use((config) => {
  const isPublic = PUBLIC_ENDPOINTS.some((path) => config.url?.includes(path));

  if (!isPublic) {
    const token = localStorage.getItem("access");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }

  return config;
});

API.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const isPublic = PUBLIC_ENDPOINTS.some((path) =>
      originalRequest.url?.includes(path)
    );

    // Only attempt token refresh for protected endpoints.
    // Never retry login/refresh/register — a 401 there means bad credentials.
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !isPublic
    ) {
      originalRequest._retry = true;

      try {
        const refresh = localStorage.getItem("refresh");

        if (!refresh) {
          window.location.href = "/login";
          return Promise.reject(error);
        }

        const res = await axios.post(
          "http://127.0.0.1:8000/api/auth/refresh/",
          { refresh }
        );

        localStorage.setItem("access", res.data.access);
        originalRequest.headers.Authorization = `Bearer ${res.data.access}`;
        return API(originalRequest);
      } catch {
        localStorage.removeItem("access");
        localStorage.removeItem("refresh");
        localStorage.removeItem("user");
        window.location.href = "/login";
      }
    }

    return Promise.reject(error);
  }
);

export default API;