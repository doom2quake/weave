import { WeaveBoard } from "./app/board.js";
import { createWeaveTools } from "./app/tools.js";
import { SamplePlan } from "./sim/sample-plan.js";
import { WeaveUI, downloadArtifact } from "./ui/controller.js";
import { EventBus } from "./webmcp/event-bus.js";
import { HumanApprovalGate } from "./webmcp/human-gate.js";
import { DeterministicClock, ProvenanceRail } from "./webmcp/provenance.js";
import { WebMCPSubstrate } from "./webmcp/substrate.js";

export async function boot({ documentRef = document } = {}) {
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

  // A real WebMCP host (for example ChatGPT's built-in browser) can inject its
  // native document.modelContext AFTER our scripts have already run. If we started
  // on the local polyfill, watch for the native host to appear and register the same
  // tools on it, so the agent can discover and call them.
  if (substrate.mode === "polyfill") {
    let ticks = 0;
    const watch = setInterval(async () => {
      ticks += 1;
      const native = documentRef.modelContext;
      if (native && !native.__webmcpLocalPolyfill && typeof native.registerTool === "function") {
        clearInterval(watch);
        try {
          const nativeSubstrate = new WebMCPSubstrate({ documentRef, eventBus, provenance, approvalGate, modelContext: native });
          await nativeSubstrate.registerAll(tools);
          ui.hostReady?.({ mode: nativeSubstrate.mode, toolCount: nativeSubstrate.size });
        } catch (err) { /* keep the polyfill if native registration fails */ }
      } else if (ticks >= 120) {
        clearInterval(watch);
      }
    }, 500);
  }

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
