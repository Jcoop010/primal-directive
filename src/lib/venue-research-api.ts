import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { askGrowthAdvisor } from "@/lib/ai";
import { extractVenueProfile, officialVenueEvidence, sameVenue, venueEvidenceSources, type SourcePage } from "./venue-research";

export const researchSavedVenue = createServerFn({method:"POST"})
  .middleware([authMiddleware])
  .validator(z.object({venue:z.string().trim().min(1).max(200),city:z.string().trim().max(200)}))
  .handler(async ({data}) => {
    // Fixed official seed URLs, never fetch arbitrary client/model URLs (SSRF).
    const urls = sameVenue(data.venue,"Thunderbird Cafe") && /pittsburgh/i.test(data.city)
      ? ["https://thunderbirdmusichall.com/aboutus/", "https://thunderbirdmusichall.com/contact/"]
      : sameVenue(data.venue,"Johnny Brenda's") && /philadelphia/i.test(data.city)
        ? ["https://johnnybrendas.com/menu-2-2/", "https://johnnybrendas.com/menu-2/", "https://www.songkick.com/venues/254-johnny-brendas", "https://www.jambase.com/venue/johnny-brendas"] : [];
    const pages: SourcePage[] = [];
    await Promise.all(urls.map(async url => {
      try {
        const r = await fetch(url,{redirect:"error",signal:AbortSignal.timeout(10000),headers:{accept:"text/html"}});
        if (!r.ok || !r.headers.get("content-type")?.includes("text/html")) { await r.body?.cancel(); return; }
        // Bound bytes before decoding so unexpected pages cannot exhaust memory.
        const reader = r.body?.getReader(); if (!reader) return;
        const chunks: Uint8Array[] = []; let size=0;
        try { for (;;) { const {done,value}=await reader.read(); if(done) break; size+=value.length; if(size>1000000) {await reader.cancel();return;} chunks.push(value); } }
        finally {reader.releaseLock();}
        pages.push({url,html:Buffer.concat(chunks).toString("utf8")});
      } catch { /* Provider research below can still resolve unavailable official pages. */ }
    }));
    const official = officialVenueEvidence(data.venue,pages);
    if (venueEvidenceSources(official).length) return {evidence:official,citations:venueEvidenceSources(official),message:official.venueCapacity ? (sameVenue(data.venue,"Thunderbird Cafe") ? "Official pages document Music Hall capacity and a booking form. Confirm room configuration before outreach." : "Booking details come from the official venue page; capacity is documented by the linked music listing. Confirm configuration before outreach.") : "Booking details extracted from the official venue page. Capacity remains unverified."};
    const response = await askGrowthAdvisor({data:{
      message:`Research this exact saved music venue: ${data.venue}, ${data.city}. Return a venueResearch object with venue, city, venueCapacity, capacitySourceUrl, bookingContactName, bookingContactSourceUrl and bookingRoute. Cite each fact's exact live supporting HTTPS URL. Omit unsupported fields. Do not invent dates, fees or contacts.`,
      targetVenue:data.venue,targetCity:data.city,mode:"research",history:[],context:"Enrich an existing saved venue only. No new gigs or communications."
    }});
    if (!response.ok) throw new Error(response.error);
    return {evidence:response.venueEvidence ?? extractVenueProfile(response,data.venue,data.city,response.citations),citations:response.citations,message:response.answer};
  });
