import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default async function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #9333ea, #06b6d4)",
          color: "#f8fafc",
          fontSize: 96,
          fontWeight: 700,
        }}
      >
        IS
      </div>
    ),
    size,
  );
}
