import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createAutomationRun } from "./automation-runner.ts";
import { planAutomationExecution } from "./automation-execution.ts";
import type { AutomationPolicy } from "./automation-policy.ts";
const now = "2026-10-16T12:00:00.000Z";
const policy: AutomationPolicy = { enabled: true, permissions: new Set(["booking_research"]), maxCampaignMessagesPerDay: 5, messagesSentToday: 0, recipientOptedOut: false, requiresHumanApproval: false };
const run = () => createAutomationRun({ id: "r1", bandId: "band1", action: "research_venue", idempotencyKey: "lead-1", now });
describe("autonomous execution gate", () => {
  it("allows permitted internal research", () => assert.equal(planAutomationExecution({ run: run(), action: "research_venue", policy, now, existingRuns: [] }).kind, "execute"));
  it("blocks ungranted sending", () => assert.equal(planAutomationExecution({ run: run(), action: "send_approved_outreach", policy, now, existingRuns: [] }).kind, "blocked"));
  it("blocks duplicate active work", () => assert.equal(planAutomationExecution({ run: run(), action: "research_venue", policy, now, existingRuns: [{ ...run(), id: "r2" }] }).kind, "duplicate"));
  it("requires approval for binding offers", () => {
    const offer = { ...run(), action: "accept_offer" };
    assert.equal(planAutomationExecution({ run: offer, action: "accept_offer", policy, now, existingRuns: [] }).kind, "approval");
  });
  it("blocks disabled automation", () => assert.equal(planAutomationExecution({ run: run(), action: "research_venue", policy: { ...policy, enabled: false }, now, existingRuns: [] }).kind, "blocked"));
});
