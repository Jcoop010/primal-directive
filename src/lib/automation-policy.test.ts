import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  evaluateAutomationPermission,
  retryDecision,
  type AutomationPermission,
  type AutomationPolicy,
} from "./automation-policy.ts";

const policy = (overrides: Partial<AutomationPolicy> = {}): AutomationPolicy => ({
  enabled: true,
  permissions: new Set<AutomationPermission>([
    "booking_research",
    "draft_messages",
    "send_campaign_messages",
    "send_followups",
    "manage_internal_tasks",
    "calendar_sync",
    "financial_suggestions",
    "financial_exports",
  ]),
  maxCampaignMessagesPerDay: 10,
  messagesSentToday: 2,
  recipientOptedOut: false,
  requiresHumanApproval: false,
  ...overrides,
});

describe("automation permission policy", () => {
  it("allows explicitly enabled low-risk actions", () => {
    assert.equal(evaluateAutomationPermission("research_venue", policy()).requiresApproval, false);
  });

  it("blocks all actions when automation is paused", () => {
    const result = evaluateAutomationPermission("create_internal_task", policy({ enabled: false }));
    assert.equal(result.allowed, false);
  });

  it("always requires approval for money movement and binding commitments", () => {
    for (const action of ["accept_offer", "sign_contract", "move_money", "pay_bill", "pay_member", "file_tax_return"] as const) {
      const result = evaluateAutomationPermission(action, policy());
      assert.equal(result.allowed, true);
      assert.equal(result.requiresApproval, true);
    }
  });

  it("blocks outreach to opted-out recipients", () => {
    const result = evaluateAutomationPermission("send_routine_followup", policy({ recipientOptedOut: true }));
    assert.equal(result.allowed, false);
    assert.match(result.reason, /opted out/i);
  });

  it("enforces the daily campaign limit", () => {
    const result = evaluateAutomationPermission(
      "send_approved_outreach",
      policy({ messagesSentToday: 10, maxCampaignMessagesPerDay: 10 }),
    );
    assert.equal(result.allowed, false);
    assert.match(result.reason, /limit/i);
  });

  it("requires a granted permission for each low-risk action", () => {
    const result = evaluateAutomationPermission("calendar_sync", policy({ permissions: new Set<AutomationPermission>() }));
    assert.equal(result.allowed, false);
  });

  it("supports a band-wide approval requirement", () => {
    const result = evaluateAutomationPermission("research_venue", policy({ requiresHumanApproval: true }));
    assert.equal(result.allowed, true);
    assert.equal(result.requiresApproval, true);
  });
});

describe("retry policy", () => {
  it("uses exponential backoff and caps the delay", () => {
    assert.equal(retryDecision(1, 5, 1000, 5000).delayMs, 1000);
    assert.equal(retryDecision(2, 5, 1000, 5000).delayMs, 2000);
    assert.equal(retryDecision(5, 8, 1000, 5000).delayMs, 5000);
  });

  it("stops after maximum attempts", () => {
    assert.equal(retryDecision(3, 3).retry, false);
  });

  it("rejects invalid attempts", () => {
    assert.throws(() => retryDecision(0, 3), /positive integer/i);
    assert.throws(() => retryDecision(1, 0), /positive integer/i);
  });
});
