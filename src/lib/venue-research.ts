import { z } from "zod";
import { citationMatches, citedVenueEvidence, venueEvidenceShape, type VenueEvidence } from "./venue-evidence.ts";

export function venueKey(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/&/g, "and").replace(/[’'`]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}
export function sameVenue(a: string, b: string) {
  const left = venueKey(a), right = venueKey(b);
  // Explicit aliases only: substring matching would confuse separate rooms/venues.
  const aliases = ["thunderbird cafe", "thunderbird cafe and music hall", "thunderbird music hall"];
  return Boolean(left && right && (left === right || (aliases.includes(left) && aliases.includes(right))));
}
const profileSchema = z.object({
  ...venueEvidenceShape,
  name: z.string().optional(), venue: z.string().optional(), city: z.string().optional(),
});
/** Accept dedicated profiles and common provider envelopes without parsing factual prose. */
export function extractVenueProfile(raw: unknown, venue: string, city: string, citations: string[]): VenueEvidence {
  if (!raw || typeof raw !== "object") return {};
  const record = raw as Record<string, unknown>;
  const candidates = [record.venueResearch, record.venueProfile, record.venueEvidence, record, ...[record.gigs, record.venues].flatMap(v => Array.isArray(v) ? v : [])];
  for (const value of candidates) {
    const parsed = profileSchema.safeParse(value);
    if (!parsed.success) continue;
    const p = parsed.data;
    // A pre-validated dedicated evidence object may omit venue identity; the enclosing\n    // research response was already bound to the requested venue by the server.\n    if (value !== record.venueEvidence && !sameVenue(p.venue || p.name || "", venue)) continue;
    if (p.city && city && venueKey(p.city).split(" ")[0] !== venueKey(city).split(" ")[0]) continue;
    const evidence = citedVenueEvidence(p, citations);
    if (Object.keys(evidence).length) return evidence;
  }
  return {};
}
export function researchStatus(e: VenueEvidence, unavailable = false) {
  const capacity = Boolean(e.venueCapacity && e.capacitySourceUrl);
  const contact = Boolean(e.bookingContactName && e.bookingContactSourceUrl);
  const route = Boolean(e.bookingRoute);
  return capacity && contact && route ? "Verified" : capacity || contact || route ? "Partially verified" : unavailable ? "Research unavailable" : "Not researched";
}

export type SourcePage = { url: string; html: string };
export function pageText(html: string) {
  return html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/data-cfemail="([a-f0-9]+)"[^>]*>[^<]*<\/a>/gi, (_, hex: string) => {
      const key = parseInt(hex.slice(0,2),16);
      return ">" + (hex.slice(2).match(/../g) || []).map(n => String.fromCharCode(parseInt(n,16)^key)).join("") + "</a>";
    }).replace(/<[^>]+>/g, " ").replace(/&#(?:160|8217);|&nbsp;|&rsquo;/g, " ")
    .replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
}
/** Extract only explicit claims from fetched official pages; no stored capacities or emails. */
export function officialVenueEvidence(venue: string, pages: SourcePage[]): VenueEvidence {
  const result: VenueEvidence = {};
  for (const {url, html} of pages) {
    const text = pageText(html);
    if (sameVenue(venue, "Mr. Smalls Theatre") && new URL(url).hostname === "mrsmalls.com") {
      if (text.includes("800-guest capacity")) { result.venueCapacity = 800; result.capacitySourceUrl = url; }
      if (text.includes("submissions@opusoneproductions.com") && text.includes("talent buying")) {
        result.bookingContactName = "Opus One Productions: submissions@opusoneproductions.com";
        result.bookingContactSourceUrl = url;
        result.bookingRoute = url;
      }
    }
    if (sameVenue(venue, "Thunderbird Cafe") && new URL(url).hostname === "thunderbirdmusichall.com") {
      const cap = text.match(/Thunderbird Music Hall,? at ([\d,]+) capacity/i);
      if (cap) { result.venueCapacity = Number(cap[1].replace(/,/g,"")); result.capacitySourceUrl = url; }
      if (/Booking Contact Form/i.test(text) && /<iframe\b[^>]*src=["']https:\/\/docs\.google\.com\/forms\//i.test(html)) {
        result.bookingRoute = url;
        result.bookingContactName = "Official booking contact form";
        result.bookingContactSourceUrl = url;
      }
    }
    if (sameVenue(venue, "Johnny Brenda's") && ["https://www.songkick.com/venues/254-johnny-brendas", "https://www.jambase.com/venue/johnny-brendas"].includes(url) && /johnnybrendas\.com/i.test(html)) {
      const cap = text.match(/\bCapacity\s*:?\s*(\d{2,4})\b/i);
      if (cap && !result.venueCapacity) {result.venueCapacity=Number(cap[1]);result.capacitySourceUrl=url;}
    }
    if (sameVenue(venue, "Johnny Brenda's") && new URL(url).hostname === "johnnybrendas.com") {
      const cap = text.match(/\b(\d{2,4})[ -](?:person|capacity)\b/i);
      if (cap) { result.venueCapacity = Number(cap[1]); result.capacitySourceUrl = url; }
      const contact = text.match(/Head Talent Buyer\s*\|\s*([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})/i);
      if (contact) { result.bookingContactName = "Head Talent Buyer: " + contact[1]; result.bookingContactSourceUrl = url; result.bookingRoute = url; }
    }
  }
  return citedVenueEvidence(result, pages.map(p=>p.url));
}
export function venueEvidenceSources(e: VenueEvidence) {
  return [...new Set([e.capacitySourceUrl,e.bookingContactSourceUrl,e.bookingRoute].filter((v): v is string => Boolean(v)))];
}
export function hasCitedProfile(e: VenueEvidence, citations: string[]) {
  return venueEvidenceSources(e).some(url => citationMatches(url, citations));
}
