import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "IntelliSeek — Understand Your Notes With AI";
export const size = { width: 1200, height: 630 };

export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          background: "linear-gradient(135deg, #020617 0%, #0f172a 55%, #164e63 100%)",
          padding: "80px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 24,
          }}
        >
          <div
            style={{
              width: 88,
              height: 88,
              borderRadius: 24,
              background: "linear-gradient(135deg, #9333ea, #06b6d4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#f8fafc",
              fontSize: 44,
              fontWeight: 700,
            }}
          >
            IS
          </div>
          <div style={{ display: "flex", fontSize: 64, fontWeight: 700, color: "#f8fafc" }}>
            <span>Intelli</span>
            <span
              style={{
                background: "linear-gradient(90deg, #9333ea, #06b6d4)",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              Seek
            </span>
          </div>
        </div>
        <div style={{ marginTop: 48, display: "flex", fontSize: 52, fontWeight: 600, color: "#f8fafc" }}>
          Understand Your Notes With AI
        </div>
        <div style={{ marginTop: 24, display: "flex", fontSize: 28, color: "#94a3b8", maxWidth: 900 }}>
          Upload your lecture notes, slides, and PDFs — get source-grounded answers with citations.
        </div>
      </div>
    ),
    size,
  );
}
