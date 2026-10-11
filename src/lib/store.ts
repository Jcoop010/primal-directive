import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createSeed, WELCOME_TEXT } from "@/lib/seed";
import { uid } from "@/lib/utils";
import { recordMerchSale as applyMerchSale, restockMerch } from "@/lib/merch-ops";
import type {
  ArtistProfile,
  ChatMessage,
  Gig,
  MoneyEntry,
  MerchProduct,
  MerchSale,
  Person,
  SuggestedGig,
  SuggestedPerson,
} from "@/lib/types";

type Composer = {
  gigOpen: boolean;
  personOpen: boolean;
  moneyOpen: boolean;
  profileOpen: boolean;
  commandOpen: boolean;
  editingGigId?: string;
  editingPersonId?: string;
  editingMoneyId?: string;
};

type State = {
  gigs: Gig[];
  people: Person[];
  money: MoneyEntry[];
  merchProducts: MerchProduct[];
  merchSales: MerchSale[];
  chat: ChatMessage[];
  profile: ArtistProfile;
  composer: Composer;
};

type Actions = {
  addGig: (gig: Omit<Gig, "id">) => string;
  updateGig: (id: string, patch: Partial<Gig>) => void;
  removeGig: (id: string) => void;
  addPerson: (person: Omit<Person, "id">) => string;
  updatePerson: (id: string, patch: Partial<Person>) => void;
  removePerson: (id: string) => void;
  addMoney: (entry: Omit<MoneyEntry, "id">) => string;
  updateMoney: (id: string, patch: Partial<MoneyEntry>) => void;
  removeMoney: (id: string) => void;
  addMerchProduct: (product: Omit<MerchProduct, "id">) => string;
  updateMerchProduct: (id: string, patch: Partial<MerchProduct>) => void;
  restockMerchProduct: (id: string, quantity: number) => void;
  recordMerchSale: (sale: Omit<MerchSale, "id">) => string;
  updateProfile: (patch: Partial<ArtistProfile>) => void;
  addUserMessage: (text: string) => void;
  addAiMessage: (msg: Omit<ChatMessage, "id" | "role">) => void;
  clearChat: () => void;
  ingestSuggestedGig: (g: SuggestedGig) => void;
  ingestSuggestedPerson: (p: SuggestedPerson) => void;
  setComposer: (patch: Partial<Composer>) => void;
  openGig: (id?: string) => void;
  openPerson: (id?: string) => void;
  openMoney: (id?: string) => void;
  resetSample: () => void;
  clearAll: () => void;
};

const emptyComposer: Composer = {
  gigOpen: false,
  personOpen: false,
  moneyOpen: false,
  profileOpen: false,
  commandOpen: false,
};

function welcomeChat(): ChatMessage[] {
  return [
    {
      id: uid(),
      role: "ai",
      text: WELCOME_TEXT,
      source: "PRIMAL DIRECTIVE",
    },
  ];
}

function fresh(): Omit<State, "composer"> & { composer: Composer } {
  const seed = createSeed();
  return {
    ...seed,
    merchProducts: [],
    merchSales: [],
    chat: welcomeChat(),
    composer: { ...emptyComposer },
  };
}

