/** Decode supported provider envelopes, without displaying malformed JSON as prose. */
export function readableAdvisorAnswer(raw: string): { answer: string; object?: unknown } {
  let text = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  let object: unknown;
  for (let pass = 0; pass < 3; pass++) {
    try {
      const value: unknown = JSON.parse(text);
      if (typeof value === 'string') { text = value; continue; }
      if (value && typeof value === 'object' && 'answer' in value && typeof value.answer === 'string') {
        object = value; text = value.answer; continue;
      }
      return { answer: '' };
    } catch { break; }
  }
  if (text.trim().startsWith('[') || text.trim().startsWith('{') || /"(?:answer|gigs|people|moves)"\s*:/.test(text)) return { answer: '' };
  const paragraphs = text.replace(/\\n/g, '\n').split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  return { answer: [...new Set(paragraphs)].join('\n\n').slice(0, 20000), object };
}
