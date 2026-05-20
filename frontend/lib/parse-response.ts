export type ParseResult = {
  ok: boolean;
  status?: string;
  document_id?: string;
  filename?: string;
  text_preview?: string;
  error?: string;
};

export async function readParseResponse(response: Response): Promise<ParseResult> {
  const text = await response.text();

  if (!text) {
    return response.ok
      ? { ok: true }
      : { ok: false, error: `Parsing service failed with HTTP ${response.status}` };
  }

  try {
    const result = JSON.parse(text) as ParseResult;
    return response.ok || result.error
      ? result
      : { ok: false, error: `Parsing service failed with HTTP ${response.status}` };
  } catch {
    return { ok: false, error: `Parsing service returned an invalid response: ${text.slice(0, 180)}` };
  }
}