export const useMusician = create<State & Actions>()(
  persist(
    (set) => ({
      ...fresh(),
      addGig: (gig) => {
        const id = uid();
        set((s) => ({ gigs: [{ ...gig, id }, ...s.gigs] }));
        return id;
      },
      updateGig: (id, patch) =>
        set((s) => ({
          gigs: s.gigs.map((g) => (g.id === id ? { ...g, ...patch } : g)),
        })),
      removeGig: (id) =>
        set((s) => ({
          gigs: s.gigs.filter((g) => g.id !== id),
          money: s.money.map((m) =>
            m.gigId === id ? { ...m, gigId: undefined } : m,
          ),
        })),
      addPerson: (person) => {
        const id = uid();
        set((s) => ({ people: [{ ...person, id }, ...s.people] }));
        return id;
      },
      updatePerson: (id, patch) =>
        set((s) => ({
          people: s.people.map((p) => (p.id === id ? { ...p, ...patch } : p)),
        })),
      removePerson: (id) =>
        set((s) => ({ people: s.people.filter((p) => p.id !== id) })),
      addMoney: (entry) => {
        const id = uid();
        set((s) => ({ money: [{ ...entry, id }, ...s.money] }));
        return id;
      },
      updateMoney: (id, patch) =>
        set((s) => ({
          money: s.money.map((m) => (m.id === id ? { ...m, ...patch } : m)),
        })),
      removeMoney: (id) =>
        set((s) => ({ money: s.money.filter((m) => m.id !== id) })),
      addMerchProduct: (product) => {
        const id = uid();
        set((s) => ({ merchProducts: [{ ...product, id }, ...s.merchProducts] }));
        return id;
      },
      updateMerchProduct: (id, patch) =>
        set((s) => ({
          merchProducts: s.merchProducts.map((product) =>
            product.id === id ? { ...product, ...patch } : product,
          ),
        })),
      restockMerchProduct: (id, quantity) =>
        set((s) => ({ merchProducts: restockMerch(s.merchProducts, id, quantity) })),
      recordMerchSale: (sale) => {
        const id = uid();
        set((s) => {
          const result = applyMerchSale(s.merchProducts, s.merchSales, sale, id);
          const product = s.merchProducts.find((item) => item.id === sale.productId);
          if (!product) throw new Error("Product not found while recording sale.");
          // Keep the sale, inventory movement, and cash ledger entry in one state update.
          // This prevents a successful sale from being saved without its corresponding revenue record.
          const ledgerEntry: MoneyEntry = {
            id: uid(),
            type: "collected",
            amount: sale.quantity * sale.unitPrice,
            label: `Merch: ${product.name} × ${sale.quantity}`,
            date: sale.date,
            gigId: sale.gigId,
          };
          return {
            merchProducts: result.products,
            merchSales: result.sales,
            money: [ledgerEntry, ...s.money],
          };
        });
        return id;
      },
      updateProfile: (patch) =>
        set((s) => ({ profile: { ...s.profile, ...patch } })),
      addUserMessage: (text) =>
        set((s) => ({
          chat: [...s.chat, { id: uid(), role: "user", text }],
        })),
      addAiMessage: (msg) =>
        set((s) => ({
          chat: [...s.chat, { id: uid(), role: "ai", ...msg }],
        })),
      clearChat: () => set({ chat: welcomeChat() }),
      ingestSuggestedGig: (g) =>
        set((s) => {
          const duplicate = s.gigs.some(
            (existing) =>
              existing.name.trim().toLowerCase() === g.name.trim().toLowerCase() &&
              (existing.venue || "").trim().toLowerCase() ===
                (g.venue || "").trim().toLowerCase() &&
              (existing.date || "") === (g.date || ""),
          );
          if (duplicate) return s;
          return {
            gigs: [
              {
                id: uid(),
                name: g.name,
                venue: g.venue,
                city: g.city,
                date: g.date,
                fee: g.fee,
                conf: g.conf,
                status: g.status ?? "lead",
                notes: g.reason,
              },
              ...s.gigs,
            ],
          };
        }),
      ingestSuggestedPerson: (p) =>
        set((s) => {
          const duplicate = s.people.some(
            (existing) =>
              existing.name.trim().toLowerCase() === p.name.trim().toLowerCase() &&
              existing.role.trim().toLowerCase() === p.role.trim().toLowerCase() &&
              existing.city.trim().toLowerCase() === p.city.trim().toLowerCase(),
          );
          if (duplicate) return s;
          return {
            people: [
              {
                id: uid(),
                name: p.name,
                role: p.role,
                city: p.city,
                contact: "",
                notes: [p.detail, p.reason].filter(Boolean).join(" — "),
              },
              ...s.people,
            ],
          };
        }),
      setComposer: (patch) =>
        set((s) => ({ composer: { ...s.composer, ...patch } })),
      openGig: (id) =>
        set((s) => ({
          composer: {
            ...s.composer,
            gigOpen: true,
            commandOpen: false,
            editingGigId: id,
          },
        })),
      openPerson: (id) =>
        set((s) => ({
          composer: {
            ...s.composer,
            personOpen: true,
            commandOpen: false,
            editingPersonId: id,
          },
        })),
      openMoney: (id) =>
        set((s) => ({
          composer: {
            ...s.composer,
            moneyOpen: true,
            commandOpen: false,
            editingMoneyId: id,
          },
        })),
      resetSample: () => set(fresh()),
      clearAll: () =>
        set({
          gigs: [],
          people: [],
          money: [],
          merchProducts: [],
          merchSales: [],
          chat: welcomeChat(),
          composer: { ...emptyComposer },
        }),
    }),
    {
      name: "musician-os-v1",
      partialize: (s) => ({
        gigs: s.gigs,
        people: s.people,
        money: s.money,
        merchProducts: s.merchProducts,
        merchSales: s.merchSales,
        chat: s.chat,
        profile: s.profile,
      }),
    },
  ),
);

