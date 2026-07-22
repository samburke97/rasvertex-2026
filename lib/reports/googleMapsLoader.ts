/// <reference types="google.maps" />
// lib/reports/googleMapsLoader.ts
// Loads the Google Maps JavaScript SDK once (singleton promise) for the
// anchor report's live zone map preview. Client-side only — this key is
// necessarily exposed in the browser (unlike the server-only static-map
// proxy key), so it must be its own HTTP-referrer-restricted key.

let loadPromise: Promise<typeof google> | null = null;

export function loadGoogleMaps(): Promise<typeof google> {
  if (typeof window === "undefined") {
    return Promise.reject(
      new Error("Google Maps can only load in the browser"),
    );
  }
  if (window.google?.maps) return Promise.resolve(window.google);
  if (loadPromise) return loadPromise;

  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_JS_KEY;
  if (!key) {
    return Promise.reject(
      new Error("NEXT_PUBLIC_GOOGLE_MAPS_JS_KEY is not configured"),
    );
  }

  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&v=weekly`;
    script.async = true;
    script.onload = () => {
      if (window.google?.maps) resolve(window.google);
      else reject(new Error("Google Maps failed to initialise"));
    };
    script.onerror = () => {
      loadPromise = null;
      reject(new Error("Failed to load the Google Maps script"));
    };
    document.head.appendChild(script);
  });

  return loadPromise;
}
