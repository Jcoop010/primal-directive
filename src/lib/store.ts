import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createSeed, WELCOME_TEXT } from "@/lib/seed";
import { syncBookingReminder, validBookingDay } from "@/lib/booking-workflow";
import { uid } from "@/lib/utils";
import {
  adjustMerchInventory as applyInventoryAdjustment,
  buildMerchLedgerEntries,
  recordMerchOrder as applyMerchOrder,
  recordMerchSale as applyMerchSale,
  refundMerchOrder as applyMerchRefund,
  restockMerch,
  summarizeMerch,
} from "@/lib/merch-ops";
import { generateShowTaskPacks, rescheduleOpenShowTasks } from "@/lib/show-workflows";
import type {
  ArtistProfile,
  ChatMessage,
  Gig,
  MoneyEntry,
  MerchInventoryAdjustment,
  MerchOrder,
  MerchRefund,
  MerchProduct,
  MerchSale,
  OperationalTask,
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
  merchOrders: MerchOrder[];
  merchInventoryAdjustments: MerchInventoryAdjustment[];
  merchRefunds: MerchRefund[];
  tasks: OperationalTask[];
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
  adjustMerchProduct: (
    id: string,
    quantityDelta: number,
    reason: "restock" | "comp" | "damage" | "correction",
    note: string,
  ) => void;
  recordMerchSale: (sale: Omit<MerchSale, "id">) => string;
  recordMerchOrder: (
    order: Omit<
      MerchOrder,
      "id" | "status" | "createdAt" | "subtotal" | "total" | "refundedAmount"
    >,
  ) => string;
  refundMerchOrder: (id: string, restock: boolean, note: string) => void;
  generateShowTasks: () => number;
  updateOperationalTask: (
    id: string,
    patch: Partial<Pick<OperationalTask, "status" | "dueDate">>,
  ) => void;
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
    merchOrders: [],
    merchInventoryAdjustments: [],
    merchRefunds: [],
    tasks: [],
    chat: welcomeChat(),
    composer: { ...emptyComposer },
  };
}

