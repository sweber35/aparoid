// Lambda API endpoints
export const LAMBDA_URLS = {
  REPLAY_STUBS_LAMBDA: import.meta.env.VITE_REPLAY_STUBS_LAMBDA_URL,
  REPLAY_DATA_LAMBDA: import.meta.env.VITE_REPLAY_DATA_LAMBDA_URL,
  REPLAY_TAGS_LAMBDA: import.meta.env.VITE_REPLAY_TAGS_LAMBDA_URL,
} as const; 