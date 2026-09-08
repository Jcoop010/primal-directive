import type { SuggestedGig, SuggestedPerson } from "@/lib/types";

export type LocalAdvice = {
  answer: string;
  source: string;
  gigs: SuggestedGig[];
  people: SuggestedPerson[];
  moves: string[];
};

function shift(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function localGrowthAdvice(message: string, context: string): LocalAdvice {
  const q = message.toLowerCase();
  const home = pick(context, /HOME:\s*(.+)/) || "your home city";
  const artist = pick(context, /ARTIST:\s*(.+)/) || "the band";
  const genre = pick(context, /GENRE:\s*(.+)/) || "your sound";
  const draw = pick(context, /TYPICAL DRAW:\s*(.+)/) || "your current draw";
  const fee = pick(context, /FEE TARGET:\s*(.+)/) || "your fee target";

  if (/(bill|support|3-band|three band|lineup|share a bill)/.test(q)) {
    return billAdvice(artist, home, genre, draw);
  }
  if (/(rout|northeast|tour|cluster|drive)/.test(q)) {
    return routingAdvice(artist, home);
  }
  if (/(post|content|tiktok|instagram|social|video)/.test(q)) {
    return contentAdvice(artist, home);
  }
  if (/(venue|room|book|gig|guarantee|club)/.test(q)) {
    return venueAdvice(artist, home, draw, fee);
  }
  return drawAdvice(artist, home, genre, draw, fee);
}

function drawAdvice(
  artist: string,
  home: string,
  genre: string,
  draw: string,
  fee: string,
): LocalAdvice {
  return {
    source: "PRIMAL DIRECTIVE PLAYBOOK",
    answer: `${artist} will not grow a ${draw} ${genre} draw by chasing bigger rooms. Own ${home} first.

Play the 100–250 cap rooms on a cadence — monthly, not quarterly — so the same faces see you twice. Club Cafe, Thunderbird, and a walk-up like Brillobox are the right size. Mr. Smalls is a stretch hold: it converts when you walk in with a finished bill, not a hope.

The next 90 days: (1) convert the Club Cafe remainder into cash this week, (2) lock a Copper Wires co-bill in Morgantown and reverse-host them in Pittsburgh, (3) treat Purple Fiddle as a merch + email-capture night, not a one-off mountain story.

Fee target ${fee} is realistic for a packed 150-cap, not an empty 400-cap. Grow the list, then the room.`,
    gigs: [
      {
        name: "Weeknight hometown cadence",
        venue: "Brillobox",
        city: "Pittsburgh, PA",
        date: shift(21),
        fee: 500,
        conf: 0.45,
        reason: "Walk-up 100-cap. Use it to rehearse a monthly hometown slot.",
        status: "lead",
      },
      {
        name: "Reverse-host Copper Wires",
        venue: "Thunderbird Cafe",
        city: "Pittsburgh, PA",
        date: shift(35),
        fee: 750,
        conf: 0.4,
        reason: "Pay back the Morgantown routing night with a Pittsburgh bill.",
        status: "lead",
      },
    ],
    people: [
      {
        name: "The Copper Wires",
        role: "band",
        city: "Morgantown, WV",
        detail: "Jam-adjacent co-bill",
        reason: "Easy overnight and overlapping audience.",
      },
    ],
    moves: [
      "Send Maya Chen a one-sheet + 3 live videos before Club Cafe.",
      "Text Copper Wires to lock a two-city swap.",
      "Put a list-capture on the Purple Fiddle merch table.",
    ],
  };
}

function billAdvice(
  artist: string,
  home: string,
  genre: string,
  draw: string,
): LocalAdvice {
  return {
    source: "PRIMAL DIRECTIVE PLAYBOOK",
    answer: `A 250-cap bill for ${artist} (${genre}, draw ${draw}, home ${home}) should stack audiences, not friends.

1. ${artist} — hometown headliner or high support.
2. The Copper Wires (Morgantown) — jam-adjacent, overlapping fans, makes the WV routing real.
3. Hollow Oak (Columbus) — americana four-piece that pulls 150–250. They make the Ohio jump worth the van.

Do not put three local same-scene bands on one bill. You cannibalize one crowd. Offer this package to Dana Ortiz at Mr. Smalls so the negotiating hold has a reason to become a guarantee.`,
    gigs: [
      {
        name: "Packaged 3-band bill",
        venue: "Mr. Smalls Theatre",
        city: "Millvale, PA",
        date: shift(29),
        fee: 1500,
        conf: 0.6,
        reason: "Walk in with Copper Wires + Hollow Oak already penciled.",
        status: "negotiating",
      },
    ],
    people: [
      {
        name: "Dana Ortiz",
        role: "booker",
        city: "Millvale, PA",
        detail: "Mr. Smalls",
        reason: "Responds to a finished bill, not a lone ask.",
      },
      {
        name: "Hollow Oak",
        role: "band",
        city: "Columbus, OH",
        detail: "Americana four-piece",
        reason: "Fills the 150–250 gap and opens Ohio routing.",
      },
    ],
    moves: [
      "Email Dana the three-band package with dates and draws.",
      "Ask Hollow Oak for two Ohio dates around the Pittsburgh night.",
    ],
  };
}

function routingAdvice(artist: string, home: string): LocalAdvice {
  return {
    source: "PRIMAL DIRECTIVE PLAYBOOK",
    answer: `Do not drive six hours from ${home} for Johnny Brenda's as a one-off. ${artist} needs a cluster.

Northeast cluster (3–4 nights):
• Philadelphia — Johnny Brenda's (already in the pipeline)
• Baltimore — The Ottobar or a 150–200 cap room
• One Hudson Valley / NYC support if a bill appears — otherwise skip it

West/south cluster:
• Morgantown — 123 Pleasant Street (already in outreach)
• Thomas, WV — Purple Fiddle (booked, merch-heavy)
• Columbus — attach Hollow Oak

Rule: two rooms within 3 hours or it does not leave the driveway. Ask Stage Left Booking for a Philly week only if you can add a second night.`,
    gigs: [
      {
        name: "Baltimore cluster night",
        venue: "The Ottobar",
        city: "Baltimore, MD",
        date: shift(64),
        fee: 900,
        conf: 0.3,
        reason: "Pairs with Johnny Brenda's so Philly is not a one-off.",
        status: "lead",
      },
    ],
    people: [
      {
        name: "Stage Left Booking",
        role: "promoter",
        city: "Philadelphia, PA",
        detail: "Philly / NYC / Hudson",
        reason: "Only useful if you offer 2–3 dates, not one.",
      },
    ],
    moves: [
      "Hold Johnny Brenda's only if a second Mid-Atlantic night is real.",
      "Finish the Morgantown outreach so the WV weekend is a loop.",
    ],
  };
}

function contentAdvice(artist: string, home: string): LocalAdvice {
  return {
    source: "PRIMAL DIRECTIVE PLAYBOOK",
    answer: `Content that sells tickets for ${artist} is footage of rooms people can actually walk into in ${home} — not studio aesthetic.

This month:
• Purple Fiddle (booked) — 3 vertical clips the night of, geotag Thomas + Pittsburgh. Ask people to tap for the Club Cafe date.
• Club Cafe (booked) — one 45-second live song, one merch-table talk-to-camera: “we’re back here on [date], bring one friend.”
• One-sheet video for Dana Ortiz / Maya Chen: 3 clips, 60 seconds, no preamble.

Kill anything that does not point at a date, a list, or a merch SKU. Streams are a souvenir; the list is the business.`,
    gigs: [],
    people: [
      {
        name: "Maya Chen",
        role: "booker",
        city: "Pittsburgh, PA",
        detail: "Club Cafe",
        reason: "She books off a one-sheet + recent live video, not DMs.",
      },
    ],
    moves: [
      "Make a 60-second one-sheet video before the next booker email.",
      "Put a QR to the email list on the merch table this week.",
    ],
  };
}

function venueAdvice(
  artist: string,
  home: string,
  draw: string,
  fee: string,
): LocalAdvice {
  return {
    source: "PRIMAL DIRECTIVE PLAYBOOK",
    answer: `Rooms that fit ${artist} at draw ${draw} out of ${home}:

Right now: Club Cafe, Thunderbird, Brillobox, 123 Pleasant Street, Purple Fiddle.
Next: Mr. Smalls only with a packaged bill. Johnny Brenda's only inside a cluster.

Guarantees: ${fee} is the hometown target. Door deals are fine on weeknights if merch is strong. Do not take a $200 “exposure” night in a 400-cap.

Follow up the Thunderbird lead with Eli this week. A weeknight showcase is how ${home} draw actually compounds.`,
    gigs: [
      {
        name: "Weeknight showcase follow-up",
        venue: "Thunderbird Cafe",
        city: "Pittsburgh, PA",
        date: shift(45),
        fee: 700,
        conf: 0.4,
        reason: "Eli’s showcase slot — send a one-sheet, not a generic EPK.",
        status: "outreach",
      },
    ],
    people: [
      {
        name: "Eli Brooks",
        role: "promoter",
        city: "Pittsburgh, PA",
        detail: "Weeknight showcases",
        reason: "The shortest path to a monthly hometown slot.",
      },
    ],
    moves: [
      `Email Eli a one-sheet this week asking for a month-out showcase.`,
      "Keep Mr. Smalls in negotiating until the 3-band package is attached.",
    ],
  };
}

function pick(context: string, re: RegExp) {
  return context.match(re)?.[1]?.trim();
}
