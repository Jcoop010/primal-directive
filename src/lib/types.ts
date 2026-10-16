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

export type Gig = import("./venue-evidence").VenueEvidence & {
  id: string;
  name: string;
  venue: string;
  city: string;
  date: string;
  fee: number;
  conf: number;
  status: GigStatus;
  notes: string;
  /** Research is not proof that the booking contact or opportunity is verified. */
  researchSourceUrl?: string;
  researchVerifiedAt?: string;
  outreachContact?: string;
  outreachLastContactedAt?: string;
  outreachNextFollowUp?: string;
  outreachNotes?: string;
  outreachReplyStatus?: "awaiting" | "interested" | "declined";
  outreachReplyReceivedAt?: string;
};

export type Person = {
  id: string;
  name: string;
  role: PersonRole;
  city: string;
  contact: string;
  notes: string;
  settlementSharePercent?: number;
};

export type MoneyEntry = {
  id: string;
  type: MoneyType;
  amount: number;
  label: string;
  date: string;
  gigId?: string;
  sourceOrderId?: string;
};

export type OperationalTaskStatus = "open" | "done";

export type OperationalTask = {
  id: string;
  title: string;
  description: string;
  category: "booking" | "advancing" | "promotion" | "merch" | "finance";
  gigId: string;
  dueDate: string;
  dueDateOverridden?: boolean;
  status: OperationalTaskStatus;
  sourceKey: string;
  createdAt: string;
};

export type ChatRole = "user" | "ai";

export type SuggestedGig = import("./venue-evidence").VenueEvidence & {
  sourceUrl?: string;
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
  sourceUrl?: string;
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
  reservePercent?: number;
};

export const MERCH_CATEGORIES = ["apparel", "music", "accessories", "stickers", "other"] as const;
export type MerchCategory = (typeof MERCH_CATEGORIES)[number];

export const MERCH_PAYMENT_METHODS = ["cash", "card", "digital", "other"] as const;
export type MerchPaymentMethod = (typeof MERCH_PAYMENT_METHODS)[number];

export type MerchProduct = {
  id: string;
  name: string;
  sku: string;
  category: MerchCategory;
  price: number;
  unitCost: number;
  stockOnHand: number;
  reorderAt: number;
  active: boolean;
  /** Variant attributes are captured per SKU so stock is tracked per size/color. */
  size?: string;
  color?: string;
  imageUrl?: string;
};

export type MerchSale = {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  unitCost: number;
  date: string;
  gigId?: string;
  paymentMethod: MerchPaymentMethod;
  notes: string;
  orderId?: string;
  channel?: "table" | "show" | "online";
  member?: string;
  discountAmount?: number;
  taxAmount?: number;
  processingFee?: number;
};

export type MerchOrderStatus = "paid" | "refunded" | "void";
export type MerchOrderLine = {
  productId: string;
  quantity: number;
  unitPrice: number;
  unitCost: number;
};
export type MerchOrder = {
  id: string;
  status: MerchOrderStatus;
  channel: "table" | "show" | "online";
  date: string;
  createdAt: string;
  lines: MerchOrderLine[];
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  processingFee: number;
  total: number;
  paymentMethod: MerchPaymentMethod;
  gigId?: string;
  member?: string;
  notes: string;
  providerReference?: string;
  refundedAmount?: number;
};

export type MerchInventoryAdjustment = {
  id: string;
  productId: string;
  quantityDelta: number;
  reason: "opening" | "restock" | "sale" | "return" | "comp" | "damage" | "correction";
  date: string;
  gigId?: string;
  note: string;
  sourceOrderId?: string;
};

export type MerchRefund = {
  id: string;
  orderId: string;
  date: string;
  amount: number;
  restocked: boolean;
  note: string;
};
