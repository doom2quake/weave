import { CARD_KINDS, LAYOUTS } from "./board.js";

const noExtras = Object.freeze({ additionalProperties: false });
const cardId = Object.freeze({ type: "string", pattern: "^card-[0-9]{3,}$" });
const cardText = Object.freeze({ type: "string", minLength: 1, maxLength: 180, pattern: "\\S" });

export function createWeaveTools({ board, eventBus, deliverArtifact = () => false }) {
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
