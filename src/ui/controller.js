import { EXACT_JUDGE_PROMPT } from "../sim/sample-plan.js";

const SVG_NS = "http://www.w3.org/2000/svg";

export class WeaveUI {
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

export function downloadArtifact(documentRef, artifact) {
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
