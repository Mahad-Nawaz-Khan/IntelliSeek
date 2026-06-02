import "server-only";

export type ErrorCategory =
  | "validation"
  | "auth_failure"
  | "rate_limit"
  | "storage_download"
  | "parse_failure"
  | "embedding_failure"
  | "supabase_query"
  | "supabase_insert"
  | "supabase_delete"
  | "retrieval"
  | "indexing"
  | "inngest_enqueue"
  | "agent"
  | "unknown";

type LogLevel = "info" | "warn" | "error";

export type LogData = Record<string, unknown> & {
  errorCategory?: ErrorCategory;
  error?: unknown;
};

export type RequestLogger = ReturnType<typeof createRequestLogger>;

function sanitizeValue(value: unknown): unknown {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: process.env.NODE_ENV === "production" ? undefined : value.stack,
    };
  }

  if (Array.isArray(value)) return value.map(sanitizeValue);

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => !/token|secret|cookie|password|key/i.test(key))
        .map(([key, item]) => [key, sanitizeValue(item)]),
    );
  }

  return value;
}

function sanitizeLogData(data: LogData): Record<string, unknown> {
  const sanitized = sanitizeValue(data);
  return sanitized && typeof sanitized === "object" && !Array.isArray(sanitized)
    ? sanitized as Record<string, unknown>
    : {};
}

function writeLog(level: LogLevel, source: string, requestId: string, startedAt: number, message: string, data: LogData = {}) {
  const payload = {
    level,
    timestamp: new Date().toISOString(),
    source,
    requestId,
    message,
    durationMs: Date.now() - startedAt,
    ...sanitizeLogData(data),
  };

  const line = JSON.stringify(payload);
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.info(line);
  }
}

export function generateRequestId(prefix = "req") {
  const random = crypto.randomUUID?.().slice(0, 8) ?? Math.random().toString(16).slice(2, 10);
  return `${prefix}_${random}_${Date.now().toString(36)}`;
}

export function createRequestLogger(source: string, requestId = generateRequestId()) {
  const startedAt = Date.now();

  return {
    requestId,
    info(message: string, data?: LogData) {
      writeLog("info", source, requestId, startedAt, message, data);
    },
    warn(message: string, data?: LogData) {
      writeLog("warn", source, requestId, startedAt, message, data);
    },
    error(message: string, data?: LogData) {
      writeLog("error", source, requestId, startedAt, message, data);
    },
  };
}
