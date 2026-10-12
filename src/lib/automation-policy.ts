export type AutomationAction =
  | "research_venue"
  | "draft_outreach"
  | "send_approved_outreach"
  | "send_routine_followup"
  | "create_internal_task"
  | "sync_confirmed_show_calendar"
  | "categorize_transaction"
  | "prepare_financial_export"
  | "accept_offer"
  | "sign_contract"
  | "move_money"
  | "pay_bill"
  | "issue_refund"
  | "pay_member"
  | "file_tax_return"
  | "change_permissions"
  | "delete_financial_record";

export type AutomationPermission =
  | "booking_research"
  | "draft_messages"
  | "send_campaign_messages"
  | "send_followups"
  | "manage_internal_tasks"
  | "calendar_sync"
  | "financial_suggestions"
  | "financial_exports";

export type AutomationPolicy = {
  enabled: boolean;
  permissions: ReadonlySet<AutomationPermission>;
  maxCampaignMessagesPerDay: number;
  messagesSentToday: number;
  recipientOptedOut: boolean;
  requiresHumanApproval: boolean;
};

export type AutomationDecision =
  | { allowed: true; requiresApproval: false; reason: string }
  | { allowed: true; requiresApproval: true; reason: string }
  | { allowed: false; requiresApproval: true; reason: string };

const PERMISSION_FOR_ACTION: Partial<Record<AutomationAction, AutomationPermission>> = {
  research_venue: "booking_research",
  draft_outreach: "draft_messages",
  send_approved_outreach: "send_campaign_messages",
  send_routine_followup: "send_followups",
  create_internal_task: "manage_internal_tasks",
  sync_confirmed_show_calendar: "calendar_sync",
  categorize_transaction: "financial_suggestions",
  prepare_financial_export: "financial_exports",
};

const ALWAYS_APPROVAL = new Set<AutomationAction>([
  "accept_offer",
  "sign_contract",
  "move_money",
  "pay_bill",
  "issue_refund",
  "pay_member",
  "file_tax_return",
  "change_permissions",
  "delete_financial_record",
]);

export function evaluateAutomationPermission(
  action: AutomationAction,
  policy: AutomationPolicy,
): AutomationDecision {
  if (!policy.enabled) {
    return { allowed: false, requiresApproval: true, reason: "Automation is paused for this band." };
  }

  if (action === "send_routine_followup" || action === "send_approved_outreach") {
    if (policy.recipientOptedOut) {
      return { allowed: false, requiresApproval: true, reason: "Recipient has opted out; sending is blocked." };
    }
    if (
      !Number.isInteger(policy.maxCampaignMessagesPerDay) ||
      policy.maxCampaignMessagesPerDay < 0 ||
      !Number.isInteger(policy.messagesSentToday) ||
      policy.messagesSentToday < 0
    ) {
      return { allowed: false, requiresApproval: true, reason: "Campaign limits are invalid." };
    }
    if (policy.messagesSentToday >= policy.maxCampaignMessagesPerDay) {
      return { allowed: false, requiresApproval: true, reason: "The configured daily message limit has been reached." };
    }
  }

  if (ALWAYS_APPROVAL.has(action)) {
    return {
      allowed: true,
      requiresApproval: true,
      reason: "This action has material financial, legal, or security consequences and must be explicitly approved.",
    };
  }

  const requiredPermission = PERMISSION_FOR_ACTION[action];
  if (!requiredPermission || !policy.permissions.has(requiredPermission)) {
    return {
      allowed: false,
      requiresApproval: true,
      reason: requiredPermission
        ? `The band has not granted the ${requiredPermission} permission.`
        : "No execution policy is defined for this action.",
    };
  }

  if (policy.requiresHumanApproval) {
    return { allowed: true, requiresApproval: true, reason: "Band policy requires approval before execution." };
  }

  return { allowed: true, requiresApproval: false, reason: "Allowed by the band's configured automation policy." };
}

export type RetryDecision = {
  retry: boolean;
  delayMs: number;
  reason: string;
};

/**
 * Deterministic exponential backoff. Caller must persist attempt count and
 * apply provider-specific limits; this helper does not perform network calls.
 */
export function retryDecision(
  attempt: number,
  maxAttempts: number,
  baseDelayMs = 1_000,
  maxDelayMs = 60_000,
): RetryDecision {
  if (!Number.isInteger(attempt) || attempt < 1) {
    throw new Error("Attempt must be a positive integer.");
  }
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
    throw new Error("Maximum attempts must be a positive integer.");
  }
  if (!Number.isFinite(baseDelayMs) || baseDelayMs < 0 || !Number.isFinite(maxDelayMs) || maxDelayMs < 0) {
    throw new Error("Retry delays must be finite and non-negative.");
  }
  if (attempt >= maxAttempts) {
    return { retry: false, delayMs: 0, reason: "Maximum attempts reached; send to the failure queue for review." };
  }
  const delayMs = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1));
  return { retry: true, delayMs, reason: "Retry with exponential backoff; preserve the same idempotency key." };
}
