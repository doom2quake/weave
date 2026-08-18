export class DeterministicClock {
  #nextTimestamp;
  #stepMs;

  constructor({ start = "2026-08-27T10:00:00.000Z", stepMs = 7_000 } = {}) {
    this.#nextTimestamp = Date.parse(start);
    this.#stepMs = stepMs;
  }

  next() {
    const timestamp = new Date(this.#nextTimestamp).toISOString();
    this.#nextTimestamp += this.#stepMs;
    return timestamp;
  }

  reset(start = "2026-08-27T10:00:00.000Z") {
    this.#nextTimestamp = Date.parse(start);
  }
}

export class ProvenanceRail {
  #entries = [];
  #eventBus;
  #clock;
  #caseId;

  constructor({ eventBus, clock = new DeterministicClock(), caseId = "weave-board" } = {}) {
    this.#eventBus = eventBus;
    this.#clock = clock;
    this.#caseId = caseId;
  }

  record({ callId, name, args, result, error, status, humanApproved = null }) {
    const payload = error ? { error: error.message, code: error.code ?? error.name } : result;
    const entry = Object.freeze({
      id: `rcpt-${String(this.#entries.length + 1).padStart(3, "0")}`,
      callId,
      name,
      args: structuredClone(args ?? {}),
      argsDigest: digest(args ?? {}),
      resultDigest: digest(payload),
      timestamp: this.#clock.next(),
      status,
      humanApproved,
      error: error ? { message: error.message, code: error.code ?? error.name } : null,
    });
    this.#entries.push(entry);
    this.#eventBus?.emit("provenance:recorded", entry);
    return structuredClone(entry);
  }

  snapshot() {
    return structuredClone(this.#entries);
  }

  clear() {
    this.#entries = [];
    this.#clock.reset();
    this.#eventBus?.emit("provenance:cleared", {});
  }

  bundle() {
    const receipts = this.snapshot();
    return { version: 1, caseId: this.#caseId, source: "local browser session", receipts, bundleDigest: digest(receipts) };
  }
}

export function stableStringify(value) {
  if (value === undefined) return '"[undefined]"';
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const entries = Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`);
  return `{${entries.join(",")}}`;
}

export function digest(value) {
  const source = stableStringify(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `fnv1a:${hash.toString(16).padStart(8, "0")}`;
}
