export const GIG_STATUSES = [
  "lead",
  "outreach",
  "negotiating",
  "hold",
  "booked",
  "completed",
  "passed",
] as const;

export type GigStatus = (typeof GIG_STATUSES)[number];

export const GIG_STATUS_LABEL: Record<GigStatus, string> = {
  lead: "Lead",
  outreach: "Outreach",
  negotiating: "Negotiating",
  hold: "Hold",
  booked: "Booked",
  completed: "Completed",
  passed: "Passed",
};

export const PERSON_ROLES = [
  "band",
  "booker",
  "promoter",
  "venue",
  "manager",
  "press",
  "other",
] as const;

export type PersonRole = (typeof PERSON_ROLES)[number];

export const PERSON_ROLE_LABEL: Record<PersonRole, string> = {
  band: "Band",
  booker: "Booker",
  promoter: "Promoter",
  venue: "Venue",
  manager: "Manager",
  press: "Press",
  other: "Other",
};

export const MONEY_TYPES = ["collected", "outstanding", "cost"] as const;
export type MoneyType = (typeof MONEY_TYPES)[number];

export const MONEY_TYPE_LABEL: Record<MoneyType, string> = {
  collected: "Collected",
  outstanding: "Outstanding",
  cost: "Cost",
};

export type Gig = {
  id: string;
  name: string;
  venue: string;
  city: string;
  date: string;
  fee: number;
  conf: number;
  status: GigStatus;
  notes: string;
};

export type Person = {
  id: string;
  name: string;
  role: PersonRole;
  city: string;
  contact: string;
  notes: string;
};

export type MoneyEntry = {
  id: string;
  type: MoneyType;
  amount: number;
  label: string;
  date: string;
  gigId?: string;
};

export type ChatRole = "user" | "ai";

export type SuggestedGig = {
  name: string;
  venue: string;
  city: string;
  date: string;
  fee: number;
  conf: number;
  reason: string;
  status?: GigStatus;
};

export type SuggestedPerson = {
  name: string;
  role: PersonRole;
  city: string;
  detail: string;
  reason: string;
};

export type ChatMessage = {
  id: string;
  role: ChatRole;
  text: string;
  source?: string;
  citations?: string[];
  gigs?: SuggestedGig[];
  people?: SuggestedPerson[];
  moves?: string[];
};

export type ArtistProfile = {
  artistName: string;
  city: string;
  genre: string;
  draw: string;
  feeTarget: number;
  notes: string;
};
