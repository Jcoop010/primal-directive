export type PaidPlan = "pro" | "studio";
export const LIVE_PRICES: Record<PaidPlan, string> = {
  pro: "price_1UPXQ4IS04s94hSMW7JAMY7Y",
  studio: "price_1UPXQ4IS04s94hSMbHavjP0F",
};
export function entitledPlan(
  rows: readonly { plan: string; status: string; period_end: string | Date | null }[],
  now = Date.now(),
): "free" | PaidPlan {
  const eligible = rows.filter(
    (r) =>
      ["active", "trialing"].includes(r.status) &&
      r.period_end &&
      new Date(r.period_end).getTime() > now,
  );
  return eligible.some((r) => r.plan === "studio")
    ? "studio"
    : eligible.some((r) => r.plan === "pro")
      ? "pro"
      : "free";
}
