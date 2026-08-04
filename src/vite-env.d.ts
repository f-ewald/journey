/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Mapbox access token, supplied via a gitignored `.env`. */
  readonly VITE_MAPBOX_TOKEN?: string;
  /**
   * Optional Stadia Maps API key for the Stamen basemaps. Browsers are served
   * without one, but that anonymous access is rate limited and starts
   * returning 429 under load — which leaves the map blank, since Mapbox waits
   * for the first tiles before it reports itself ready.
   */
  readonly VITE_STADIA_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
