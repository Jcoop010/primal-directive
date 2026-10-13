import assert from "node:assert/strict";
import test from "node:test";
import { adjustMerchInventory, buildMerchLedgerEntries, recordMerchOrder, recordMerchSale, refundMerchOrder, restockMerch, summarizeMerch } from "./merch-ops.ts";
import type { MerchOrder, MerchProduct, MerchSale } from "./types.ts";

const products: MerchProduct[] = [
  { id: "tee", name: "Logo Tee", sku: "TEE-BLK", category: "apparel", price: 30, unitCost: 10, stockOnHand: 12, reorderAt: 3, active: true },
  { id: "sticker", name: "Sticker", sku: "STK-01", category: "stickers", price: 3, unitCost: 0.5, stockOnHand: 2, reorderAt: 5, active: true },
];
const sale: Omit<MerchSale, "id"> = {
  productId: "tee", quantity: 2, unitPrice: 30, unitCost: 10,
  date: "2026-10-11", gigId: "show-1", paymentMethod: "cash", notes: "",
};

test("records both merch revenue and cost of goods against the same show", () => {
  const entries = buildMerchLedgerEntries(sale, "Logo Tee", {
    revenueId: "revenue-1",
    costId: "cost-1",
  });
  assert.equal(entries.length, 2);
  assert.deepEqual(entries.map((entry) => [entry.type, entry.amount]), [
    ["collected", 60],
    ["cost", 20],
  ]);
  assert.equal(entries[0]?.gigId, "show-1");
  assert.equal(entries[1]?.gigId, "show-1");
});

test("rejects invalid merch ledger identities and amounts", () => {
  assert.throws(() => buildMerchLedgerEntries(sale, "Logo Tee", {
    revenueId: "same",
    costId: "same",
  }), /unique IDs/);
  assert.throws(() => buildMerchLedgerEntries({ ...sale, unitCost: -1 }, "Logo Tee", {
    revenueId: "revenue-1",
    costId: "cost-1",
  }), /non-negative/);
});

test("records a sale, snapshots unit economics, reduces stock, and audits the inventory movement", () => {
  const result = recordMerchSale(products, [], sale, "sale-1", "adjustment-1");
  assert.equal(result.products[0]?.stockOnHand, 10);
  assert.equal(result.sales[0]?.unitCost, 10);
  assert.equal(result.sales[0]?.gigId, "show-1");
  assert.deepEqual(result.adjustments, [{
    id: "adjustment-1", productId: "tee", quantityDelta: -2, reason: "sale",
    date: "2026-10-11", gigId: "show-1", note: "Manual sale sale-1",
  }]);
});

test("rejects overselling and invalid quantities", () => {
  assert.throws(() => recordMerchSale(products, [], { ...sale, quantity: 99 }, "sale-2"), /Not enough stock/);
  assert.throws(() => recordMerchSale(products, [], { ...sale, quantity: 1.5 }, "sale-3"), /whole number/);
});

test("restock adds whole units and rejects unknown product", () => {
  assert.equal(restockMerch(products, "sticker", 8)[1]?.stockOnHand, 10);
  assert.throws(() => restockMerch(products, "missing", 1), /not found/i);
});

test("audits inventory changes and prevents negative stock", () => {
  assert.equal(adjustMerchInventory(products, "tee", -2, "comp")[0]?.stockOnHand, 10);
  assert.throws(() => adjustMerchInventory(products, "tee", -13, "damage"), /negative/);
  assert.throws(() => adjustMerchInventory(products, "tee", -1, "restock"), /increase stock/);
});

test("summarizes gross sales, cost of goods, profit, and low stock", () => {
  const summary = summarizeMerch(products, [{ ...sale, id: "sale-1" }]);
  assert.equal(summary.unitsSold, 2);
  assert.equal(summary.grossSales, 60);
  assert.equal(summary.costOfGoods, 20);
  assert.equal(summary.grossProfit, 40);
  assert.equal(summary.lowStockProducts, 1);
  assert.equal(summary.inventoryCostValue, 121);
});

test("rejects malformed historical sale values", () => {
  assert.throws(() => summarizeMerch(products, [{ ...sale, id: "sale-1", unitPrice: -1 }]), /non-negative/);
});

const orderInput: Omit<MerchOrder, "id" | "status" | "createdAt" | "subtotal" | "total" | "refundedAmount"> = {
  channel: "show", date: "2026-10-12", lines: [
    { productId: "tee", quantity: 2, unitPrice: 30, unitCost: 10 },
    { productId: "sticker", quantity: 1, unitPrice: 3, unitCost: 0.5 },
  ],
  discountAmount: 3, taxAmount: 5, processingFee: 1, paymentMethod: "cash", gigId: "show-1", member: "Ari", notes: "",
};

