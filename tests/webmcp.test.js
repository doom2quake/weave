import assert from "node:assert/strict";
import test from "node:test";
import { WeaveBoard } from "../src/app/board.js";
import { createWeaveTools } from "../src/app/tools.js";
import { SamplePlan } from "../src/sim/sample-plan.js";
import { EventBus } from "../src/webmcp/event-bus.js";
import { ApprovalRequiredError, HumanApprovalGate } from "../src/webmcp/human-gate.js";
import { createModelContextPolyfill } from "../src/webmcp/polyfill.js";
import { DeterministicClock, ProvenanceRail } from "../src/webmcp/provenance.js";
import { ToolContractError } from "../src/webmcp/schema.js";
import { WebMCPSubstrate } from "../src/webmcp/substrate.js";

const EXPECTED_TOOLS = [
  "addCard",
  "clearBoard",
  "exportPlan",
  "groupCards",
  "linkCards",
  "reflow",
  "setSchedule",
  "summarizePlan",
  "updateCard",
];

function createHarness({ approvalProvider = null, deliverArtifact = () => false } = {}) {
  const eventBus = new EventBus();
  const board = new WeaveBoard();
  const provenance = new ProvenanceRail({
    eventBus,
    clock: new DeterministicClock({ start: "2026-08-27T10:00:00.000Z", stepMs: 7_000 }),
  });
  const approvalGate = new HumanApprovalGate({ eventBus, approvalProvider });
  const modelContext = createModelContextPolyfill();
  const substrate = new WebMCPSubstrate({ modelContext, eventBus, provenance, approvalGate });
  const tools = createWeaveTools({ board, eventBus, deliverArtifact });
  return { eventBus, board, provenance, approvalGate, modelContext, substrate, tools };
}

test("nine tools register with the verified imperative WebMCP descriptor shape", async () => {
  const harness = createHarness();
  await harness.substrate.registerAll(harness.tools);
  const descriptors = await harness.modelContext.getTools();

  assert.equal(harness.substrate.mode, "polyfill");
  assert.equal(harness.substrate.size, 9);
  assert.deepEqual(descriptors.map((tool) => tool.name), EXPECTED_TOOLS);
  assert.ok(descriptors.every((tool) => tool.inputSchema.type === "object"));
  assert.equal(descriptors.find((tool) => tool.name === "summarizePlan").annotations.readOnlyHint, true);
  assert.equal(descriptors.find((tool) => tool.name === "addCard").annotations.readOnlyHint, false);
  assert.equal(descriptors.find((tool) => tool.name === "clearBoard").annotations.readOnlyHint, false);
});

test("schema validation rejects missing, extra, enum, and malformed arguments", async () => {
  const harness = createHarness();
  await harness.substrate.registerAll(harness.tools);

  await assert.rejects(harness.substrate.invoke("addCard", { text: "A goal" }), ToolContractError);
  await assert.rejects(harness.substrate.invoke("addCard", { text: "A goal", kind: "unknown" }), ToolContractError);
  await assert.rejects(harness.substrate.invoke("addCard", { text: "A goal", kind: "goal", hidden: true }), ToolContractError);
  await assert.rejects(harness.substrate.invoke("updateCard", { id: "first", text: "No" }), ToolContractError);
  await assert.rejects(harness.substrate.invoke("addCard", { text: "   ", kind: "note" }), ToolContractError);
  assert.equal(harness.board.state.cards.length, 0);
  assert.equal(harness.provenance.snapshot().length, 5);
});

test("tools deterministically add, update, link, group, schedule, reflow, and summarize", async () => {
  const harness = createHarness();
  await harness.substrate.registerAll(harness.tools);
  const goal = (await harness.substrate.invoke("addCard", { text: "Publish a guide", kind: "goal" })).card.id;
  const draft = (await harness.substrate.invoke("addCard", { text: "Write the draft", kind: "task" })).card.id;
  await harness.substrate.invoke("updateCard", { id: draft, text: "Write a short draft" });
  await harness.substrate.invoke("linkCards", { a: goal, b: draft });
  await harness.substrate.invoke("groupCards", { ids: [draft], label: "Writing" });
  await harness.substrate.invoke("setSchedule", { id: draft, when: "Monday · 09:00" });
  await harness.substrate.invoke("reflow", { layout: "timeline" });
  const result = await harness.substrate.invoke("summarizePlan", {});

  assert.deepEqual(result.summary.totals, { cards: 2, links: 1, groups: 1, scheduled: 1 });
  assert.equal(harness.board.state.layout, "timeline");
  assert.equal(harness.board.state.cards[1].text, "Write a short draft");
  assert.deepEqual(harness.provenance.snapshot().map((entry) => entry.name), [
    "addCard", "addCard", "updateCard", "linkCards", "groupCards", "setSchedule", "reflow", "summarizePlan",
  ]);
});

