import { uid } from "@/lib/utils";
import { addDays, toIsoDay } from "@/lib/format";
import type { ArtistProfile, Gig, MoneyEntry, Person } from "@/lib/types";

export function createSeed() {
  const today = new Date();
  const gigs: Gig[] = [
    {
      id: uid(),
      name: "Saturday night support",
      venue: "Club Cafe",
      city: "Pittsburgh, PA",
      date: toIsoDay(addDays(today, 14)),
      fee: 900,
      conf: 0.9,
      status: "booked",
      notes: "Deposit received. Load-in 5:30. 45-minute set.",
    },
    {
      id: uid(),
      name: "Mr. Smalls Theatre hold",
      venue: "Mr. Smalls Theatre",
      city: "Millvale, PA",
      date: toIsoDay(addDays(today, 29)),
      fee: 1500,
      conf: 0.55,
      status: "negotiating",
      notes: "Waiting on door split vs. $1,500 guarantee. Need a second support.",
    },
    {
      id: uid(),
      name: "Weeknight showcase",
      venue: "Thunderbird Cafe",
      city: "Pittsburgh, PA",
      date: toIsoDay(addDays(today, 45)),
      fee: 700,
      conf: 0.3,
      status: "lead",
      notes: "Good local-draw room. Follow up with Eli.",
    },
    {
      id: uid(),
      name: "Morgantown routing night",
      venue: "123 Pleasant Street",
      city: "Morgantown, WV",
      date: toIsoDay(addDays(today, 40)),
      fee: 800,
      conf: 0.4,
      status: "outreach",
      notes: "Pairs with a Copper Wires bill. Van overnight is cheap.",
    },
    {
      id: uid(),
      name: "Philly jump",
      venue: "Johnny Brenda's",
      city: "Philadelphia, PA",
      date: toIsoDay(addDays(today, 63)),
      fee: 1100,
      conf: 0.25,
      status: "lead",
      notes: "Needs a Northeast cluster — don't run this as a one-off.",
    },
    {
      id: uid(),
      name: "Mountain room",
      venue: "The Purple Fiddle",
      city: "Thomas, WV",
      date: toIsoDay(addDays(today, 8)),
      fee: 650,
      conf: 0.95,
      status: "booked",
      notes: "Merch-heavy room. Bring vinyl and stickers.",
    },
  ];

  const people: Person[] = [
    {
      id: uid(),
      name: "Maya Chen",
      role: "booker",
      city: "Pittsburgh, PA",
      contact: "maya@clubcafe.example",
      notes: "Books Club Cafe. Prefers a one-sheet + 3 recent videos.",
    },
    {
      id: uid(),
      name: "Dana Ortiz",
      role: "booker",
      city: "Millvale, PA",
      contact: "dana@mrsmalls.example",
      notes: "Mr. Smalls. Responds faster if you propose the full bill.",
    },
    {
      id: uid(),
      name: "Eli Brooks",
      role: "promoter",
      city: "Pittsburgh, PA",
      contact: "eli@stageleft.example",
      notes: "Runs weeknight showcases. Good for growing local draw.",
    },
    {
      id: uid(),
      name: "The Copper Wires",
      role: "band",
      city: "Morgantown, WV",
      contact: "copperwires.band",
      notes: "Jam-adjacent. Easy overnight routing from Pittsburgh.",
    },
    {
      id: uid(),
      name: "Hollow Oak",
      role: "band",
      city: "Columbus, OH",
      contact: "hollowoak.band",
      notes: "Americana four-piece. Strong 150–250 cap rooms.",
    },
    {
      id: uid(),
      name: "Stage Left Booking",
      role: "promoter",
      city: "Philadelphia, PA",
      contact: "hello@stageleft.example",
      notes: "Can cluster Philly / NYC / Hudson Valley if you have 3 dates.",
    },
  ];

  const money: MoneyEntry[] = [
    {
      id: uid(),
      type: "collected",
      amount: 1500,
      label: "River festival deposit",
      date: toIsoDay(addDays(today, -12)),
    },
    {
      id: uid(),
      type: "collected",
      amount: 420,
      label: "Merch — last Saturday",
      date: toIsoDay(addDays(today, -6)),
    },
    {
      id: uid(),
      type: "collected",
      amount: 300,
      label: "Club Cafe deposit",
      date: toIsoDay(addDays(today, -2)),
      gigId: gigs[0]?.id,
    },
    {
      id: uid(),
      type: "collected",
      amount: 64,
      label: "Streaming payout",
      date: toIsoDay(addDays(today, -1)),
    },
    {
      id: uid(),
      type: "outstanding",
      amount: 600,
      label: "Club Cafe remainder",
      date: gigs[0]?.date ?? toIsoDay(today),
      gigId: gigs[0]?.id,
    },
    {
      id: uid(),
      type: "outstanding",
      amount: 650,
      label: "Purple Fiddle guarantee",
      date: gigs[5]?.date ?? toIsoDay(today),
      gigId: gigs[5]?.id,
    },
    {
      id: uid(),
      type: "cost",
      amount: 200,
      label: "Rehearsal space — August",
      date: toIsoDay(addDays(today, -20)),
    },
    {
      id: uid(),
      type: "cost",
      amount: 380,
      label: "Van repair",
      date: toIsoDay(addDays(today, -9)),
    },
    {
      id: uid(),
      type: "cost",
      amount: 85,
      label: "Gas — Morgantown scout",
      date: toIsoDay(addDays(today, -4)),
    },
  ];

  const profile: ArtistProfile = {
    artistName: "River Fold",
    city: "Pittsburgh, PA",
    genre: "Americana / jam",
    draw: "80–150",
    feeTarget: 1000,
    notes:
      "Home base Pittsburgh. Grow local draw, then route WV / OH / PA / Northeast. Merch and email list matter more than vanity streams.",
  };

  return { gigs, people, money, profile };
}

export const WELCOME_TEXT = `I’m your growth advisor. I search the live web for rooms, bills, press, playlisting, and what’s actually working for bands at your level.

Tell me a market, a date window, a fee target, or a growth problem — local draw, content, routing, guarantees, or who to share a bill with. I’ll come back with a next move you can run this week.`;
