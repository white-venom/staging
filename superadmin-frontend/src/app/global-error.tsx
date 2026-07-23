"use client";

// Next.js only calls this when the crash happens in the ROOT layout itself
// (so route-level error.tsx never got a chance to mount) -- it has to render
// its own <html>/<body> and stay dependency-free since whatever the layout
// depends on may be exactly what crashed.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, -apple-system, sans-serif" }}>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            background: "#f8fafc",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 420,
              background: "#fff",
              border: "1px solid #e2e8f0",
              borderRadius: 4,
              padding: 32,
              textAlign: "center",
            }}
          >
            <div
              style={{
                display: "inline-block",
                padding: "4px 10px",
                background: "#fef2f2",
                border: "1px solid #fecaca",
                color: "#b91c1c",
                borderRadius: 4,
                fontSize: 10,
                fontWeight: 900,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                marginBottom: 12,
              }}
            >
              Console Failed To Load
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: "#1e293b", margin: "0 0 8px" }}>
              Something went wrong
            </h2>
            <p style={{ fontSize: 13, color: "#64748b", lineHeight: 1.5, margin: "0 0 20px" }}>
              The superadmin console couldn&apos;t start. No tenant data was touched — try reloading.
            </p>
            <button
              onClick={() => reset()}
              style={{
                width: "100%",
                padding: "12px",
                background: "#4f46e5",
                color: "#fff",
                border: "none",
                borderRadius: 4,
                fontSize: 12,
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: "0.03em",
                cursor: "pointer",
                marginBottom: 8,
              }}
            >
              Reload
            </button>
            <a
              href="mailto:support@crediiflow.in"
              style={{
                display: "block",
                fontSize: 11,
                fontWeight: 700,
                color: "#64748b",
                textDecoration: "none",
                marginTop: 12,
              }}
            >
              support@crediiflow.in
            </a>
            {error?.digest && (
              <p style={{ fontSize: 10, color: "#94a3b8", marginTop: 16, fontFamily: "monospace" }}>
                Ref: {error.digest}
              </p>
            )}
          </div>
        </div>
      </body>
    </html>
  );
}
