export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isString(value: unknown): value is string {
  return typeof value === "string";
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** undefined = absent, null = present but invalid */
export function readOptionalPositiveInt(
  payload: Record<string, unknown>,
  key: string,
  opts: { max?: number } = {},
): number | undefined | null {
  const value = payload[key];
  if (value === undefined) {
    return undefined;
  }
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value <= 0
  ) {
    return null;
  }
  const max = opts.max ?? 500;
  if (value > max) {
    return null;
  }
  return value;
}

export function isOptionLikeBranchRef(branch: string): boolean {
  return branch.startsWith("-");
}

/** undefined = absent, null = present but invalid */
export function readOptionalString(
  payload: Record<string, unknown>,
  key: string,
): string | undefined | null {
  const value = payload[key];
  if (value === undefined) {
    return undefined;
  }
  return isString(value) ? value : null;
}

export function readOptionalBoolean(
  payload: Record<string, unknown>,
  key: string,
): boolean | undefined | null {
  const value = payload[key];
  if (value === undefined) {
    return undefined;
  }
  return typeof value === "boolean" ? value : null;
}

export function readRequiredString(
  payload: Record<string, unknown>,
  key: string,
): string | null {
  const value = payload[key];
  return isString(value) ? value : null;
}

export function getPayload(
  msg: Record<string, unknown>,
): Record<string, unknown> | null {
  return isRecord(msg.payload) ? msg.payload : null;
}

export type MessageEnvelope = { type: string; payload?: unknown };

export function isMessageEnvelope(value: unknown): value is MessageEnvelope {
  return isRecord(value) && isString(value.type);
}