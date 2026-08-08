export type LogFields = Readonly<Record<string, unknown>>;

/** Host-agnostic diagnostics port. Implementations must redact secrets. */
export interface Logger {
  debug(event: string, fields?: LogFields): void;
  info(event: string, fields?: LogFields): void;
  warn(event: string, fields?: LogFields): void;
  error(event: string, fields?: LogFields): void;
}

const ignore = (): void => undefined;

export const NOOP_LOGGER: Logger = {
  debug: ignore,
  info: ignore,
  warn: ignore,
  error: ignore,
};

/** Ordered from most to least verbose; `off` silences everything. */
const LOG_LEVELS = ["debug", "info", "warn", "error"] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];
export type LogLevelSetting = LogLevel | "off";

export function isLogLevelSetting(value: unknown): value is LogLevelSetting {
  return value === "off" || (LOG_LEVELS as readonly unknown[]).includes(value);
}

/**
 * Drops records below `getMinimum()`. The threshold is read per call so a
 * settings change takes effect without reloading the window.
 */
export function withMinimumLevel(
  logger: Logger,
  getMinimum: () => LogLevelSetting,
): Logger {
  const write = (level: LogLevel, event: string, fields?: LogFields) => {
    const minimum = getMinimum();
    if (minimum === "off" || LOG_LEVELS.indexOf(level) < LOG_LEVELS.indexOf(minimum)) {
      return;
    }
    logger[level](event, fields);
  };
  return {
    debug: (event, fields) => write("debug", event, fields),
    info: (event, fields) => write("info", event, fields),
    warn: (event, fields) => write("warn", event, fields),
    error: (event, fields) => write("error", event, fields),
  };
}

export function errorLogFields(error: unknown): LogFields {
  if (error instanceof Error) {
    const nodeError = error as NodeJS.ErrnoException;
    return {
      errorName: error.name,
      errorMessage: error.message,
      ...(typeof nodeError.code === "string" ? { errorCode: nodeError.code } : {}),
    };
  }
  return { errorMessage: String(error) };
}
