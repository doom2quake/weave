import { ensureModelContext } from "./polyfill.js";
import { ApprovalRequiredError } from "./human-gate.js";
import { validateArgs } from "./schema.js";

const TOOL_NAME_PATTERN = /^[A-Za-z0-9_.-]{1,128}$/;

export class WebMCPSubstrate {
  #context;
  #mode;
  #eventBus;
  #provenance;
  #approvalGate;
  #registered = new Map();
  #callCounter = 0;

  constructor({ documentRef, eventBus, provenance, approvalGate, modelContext } = {}) {
    const host = modelContext
      ? { context: modelContext, mode: modelContext.__webmcpLocalPolyfill ? "polyfill" : "native" }
      : ensureModelContext(documentRef);
    this.#context = host.context;
    this.#mode = host.mode;
    this.#eventBus = eventBus;
    this.#provenance = provenance;
    this.#approvalGate = approvalGate;
  }

  get mode() { return this.#mode; }
  get size() { return this.#registered.size; }

  list() {
    return [...this.#registered.values()].map(({ definition }) => ({
      name: definition.name,
      title: definition.title,
      description: definition.description,
      inputSchema: structuredClone(definition.inputSchema),
      irreversible: definition.irreversible,
    }));
  }

  async registerTool({ name, title, description, inputSchema, handler, irreversible = false, readOnly = !irreversible, approval }) {
    validateDefinition({ name, description, inputSchema, handler });
    const controller = new AbortController();
    const definition = { name, title: title ?? humanizeName(name), description, inputSchema, handler, irreversible, readOnly, approval };

    const execute = async (inputObject = {}, options = {}) => {
      const callId = `call-${String(++this.#callCounter).padStart(3, "0")}`;
      const signal = options.signal ?? new AbortController().signal;
      let humanApproved = irreversible ? false : null;
      this.#eventBus?.emit("tool:started", { callId, name, args: inputObject, irreversible });
      try {
        if (signal.aborted) throw signal.reason ?? new DOMException("Tool call cancelled.", "AbortError");
        validateArgs(name, inputSchema, inputObject);
        if (irreversible) {
          if (!this.#approvalGate) throw new ApprovalRequiredError(name);
          const decision = await this.#approvalGate.request({
            toolName: name,
            title: approval?.title ?? `Approve ${definition.title}?`,
            description: approval?.description ?? description,
            args: inputObject,
            scope: typeof approval?.scope === "function" ? approval.scope(inputObject) : approval?.scope,
          }, { signal });
          humanApproved = decision.approved;
          if (!decision.approved) throw new ApprovalRequiredError(name);
        }
        const result = await handler(structuredClone(inputObject), { signal, humanApproved, callId });
        assertSerializableResult(name, result);
        const receipt = this.#provenance?.record({ callId, name, args: inputObject, result, status: "success", humanApproved });
        this.#eventBus?.emit("tool:completed", { callId, name, args: inputObject, result, receipt, humanApproved });
        return result;
      } catch (error) {
        const status = error instanceof ApprovalRequiredError ? "denied" : "error";
        const receipt = this.#provenance?.record({ callId, name, args: inputObject, error, status, humanApproved });
        this.#eventBus?.emit("tool:failed", { callId, name, args: inputObject, error, receipt, humanApproved });
        throw error;
      }
    };

    const descriptor = {
      name,
      title: definition.title,
      description,
      inputSchema,
      annotations: { readOnlyHint: Boolean(readOnly), untrustedContentHint: false },
      execute,
    };
    await this.#context.registerTool(descriptor, { signal: controller.signal });
    this.#registered.set(name, { definition, descriptor, controller });
    this.#eventBus?.emit("tool:registered", { name, mode: this.#mode, irreversible });
    return () => this.unregister(name);
  }

  async registerAll(definitions) {
    for (const definition of definitions) await this.registerTool(definition);
    return this.list();
  }

  invoke(name, args = {}, options = {}) {
    const registered = this.#registered.get(name);
    if (!registered) throw new RangeError(`Tool ${name} is not registered.`);
    return registered.descriptor.execute(args, options);
  }

  unregister(name) {
    const registered = this.#registered.get(name);
    if (!registered) return false;
    registered.controller.abort();
    this.#registered.delete(name);
    this.#eventBus?.emit("tool:unregistered", { name });
    return true;
  }

  destroy() {
    for (const name of [...this.#registered.keys()]) this.unregister(name);
  }
}

function validateDefinition({ name, description, inputSchema, handler }) {
  if (!TOOL_NAME_PATTERN.test(name ?? "")) throw new TypeError(`Invalid tool name: ${name}`);
  if (typeof description !== "string" || description.trim().length === 0) throw new TypeError(`Tool ${name} needs a non-empty description.`);
  if (!inputSchema || inputSchema.type !== "object") throw new TypeError(`Tool ${name} needs an object input schema.`);
  if (typeof handler !== "function") throw new TypeError(`Tool ${name} needs a handler function.`);
}

function assertSerializableResult(name, result) {
  if (result === undefined) throw new TypeError(`Tool ${name} returned undefined.`);
  if (JSON.stringify(result) === undefined) throw new TypeError(`Tool ${name} returned a non-serializable value.`);
}

function humanizeName(name) {
  return name.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (character) => character.toUpperCase());
}
