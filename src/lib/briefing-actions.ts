import type { BriefingItem } from "./daily-briefing";

export function makeBriefingActionPrompt(item: BriefingItem): string {
  return `Prepare three practical next steps for this band operations priority: ${item.title}. Context: ${item.detail}. Use our saved workspace information, label assumptions clearly, and draft suggested communications for review. Do not claim any work has already been performed.`;
}
