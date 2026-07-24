"use client";
// app/global-error.tsx
//
// Last-resort fallback — only fires if the ROOT layout itself throws, which
// is why it renders its own <html>/<body> (there's no parent layout left to
// rely on at that point). Segment-level error.tsx files handle everything
// else, keeping the sidebar/shell visible; this one is the rare full-page
// case where even the shell couldn't render.

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[GlobalError]", error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "1rem",
            padding: "2rem",
            fontFamily:
              "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            textAlign: "center",
          }}
        >
          <h1 style={{ fontSize: "1.5rem", fontWeight: 600, margin: 0 }}>
            Something went wrong
          </h1>
          <p style={{ color: "#7e807f", margin: 0, maxWidth: 420 }}>
            The app hit an unexpected error and couldn&apos;t recover. Try
            reloading — if it keeps happening, let us know what you were
            doing.
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: "0.5rem",
              padding: "0.625rem 1.25rem",
              borderRadius: "8px",
              border: "none",
              background: "#141414",
              color: "#fff",
              fontSize: "0.875rem",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
