/** Default host/port for the local bridge. Localhost-only by design. */
export const BRIDGE_HOST = "127.0.0.1";
export const BRIDGE_PORT = 8765;
export const BRIDGE_BASE_URL = `http://${BRIDGE_HOST}:${BRIDGE_PORT}`;

export const API_PREFIX = "/api/v1";

export const ENDPOINTS = {
  health: `${API_PREFIX}/health`,
  context: `${API_PREFIX}/context`,
  contextLatest: `${API_PREFIX}/context/latest`,
} as const;

/** Collector truncation limits (characters), tuned for MVP; compression comes later. */
export const LIMITS = {
  activeFileMaxChars: 60_000,
  gitDiffMaxChars: 40_000,
  terminalMaxLines: 200,
  maxDiagnostics: 100,
} as const;
