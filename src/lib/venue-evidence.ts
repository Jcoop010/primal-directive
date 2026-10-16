import { z } from "zod";
const link = z
  .string()
  .url()
  .max(2000)
  .refine((v) => v.startsWith("https://"), "Use HTTPS sources.")
  .optional();
export const venueEvidenceShape = {
  venueCapacity: z.number().int().positive().max(1000000).optional(),
  capacitySourceUrl: link,
  bookingRoute: link,
  bookingContactName: z.string().max(200).optional(),
  bookingContactSourceUrl: link,
};
export type VenueEvidence = z.infer<z.ZodObject<typeof venueEvidenceShape>>;
export function evidencePage(value: string | undefined) {
  try {
    const url = new URL(value ?? "");
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      /^(localhost|127\.|10\.|192\.168\.|\[)/i.test(url.hostname)
    )
      return null;
    for (const key of [...url.searchParams.keys()])
      if (/^utm_/i.test(key) || ["fbclid", "gclid"].includes(key)) url.searchParams.delete(key);
    url.searchParams.sort();
    return (
      url.origin.toLowerCase() +
      url.pathname.replace(/\/+$/, "") +
      (url.searchParams.size ? "?" + url.searchParams.toString() : "")
    );
  } catch {
    return null;
  }
}
export function citationMatches(value: string | undefined, citations: string[]) {
  const page = evidencePage(value);
  return page !== null && citations.some((c) => evidencePage(c) === page);
}
export function citedVenueEvidence(input: VenueEvidence, citations: string[]): VenueEvidence {
  const capacity =
    citationMatches(input.capacitySourceUrl, citations) &&
    Number.isInteger(input.venueCapacity) &&
    input.venueCapacity! > 0;
  const contact = citationMatches(input.bookingContactSourceUrl, citations);
  return {
    ...(capacity
      ? { venueCapacity: input.venueCapacity, capacitySourceUrl: input.capacitySourceUrl }
      : {}),
    ...(contact
      ? {
          bookingContactName: input.bookingContactName,
          bookingContactSourceUrl: input.bookingContactSourceUrl,
          bookingRoute: citationMatches(input.bookingRoute, citations)
            ? input.bookingRoute
            : undefined,
        }
      : {}),
  };
}
