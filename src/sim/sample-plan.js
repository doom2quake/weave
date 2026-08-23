export const EXACT_JUDGE_PROMPT = "Use this page's site tools to plan a 3-day Lisbon trip. Add a goal plus practical cards, link dependencies, group them into Prep, Lisbon days, and Day trip, schedule the trip across three days, reflow it as a timeline, summarize the plan, and export it as Markdown.";

export class SamplePlan {
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
