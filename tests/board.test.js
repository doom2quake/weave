import assert from "node:assert/strict";
import test from "node:test";
import { WeaveBoard } from "../src/app/board.js";

function makeSmallBoard() {
  const board = new WeaveBoard();
  const goal = board.addCard("Ship the launch", "goal");
  const page = board.addCard("Write the landing page", "task");
  const email = board.addCard("Send the launch email", "task");
  return { board, goal, page, email };
}

test("cards receive deterministic identifiers and starting positions", () => {
  const first = makeSmallBoard();
  const second = makeSmallBoard();

  assert.deepEqual(first.board.state.cards, second.board.state.cards);
  assert.deepEqual(first.board.state.cards.map(({ id, x, y }) => ({ id, x, y })), [
    { id: "card-001", x: 84, y: 104 },
    { id: "card-002", x: 362, y: 104 },
    { id: "card-003", x: 640, y: 104 },
  ]);
});

test("link, group, schedule, and timeline reflow create the expected structure", () => {
  const { board, goal, page, email } = makeSmallBoard();
  board.linkCards(goal.id, page.id);
  board.linkCards(page.id, email.id);
  board.groupCards([page.id, email.id], "Launch day");
  board.setSchedule(page.id, "Day 1 · 09:00");
  board.setSchedule(email.id, "Day 1 · 12:00");
  const reflow = board.reflow("timeline");
  const state = board.state;

  assert.equal(state.links.length, 2);
  assert.deepEqual(state.groups[0].cardIds, ["card-002", "card-003"]);
  assert.equal(state.cards.find((card) => card.id === page.id).x, 76);
  assert.equal(state.cards.find((card) => card.id === email.id).x, 322);
  assert.equal(state.cards.find((card) => card.id === goal.id).y, 610);
  assert.equal(reflow.layout, "timeline");
  assert.equal(reflow.stage.height, 820);
});

test("duplicate directional links are idempotent and self-links are refused", () => {
  const { board, goal, page } = makeSmallBoard();
  const first = board.linkCards(goal.id, page.id);
  const duplicate = board.linkCards(goal.id, page.id);

  assert.equal(first.created, true);
  assert.equal(duplicate.created, false);
  assert.equal(board.state.links.length, 1);
  assert.throws(() => board.linkCards(goal.id, goal.id), /cannot link to itself/);
});

test("summary reports groups, schedule, links, and next moves without hidden data", () => {
  const { board, goal, page, email } = makeSmallBoard();
  board.linkCards(goal.id, page.id);
  board.linkCards(page.id, email.id);
  board.groupCards([page.id, email.id], "Launch day");
  board.setSchedule(email.id, "Friday · 12:00");
  const summary = board.summarize();

  assert.equal(summary.title, "Ship the launch");
  assert.deepEqual(summary.totals, { cards: 3, links: 2, groups: 1, scheduled: 1 });
  assert.deepEqual(summary.sections[0], { label: "Launch day", cards: ["Write the landing page", "Send the launch email"] });
  assert.deepEqual(summary.nextMoves, ["Write the landing page", "Send the launch email"]);
  assert.match(summary.overview, /3 cards are connected by 2 links/);
});

test("Markdown and JSON exports are complete and parseable", () => {
  const { board, goal, page } = makeSmallBoard();
  board.linkCards(goal.id, page.id);
  board.setSchedule(page.id, "Day 1");

  const markdown = board.export("markdown");
  const json = board.export("json");
  const parsed = JSON.parse(json.content);

  assert.equal(markdown.filename, "weave-plan.md");
  assert.match(markdown.content, /^# Ship the launch/m);
  assert.match(markdown.content, /## Schedule/);
  assert.match(markdown.content, /Ship the launch → Write the landing page/);
  assert.equal(parsed.version, 1);
  assert.equal(parsed.summary.totals.cards, 3);
  assert.equal(parsed.board.links[0].a, "card-001");
});

test("clear returns exact removal counts and resets stable identifiers", () => {
  const { board, goal, page } = makeSmallBoard();
  board.linkCards(goal.id, page.id);
  board.groupCards([goal.id, page.id], "Core");
  const removed = board.clear();
  const next = board.addCard("Start again", "goal");

  assert.deepEqual(removed, { cards: 3, links: 1, groups: 1 });
  assert.equal(next.id, "card-001");
  assert.equal(board.state.links.length, 0);
});
