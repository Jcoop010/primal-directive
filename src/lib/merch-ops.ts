import type { MerchProduct, MerchSale } from "@/lib/types";

export type MerchSummary = {
  unitsSold: number;
  grossSales: number;
  costOfGoods: number;
  grossProfit: number;
  lowStockProducts: number;
  inventoryCostValue: number;
};

function validAmount(value: number, label: string, allowZero = true) {
  if (!Number.isFinite(value) || value < 0 || (!allowZero && value === 0)) {
    throw new Error(`${label} must be a finite ${allowZero ? "non-negative" : "positive"} number.`);
  }
}

export function recordMerchSale(
  products: readonly MerchProduct[],
  sales: readonly MerchSale[],
  input: Omit<MerchSale, "id">,
  id: string,
): { products: MerchProduct[]; sales: MerchSale[] } {
  if (!id.trim()) throw new Error("Sale ID is required.");
  if (sales.some((sale) => sale.id === id)) throw new Error("Sale ID already exists.");
  if (!input.productId.trim()) throw new Error("Choose a merch product.");
  if (!Number.isInteger(input.quantity) || input.quantity < 1) {
    throw new Error("Quantity must be a positive whole number.");
  }
  validAmount(input.unitPrice, "Sale price");
  validAmount(input.unitCost, "Unit cost");
  const product = products.find((item) => item.id === input.productId);
  if (!product || !product.active) throw new Error("Product is missing or inactive.");
  if (product.stockOnHand < input.quantity) {
    throw new Error(`Not enough stock: ${product.stockOnHand} available, ${input.quantity} requested.`);
  }
  const sale: MerchSale = { ...input, id };
  return {
    products: products.map((item) =>
      item.id === product.id ? { ...item, stockOnHand: item.stockOnHand - input.quantity } : item,
    ),
    sales: [sale, ...sales],
  };
}

export function restockMerch(
  products: readonly MerchProduct[],
  productId: string,
  quantity: number,
): MerchProduct[] {
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new Error("Restock quantity must be a positive whole number.");
  }
  const product = products.find((item) => item.id === productId);
  if (!product) throw new Error("Product not found.");
  const stockOnHand = product.stockOnHand + quantity;
  if (!Number.isSafeInteger(stockOnHand)) throw new Error("Stock quantity is too large.");
  return products.map((item) => item.id === productId ? { ...item, stockOnHand } : item);
}

export function summarizeMerch(
  products: readonly MerchProduct[],
  sales: readonly MerchSale[],
): MerchSummary {
  let unitsSold = 0;
  let grossSales = 0;
  let costOfGoods = 0;
  for (const sale of sales) {
    if (!Number.isInteger(sale.quantity) || sale.quantity < 1) throw new Error("Sale quantity must be a positive whole number.");
    validAmount(sale.unitPrice, "Sale price");
    validAmount(sale.unitCost, "Unit cost");
    unitsSold += sale.quantity;
    grossSales += sale.quantity * sale.unitPrice;
    costOfGoods += sale.quantity * sale.unitCost;
  }
  const inventoryCostValue = products.reduce((sum, product) => {
    validAmount(product.unitCost, "Product unit cost");
    if (!Number.isInteger(product.stockOnHand) || product.stockOnHand < 0) throw new Error("Stock on hand must be a non-negative whole number.");
    return sum + product.stockOnHand * product.unitCost;
  }, 0);
  return {
    unitsSold,
    grossSales,
    costOfGoods,
    grossProfit: grossSales - costOfGoods,
    lowStockProducts: products.filter((product) => product.active && product.stockOnHand <= product.reorderAt).length,
    inventoryCostValue,
  };
}
