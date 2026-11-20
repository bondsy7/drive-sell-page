import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { isDemoCustomer, isDemoEmailContent, resolveAutopilotDecision } from "./sales-autopilot.ts";

Deno.test("autopilot off never processes the lead automatically", () => {
  assertEquals(resolveAutopilotDecision({ mode: "off", stage: "new_lead", autoReplyStages: ["new_lead"], demoKnowledgeActive: false, demoCustomer: false }), "notify_only");
});

Deno.test("approval mode always creates a draft", () => {
  assertEquals(resolveAutopilotDecision({ mode: "approval", stage: "new_lead", autoReplyStages: ["new_lead"], demoKnowledgeActive: false, demoCustomer: false }), "draft");
});

Deno.test("full auto queues only an included stage without DEMO knowledge", () => {
  assertEquals(resolveAutopilotDecision({ mode: "full_auto", stage: "new_lead", autoReplyStages: ["new_lead"], demoKnowledgeActive: false, demoCustomer: false }), "queue");
  assertEquals(resolveAutopilotDecision({ mode: "full_auto", stage: "closing", autoReplyStages: ["new_lead"], demoKnowledgeActive: false, demoCustomer: false }), "draft");
});

Deno.test("active DEMO knowledge forces approval even in full auto", () => {
  assertEquals(resolveAutopilotDecision({ mode: "full_auto", stage: "new_lead", autoReplyStages: ["new_lead"], demoKnowledgeActive: true, demoCustomer: false }), "draft");
});

Deno.test("DEMO customers and DEMO email content are detected without matching normal wording", () => {
  assertEquals(isDemoCustomer({ name: "[DEMO] Max", email: "kunde@example.org" }), true);
  assertEquals(isDemoCustomer({ name: "Max", email: "max@example.invalid" }), true);
  assertEquals(isDemoCustomer({ name: "Max", email: "max@example.org" }), false);
  assertEquals(isDemoEmailContent("Angebot", "[DEMO] Nur ein Test"), true);
  assertEquals(isDemoEmailContent("Demokratie", "normale Antwort"), false);
});
