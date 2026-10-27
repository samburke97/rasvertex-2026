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
            background: "#f6f6f4",
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
          <h1 style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.02em", color: "#17171a", margin: 0 }}>
            Something went wrong
          </h1>
          <p style={{ color: "rgba(23, 23, 26, 0.62)", fontSize: 14, lineHeight: 1.55, margin: 0, maxWidth: 420 }}>
            The app hit an unexpected error and couldn&apos;t recover. Try
            reloading — if it keeps happening, let us know what you were
            doing.
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: 8,
              height: 38,
              padding: "0 16px",
              borderRadius: 9,
              border: "none",
              background: "linear-gradient(180deg, #3a78a6 0%, #2f6a94 100%)",
              boxShadow: "0 1px 2px rgba(62, 127, 176, 0.15)",
              color: "#fff",
              fontSize: 13,
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
