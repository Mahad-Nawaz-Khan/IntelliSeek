import { getAuthenticatedUser } from "../../../../lib/server/auth";
import { markChatJobCancelled, recordChatJobCancelled } from "../../../../lib/server/chat-jobs";
import { createRequestLogger } from "../../../../lib/server/logger";
import { checkRateLimit, getClientIp, rateLimitHeaders, rateLimitResponse } from "../../../../lib/server/rate-limit";

export const runtime = "nodejs";

const JOB_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type CancelRequestBody = {
  jobId?: unknown;
};

/**
 * Marks an in-flight chat answer as cancelled so the background job stops
 * generating. Both the visible stream (client abort) and the server-side job
 * are handled: the abort tears down the SSE read, and this request is what the
 * detached job polls for. The DB insert makes the cancellation deterministic
 * even when this request lands on a different serverless instance than the
 * generation; the in-memory mark is the same-instance fast path.
 */
export async function POST(request: Request) {
  const log = createRequestLogger("api.chat.cancel");

  const user = await getAuthenticatedUser(log);
  if (!user) {
    log.warn("cancel.unauthenticated", { errorCategory: "auth_failure" });
    return Response.json({ ok: false, error: "Sign in is required" }, { status: 401 });
  }

  let body: CancelRequestBody;
  try {
    body = (await request.json()) as CancelRequestBody;
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON request body" }, { status: 400 });
  }

  const jobId = typeof body.jobId === "string" ? body.jobId.trim() : "";
  if (!JOB_ID_PATTERN.test(jobId)) {
    return Response.json({ ok: false, error: "Invalid job id" }, { status: 400 });
  }

  const rateLimit = await checkRateLimit({
    key: `chat-cancel:${user.id}:${getClientIp(request)}`,
    limit: 30,
    windowMs: 60 * 1000,
    log,
  });
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit);

  markChatJobCancelled(jobId);
  // A missing table only means the migration has not run yet; the in-memory
  // mark above still covers the same-instance case, so the request succeeds.
  const persisted = await recordChatJobCancelled(jobId, user.id);
  if (!persisted) {
    log.warn("cancel.persist.failed", { userId: user.id, jobId });
  }

  log.info("cancel.complete", { userId: user.id, jobId, persisted });
  return Response.json(
    { ok: true, status: "Cancellation recorded" },
    { status: 200, headers: rateLimitHeaders(rateLimit) },
  );
}