test("export tool returns valid content and uses the local artifact delivery seam", async () => {
  const delivered = [];
  const harness = createHarness({ deliverArtifact: (artifact) => delivered.push(artifact) > 0 });
  await harness.substrate.registerAll(harness.tools);
  await harness.substrate.invoke("addCard", { text: "Plan the week", kind: "goal" });
  const result = await harness.substrate.invoke("exportPlan", { format: "json" });

  assert.equal(result.opened, true);
  assert.equal(delivered.length, 1);
  assert.equal(JSON.parse(result.artifact.content).summary.title, "Plan the week");
  assert.equal(result.artifact.mimeType, "application/json");
});

test("clearBoard refuses a call without the explicit confirm argument", async () => {
  const harness = createHarness({ approvalProvider: async () => true });
  await harness.substrate.registerAll(harness.tools);
  await harness.substrate.invoke("addCard", { text: "Keep me", kind: "goal" });

  await assert.rejects(harness.substrate.invoke("clearBoard", {}), ToolContractError);
  await assert.rejects(harness.substrate.invoke("clearBoard", { confirm: false }), ToolContractError);
  assert.equal(harness.board.state.cards.length, 1);
});

test("clearBoard remains unchanged when its human checkpoint is denied", async () => {
  const harness = createHarness({ approvalProvider: async () => false });
  await harness.substrate.registerAll(harness.tools);
  await harness.substrate.invoke("addCard", { text: "Keep me", kind: "goal" });

  await assert.rejects(
    harness.substrate.invoke("clearBoard", { confirm: true }),
    (error) => error instanceof ApprovalRequiredError && error.code === "HUMAN_APPROVAL_REQUIRED",
  );
  assert.equal(harness.board.state.cards.length, 1);
  const receipt = harness.provenance.snapshot().at(-1);
  assert.equal(receipt.status, "denied");
  assert.equal(receipt.humanApproved, false);
});

test("approved clearBoard removes the complete local board and records approval", async () => {
  const harness = createHarness({ approvalProvider: async () => true });
  await harness.substrate.registerAll(harness.tools);
  await harness.substrate.invoke("addCard", { text: "Clear me", kind: "goal" });
  const result = await harness.substrate.invoke("clearBoard", { confirm: true });

  assert.equal(result.status, "cleared");
  assert.equal(result.humanApproved, true);
  assert.equal(harness.board.state.cards.length, 0);
  assert.equal(harness.provenance.snapshot().at(-1).humanApproved, true);
});

test("every success and failure receives a stable provenance receipt", async () => {
  const first = createHarness();
  const second = createHarness();
  await first.substrate.registerAll(first.tools);
  await second.substrate.registerAll(second.tools);

  await first.substrate.invoke("addCard", { text: "Same", kind: "goal" });
  await second.substrate.invoke("addCard", { text: "Same", kind: "goal" });
  await assert.rejects(first.substrate.invoke("reflow", { layout: "grid" }), ToolContractError);
  const firstReceipts = first.provenance.snapshot();
  const secondReceipt = second.provenance.snapshot()[0];

  assert.equal(firstReceipts[0].timestamp, "2026-08-27T10:00:00.000Z");
  assert.equal(firstReceipts[0].argsDigest, secondReceipt.argsDigest);
  assert.equal(firstReceipts[0].resultDigest, secondReceipt.resultDigest);
  assert.equal(firstReceipts[1].status, "error");
  assert.equal(firstReceipts[1].error.code, "INVALID_TOOL_ARGUMENTS");
});

test("sample harness builds the complete Lisbon board through 31 registered calls", async () => {
  const harness = createHarness({ approvalProvider: async () => true });
  await harness.substrate.registerAll(harness.tools);
  const sample = new SamplePlan({ substrate: harness.substrate, board: harness.board, eventBus: harness.eventBus });
  const outcome = await sample.run({ stepDelay: 0 });
  const state = harness.board.state;

  assert.equal(outcome.status, "completed");
  assert.equal(outcome.calls, 31);
  assert.equal(state.cards.length, 9);
  assert.equal(state.links.length, 8);
  assert.equal(state.groups.length, 3);
  assert.equal(state.cards.filter((card) => card.schedule).length, 8);
  assert.equal(state.layout, "timeline");
  assert.equal(state.summary.title, "Plan a 3-day Lisbon trip");
  assert.equal(harness.provenance.snapshot().length, 31);
});

test("polyfill accepts JSON input and abort unregisters the named tool", async () => {
  const harness = createHarness();
  await harness.substrate.registerAll(harness.tools);
  const result = await harness.modelContext.executeTool("addCard", JSON.stringify({ text: "From JSON", kind: "note" }));
  assert.equal(result.card.id, "card-001");

  assert.equal(harness.substrate.unregister("addCard"), true);
  assert.equal(harness.substrate.size, 8);
  await assert.rejects(harness.modelContext.executeTool("addCard", { text: "Again", kind: "note" }), (error) => error.name === "NotFoundError");
});