test("records a multi-item order with exact discount, tax, fee, stock, and ledger totals", () => {
  const result = recordMerchOrder(products, [], [], orderInput, {
    orderId: "order-1", saleIds: ["sale-a", "sale-b"], ledgerIds: ["rev-a", "cost-a", "rev-b", "cost-b"],
  });
  assert.equal(result.orders[0]?.subtotal, 63);
  assert.equal(result.orders[0]?.total, 65);
  assert.equal(result.products[0]?.stockOnHand, 10);
  assert.equal(result.products[1]?.stockOnHand, 1);
  assert.equal(result.sales.reduce((sum, item) => sum + item.discountAmount!, 0), 3);
  assert.equal(result.ledgerEntries.filter((entry) => entry.type === "collected").reduce((sum, entry) => sum + entry.amount, 0), 60);
  assert.equal(result.ledgerEntries.filter((entry) => entry.label.startsWith("Merch sales tax")).reduce((sum, entry) => sum + entry.amount, 0), 5);
  assert.equal(result.ledgerEntries.filter((entry) => entry.label.startsWith("Merch processing fee")).reduce((sum, entry) => sum + entry.amount, 0), 1);
  assert.ok(result.ledgerEntries.every((entry) => entry.sourceOrderId === "order-1"));
});

test("rejects duplicate and oversold multi-item orders without mutating source inventory", () => {
  assert.throws(() => recordMerchOrder(products, [], [], { ...orderInput, lines: [{ ...orderInput.lines[0]!, quantity: 99 }, orderInput.lines[1]!] }, {
    orderId: "order-2", saleIds: ["s1", "s2"], ledgerIds: ["r1", "c1", "r2", "c2"],
  }), /Not enough stock/);
  assert.equal(products[0]?.stockOnHand, 12);
  assert.throws(() => recordMerchOrder(products, [], [], { ...orderInput, lines: [orderInput.lines[0]!, orderInput.lines[0]!] }, {
    orderId: "order-3", saleIds: ["s1", "s2"], ledgerIds: ["r1", "c1", "r2", "c2"],
  }), /only once/);
});

test("refunds a manual order once and optionally restores stock with audit entries", () => {
  const paid = recordMerchOrder(products, [], [], orderInput, {
    orderId: "order-4", saleIds: ["s1", "s2"], ledgerIds: ["r1", "c1", "r2", "c2"],
  });
  const refunded = refundMerchOrder(paid.products, paid.orders, [], {
    orderId: "order-4", refundId: "refund-1", date: "2026-10-12", restock: true, note: "Returned",
    ledgerIds: ["refund-revenue", "refund-tax", "refund-cogs"], adjustmentIds: ["adj-a", "adj-b"],
  });
  assert.equal(refunded.orders[0]?.status, "refunded");
  assert.equal(refunded.products[0]?.stockOnHand, 12);
  assert.equal(refunded.adjustments.length, 2);
  assert.equal(refunded.ledgerEntries.find((entry) => entry.type === "collected")?.amount, -60);
  assert.throws(() => refundMerchOrder(refunded.products, refunded.orders, refunded.refunds, {
    orderId: "order-4", refundId: "refund-2", date: "2026-10-12", restock: true, note: "duplicate",
    ledgerIds: ["r", "t", "c"], adjustmentIds: ["a", "b"],
  }), /already/);
});


test("excludes refunded orders from sales and units while honoring restock state", () => {
  const paid = recordMerchOrder(products, [], [], orderInput, {
    orderId: "order-summary", saleIds: ["summary-a", "summary-b"],
    ledgerIds: ["summary-ra", "summary-ca", "summary-rb", "summary-cb"],
  });
  const refund = refundMerchOrder(paid.products, paid.orders, [], {
    orderId: "order-summary", refundId: "refund-summary", date: "2026-10-13",
    restock: true, note: "Returned", ledgerIds: ["summary-refund", "summary-tax", "summary-cogs"],
    adjustmentIds: ["summary-adj-a", "summary-adj-b"],
  });
  const summary = summarizeMerch(refund.products, paid.sales, refund.orders, refund.refunds);
  assert.equal(summary.unitsSold, 0);
  assert.equal(summary.grossSales, 0);
  assert.equal(summary.netSales, 0);
  assert.equal(summary.costOfGoods, 0);
  assert.equal(summary.taxCollected, 0);
  assert.equal(summary.processingFees, 1);
});


test("rejects invalid standalone sale discounts, tax, and processing fees", () => {
  const ids = { revenueId: "revenue-check", costId: "cost-check" };
  assert.throws(() => buildMerchLedgerEntries({ ...sale, discountAmount: -1 }, "Logo Tee", ids), /Discount.*non-negative/);
  assert.throws(() => buildMerchLedgerEntries({ ...sale, discountAmount: 1000 }, "Logo Tee", ids), /cannot exceed/);
  assert.throws(() => buildMerchLedgerEntries({ ...sale, taxAmount: -1 }, "Logo Tee", ids), /Tax.*non-negative/);
  assert.throws(() => buildMerchLedgerEntries({ ...sale, processingFee: -1 }, "Logo Tee", ids), /Processing fee.*non-negative/);
});
