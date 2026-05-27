import { serve } from "inngest/next";

import { inngest } from "../../../lib/server/inngest/client";
import { functions } from "../../../lib/server/inngest/functions";

export const runtime = "nodejs";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions,
});
