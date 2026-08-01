/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Mapbox access token, supplied via a gitignored `.env`. */
  readonly VITE_MAPBOX_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
