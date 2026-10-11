import assert from "node:assert/strict";
import test from "node:test";
import { recordMerchSale, restockMerch, summarizeMerch } from "./merch-ops.ts";
import type { MerchProduct, MerchSale } from "./types.ts";

const products: MerchProduct[] = [
  { id: "tee", name: "Logo Tee", sku: "TEE-BLK", category: "apparel", price: 30, unitCost: 10, stockOnHand: 12, reorderAt: 3, active: true },
  { id: "sticker", name: "Sticker", sku: "STK-01", category: "stickers", price: 3, unitCost: 0.5, stockOnHand: 2, reorderAt: 5, active: true },
];
const sale: Omit<MerchSale, "id"> = {
  productId: "tee", quantity: 2, unitPrice: 30, unitCost: 10,
  date: "2026-10-11", gigId: "show-1", paymentMethod: "cash", notes: "",
};

test("records a sale, snapshots unit economics, and reduces stock", () => {
  const result = recordMerchSale(products, [], sale, "sale-1");
  assert.equal(result.products[0]?.stockOnHand, 10);
  assert.equal(result.sales[0]?.unitCost, 10);
  assert.equal(result.sales[0]?.gigId, "show-1");
});

test("rejects overselling and invalid quantities", () => {
  assert.throws(() => recordMerchSale(products, [], { ...sale, quantity: 99 }, "sale-2"), /Not enough stock/);
  assert.throws(() => recordMerchSale(products, [], { ...sale, quantity: 1.5 }, "sale-3"), /whole number/);
});

test("restock adds whole units and rejects unknown product", () => {
  assert.equal(restockMerch(products, "sticker", 8)[1]?.stockOnHand, 10);
  assert.throws(() => restockMerch(products, "missing", 1), /not found/i);
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
