export function needsLiveResearch(message: string, history: { role: "user" | "ai"; text: string }[]): boolean {
  if (/\b(saved|recorded|workspace|weekly plan|goal progress|completed tasks?)\b/i.test(message) && !/\b(search|research|find|look up|verify|latest|news|weather|forecast|stock price|live|availability)\b/i.test(message)) return false;
  const previous = message.trim().length < 32
    ? history.filter(item => item.role === "user").slice(-2).map(item => item.text).join(" ")
    : "";
  const query = [message, previous].join(" ");
  return /\b(current|latest|today|tomorrow|upcoming|recent|news|weather|forecast|temperature|price|prices|stock|stocks|exchange rate|currency|election|results|score|scores|schedule|traffic|time in|research|search|find|look up|verify|source|live|real|venue|venues|booker|promoter|contact|festival|concert|tour|routing|nearby|capacity|booking|availability|lineup|artist|artists|band|bands|spotify|instagram|youtube|tiktok|ticket|market|competition|competitor|playing|shows|who books|where can we play)\b/i.test(query);
}
