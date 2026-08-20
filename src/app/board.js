export const CARD_KINDS = Object.freeze(["goal", "task", "place", "moment", "note"]);
export const LAYOUTS = Object.freeze(["canvas", "columns", "timeline"]);

export class WeaveBoard {
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
