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
    // Dedicated evidence is bound to the requested venue by the server.
    if (value !== record.venueEvidence && !sameVenue(p.venue || p.name || "", venue)) continue;
    if (p.city && city && venueKey(p.city.split(",")[0]) !== venueKey(city.split(",")[0])) continue;
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
/** Extract explicit claims from fetched pages. No venue-specific domains, figures or contacts. */
export function officialVenueEvidence(venue: string, pages: SourcePage[], city = ""): VenueEvidence {
  const mentions = (text: string) => {
    const key = " " + venueKey(text) + " ";
    const names = sameVenue(venue, "Thunderbird Cafe") ? [venue, "Thunderbird Cafe", "Thunderbird Cafe and Music Hall", "Thunderbird Music Hall"] : [venue];
    return names.some(name => key.includes(" " + venueKey(name) + " "));
  };
  const identityHosts = new Set(pages.filter(p => {
    const text = pageText(p.html);
    return mentions(text) && (!city || venueKey(text).includes(venueKey(city.split(",")[0])));
  }).map(p => new URL(p.url).hostname));
  const result: VenueEvidence = {};
  const capacities: { value: number; url: string }[] = [];
  for (const {url, html} of pages) {
    if (!identityHosts.has(new URL(url).hostname)) continue;
    const text = pageText(html);
    for (const match of text.matchAll(/\b([\d,]+)[-– ](?:person|guest|seat|capacity)\b|\bcapacity\s*(?:of|:|-)?\s*([\d,]+)\b|\bat\s+([\d,]+)\s+capacity\b/gi)) {
      const value = Number((match[1] || match[2] || match[3]).replace(/,/g, ""));
      if (Number.isInteger(value) && value > 0 && value <= 1000000) capacities.push({ value, url });
    }
    const contact = text.match(/(Head Talent Buyer|Talent Buying)[^@]{0,100}?([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})/i) || text.match(/(Booking(?:\s+(?:inquiries|contact|submissions))?|Submissions)[^@]{0,100}?([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})/i);
    if (contact) { result.bookingContactName = contact[1] + ": " + contact[2]; result.bookingContactSourceUrl = url; result.bookingRoute = url; }
    if (/booking\s+(?:contact\s+|submission\s+)?form/i.test(text) && /<(?:form\b|iframe\b[^>]*src=["']https:\/\/docs\.google\.com\/forms\/)/i.test(html)) {
      result.bookingContactName = "Booking contact form"; result.bookingContactSourceUrl = url; result.bookingRoute = url;
    }
  }
  // Multiple room/layout figures need human review; choosing the first would invent certainty.
  if (new Set(capacities.map(c => c.value)).size === 1) { result.venueCapacity = capacities[0].value; result.capacitySourceUrl = capacities[0].url; }
  return citedVenueEvidence(result, pages.map(p=>p.url));
}

/** Follow only relevant links on the same website; every fetch is independently guarded. */
export function venueSourceLinks(page: SourcePage): string[] {
  const origin = new URL(page.url).origin;
  const links: string[] = [];
  for (const match of page.html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    try {
      const url = new URL(match[1].replace(/&amp;/g, "&"), page.url);
      if (url.protocol === "https:" && url.origin === origin && /booking|contact|about|venue|rental/i.test(url.pathname + " " + pageText(match[2]))) links.push(url.href);
    } catch { /* Ignore malformed links. */ }
  }
  return [...new Set(links)].slice(0, 3);
}
export function venueEvidenceSources(e: VenueEvidence) {
  return [...new Set([e.capacitySourceUrl,e.bookingContactSourceUrl,e.bookingRoute].filter((v): v is string => Boolean(v)))];
}
export function hasCitedProfile(e: VenueEvidence, citations: string[]) {
  return venueEvidenceSources(e).some(url => citationMatches(url, citations));
}
