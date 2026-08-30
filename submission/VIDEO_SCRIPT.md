# Weave demo video script (target 1:50, hard cap 3:00, audio required)

Human voice, warm and clear. Screen directions in [brackets]. The rules require the narration to
cover what you built and how you used WebMCP, so keep the WebMCP section in.

---

**[0:00 - 0:12]  Hook**
[Screen: Weave open in ChatGPT's in-app browser, an inviting empty canvas with a single prompt.]

"Turning a vague idea into a real plan is the boring part. You know roughly what you want, but laying
it out, breaking it into steps, ordering it, that takes time. We wanted your browser agent to do that
with you, on a canvas, in about a minute."

**[0:12 - 0:24]  What it is**
[Screen: point at the canvas and the example prompts.]

"This is Weave. It opens with nothing to set up, no account, no data to load. You just tell your agent
a goal."

**[0:24 - 1:05]  Building the plan**
[Screen: type "Plan a 3-day Lisbon trip." Cards appear, connect, and group into a timeline.]

"I ask for a three day trip to Lisbon. Watch the board build itself. The agent drops in cards, one per
thing to do, links the ones that depend on each other, groups them by day, and lays them on a
timeline. In under a minute I have a plan I can actually use. And it is not locked. I can drag a card,
edit it, and ask the agent to reflow or summarise, and it does."

**[1:05 - 1:20]  It is general**
[Screen: quickly try another prompt, e.g. "Map my product launch," board rebuilds.]

"It is not just trips. The same board plans a product launch, an essay, a move. Any goal you can say
in a sentence."

**[1:20 - 1:50]  How we used WebMCP**
[Screen: briefly show the tools list or the registerTool snippet in the README.]

"Here is how it works. Weave registers its tools on the page with WebMCP, using
document.modelContext.registerTool. Add a card, link cards, group them, set a schedule, summarise,
export. ChatGPT's agent discovers those tools and calls them with structured arguments, and our code
runs in the page and draws the board. The agent is not typing into a box or scraping a screen, it is
calling real functions we exposed, so the plan it builds is structured data you can keep. It runs from
any static host, in the browser, with zero setup. Thanks for watching."

---

Recording tips: open in ChatGPT's in-app browser for the real WebMCP path; with the fallback, click
"Build a sample plan." 1280x800. One silent timing pass, then voice over. Keep it short.
