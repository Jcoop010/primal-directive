import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { askGrowthAdvisor } from "@/lib/ai";
import { fetchSourcePage } from "./source-fetch.server";
import { officialVenueEvidence, venueEvidenceSources, researchStatus, venueSourceLinks, type SourcePage } from "./venue-research";

export const researchSavedVenue = createServerFn({method:"POST"})
  .middleware([authMiddleware])
  .validator(z.object({venue:z.string().trim().min(1).max(200),city:z.string().trim().max(200),sourceUrls:z.array(z.string().url().max(2000)).max(3).optional()}))
  .handler(async ({data}) => {
    const pages: SourcePage[] = [];
    const attempted = new Set<string>();
    async function readSources(urls: string[]) {
      const selected = [...new Set(urls)].filter(url => !attempted.has(url)).slice(0, Math.max(0, 6 - attempted.size));
      selected.forEach(url => attempted.add(url));
      const fetched = await Promise.all(selected.map(url => fetchSourcePage(url)));
      pages.push(...fetched.filter((page): page is SourcePage => page !== null));
    }
    await readSources(data.sourceUrls || []);
    await readSources(pages.flatMap(venueSourceLinks));
    let evidence = officialVenueEvidence(data.venue, pages, data.city);
    if (researchStatus(evidence) === "Verified") return {evidence,citations:venueEvidenceSources(evidence),message:"Venue facts corroborated in fetched source pages. Review the room, layout and current submission requirements."};
    let citations = venueEvidenceSources(evidence);
    let providerUnavailable = false;
    try {
      const response = await askGrowthAdvisor({data:{
        message:`Research this exact saved music venue: ${data.venue}, ${data.city}. Find the official website, booking submission route and source-supported room capacity. Return exact accessible HTTPS source URLs. Never invent contacts, dates, availability or terms.`,
        targetVenue:data.venue,targetCity:data.city,mode:"research",history:[],context:"Enrich an existing saved venue only. No new gigs or communications."
      }});
      if (!response.ok) throw new Error(response.error);
      citations = [...new Set([...citations, ...response.citations])];
      await readSources(response.citations);
      evidence = officialVenueEvidence(data.venue, pages, data.city);
      providerUnavailable = !response.citations.length;
    } catch { providerUnavailable = true; }
    const supported = venueEvidenceSources(evidence);
    return {evidence,citations:[...new Set([...citations,...supported])],message:supported.length
      ? "Some venue facts were corroborated in fetched pages. Missing or ambiguous claims remain unverified."
      : providerUnavailable
        ? "Live research is unavailable. Existing saved evidence was preserved; no current venue facts were verified. Add an official source or retry later."
        : "Research returned source links, but no venue facts could be independently corroborated. Review the links; contacts, capacity and booking route remain unverified."};
  });