export const useMusician = create<State & Actions>()(
  persist(
    (set) => ({
      ...fresh(),
      addGig: (gig) => {
        if (gig.date && !validBookingDay(gig.date)) throw Error("Enter a real show date.");
        if (gig.status === "booked" && !validBookingDay(gig.date))
          throw Error("A confirmed booking requires a show date.");
        const id = uid();
        set((s) => {
          const savedGig = { ...gig, id };
          // Booking is the workflow trigger: a confirmed, dated show immediately
          // receives its operational checklist instead of relying on a manual step.
          const tasks =
            savedGig.status === "booked"
              ? generateShowTaskPacks([savedGig], s.tasks).map((task) => ({ ...task, id: uid() }))
              : [];
          return {
            gigs: [savedGig, ...s.gigs],
            tasks: syncBookingReminder(
              savedGig,
              [...tasks, ...s.tasks],
              uid(),
              new Date().toISOString(),
            ),
          };
        });
        return id;
      },
      updateGig: (id, patch) =>
        set((s) => {
          const previous = s.gigs.find((gig) => gig.id === id);
          const gigs = s.gigs.map((gig) => (gig.id === id ? { ...gig, ...patch } : gig));
          const updated = gigs.find((gig) => gig.id === id);
          if (updated?.date && !validBookingDay(updated.date))
            throw Error("Enter a real show date.");
          if (updated?.status === "booked" && !validBookingDay(updated.date))
            throw Error("A confirmed booking requires a show date.");
          const newlyBooked = previous?.status !== "booked" && updated?.status === "booked";
          const existingTasks =
            updated && previous?.date !== updated.date
              ? rescheduleOpenShowTasks(updated, s.tasks)
              : s.tasks;
          const tasks =
            newlyBooked && updated
              ? generateShowTaskPacks([updated], existingTasks).map((task) => ({
                  ...task,
                  id: uid(),
                }))
              : [];
          const combined = [...tasks, ...existingTasks];
          return {
            gigs,
            tasks: updated
              ? syncBookingReminder(updated, combined, uid(), new Date().toISOString())
              : combined,
          };
        }),
      removeGig: (id) =>
        set((s) => ({
          gigs: s.gigs.filter((g) => g.id !== id),
          // Preserve financial and merch history, but detach it from a deleted show.
          // Show-prep tasks are operational work tied to that show and should not linger orphaned.
          money: s.money.map((entry) =>
            entry.gigId === id ? { ...entry, gigId: undefined } : entry,
          ),
          merchSales: s.merchSales.map((sale) =>
            sale.gigId === id ? { ...sale, gigId: undefined } : sale,
          ),
          merchOrders: s.merchOrders.map((order) =>
            order.gigId === id ? { ...order, gigId: undefined } : order,
          ),
          merchInventoryAdjustments: s.merchInventoryAdjustments.map((adjustment) =>
            adjustment.gigId === id ? { ...adjustment, gigId: undefined } : adjustment,
          ),
          tasks: s.tasks.filter((task) => task.gigId !== id),
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
      removePerson: (id) => set((s) => ({ people: s.people.filter((p) => p.id !== id) })),
      addMoney: (entry) => {
        const id = uid();
        set((s) => ({ money: [{ ...entry, id }, ...s.money] }));
        return id;
      },
      updateMoney: (id, patch) =>
        set((s) => ({
          money: s.money.map((m) => (m.id === id ? { ...m, ...patch } : m)),
        })),
      removeMoney: (id) => set((s) => ({ money: s.money.filter((m) => m.id !== id) })),
      addMerchProduct: (product) => {
        const id = uid();
        set((s) => ({
          merchProducts: [{ ...product, id }, ...s.merchProducts],
          merchInventoryAdjustments:
            product.stockOnHand > 0
              ? [
                  {
                    id: uid(),
                    productId: id,
                    quantityDelta: product.stockOnHand,
                    reason: "opening",
                    date: new Date().toISOString().slice(0, 10),
                    note: "Opening stock",
                  },
                  ...s.merchInventoryAdjustments,
                ]
              : s.merchInventoryAdjustments,
        }));
        return id;
      },
      updateMerchProduct: (id, patch) =>
        set((s) => ({
          merchProducts: s.merchProducts.map((product) =>
            product.id === id ? { ...product, ...patch } : product,
          ),
        })),
      restockMerchProduct: (id, quantity) =>
        set((s) => {
          const products = restockMerch(s.merchProducts, id, quantity);
          return {
            merchProducts: products,
            merchInventoryAdjustments: [
              {
                id: uid(),
                productId: id,
                quantityDelta: quantity,
                reason: "restock",
                date: new Date().toISOString().slice(0, 10),
                note: "Restocked",
              },
              ...s.merchInventoryAdjustments,
            ],
          };
        }),
      adjustMerchProduct: (id, quantityDelta, reason, note) =>
        set((s) => ({
          merchProducts: applyInventoryAdjustment(s.merchProducts, id, quantityDelta, reason),
          merchInventoryAdjustments: [
            {
              id: uid(),
              productId: id,
              quantityDelta,
              reason,
              date: new Date().toISOString().slice(0, 10),
              note,
            },
            ...s.merchInventoryAdjustments,
          ],
        })),
      recordMerchSale: (sale) => {
        const id = uid();
        set((s) => {
          const result = applyMerchSale(s.merchProducts, s.merchSales, sale, id);
          const product = s.merchProducts.find((item) => item.id === sale.productId);
          if (!product) throw new Error("Product not found while recording sale.");
          // Keep the sale, inventory movement, and cash ledger entry in one state update.
          // This prevents a successful sale from being saved without its corresponding revenue record.
          const ledgerEntries = buildMerchLedgerEntries(sale, product.name, {
            revenueId: uid(),
            costId: uid(),
          });
          return {
            merchProducts: result.products,
            merchSales: result.sales,
            // Record revenue and its inventory cost together so show-level net
            // reflects merch margin rather than treating all merch receipts as profit.
            money: [...ledgerEntries, ...s.money],
          };
        });
        return id;
      },
      recordMerchOrder: (order) => {
        const id = uid();
        set((s) => {
          const result = applyMerchOrder(s.merchProducts, s.merchOrders, s.merchSales, order, {
            orderId: id,
            saleIds: order.lines.map(() => uid()),
            ledgerIds: order.lines.flatMap(() => [uid(), uid()]),
          });
          return {
            merchProducts: result.products,
            merchOrders: result.orders,
            merchSales: result.sales,
            merchInventoryAdjustments: [
              ...order.lines.map((line) => ({
                id: uid(),
                productId: line.productId,
                quantityDelta: -line.quantity,
                reason: "sale" as const,
                date: order.date,
                gigId: order.gigId,
                note: `Sale from order ${id}`,
                sourceOrderId: id,
              })),
              ...s.merchInventoryAdjustments,
            ],
            money: [...result.ledgerEntries, ...s.money],
          };
        });
        return id;
      },
      refundMerchOrder: (orderId, restock, note) =>
        set((s) => {
          const result = applyMerchRefund(s.merchProducts, s.merchOrders, s.merchRefunds, {
            orderId,
            refundId: uid(),
            date: new Date().toISOString().slice(0, 10),
            restock,
            note,
            ledgerIds: [uid(), uid(), uid()],
            adjustmentIds:
              s.merchOrders.find((order) => order.id === orderId)?.lines.map(() => uid()) ?? [],
          });
          return {
            merchProducts: result.products,
            merchOrders: result.orders,
            merchRefunds: result.refunds,
            merchInventoryAdjustments: [...result.adjustments, ...s.merchInventoryAdjustments],
            money: [...result.ledgerEntries, ...s.money],
          };
        }),
      generateShowTasks: () => {
        let added = 0;
        set((s) => {
          const generated = generateShowTaskPacks(s.gigs, s.tasks);
          added = generated.length;
          if (generated.length === 0) return s;
          return {
            tasks: [...generated.map((task) => ({ ...task, id: uid() })), ...s.tasks],
          };
        });
        return added;
      },
      updateOperationalTask: (id, patch) =>
        set((s) => ({
          tasks: s.tasks.map((task) =>
            task.id === id
              ? {
                  ...task,
                  ...patch,
                  ...(patch.dueDate !== undefined ? { dueDateOverridden: true } : {}),
                }
              : task,
          ),
        })),
      updateProfile: (patch) => set((s) => ({ profile: { ...s.profile, ...patch } })),
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
              (existing.city || "").trim().toLowerCase() === (g.city || "").trim().toLowerCase() &&
              !existing.date,
          );
          if (duplicate) return s;
          return {
            gigs: [
              {
                id: uid(),
                name: g.name,
                venue: g.venue,
                city: g.city,
                date: "",
                fee: 0,
                conf: g.conf,
                status: "lead",
                researchSourceUrl: g.sourceUrl,
                venueCapacity: g.venueCapacity,
                capacitySourceUrl: g.capacitySourceUrl,
                bookingRoute: g.bookingRoute,
                bookingContactName: g.bookingContactName,
                bookingContactSourceUrl: g.bookingContactSourceUrl,
                outreachContact: [g.bookingContactName, g.bookingRoute].filter(Boolean).join(" — "),

                notes: [
                  g.reason,
                  g.sourceUrl ? `Research source: ${g.sourceUrl}` : "",
                  "Unconfirmed research lead; verify booking terms before outreach.",
                ]
                  .filter(Boolean)
                  .join("\n"),
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
      setComposer: (patch) => set((s) => ({ composer: { ...s.composer, ...patch } })),
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
          merchOrders: [],
          merchInventoryAdjustments: [],
          merchRefunds: [],
          tasks: [],
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
        merchOrders: s.merchOrders,
        merchInventoryAdjustments: s.merchInventoryAdjustments,
        merchRefunds: s.merchRefunds,
        tasks: s.tasks,
        chat: s.chat,
        profile: s.profile,
      }),
    },
  ),
);

export function sumMoney(entries: MoneyEntry[], type: MoneyEntry["type"]) {
  return entries.filter((x) => x.type === type).reduce((a, x) => a + (Number(x.amount) || 0), 0);
}

export function pipelineGigs(gigs: Gig[]) {
  return gigs.filter((g) => g.status !== "completed" && g.status !== "passed");
}

export function pipelineValue(gigs: Gig[]) {
  return pipelineGigs(gigs).reduce((a, g) => a + (Number(g.fee) || 0), 0);
}

export function weightedValue(gigs: Gig[]) {
  return pipelineGigs(gigs).reduce((a, g) => a + (Number(g.fee) || 0) * (Number(g.conf) || 0), 0);
}

export function buildAdvisorContext() {
  const s = useMusician.getState();
  const collected = sumMoney(s.money, "collected");
  const outstanding = sumMoney(s.money, "outstanding");
  const costs = sumMoney(s.money, "cost");
  const profit = collected - costs;
  const merchSummary = summarizeMerch(s.merchProducts, s.merchSales, s.merchOrders, s.merchRefunds);
  const merchRevenue = merchSummary.netSales;
  const merchGrossProfit = merchSummary.grossProfit;
  const merchUnitsSold = merchSummary.unitsSold;
  const lowStock = s.merchProducts.filter(
    (product) => product.active && product.stockOnHand <= product.reorderAt,
  );
  const merchLines = s.merchProducts
    .slice(0, 15)
    .map(
      (product) =>
        `- ${product.name} [${product.sku || "no SKU"}] | stock ${product.stockOnHand} | price ${product.price} | cost ${product.unitCost}${product.active && product.stockOnHand <= product.reorderAt ? " | REORDER" : ""}`,
    )
    .join("\\n");
  const gigLines = [...s.gigs]
    .sort((a, b) => {
      const priority = (gig: Gig) =>
        ["completed", "passed"].includes(gig.status) ? "9999" : gig.outreachNextFollowUp || "9998";
      return priority(a).localeCompare(priority(b));
    })
    .slice(0, 12)
    .map(
      (g) =>
        `- ${g.name} @ ${g.venue}, ${g.city} | ${g.date || "TBD"} | $${g.fee} | ${g.status} | source ${g.researchSourceUrl || "not recorded"} | source reviewed ${g.researchVerifiedAt || "no"} | contact ${g.outreachContact || "not recorded"} | last contacted ${g.outreachLastContactedAt || "never recorded"} | follow-up ${g.outreachNextFollowUp || "not set"} | ${g.outreachNotes?.slice(0, 180) || ""} | ${g.notes.slice(0, 180)}`,
    )
    .join("\n");
  const peopleLines = s.people
    .slice(0, 12)
    .map(
      (p) =>
        `- ${p.name} (${p.role}) ${p.city}${p.settlementSharePercent !== undefined ? ` | settlement share ${p.settlementSharePercent}%` : ""} | ${p.notes}`,
    )
    .join("\n");
  return `ARTIST: ${s.profile.artistName}
HOME: ${s.profile.city}
GENRE: ${s.profile.genre}
TYPICAL DRAW: ${s.profile.draw}
FEE TARGET: $${s.profile.feeTarget}
NOTES: ${s.profile.notes.slice(0, 500)}

MONEY: collected ${collected}, outstanding ${outstanding}, costs ${costs}, profit ${profit}
MERCH: recorded sales ${merchRevenue}, gross profit ${merchGrossProfit}, units sold ${merchUnitsSold}, low-stock items ${lowStock.length}

GIG PIPELINE:
${gigLines || "(empty)"}

PEOPLE:
${peopleLines || "(empty)"}

MERCH INVENTORY:
${merchLines || "(empty)"}`.slice(0, 4500);
}
