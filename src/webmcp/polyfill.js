const TOOL_NAME_PATTERN = /^[A-Za-z0-9_.-]{1,128}$/;

export function createModelContextPolyfill({ origin = "local://weave" } = {}) {
  const tools = new Map();
  const eventTarget = typeof EventTarget === "function" ? new EventTarget() : createTinyEventTarget();

  const context = {
    __webmcpLocalPolyfill: true,

    async registerTool(tool, options = {}) {
      validateDescriptor(tool);
      if (tools.has(tool.name)) throw invalidState(`Tool ${tool.name} is already registered.`);
      if (options.signal?.aborted) throw options.signal.reason ?? abortError();
      tools.set(tool.name, tool);
      if (options.signal) {
        options.signal.addEventListener("abort", () => {
          if (tools.delete(tool.name)) dispatchToolChange(eventTarget);
        }, { once: true });
      }
      dispatchToolChange(eventTarget);
    },

    async getTools() {
      return [...tools.values()]
        .sort((left, right) => left.name.localeCompare(right.name))
        .map((tool) => ({
          name: tool.name,
          title: tool.title ?? "",
          description: tool.description,
          inputSchema: structuredClone(tool.inputSchema ?? {}),
          annotations: structuredClone(tool.annotations ?? { readOnlyHint: false, untrustedContentHint: false }),
          origin,
          window: typeof window === "undefined" ? null : window,
        }));
    },

    async executeTool(toolOrName, inputObject = {}, options = {}) {
      if (options.signal?.aborted) throw options.signal.reason ?? abortError();
      const name = typeof toolOrName === "string" ? toolOrName : toolOrName?.name;
      const descriptor = tools.get(name);
      if (!descriptor) throw notFound(`Tool ${name ?? "(unknown)"} is not registered.`);
      const parsedInput = typeof inputObject === "string" ? JSON.parse(inputObject) : inputObject;
      const signal = options.signal ?? new AbortController().signal;
      return descriptor.execute(parsedInput, { signal });
    },

    addEventListener: eventTarget.addEventListener.bind(eventTarget),
    removeEventListener: eventTarget.removeEventListener.bind(eventTarget),
    dispatchEvent: eventTarget.dispatchEvent.bind(eventTarget),
    ontoolchange: null,
  };

  context.addEventListener("toolchange", (event) => context.ontoolchange?.(event));
  return context;
}

export function ensureModelContext(documentRef = globalThis.document) {
  if (typeof documentRef?.modelContext?.registerTool === "function") return { context: documentRef.modelContext, mode: "native" };
  const context = createModelContextPolyfill();
  if (documentRef) {
    try {
      Object.defineProperty(documentRef, "modelContext", { configurable: true, enumerable: false, value: context });
    } catch {
      documentRef.modelContext = context;
    }
  }
  return { context, mode: "polyfill" };
}

function validateDescriptor(tool) {
  if (!tool || typeof tool !== "object") throw new TypeError("Tool descriptor must be an object.");
  if (!TOOL_NAME_PATTERN.test(tool.name ?? "")) throw invalidState("Tool name is invalid.");
  if (typeof tool.description !== "string" || tool.description.length === 0) throw invalidState("Tool description must be a non-empty string.");
  if (typeof tool.execute !== "function") throw new TypeError("Tool execute must be a function.");
  if (tool.inputSchema !== undefined) JSON.stringify(tool.inputSchema);
}

function createTinyEventTarget() {
  const listeners = new Map();
  return {
    addEventListener(name, listener) {
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name).add(listener);
    },
    removeEventListener(name, listener) { listeners.get(name)?.delete(listener); },
    dispatchEvent(event) {
      for (const listener of listeners.get(event.type) ?? []) listener(event);
      return true;
    },
  };
}

function dispatchToolChange(target) {
  const event = typeof Event === "function" ? new Event("toolchange") : { type: "toolchange" };
  target.dispatchEvent(event);
}

function invalidState(message) {
  return typeof DOMException === "function" ? new DOMException(message, "InvalidStateError") : Object.assign(new Error(message), { name: "InvalidStateError" });
}

function notFound(message) {
  return typeof DOMException === "function" ? new DOMException(message, "NotFoundError") : Object.assign(new Error(message), { name: "NotFoundError" });
}

function abortError() {
  return typeof DOMException === "function" ? new DOMException("The operation was aborted.", "AbortError") : Object.assign(new Error("The operation was aborted."), { name: "AbortError" });
}
