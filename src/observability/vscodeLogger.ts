import type * as vscode from "vscode";
import { sanitizeLogMessage } from "../util/safeLog";
import type { LogFields, Logger } from "./logger";

type LogLevel = "debug" | "info" | "warn" | "error";

function safeValue(
  value: unknown,
  seen: WeakSet<object>,
  depth = 0,
): unknown {
  if (typeof value === "string") {
    return sanitizeLogMessage(value);
  }
  if (
    value === null ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "undefined"
  ) {
    return value;
  }
  if (typeof value === "bigint") {
    return value.toString();
  }
  if (value instanceof Error) {
    const nodeError = value as NodeJS.ErrnoException;
    return {
      name: value.name,
      message: sanitizeLogMessage(value.message),
      ...(typeof nodeError.code === "string" ? { code: nodeError.code } : {}),
    };
  }
  if (typeof value !== "object") {
    return String(value);
  }
  if (depth >= 4 || seen.has(value)) {
    return "[TRUNCATED]";
  }
  seen.add(value);
  if (Array.isArray(value)) {
    return value.slice(0, 50).map((entry) => safeValue(entry, seen, depth + 1));
  }
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .slice(0, 50)
      .map(([key, entry]) => [key, safeValue(entry, seen, depth + 1)]),
  );
}

function serialize(level: LogLevel, event: string, fields?: LogFields): string {
  const safeFields = fields
    ? (safeValue(fields, new WeakSet()) as Record<string, unknown>)
    : {};
  const record = {
    timestamp: new Date().toISOString(),
    level,
    event: sanitizeLogMessage(event),
    ...safeFields,
  };
  return JSON.stringify(record);
}

export function createOutputChannelLogger(
  output: Pick<vscode.OutputChannel, "appendLine">,
): Logger {
  const write = (level: LogLevel, event: string, fields?: LogFields) => {
    output.appendLine(serialize(level, event, fields));
  };
  return {
    debug: (event, fields) => write("debug", event, fields),
    info: (event, fields) => write("info", event, fields),
    warn: (event, fields) => write("warn", event, fields),
    error: (event, fields) => write("error", event, fields),
  };
}
