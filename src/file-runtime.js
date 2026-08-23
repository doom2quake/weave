/* Generated from the ES-module source for direct file:// use. Do not edit by hand. */
(() => {
  "use strict";
  const __modules = Object.create(null);
  __modules["src/app/board.js"] = (() => {
    const CARD_KINDS = Object.freeze(["goal", "task", "place", "moment", "note"]);
    const LAYOUTS = Object.freeze(["canvas", "columns", "timeline"]);

    class WeaveBoard {
      #state;

      constructor() {
        this.#state = emptyState();
      }

      get state() {
        return structuredClone(this.#state);
      }

      addCard(text, kind) {
        const order = this.#state.cards.length;
        const card = {
          id: `card-${String(this.#state.nextCard).padStart(3, "0")}`,
          text: text.trim(),
          kind,
          x: 84 + (order % 3) * 278,
          y: 104 + Math.floor(order / 3) * 154,
          groupId: null,
          schedule: null,
          order,
        };
        this.#state.nextCard += 1;
        this.#state.cards.push(card);
        this.#state.summary = null;
        return structuredClone(card);
      }

      updateCard(id, text) {
        const card = this.#requireCard(id);
        card.text = text.trim();
        this.#state.summary = null;
        return structuredClone(card);
      }

      moveCard(id, x, y) {
        const card = this.#requireCard(id);
        card.x = clamp(Math.round(x), 24, 2200);
        card.y = clamp(Math.round(y), 68, 760);
        this.#state.layout = "canvas";
        return structuredClone(card);
      }

      linkCards(a, b) {
        this.#requireCard(a);
        this.#requireCard(b);
        if (a === b) throw new RangeError("A card cannot link to itself.");
        const existing = this.#state.links.find((link) => link.a === a && link.b === b);
        if (existing) return { link: structuredClone(existing), created: false };
        const link = {
          id: `link-${String(this.#state.nextLink).padStart(3, "0")}`,
          a,
          b,
          order: this.#state.links.length,
        };
        this.#state.nextLink += 1;
        this.#state.links.push(link);
        this.#state.summary = null;
        return { link: structuredClone(link), created: true };
      }

      groupCards(ids, label) {
        const cards = ids.map((id) => this.#requireCard(id));
        for (const card of cards) {
          if (!card.groupId) continue;
          const oldGroup = this.#state.groups.find((group) => group.id === card.groupId);
          if (oldGroup) oldGroup.cardIds = oldGroup.cardIds.filter((cardId) => cardId !== card.id);
        }
        this.#state.groups = this.#state.groups.filter((group) => group.cardIds.length > 0);
        const group = {
          id: `group-${String(this.#state.nextGroup).padStart(3, "0")}`,
          label: label.trim(),
          cardIds: [...ids],
          order: this.#state.groups.length,
        };
        this.#state.nextGroup += 1;
        this.#state.groups.push(group);
        for (const card of cards) card.groupId = group.id;
        this.#state.summary = null;
        return structuredClone(group);
      }

      setSchedule(id, when) {
        const card = this.#requireCard(id);
        card.schedule = when.trim();
        this.#state.summary = null;
        return structuredClone(card);
      }

      reflow(layout) {
        this.#state.layout = layout;
        if (layout === "canvas") this.#reflowCanvas();
        if (layout === "columns") this.#reflowColumns();
        if (layout === "timeline") this.#reflowTimeline();
        return {
          layout,
          cards: this.#state.cards.map(({ id, x, y }) => ({ id, x, y })),
          stage: stageFor(layout, this.#state.cards.length, this.#state.groups.length),
        };
      }

      summarize() {
        const goal = this.#state.cards.find((card) => card.kind === "goal") ?? this.#state.cards[0] ?? null;
        const sections = this.#state.groups.map((group) => ({
          label: group.label,
          cards: group.cardIds.map((id) => this.#requireCard(id).text),
        }));
        const groupedIds = new Set(this.#state.groups.flatMap((group) => group.cardIds));
        const ungrouped = this.#state.cards.filter((card) => !groupedIds.has(card.id)).map((card) => card.text);
        if (ungrouped.length > 0) sections.push({ label: "Open", cards: ungrouped });
        const scheduled = [...this.#state.cards]
          .filter((card) => card.schedule)
          .sort(compareScheduled)
          .map((card) => ({ id: card.id, when: card.schedule, text: card.text }));
        const nextMoves = this.#state.cards.filter((card) => card.kind === "task").slice(0, 3).map((card) => card.text);
        const title = goal?.text ?? "Untitled plan";
        const summary = {
          title,
          overview: this.#state.cards.length === 0
            ? "Start with one goal, then add the decisions and actions that make it real."
            : `${title}. ${this.#state.cards.length} cards are connected by ${this.#state.links.length} links across ${this.#state.groups.length} groups. ${scheduled.length} cards have a place on the schedule.`,
          totals: {
            cards: this.#state.cards.length,
            links: this.#state.links.length,
            groups: this.#state.groups.length,
            scheduled: scheduled.length,
          },
          sections,
          scheduled,
          nextMoves,
        };
        this.#state.summary = summary;
        return structuredClone(summary);
      }

      clear() {
        const removed = {
          cards: this.#state.cards.length,
          links: this.#state.links.length,
          groups: this.#state.groups.length,
        };
        this.#state = emptyState();
        return removed;
      }

      export(format) {
        const snapshot = this.state;
        const summary = this.summarize();
        if (format === "json") {
          return {
            filename: "weave-plan.json",
            mimeType: "application/json",
            content: JSON.stringify({ version: 1, summary, board: publicState(snapshot) }, null, 2),
          };
        }
        return {
          filename: "weave-plan.md",
          mimeType: "text/markdown",
          content: buildMarkdown(snapshot, summary),
        };
      }

      #requireCard(id) {
        const card = this.#state.cards.find((candidate) => candidate.id === id);
        if (!card) throw new RangeError(`Card ${id} does not exist.`);
        return card;
      }

      #reflowCanvas() {
        for (const [index, card] of this.#state.cards.entries()) {
          card.x = 84 + (index % 3) * 278;
          card.y = 104 + Math.floor(index / 3) * 154;
        }
      }

      #reflowColumns() {
        const columns = this.#state.groups.map((group) => ({ id: group.id, cardIds: group.cardIds }));
        const grouped = new Set(columns.flatMap((column) => column.cardIds));
        const open = this.#state.cards.filter((card) => !grouped.has(card.id)).map((card) => card.id);
        if (open.length > 0) columns.push({ id: null, cardIds: open });
        for (const [columnIndex, column] of columns.entries()) {
          for (const [rowIndex, id] of column.cardIds.entries()) {
            const card = this.#requireCard(id);
            card.x = 68 + columnIndex * 300;
            card.y = 126 + rowIndex * 150;
          }
        }
      }

      #reflowTimeline() {
        const scheduled = [...this.#state.cards].filter((card) => card.schedule).sort(compareScheduled);
        const scheduledIds = new Set(scheduled.map((card) => card.id));
        for (const [index, card] of scheduled.entries()) {
          card.x = 76 + index * 246;
          card.y = index % 2 === 0 ? 126 : 374;
        }
        const unscheduled = this.#state.cards.filter((card) => !scheduledIds.has(card.id));
        for (const [index, card] of unscheduled.entries()) {
          card.x = 76 + index * 246;
          card.y = 610;
        }
      }
    }

    function emptyState() {
      return {
        version: 1,
        layout: "canvas",
        nextCard: 1,
        nextLink: 1,
        nextGroup: 1,
        cards: [],
        links: [],
        groups: [],
        summary: null,
      };
    }

    function stageFor(layout, cardCount, groupCount) {
      if (layout === "timeline") return { width: Math.max(1180, cardCount * 246 + 120), height: 820 };
      if (layout === "columns") return { width: Math.max(1180, Math.max(groupCount, 1) * 300 + 120), height: 820 };
      return { width: 1180, height: Math.max(700, Math.ceil(cardCount / 3) * 154 + 220) };
    }

    function compareScheduled(left, right) {
      return scheduleRank(left.schedule) - scheduleRank(right.schedule) || left.order - right.order;
    }

    function scheduleRank(value) {
      if (/^before/i.test(value)) return 0;
      const day = Number(value.match(/day\s+(\d+)/i)?.[1] ?? 50);
      const hour = Number(value.match(/(\d{1,2})(?::(\d{2}))?/)?.[1] ?? 12);
      const minute = Number(value.match(/\d{1,2}:(\d{2})/)?.[1] ?? 0);
      const phase = /morning/i.test(value) ? 8 : /afternoon/i.test(value) ? 14 : /evening|sunset/i.test(value) ? 19 : hour;
      return day * 1_000 + phase * 60 + minute;
    }

    function publicState(state) {
      const { nextCard: _nextCard, nextLink: _nextLink, nextGroup: _nextGroup, summary: _summary, ...board } = state;
      return board;
    }

    function buildMarkdown(state, summary) {
      const lines = [
        `# ${summary.title}`,
        "",
        summary.overview,
        "",
        "## Plan",
        "",
      ];
      for (const section of summary.sections) {
        lines.push(`### ${section.label}`, "", ...section.cards.map((text) => `- ${text}`), "");
      }
      if (summary.scheduled.length > 0) {
        lines.push("## Schedule", "", ...summary.scheduled.map((item) => `- **${item.when}:** ${item.text}`), "");
      }
      if (state.links.length > 0) {
        const cards = new Map(state.cards.map((card) => [card.id, card.text]));
        lines.push("## Connections", "", ...state.links.map((link) => `- ${cards.get(link.a)} → ${cards.get(link.b)}`), "");
      }
      lines.push("_Built in Weave._", "");
      return lines.join("\n");
    }

    function clamp(value, minimum, maximum) {
      return Math.max(minimum, Math.min(maximum, value));
    }
    return Object.freeze({ CARD_KINDS, LAYOUTS, WeaveBoard });
  })();
  __modules["src/webmcp/event-bus.js"] = (() => {
    class EventBus {
      #listeners = new Map();

      on(eventName, listener) {
        if (!this.#listeners.has(eventName)) this.#listeners.set(eventName, new Set());
        this.#listeners.get(eventName).add(listener);
        return () => this.off(eventName, listener);
      }

      off(eventName, listener) {
        this.#listeners.get(eventName)?.delete(listener);
      }

      emit(eventName, detail = {}) {
        const event = Object.freeze({ type: eventName, detail });
        for (const listener of this.#listeners.get(eventName) ?? []) {
          try {
            listener(event);
          } catch (error) {
            queueMicrotask(() => { throw error; });
          }
        }
        for (const listener of this.#listeners.get("*") ?? []) {
          try {
            listener(event);
          } catch (error) {
            queueMicrotask(() => { throw error; });
          }
        }
        return event;
      }

      clear() {
        this.#listeners.clear();
      }
    }
    return Object.freeze({ EventBus });
  })();
  __modules["src/webmcp/schema.js"] = (() => {
    class ToolContractError extends TypeError {
      constructor(toolName, issues) {
        const detail = issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ");
        super(`Invalid arguments for ${toolName}: ${detail}`);
        this.name = "ToolContractError";
        this.code = "INVALID_TOOL_ARGUMENTS";
        this.toolName = toolName;
        this.issues = issues;
      }
    }

    function validateArgs(toolName, schema, args) {
      const issues = [];
      validateValue(schema ?? {}, args, "$", issues);
      if (issues.length > 0) throw new ToolContractError(toolName, issues);
      return args;
    }

    function validateValue(schema, value, path, issues) {
      if (!schema || typeof schema !== "object") return;

      if (Array.isArray(schema.enum) && !schema.enum.some((candidate) => Object.is(candidate, value))) {
        issues.push({ path, message: `must be one of ${schema.enum.map(formatValue).join(", ")}` });
        return;
      }
      if (Object.hasOwn(schema, "const") && !Object.is(schema.const, value)) {
        issues.push({ path, message: `must equal ${formatValue(schema.const)}` });
        return;
      }
      if (Array.isArray(schema.oneOf)) {
        const matches = schema.oneOf.filter((candidate) => {
          const candidateIssues = [];
          validateValue(candidate, value, path, candidateIssues);
          return candidateIssues.length === 0;
        });
        if (matches.length !== 1) issues.push({ path, message: "must match exactly one allowed shape" });
        return;
      }
      if (schema.type && !matchesType(schema.type, value)) {
        issues.push({ path, message: `must be ${schema.type}` });
        return;
      }

      if (schema.type === "object") validateObject(schema, value, path, issues);
      if (schema.type === "array") validateArray(schema, value, path, issues);
      if (schema.type === "string") validateString(schema, value, path, issues);
      if (schema.type === "number" || schema.type === "integer") validateNumber(schema, value, path, issues);
    }

    function validateObject(schema, value, path, issues) {
      const properties = schema.properties ?? {};
      for (const required of schema.required ?? []) {
        if (!Object.hasOwn(value, required)) issues.push({ path: `${path}.${required}`, message: "is required" });
      }
      for (const [key, entry] of Object.entries(value)) {
        if (Object.hasOwn(properties, key)) validateValue(properties[key], entry, `${path}.${key}`, issues);
        else if (schema.additionalProperties === false) issues.push({ path: `${path}.${key}`, message: "is not allowed" });
        else if (schema.additionalProperties && typeof schema.additionalProperties === "object") {
          validateValue(schema.additionalProperties, entry, `${path}.${key}`, issues);
        }
      }
    }

    function validateArray(schema, value, path, issues) {
      if (Number.isInteger(schema.minItems) && value.length < schema.minItems) {
        issues.push({ path, message: `must contain at least ${schema.minItems} item(s)` });
      }
      if (Number.isInteger(schema.maxItems) && value.length > schema.maxItems) {
        issues.push({ path, message: `must contain at most ${schema.maxItems} item(s)` });
      }
      if (schema.uniqueItems) {
        const unique = new Set(value.map((entry) => JSON.stringify(entry)));
        if (unique.size !== value.length) issues.push({ path, message: "must contain unique items" });
      }
      if (schema.items) value.forEach((entry, index) => validateValue(schema.items, entry, `${path}[${index}]`, issues));
    }

    function validateString(schema, value, path, issues) {
      if (Number.isInteger(schema.minLength) && value.length < schema.minLength) {
        issues.push({ path, message: `must be at least ${schema.minLength} character(s)` });
      }
      if (Number.isInteger(schema.maxLength) && value.length > schema.maxLength) {
        issues.push({ path, message: `must be at most ${schema.maxLength} character(s)` });
      }
      if (schema.pattern && !(new RegExp(schema.pattern).test(value))) {
        issues.push({ path, message: `must match ${schema.pattern}` });
      }
    }

    function validateNumber(schema, value, path, issues) {
      if (typeof schema.minimum === "number" && value < schema.minimum) issues.push({ path, message: `must be at least ${schema.minimum}` });
      if (typeof schema.maximum === "number" && value > schema.maximum) issues.push({ path, message: `must be at most ${schema.maximum}` });
      if (typeof schema.exclusiveMinimum === "number" && value <= schema.exclusiveMinimum) issues.push({ path, message: `must be greater than ${schema.exclusiveMinimum}` });
      if (typeof schema.exclusiveMaximum === "number" && value >= schema.exclusiveMaximum) issues.push({ path, message: `must be less than ${schema.exclusiveMaximum}` });
    }

    function matchesType(type, value) {
      if (Array.isArray(type)) return type.some((candidate) => matchesType(candidate, value));
      if (type === "object") return value !== null && typeof value === "object" && !Array.isArray(value);
      if (type === "array") return Array.isArray(value);
      if (type === "integer") return Number.isInteger(value);
      if (type === "number") return typeof value === "number" && Number.isFinite(value);
      if (type === "null") return value === null;
      return typeof value === type;
    }

    function formatValue(value) {
      return typeof value === "string" ? JSON.stringify(value) : String(value);
    }
    return Object.freeze({ ToolContractError, validateArgs });
  })();
  __modules["src/webmcp/polyfill.js"] = (() => {
    const TOOL_NAME_PATTERN = /^[A-Za-z0-9_.-]{1,128}$/;

    function createModelContextPolyfill({ origin = "local://weave" } = {}) {
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

    function ensureModelContext(documentRef = globalThis.document) {
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
    return Object.freeze({ createModelContextPolyfill, ensureModelContext });
  })();
  __modules["src/webmcp/human-gate.js"] = (() => {
    class ApprovalRequiredError extends Error {
      constructor(toolName, message = `Human approval was not granted for ${toolName}.`) {
        super(message);
        this.name = "ApprovalRequiredError";
        this.code = "HUMAN_APPROVAL_REQUIRED";
        this.toolName = toolName;
      }
    }

    class HumanApprovalGate {
      #eventBus;
      #approvalProvider;
      #pending = new Map();
      #counter = 0;

      constructor({ eventBus, approvalProvider = null } = {}) {
        this.#eventBus = eventBus;
        this.#approvalProvider = approvalProvider;
      }

      get pendingCount() {
        return this.#pending.size;
      }

      async request({ toolName, title, description, args, scope }, { signal } = {}) {
        const requestId = `approval-${String(++this.#counter).padStart(3, "0")}`;
        const request = Object.freeze({ requestId, toolName, title, description, args: structuredClone(args), scope: structuredClone(scope ?? {}) });
        this.#eventBus?.emit("approval:requested", request);

        if (this.#approvalProvider) {
          const approved = Boolean(await this.#approvalProvider(request));
          this.#eventBus?.emit(approved ? "approval:granted" : "approval:denied", { ...request, actor: approved ? "human" : null });
          return { approved, requestId, actor: approved ? "human" : null };
        }

        return new Promise((resolve, reject) => {
          const onAbort = () => {
            this.#pending.delete(requestId);
            reject(signal.reason ?? new ApprovalRequiredError(toolName, "Approval request was cancelled."));
          };
          if (signal?.aborted) return onAbort();
          signal?.addEventListener("abort", onAbort, { once: true });
          this.#pending.set(requestId, {
            request,
            settle: (approved, actor) => {
              signal?.removeEventListener("abort", onAbort);
              this.#pending.delete(requestId);
              this.#eventBus?.emit(approved ? "approval:granted" : "approval:denied", { ...request, actor: approved ? actor : null });
              resolve({ approved, requestId, actor: approved ? actor : null });
            },
          });
        });
      }

      approve(requestId, { actor = "human" } = {}) {
        const pending = this.#pending.get(requestId);
        if (!pending) return false;
        pending.settle(true, actor);
        return true;
      }

      deny(requestId) {
        const pending = this.#pending.get(requestId);
        if (!pending) return false;
        pending.settle(false, null);
        return true;
      }

      denyAll() {
        for (const requestId of [...this.#pending.keys()]) this.deny(requestId);
      }
    }
    return Object.freeze({ ApprovalRequiredError, HumanApprovalGate });
  })();
  __modules["src/webmcp/provenance.js"] = (() => {
    class DeterministicClock {
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

    class ProvenanceRail {
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

    function stableStringify(value) {
      if (value === undefined) return '"[undefined]"';
      if (value === null || typeof value !== "object") return JSON.stringify(value);
      if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
      const entries = Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`);
      return `{${entries.join(",")}}`;
    }

    function digest(value) {
      const source = stableStringify(value);
      let hash = 0x811c9dc5;
      for (let index = 0; index < source.length; index += 1) {
        hash ^= source.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193) >>> 0;
      }
      return `fnv1a:${hash.toString(16).padStart(8, "0")}`;
    }
    return Object.freeze({ DeterministicClock, ProvenanceRail, stableStringify, digest });
  })();
  __modules["src/webmcp/substrate.js"] = (() => {
    const { ensureModelContext } = __modules["src/webmcp/polyfill.js"];
    const { ApprovalRequiredError } = __modules["src/webmcp/human-gate.js"];
    const { validateArgs } = __modules["src/webmcp/schema.js"];

    const TOOL_NAME_PATTERN = /^[A-Za-z0-9_.-]{1,128}$/;

    class WebMCPSubstrate {
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
    return Object.freeze({ WebMCPSubstrate });
  })();
  __modules["src/app/tools.js"] = (() => {
    const { CARD_KINDS, LAYOUTS } = __modules["src/app/board.js"];

    const noExtras = Object.freeze({ additionalProperties: false });
    const cardId = Object.freeze({ type: "string", pattern: "^card-[0-9]{3,}$" });
    const cardText = Object.freeze({ type: "string", minLength: 1, maxLength: 180, pattern: "\\S" });

    function createWeaveTools({ board, eventBus, deliverArtifact = () => false }) {
      const changed = (operation, result) => {
        eventBus?.emit("board:changed", { operation, result, state: board.state });
        return result;
      };

      return [
        {
          name: "addCard",
          title: "Add a plan card",
          description: "Add one concise goal, task, place, moment, or note to the visible Weave board.",
          inputSchema: {
            type: "object",
            properties: { text: cardText, kind: { type: "string", enum: CARD_KINDS } },
            required: ["text", "kind"],
            ...noExtras,
          },
          readOnly: false,
          handler: ({ text, kind }) => ({ status: "added", card: changed("addCard", board.addCard(text, kind)) }),
        },
        {
          name: "updateCard",
          title: "Update a card",
          description: "Replace the text on an existing card while keeping its links, group, and schedule.",
          inputSchema: {
            type: "object",
            properties: { id: cardId, text: cardText },
            required: ["id", "text"],
            ...noExtras,
          },
          readOnly: false,
          handler: ({ id, text }) => ({ status: "updated", card: changed("updateCard", board.updateCard(id, text)) }),
        },
        {
          name: "linkCards",
          title: "Link two cards",
          description: "Draw a directional connection from one existing plan card to another.",
          inputSchema: {
            type: "object",
            properties: { a: cardId, b: cardId },
            required: ["a", "b"],
            ...noExtras,
          },
          readOnly: false,
          handler: ({ a, b }) => ({ status: "linked", ...changed("linkCards", board.linkCards(a, b)) }),
        },
        {
          name: "groupCards",
          title: "Group plan cards",
          description: "Collect related cards under one short, visible group label.",
          inputSchema: {
            type: "object",
            properties: {
              ids: { type: "array", items: cardId, minItems: 1, maxItems: 12, uniqueItems: true },
              label: { type: "string", minLength: 1, maxLength: 48, pattern: "\\S" },
            },
            required: ["ids", "label"],
            ...noExtras,
          },
          readOnly: false,
          handler: ({ ids, label }) => ({ status: "grouped", group: changed("groupCards", board.groupCards(ids, label)) }),
        },
        {
          name: "setSchedule",
          title: "Schedule a card",
          description: "Give one card a clear date, day, time, or sequence label such as Day 2 morning.",
          inputSchema: {
            type: "object",
            properties: { id: cardId, when: { type: "string", minLength: 1, maxLength: 80, pattern: "\\S" } },
            required: ["id", "when"],
            ...noExtras,
          },
          readOnly: false,
          handler: ({ id, when }) => ({ status: "scheduled", card: changed("setSchedule", board.setSchedule(id, when)) }),
        },
        {
          name: "reflow",
          title: "Reflow the board",
          description: "Arrange every visible card as a free canvas, grouped columns, or a readable timeline.",
          inputSchema: {
            type: "object",
            properties: { layout: { type: "string", enum: LAYOUTS } },
            required: ["layout"],
            ...noExtras,
          },
          readOnly: false,
          handler: ({ layout }) => ({ status: "reflowed", ...changed("reflow", board.reflow(layout)) }),
        },
        {
          name: "summarizePlan",
          title: "Summarize the plan",
          description: "Read the full board and return a concise overview, totals, groups, schedule, and next moves.",
          inputSchema: { type: "object", properties: {}, required: [], ...noExtras },
          readOnly: true,
          handler: () => {
            const summary = board.summarize();
            eventBus?.emit("summary:created", summary);
            return { status: "summarized", summary };
          },
        },
        {
          name: "exportPlan",
          title: "Export the plan",
          description: "Create and download the current plan as Markdown or structured JSON, with no upload or network call.",
          inputSchema: {
            type: "object",
            properties: { format: { type: "string", enum: ["markdown", "json"] } },
            required: ["format"],
            ...noExtras,
          },
          readOnly: false,
          handler: ({ format }) => {
            const artifact = board.export(format);
            const opened = Boolean(deliverArtifact(artifact));
            eventBus?.emit("artifact:created", artifact);
            return { status: "exported", format, opened, artifact };
          },
        },
        {
          name: "clearBoard",
          title: "Clear the board",
          description: "Remove every card, link, group, and schedule from the current local board after explicit confirmation.",
          inputSchema: {
            type: "object",
            properties: { confirm: { const: true } },
            required: ["confirm"],
            ...noExtras,
          },
          irreversible: true,
          readOnly: false,
          approval: {
            title: "Clear this board?",
            description: "This removes the current local plan. Export anything you want to keep first.",
            scope: () => ({ effect: "All cards, links, groups, and schedules on this page" }),
          },
          handler: (_args, { humanApproved }) => {
            if (!humanApproved) throw new Error("Clear requires explicit human confirmation.");
            const removed = board.clear();
            changed("clearBoard", removed);
            return { status: "cleared", removed, humanApproved };
          },
        },
      ];
    }
    return Object.freeze({ createWeaveTools });
  })();
  __modules["src/sim/sample-plan.js"] = (() => {
    const EXACT_JUDGE_PROMPT = "Use this page's site tools to plan a 3-day Lisbon trip. Add a goal plus practical cards, link dependencies, group them into Prep, Lisbon days, and Day trip, schedule the trip across three days, reflow it as a timeline, summarize the plan, and export it as Markdown.";

    class SamplePlan {
      #substrate;
      #board;
      #eventBus;
      #running = false;
      #controller = null;

      constructor({ substrate, board, eventBus }) {
        this.#substrate = substrate;
        this.#board = board;
        this.#eventBus = eventBus;
      }

      get running() {
        return this.#running;
      }

      async run({ stepDelay = 70 } = {}) {
        if (this.#running) return { status: "already-running" };
        this.#running = true;
        this.#controller = new AbortController();
        const calls = [];
        this.#eventBus?.emit("sample:started", {});

        const invoke = async (name, args) => {
          this.#eventBus?.emit("sample:step", { name, args, index: calls.length });
          const result = await this.#substrate.invoke(name, args, { signal: this.#controller.signal });
          calls.push({ name, args: structuredClone(args), result });
          if (stepDelay > 0) await delay(stepDelay, this.#controller.signal);
          return result;
        };

        try {
          if (this.#board.state.cards.length > 0) await invoke("clearBoard", { confirm: true });

          const goal = (await invoke("addCard", { text: "Plan a 3-day Lisbon trip", kind: "goal" })).card.id;
          const stay = (await invoke("addCard", { text: "Book a central stay", kind: "task" })).card.id;
          const map = (await invoke("addCard", { text: "Save an offline transit map", kind: "note" })).card.id;
          const tram = (await invoke("addCard", { text: "Ride Tram 28 before the crowds", kind: "moment" })).card.id;
          const lunch = (await invoke("addCard", { text: "Lunch at Time Out Market", kind: "place" })).card.id;
          const sunset = (await invoke("addCard", { text: "Watch sunset from Senhora do Monte", kind: "moment" })).card.id;
          const sintra = (await invoke("addCard", { text: "Take the early train to Sintra", kind: "place" })).card.id;
          const slow = (await invoke("addCard", { text: "Leave one slow morning open", kind: "note" })).card.id;
          const dinner = (await invoke("addCard", { text: "Choose dinner near Príncipe Real", kind: "task" })).card.id;

          await invoke("linkCards", { a: goal, b: stay });
          await invoke("linkCards", { a: stay, b: tram });
          await invoke("linkCards", { a: map, b: tram });
          await invoke("linkCards", { a: tram, b: lunch });
          await invoke("linkCards", { a: lunch, b: sunset });
          await invoke("linkCards", { a: goal, b: sintra });
          await invoke("linkCards", { a: sintra, b: slow });
          await invoke("linkCards", { a: slow, b: dinner });

          await invoke("groupCards", { ids: [stay, map], label: "Prep" });
          await invoke("groupCards", { ids: [tram, lunch, sunset, slow, dinner], label: "Lisbon days" });
          await invoke("groupCards", { ids: [sintra], label: "Day trip" });

          await invoke("setSchedule", { id: stay, when: "Before departure" });
          await invoke("setSchedule", { id: map, when: "Before departure" });
          await invoke("setSchedule", { id: tram, when: "Day 1 · 08:00" });
          await invoke("setSchedule", { id: lunch, when: "Day 1 · 13:00" });
          await invoke("setSchedule", { id: sunset, when: "Day 1 · 19:00" });
          await invoke("setSchedule", { id: sintra, when: "Day 2 · 08:00" });
          await invoke("setSchedule", { id: slow, when: "Day 3 · morning" });
          await invoke("setSchedule", { id: dinner, when: "Day 3 · 19:30" });

          await invoke("reflow", { layout: "columns" });
          if (stepDelay > 0) await delay(320, this.#controller.signal);
          await invoke("reflow", { layout: "timeline" });
          const summary = await invoke("summarizePlan", {});
          const outcome = { status: "completed", calls: calls.length, summary: summary.summary, results: calls };
          this.#eventBus?.emit("sample:completed", outcome);
          return outcome;
        } catch (error) {
          const outcome = { status: error.name === "AbortError" ? "cancelled" : "stopped", calls: calls.length, error };
          this.#eventBus?.emit("sample:stopped", outcome);
          throw error;
        } finally {
          this.#running = false;
          this.#controller = null;
        }
      }

      cancel() {
        this.#controller?.abort(new DOMException("Sample plan stopped.", "AbortError"));
      }
    }

    function delay(milliseconds, signal) {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, milliseconds);
        const onAbort = () => {
          clearTimeout(timer);
          reject(signal.reason ?? new DOMException("Cancelled.", "AbortError"));
        };
        if (signal.aborted) onAbort();
        else signal.addEventListener("abort", onAbort, { once: true });
      });
    }
    return Object.freeze({ EXACT_JUDGE_PROMPT, SamplePlan });
  })();
  __modules["src/ui/controller.js"] = (() => {
    const { EXACT_JUDGE_PROMPT } = __modules["src/sim/sample-plan.js"];

    const SVG_NS = "http://www.w3.org/2000/svg";

    class WeaveUI {
      #document;
      #board;
      #eventBus;
      #approvalGate;
      #provenance;
      #substrate;
      #sample;
      #openArtifact;
      #elements = {};
      #knownCards = new Set();
      #lastPositions = new Map();
      #callNodes = new Map();
      #artifacts = [];
      #pendingApproval = null;
      #activeCallId = null;

      constructor({ documentRef, board, eventBus, approvalGate, provenance, substrate, sample, openArtifact }) {
        this.#document = documentRef;
        this.#board = board;
        this.#eventBus = eventBus;
        this.#approvalGate = approvalGate;
        this.#provenance = provenance;
        this.#substrate = substrate;
        this.#sample = sample;
        this.#openArtifact = openArtifact;
      }

      bind() {
        this.#elements = {
          goalForm: this.#document.querySelector("[data-goal-form]"),
          goalInput: this.#document.querySelector("#goal-input"),
          sampleButton: this.#document.querySelector("[data-build-sample]"),
          stage: this.#document.querySelector("[data-board-stage]"),
          viewport: this.#document.querySelector("[data-board-viewport]"),
          cardLayer: this.#document.querySelector("[data-card-layer]"),
          groupLayer: this.#document.querySelector("[data-group-layer]"),
          timelineLayer: this.#document.querySelector("[data-timeline-layer]"),
          linkLayer: this.#document.querySelector("[data-link-layer]"),
          linkPaths: this.#document.querySelector("[data-link-paths]"),
          empty: this.#document.querySelector("[data-board-empty]"),
          summary: this.#document.querySelector("[data-summary-content]"),
          activity: this.#document.querySelector("[data-activity-feed]"),
          artifacts: this.#document.querySelector("[data-artifact-list]"),
          toolCount: this.#document.querySelector("[data-tool-count]"),
          hostMode: this.#document.querySelector("[data-host-mode]"),
          cardCount: this.#document.querySelector("[data-card-count]"),
          linkCount: this.#document.querySelector("[data-link-count]"),
          groupCount: this.#document.querySelector("[data-group-count]"),
          receiptCount: this.#document.querySelector("[data-receipt-count]"),
          activeMove: this.#document.querySelector("[data-active-move]"),
          activeTool: this.#document.querySelector("[data-active-tool]"),
          clearDialog: this.#document.querySelector("[data-clear-dialog]"),
          helpDialog: this.#document.querySelector("[data-help-dialog]"),
          toastRegion: this.#document.querySelector("[data-toast-region]"),
        };

        this.#document.querySelector("[data-judge-prompt]").textContent = EXACT_JUDGE_PROMPT;
        this.#elements.goalForm.addEventListener("submit", (event) => this.#startPlan(event));
        this.#elements.sampleButton.addEventListener("click", () => this.#runSample());
        for (const button of this.#document.querySelectorAll("[data-example]")) {
          button.addEventListener("click", () => {
            this.#elements.goalInput.value = button.dataset.example;
            this.#elements.goalInput.focus();
          });
        }
        for (const button of this.#document.querySelectorAll("[data-layout]")) {
          button.addEventListener("click", () => this.#invoke("reflow", { layout: button.dataset.layout }));
        }
        for (const button of this.#document.querySelectorAll("[data-export]")) {
          button.addEventListener("click", () => this.#invoke("exportPlan", { format: button.dataset.export }));
        }
        this.#document.querySelector("[data-summarize]").addEventListener("click", () => this.#invoke("summarizePlan", {}));
        this.#document.querySelector("[data-clear-board]").addEventListener("click", () => this.#clearBoard());
        this.#document.querySelector("[data-copy-prompt]").addEventListener("click", () => this.#copyPrompt());
        this.#document.querySelector("[data-open-help]").addEventListener("click", () => showDialog(this.#elements.helpDialog));
        this.#document.querySelector("[data-approve-clear]").addEventListener("click", () => this.#settleApproval(true));
        this.#document.querySelector("[data-deny-clear]").addEventListener("click", () => this.#settleApproval(false));
        this.#elements.clearDialog.addEventListener("cancel", (event) => {
          event.preventDefault();
          this.#settleApproval(false);
        });
        this.#document.addEventListener("keydown", (event) => {
          if (event.key.toLowerCase() !== "b" || event.metaKey || event.ctrlKey || event.altKey) return;
          if (["INPUT", "TEXTAREA"].includes(event.target.tagName) || event.target.isContentEditable) return;
          event.preventDefault();
          this.#runSample();
        });

        this.#eventBus.on("board:changed", () => this.renderBoard());
        this.#eventBus.on("summary:created", ({ detail }) => this.renderSummary(detail));
        this.#eventBus.on("artifact:created", ({ detail }) => this.#addArtifact(detail));
        this.#eventBus.on("tool:started", ({ detail }) => this.#toolStarted(detail));
        this.#eventBus.on("tool:completed", ({ detail }) => this.#toolFinished(detail, "complete"));
        this.#eventBus.on("tool:failed", ({ detail }) => this.#toolFinished(detail, detail.receipt?.status ?? "error"));
        this.#eventBus.on("provenance:recorded", () => {
          this.#elements.receiptCount.textContent = String(this.#provenance.snapshot().length);
        });
        this.#eventBus.on("approval:requested", ({ detail }) => this.#showApproval(detail));
        this.#eventBus.on("sample:started", () => {
          this.#elements.sampleButton.disabled = true;
          this.#elements.sampleButton.querySelector("strong").textContent = "Building the Lisbon plan";
        });
        this.#eventBus.on("sample:completed", ({ detail }) => {
          this.#sampleDone();
          this.toast(`${detail.calls} tool calls turned one thought into a plan.`);
        });
        this.#eventBus.on("sample:stopped", () => this.#sampleDone());

        this.renderBoard();
      }

      hostReady({ mode, toolCount }) {
        this.#elements.toolCount.textContent = String(toolCount);
        this.#elements.hostMode.textContent = mode === "native" ? "WebMCP live" : "local preview";
      }

      renderBoard() {
        const state = this.#board.state;
        if (state.cards.length === 0) {
          this.#knownCards.clear();
          this.#lastPositions.clear();
        }
        this.#elements.cardCount.textContent = String(state.cards.length);
        this.#elements.linkCount.textContent = String(state.links.length);
        this.#elements.groupCount.textContent = String(state.groups.length);
        this.#elements.empty.hidden = state.cards.length > 0;
        const width = Math.max(1180, ...state.cards.map((card) => card.x + 300));
        const height = Math.max(820, ...state.cards.map((card) => card.y + 190));
        this.#elements.stage.style.width = `${width}px`;
        this.#elements.stage.style.height = `${height}px`;
        this.#elements.linkLayer.setAttribute("width", String(width));
        this.#elements.linkLayer.setAttribute("height", String(height));

        this.#renderGroups(state);
        this.#renderTimeline(state);
        this.#renderLinks(state);
        this.#elements.cardLayer.replaceChildren(...state.cards.map((card) => this.#createCard(card)));
        for (const card of state.cards) this.#lastPositions.set(card.id, { x: card.x, y: card.y });
        const nextFrame = globalThis.requestAnimationFrame ?? ((callback) => setTimeout(callback, 0));
        nextFrame(() => {
          for (const element of this.#elements.cardLayer.querySelectorAll("[data-target-x]")) {
            element.style.transform = `translate(${element.dataset.targetX}px, ${element.dataset.targetY}px)`;
            delete element.dataset.targetX;
            delete element.dataset.targetY;
          }
        });
        for (const button of this.#document.querySelectorAll("[data-layout]")) {
          button.setAttribute("aria-pressed", String(button.dataset.layout === state.layout));
        }
        if (state.summary) this.renderSummary(state.summary);
      }

      renderSummary(summary) {
        const fragment = this.#document.createDocumentFragment();
        const overview = this.#document.createElement("p");
        overview.className = "summary-overview";
        overview.textContent = summary.overview;
        fragment.append(overview);

        const stats = this.#document.createElement("div");
        stats.className = "summary-stats";
        for (const [label, value] of Object.entries(summary.totals)) {
          const stat = this.#document.createElement("span");
          const number = this.#document.createElement("b");
          number.textContent = String(value);
          stat.append(number, this.#document.createTextNode(label));
          stats.append(stat);
        }
        fragment.append(stats);

        if (summary.nextMoves.length > 0) {
          const list = this.#document.createElement("ul");
          list.className = "next-moves";
          for (const move of summary.nextMoves) {
            const item = this.#document.createElement("li");
            item.textContent = move;
            list.append(item);
          }
          fragment.append(list);
        }
        this.#elements.summary.replaceChildren(fragment);
      }

      toast(message) {
        const node = this.#document.createElement("div");
        node.className = "toast";
        node.textContent = message;
        this.#elements.toastRegion.append(node);
        setTimeout(() => node.remove(), 2600);
      }

      #renderGroups(state) {
        const boxes = [];
        if (state.layout !== "timeline") {
          for (const group of state.groups) {
            const cards = group.cardIds.map((id) => state.cards.find((card) => card.id === id)).filter(Boolean);
            if (cards.length === 0) continue;
            const minX = Math.min(...cards.map((card) => card.x));
            const maxX = Math.max(...cards.map((card) => card.x));
            const minY = Math.min(...cards.map((card) => card.y));
            const maxY = Math.max(...cards.map((card) => card.y));
            const box = this.#document.createElement("div");
            box.className = "group-box";
            box.style.left = `${minX - 22}px`;
            box.style.top = `${Math.max(48, minY - 48)}px`;
            box.style.width = `${maxX - minX + 270}px`;
            box.style.height = `${maxY - minY + 182}px`;
            const label = this.#document.createElement("strong");
            label.textContent = group.label;
            box.append(label);
            boxes.push(box);
          }
        }
        this.#elements.groupLayer.replaceChildren(...boxes);
      }

      #renderTimeline(state) {
        const timeline = this.#elements.timelineLayer;
        if (state.layout !== "timeline") {
          timeline.hidden = true;
          timeline.replaceChildren();
          return;
        }
        timeline.hidden = false;
        const axis = this.#document.createElement("div");
        axis.className = "timeline-axis";
        const ticks = state.cards.filter((card) => card.schedule).map((card) => {
          const tick = this.#document.createElement("div");
          tick.className = "timeline-tick";
          tick.style.left = `${card.x + 113}px`;
          const label = this.#document.createElement("span");
          label.textContent = card.schedule;
          tick.append(label);
          return tick;
        });
        timeline.replaceChildren(axis, ...ticks);
      }

      #renderLinks(state) {
        const cards = new Map(state.cards.map((card) => [card.id, card]));
        const paths = [];
        for (const link of state.links) {
          const from = cards.get(link.a);
          const to = cards.get(link.b);
          if (!from || !to) continue;
          const x1 = from.x + 113;
          const y1 = from.y + 56;
          const x2 = to.x + 113;
          const y2 = to.y + 56;
          const curve = Math.max(70, Math.abs(x2 - x1) * 0.42);
          const direction = x2 >= x1 ? 1 : -1;
          const path = this.#document.createElementNS(SVG_NS, "path");
          path.setAttribute("class", "plan-link");
          path.setAttribute("data-link-id", link.id);
          path.setAttribute("d", `M ${x1} ${y1} C ${x1 + curve * direction} ${y1}, ${x2 - curve * direction} ${y2}, ${x2} ${y2}`);
          paths.push(path);
        }
        this.#elements.linkPaths.replaceChildren(...paths);
      }

      #createCard(card) {
        const element = this.#document.createElement("article");
        element.className = "plan-card";
        const isNew = !this.#knownCards.has(card.id);
        if (isNew) element.classList.add("arriving");
        this.#knownCards.add(card.id);
        element.dataset.cardId = card.id;
        element.dataset.kind = card.kind;
        const previous = this.#lastPositions.get(card.id);
        if (!isNew && previous && (previous.x !== card.x || previous.y !== card.y)) {
          element.style.transform = `translate(${previous.x}px, ${previous.y}px)`;
          element.dataset.targetX = String(card.x);
          element.dataset.targetY = String(card.y);
        } else {
          element.style.transform = `translate(${card.x}px, ${card.y}px)`;
        }
        element.setAttribute("aria-label", `${card.kind}: ${card.text}`);

        const top = this.#document.createElement("div");
        top.className = "card-topline";
        const kind = this.#document.createElement("span");
        kind.className = "kind-chip";
        kind.textContent = card.kind;
        const grip = this.#document.createElement("span");
        grip.className = "drag-dots";
        grip.setAttribute("aria-hidden", "true");
        top.append(kind, grip);

        const text = this.#document.createElement("p");
        text.className = "card-text";
        text.contentEditable = "true";
        text.spellcheck = true;
        text.textContent = card.text;
        text.dataset.original = card.text;
        text.setAttribute("aria-label", `Edit ${card.text}`);
        text.addEventListener("keydown", (event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            text.blur();
          }
          if (event.key === "Escape") {
            text.textContent = text.dataset.original;
            text.blur();
          }
        });
        text.addEventListener("blur", async () => {
          const nextText = text.textContent.trim();
          if (!nextText) {
            text.textContent = text.dataset.original;
            return;
          }
          if (nextText !== text.dataset.original) await this.#invoke("updateCard", { id: card.id, text: nextText });
        });

        element.append(top, text);
        if (card.schedule) {
          const schedule = this.#document.createElement("span");
          schedule.className = "schedule-chip";
          schedule.textContent = card.schedule;
          element.append(schedule);
        }
        const id = this.#document.createElement("span");
        id.className = "card-id";
        id.textContent = card.id.replace("card-", "#");
        element.append(id);
        this.#bindDrag(element, card);
        return element;
      }

      #bindDrag(element, card) {
        element.addEventListener("pointerdown", (event) => {
          if (event.button !== 0 || event.target.closest(".card-text")) return;
          event.preventDefault();
          element.setPointerCapture(event.pointerId);
          element.classList.add("dragging");
          const origin = { x: card.x, y: card.y, clientX: event.clientX, clientY: event.clientY };

          let latest = card;
          const move = (moveEvent) => {
            latest = this.#board.moveCard(
              card.id,
              origin.x + moveEvent.clientX - origin.clientX,
              origin.y + moveEvent.clientY - origin.clientY,
            );
            element.style.transform = `translate(${latest.x}px, ${latest.y}px)`;
            this.#renderLinks(this.#board.state);
          };
          const finish = () => {
            this.#lastPositions.set(card.id, { x: latest.x, y: latest.y });
            element.classList.remove("dragging");
            element.removeEventListener("pointermove", move);
            element.removeEventListener("pointerup", finish);
            element.removeEventListener("pointercancel", finish);
            this.renderBoard();
          };
          element.addEventListener("pointermove", move);
          element.addEventListener("pointerup", finish);
          element.addEventListener("pointercancel", finish);
        });
      }

      async #startPlan(event) {
        event.preventDefault();
        const text = this.#elements.goalInput.value.trim();
        if (!text) return;
        try {
          await this.#substrate.invoke("addCard", { text, kind: "goal" });
          await this.#substrate.invoke("reflow", { layout: "canvas" });
          await this.#substrate.invoke("summarizePlan", {});
          this.#elements.goalInput.value = "";
          this.#elements.viewport.scrollTo({ left: 0, top: 0, behavior: "smooth" });
        } catch (error) {
          this.toast(error.message);
        }
      }

      async #runSample() {
        if (this.#sample.running) return;
        try {
          await this.#sample.run();
          this.#elements.viewport.scrollTo({ left: 0, top: 0, behavior: "smooth" });
        } catch (error) {
          if (error.code !== "HUMAN_APPROVAL_REQUIRED" && error.name !== "AbortError") this.toast(error.message);
        }
      }

      #sampleDone() {
        this.#elements.sampleButton.disabled = false;
        this.#elements.sampleButton.querySelector("strong").textContent = "Build a sample plan";
      }

      async #invoke(name, args) {
        try {
          return await this.#substrate.invoke(name, args);
        } catch (error) {
          if (error.code !== "HUMAN_APPROVAL_REQUIRED") this.toast(error.message);
          return null;
        }
      }

      #clearBoard() {
        if (this.#board.state.cards.length === 0) {
          this.toast("The board is already clear.");
          return;
        }
        this.#invoke("clearBoard", { confirm: true });
      }

      async #copyPrompt() {
        const copied = await copyText(EXACT_JUDGE_PROMPT, this.#document);
        this.toast(copied ? "Prompt copied." : "Select the prompt and copy it from the page.");
      }

      #toolStarted(detail) {
        this.#activeCallId = detail.callId;
        this.#elements.activeMove.hidden = false;
        this.#elements.activeTool.textContent = detail.name;
        if (this.#elements.activity.querySelector(".activity-empty")) this.#elements.activity.replaceChildren();
        const item = this.#document.createElement("div");
        item.className = "activity-item";
        item.dataset.status = "running";
        const icon = this.#document.createElement("i");
        icon.textContent = "◌";
        const copy = this.#document.createElement("div");
        copy.className = "activity-copy";
        const name = this.#document.createElement("strong");
        name.textContent = detail.name;
        const args = this.#document.createElement("small");
        args.textContent = compact(detail.args);
        copy.append(name, args);
        const state = this.#document.createElement("span");
        state.className = "activity-state";
        state.textContent = detail.irreversible ? "check" : "running";
        item.append(icon, copy, state);
        this.#elements.activity.prepend(item);
        this.#callNodes.set(detail.callId, item);
        while (this.#elements.activity.children.length > 14) this.#elements.activity.lastElementChild.remove();
      }

      #toolFinished(detail, status) {
        const item = this.#callNodes.get(detail.callId);
        if (item) {
          item.dataset.status = status;
          item.querySelector("i").textContent = status === "complete" ? "✓" : "!";
          item.querySelector(".activity-state").textContent = status === "complete" ? detail.result?.status ?? "done" : status;
          const line = item.querySelector("small");
          if (status === "complete" && detail.result) line.textContent = resultLine(detail.result);
          if (status !== "complete") line.textContent = detail.error?.message ?? "The move did not run.";
        }
        if (this.#activeCallId === detail.callId) {
          this.#activeCallId = null;
          setTimeout(() => {
            if (!this.#activeCallId) this.#elements.activeMove.hidden = true;
          }, 120);
        }
      }

      #showApproval(request) {
        this.#pendingApproval = request;
        this.#document.querySelector("[data-clear-description]").textContent = request.description;
        this.#document.querySelector("[data-clear-scope]").textContent = request.scope?.effect ?? "The current local board";
        if (typeof this.#elements.clearDialog.showModal === "function") {
          showDialog(this.#elements.clearDialog);
        } else {
          const approved = globalThis.confirm?.(request.title) ?? false;
          this.#settleApproval(approved);
        }
      }

      #settleApproval(approved) {
        if (!this.#pendingApproval) return;
        const requestId = this.#pendingApproval.requestId;
        this.#pendingApproval = null;
        closeDialog(this.#elements.clearDialog);
        if (approved) this.#approvalGate.approve(requestId, { actor: "human" });
        else this.#approvalGate.deny(requestId);
      }

      #addArtifact(artifact) {
        this.#artifacts = [artifact, ...this.#artifacts.filter((item) => item.filename !== artifact.filename)].slice(0, 3);
        const rows = this.#artifacts.map((item) => {
          const row = this.#document.createElement("div");
          row.className = "artifact-row";
          const type = this.#document.createElement("span");
          type.textContent = item.filename.endsWith(".md") ? "MD" : "{}";
          const copy = this.#document.createElement("div");
          const name = this.#document.createElement("strong");
          name.textContent = item.filename;
          const size = this.#document.createElement("small");
          size.textContent = `${item.content.length.toLocaleString()} characters · local`;
          copy.append(name, size);
          const button = this.#document.createElement("button");
          button.type = "button";
          button.textContent = "↓";
          button.setAttribute("aria-label", `Download ${item.filename}`);
          button.addEventListener("click", () => this.#openArtifact(item));
          row.append(type, copy, button);
          return row;
        });
        this.#elements.artifacts.replaceChildren(...rows);
      }
    }

    function downloadArtifact(documentRef, artifact) {
      const blob = new Blob([artifact.content], { type: `${artifact.mimeType};charset=utf-8` });
      const url = URL.createObjectURL(blob);
      const anchor = documentRef.createElement("a");
      anchor.href = url;
      anchor.download = artifact.filename;
      anchor.rel = "noopener";
      anchor.hidden = true;
      documentRef.body.append(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 500);
      return true;
    }

    function compact(value) {
      const text = JSON.stringify(value);
      return text.length > 88 ? `${text.slice(0, 85)}...` : text;
    }

    function resultLine(result) {
      if (result.card) return `${result.status}: ${result.card.id}`;
      if (result.group) return `${result.status}: ${result.group.label}`;
      if (result.layout) return `${result.status}: ${result.layout}`;
      if (result.summary) return `${result.status}: ${result.summary.totals.cards} cards in view`;
      if (result.artifact) return `${result.status}: ${result.artifact.filename}`;
      return result.status ?? "completed";
    }

    function showDialog(dialog) {
      if (dialog.open) return;
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
    }

    function closeDialog(dialog) {
      if (!dialog.open) return;
      if (typeof dialog.close === "function") dialog.close();
      else dialog.removeAttribute("open");
    }

    async function copyText(text, documentRef) {
      if (typeof globalThis.navigator?.clipboard?.writeText === "function") {
        try {
          await globalThis.navigator.clipboard.writeText(text);
          return true;
        } catch {
          // Fall through to the direct-file compatible selection path.
        }
      }
      const area = documentRef.createElement("textarea");
      area.value = text;
      area.style.position = "fixed";
      area.style.opacity = "0";
      documentRef.body.append(area);
      area.select();
      const copied = documentRef.execCommand?.("copy") ?? false;
      area.remove();
      return copied;
    }
    return Object.freeze({ WeaveUI, downloadArtifact });
  })();
  __modules["src/main.js"] = (() => {
    const { WeaveBoard } = __modules["src/app/board.js"];
    const { createWeaveTools } = __modules["src/app/tools.js"];
    const { SamplePlan } = __modules["src/sim/sample-plan.js"];
    const { WeaveUI, downloadArtifact } = __modules["src/ui/controller.js"];
    const { EventBus } = __modules["src/webmcp/event-bus.js"];
    const { HumanApprovalGate } = __modules["src/webmcp/human-gate.js"];
    const { DeterministicClock, ProvenanceRail } = __modules["src/webmcp/provenance.js"];
    const { WebMCPSubstrate } = __modules["src/webmcp/substrate.js"];

    async function boot({ documentRef = document } = {}) {
      const eventBus = new EventBus();
      const board = new WeaveBoard();
      const provenance = new ProvenanceRail({
        eventBus,
        caseId: "weave-board",
        clock: new DeterministicClock({ start: "2026-08-27T10:00:00.000Z", stepMs: 7_000 }),
      });
      const approvalGate = new HumanApprovalGate({ eventBus });
      const substrate = new WebMCPSubstrate({ documentRef, eventBus, provenance, approvalGate });
      const openArtifact = (artifact) => downloadArtifact(documentRef, artifact);
      const tools = createWeaveTools({ board, eventBus, deliverArtifact: openArtifact });
      const sample = new SamplePlan({ substrate, board, eventBus });
      const ui = new WeaveUI({ documentRef, board, eventBus, approvalGate, provenance, substrate, sample, openArtifact });

      ui.bind();
      await substrate.registerAll(tools);
      ui.hostReady({ mode: substrate.mode, toolCount: substrate.size });

      const app = { board, eventBus, provenance, approvalGate, substrate, sample, ui };
      globalThis.__WEAVE__ = app;
      return app;
    }

    if (typeof document !== "undefined") {
      boot().catch((error) => {
        const mode = document.querySelector("[data-host-mode]");
        if (mode) mode.textContent = "unavailable";
        const region = document.querySelector("[data-toast-region]");
        if (region) {
          const notice = document.createElement("div");
          notice.className = "toast";
          notice.textContent = `Weave could not start: ${error.message}`;
          region.append(notice);
        }
        throw error;
      });
    }
    return Object.freeze({ boot });
  })();
})();
