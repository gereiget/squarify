import { API_BASE_URL } from "./config";

async function request(path, options = {}) {
  const response = await fetch(new URL(path, API_BASE_URL), {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  if (!response.ok) {
    let message = "Request failed.";
    try {
      const body = await response.json();
      message = body.error || message;
    } catch {
      // Ignore malformed error bodies.
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export const api = {
  createGame(payload) {
    return request("api/games", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  joinGame(payload) {
    return request("api/games/join", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  getGame(gameId) {
    return request(`api/games/${gameId}`);
  },
  move(gameId, payload) {
    return request(`api/games/${gameId}/move`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  restart(gameId, payload) {
    return request(`api/games/${gameId}/restart`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
  }
};
