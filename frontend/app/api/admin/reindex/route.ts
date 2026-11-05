import { getAuthenticatedUser } from "../../../../lib/server/auth";
import { getSupabaseServiceClient } from "../../../../lib/server/supabase";
import { inngest } from "../../../../lib/server/inngest/client";

export const runtime = "nodejs";

type DocumentReindexRow = {
  id: string;
  filename: string;
  file_type: string;
  storage_path: string;
};

export async function POST() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return Response.json({ ok: false, error: "Sign in is required" }, { status: 401 });
  }

  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    return Response.json({ ok: false, error: "Database client is unavailable" }, { status: 500 });
  }

  // Fetch all documents for this user
  const { data: documents, error } = await supabase
    .from("documents")
    .select("id, filename, file_type, storage_path")
    .eq("user_id", user.id);

  if (error) {
    return Response.json({ ok: false, error: "Failed to load documents" }, { status: 500 });
  }

  const docRows = (documents ?? []) as DocumentReindexRow[];
  if (!docRows.length) {
    return Response.json({ ok: false, error: "No documents found to reindex" }, { status: 404 });
  }

  // Dispatch Inngest index.requested event for each document
  const events = docRows.map((doc) => ({
    name: "document/index.requested" as const,
    data: {
      userId: user.id,
      documentId: doc.id,
      storagePath: doc.storage_path,
      filename: doc.filename,
      fileType: doc.file_type,
    },
  }));

  await inngest.send(events);

  return Response.json({
    ok: true,
    message: `Triggered re-indexing for ${docRows.length} documents. Micro-chunks and keyphrases are generating in background.`,
    count: docRows.length,
  });
}

