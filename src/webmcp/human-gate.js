export class ApprovalRequiredError extends Error {
  constructor(toolName, message = `Human approval was not granted for ${toolName}.`) {
    super(message);
    this.name = "ApprovalRequiredError";
    this.code = "HUMAN_APPROVAL_REQUIRED";
    this.toolName = toolName;
  }
}

export class HumanApprovalGate {
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