export function sumMoney(
  entries: MoneyEntry[],
  type: MoneyEntry["type"],
) {
  return entries
    .filter((x) => x.type === type)
    .reduce((a, x) => a + (Number(x.amount) || 0), 0);
}

export function pipelineGigs(gigs: Gig[]) {
  return gigs.filter((g) => g.status !== "completed" && g.status !== "passed");
}

export function pipelineValue(gigs: Gig[]) {
  return pipelineGigs(gigs).reduce((a, g) => a + (Number(g.fee) || 0), 0);
}

export function weightedValue(gigs: Gig[]) {
  return pipelineGigs(gigs).reduce(
    (a, g) => a + (Number(g.fee) || 0) * (Number(g.conf) || 0),
    0,
  );
}

export function buildAdvisorContext() {
  const s = useMusician.getState();
  const collected = sumMoney(s.money, "collected");
  const outstanding = sumMoney(s.money, "outstanding");
  const costs = sumMoney(s.money, "cost");
  const profit = collected - costs;
  const merchRevenue = s.merchSales.reduce((sum, sale) => sum + sale.quantity * sale.unitPrice, 0);
  const merchGrossProfit = s.merchSales.reduce((sum, sale) => sum + sale.quantity * (sale.unitPrice - sale.unitCost), 0);
  const merchUnitsSold = s.merchSales.reduce((sum, sale) => sum + sale.quantity, 0);
  const lowStock = s.merchProducts.filter((product) => product.active && product.stockOnHand <= product.reorderAt);
  const merchLines = s.merchProducts
    .slice(0, 15)
    .map((product) => `- ${product.name} [${product.sku || "no SKU"}] | stock ${product.stockOnHand} | price ${product.price} | cost ${product.unitCost}${product.active && product.stockOnHand <= product.reorderAt ? " | REORDER" : ""}`)
    .join("\\n");
  const gigLines = s.gigs
    .slice(0, 12)
    .map(
      (g) =>
        `- ${g.name} @ ${g.venue}, ${g.city} | ${g.date || "TBD"} | $${g.fee} | ${g.status} | conf ${Math.round(g.conf * 100)}% | ${g.notes}`,
    )
    .join("\n");
  const peopleLines = s.people
    .slice(0, 12)
    .map((p) => `- ${p.name} (${p.role}) ${p.city}${p.settlementSharePercent !== undefined ? ` | settlement share ${p.settlementSharePercent}%` : ""} | ${p.notes}`)
    .join("\n");
  return `ARTIST: ${s.profile.artistName}
HOME: ${s.profile.city}
GENRE: ${s.profile.genre}
TYPICAL DRAW: ${s.profile.draw}
FEE TARGET: $${s.profile.feeTarget}
NOTES: ${s.profile.notes}

MONEY: collected ${collected}, outstanding ${outstanding}, costs ${costs}, profit ${profit}
MERCH: recorded sales ${merchRevenue}, gross profit ${merchGrossProfit}, units sold ${merchUnitsSold}, low-stock items ${lowStock.length}

MERCH INVENTORY:
${merchLines || "(empty)"}

GIG PIPELINE:
${gigLines || "(empty)"}

PEOPLE:
${peopleLines || "(empty)"}`;
}
