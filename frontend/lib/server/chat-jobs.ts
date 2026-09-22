import "server-only";

import { getSupabaseServiceClient } from "./supabase";

/**
 * Cancellation registry for in-flight chat answer jobs.
 *
 * Two layers, because the cancel request and the generation request can land
 * on different serverless instances:
 *  - an in-memory set (instant, same-instance fast path), and
 *  - the `chat_stop_requests` table (deterministic, cross-instance), polled
 *    by the job at a throttled interval while generating.
 */

const cancelledJobIds = new Set<string>();
const CANCELLED_JOB_IDS_CAP = 1000;

export function markChatJobCancelled(jobId: string): void {
  if (cancelledJobIds.size >= CANCELLED_JOB_IDS_CAP) {
    // Set iterates in insertion order, so this drops the oldest entries.
    const excess = cancelledJobIds.size - CANCELLED_JOB_IDS_CAP + 1;
    let dropped = 0;
    for (const id of cancelledJobIds) {
      cancelledJobIds.delete(id);
      dropped += 1;
      if (dropped >= excess) break;
    }
  }
  cancelledJobIds.add(jobId);
}

export function isChatJobCancelledInMemory(jobId: string): boolean {
  return cancelledJobIds.has(jobId);
}

export function forgetChatJobCancelled(jobId: string): void {
  cancelledJobIds.delete(jobId);
}

/**
 * Deterministic check against `chat_stop_requests`. Returns false when the
 * service client or the table is unavailable, so a missing migration can only
 * degrade cancellation to the in-memory layer, never break answering.
 */
export async function isChatJobCancelledInDb(jobId: string, userId: string): Promise<boolean> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) return false;

  const { count, error } = await supabase
    .from("chat_stop_requests")
    .select("job_id", { count: "exact", head: true })
    .eq("job_id", jobId)
    .eq("user_id", userId);

  if (error) return false;
  return (count ?? 0) > 0;
}

export async function recordChatJobCancelled(jobId: string, userId: string): Promise<boolean> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) return false;

  const { error } = await supabase
    .from("chat_stop_requests")
    .insert({ job_id: jobId, user_id: userId });

  if (error) return false;
  return true;
}

/** Best-effort cleanup once a job finishes; stale rows are harmless anyway. */
export async function forgetChatJobCancelledInDb(jobId: string, userId: string): Promise<void> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) return;

  await supabase
    .from("chat_stop_requests")
    .delete()
    .eq("job_id", jobId)
    .eq("user_id", userId)
    .then(() => {}, () => {});
}
