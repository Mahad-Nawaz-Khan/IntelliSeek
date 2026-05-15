import { getBackendUrl } from "../../../lib/config";

const BACKEND_HEALTH_URL = getBackendUrl("/api/health");
const HEALTHY_STATUS = "IntelliSeek Backend is healthy";

export async function GET() {
  try {
    const response = await fetch(BACKEND_HEALTH_URL, {
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });

    if (!response.ok) {
      return Response.json(
        { status: "Backend connection unavailable", ok: false },
        { status: 503 },
      );
    }

    const data = (await response.json()) as { status?: string };

    if (data.status !== HEALTHY_STATUS) {
      return Response.json(
        { status: "Backend connection unavailable", ok: false },
        { status: 503 },
      );
    }

    return Response.json({ status: data.status, ok: true });
  } catch {
    return Response.json(
      { status: "Backend connection unavailable", ok: false },
      { status: 503 },
    );
  }
}
