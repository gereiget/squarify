const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/";

export const API_BASE_URL = configuredBaseUrl.endsWith("/") ? configuredBaseUrl : `${configuredBaseUrl}/`;
export const POLL_INTERVAL_MS = 1500;
