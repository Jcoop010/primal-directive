import type { MerchInventoryAdjustment, MerchOrder, MerchProduct, MerchRefund, MerchSale, MoneyEntry } from "@/lib/types";

/** Build the linked cash-ledger entries for one merch sale. */
export function buildMerchLedgerEntries(
  sale: Omit<MerchSale, "id">,
  productName: string,
  ids: { revenueId: string; costId: string },
): MoneyEntry[] {
  if (!productName.trim()) throw new Error("Product name is required for merch ledger entries.");
  if (!ids.revenueId.trim() || !ids.costId.trim() || ids.revenueId === ids.costId) {
    throw new Error("Merch ledger entries require two unique IDs.");
  }
  if (!Number.isInteger(sale.quantity) || sale.quantity < 1) {
    throw new Error("Quantity must be a positive whole number.");
  }
  validAmount(sale.unitPrice, "Sale price");
  validAmount(sale.unitCost, "Unit cost");
  const subtotal = sale.quantity * sale.unitPrice;
  const discount = sale.discountAmount ?? 0;
  validAmount(discount, "Discount");
  validAmount(sale.taxAmount ?? 0, "Tax");
  validAmount(sale.processingFee ?? 0, "Processing fee");
  if (discount > subtotal) throw new Error("Discount cannot exceed the sale subtotal.");
  return [
    {
      id: ids.revenueId,
      type: "collected",
      amount: roundCents(subtotal - discount),
      label: `Merch sale: ${productName} × ${sale.quantity}`,
      date: sale.date,
      gigId: sale.gigId,
    },
    {
      id: ids.costId,
      type: "cost",
      amount: sale.quantity * sale.unitCost,
      label: `Merch cost of goods: ${productName} × ${sale.quantity}`,
      date: sale.date,
      gigId: sale.gigId,
    },
    ...((sale.taxAmount ?? 0) > 0 ? [{
      id: `${ids.costId}:tax`,
      type: "cost" as const,
      amount: sale.taxAmount!,
      label: `Merch sales tax payable: ${productName}`,
      date: sale.date,
      gigId: sale.gigId,
    }] : []),
    ...((sale.processingFee ?? 0) > 0 ? [{
      id: `${ids.costId}:fee`,
      type: "cost" as const,
      amount: sale.processingFee!,
      label: `Merch processing fee: ${productName}`,
      date: sale.date,
      gigId: sale.gigId,
    }] : []),
  ];
}

export type MerchSummary = {
  unitsSold: number;
  grossSales: number;
  discounts: number;
  netSales: number;
  costOfGoods: number;
  grossProfit: number;
  taxCollected: number;
  processingFees: number;
  netAfterTaxAndFees: number;
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
  inventoryAdjustmentId = `${id}:inventory`,
): { products: MerchProduct[]; sales: MerchSale[]; adjustments: MerchInventoryAdjustment[] } {
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
  if (!inventoryAdjustmentId.trim()) throw new Error("Inventory adjustment ID is required.");
  return {
    products: products.map((item) =>
      item.id === product.id ? { ...item, stockOnHand: item.stockOnHand - input.quantity } : item,
    ),
    sales: [sale, ...sales],
    // Every manual sale must have a matching stock movement for inventory auditability.
    adjustments: [{
      id: inventoryAdjustmentId,
      productId: product.id,
      quantityDelta: -input.quantity,
      reason: "sale",
      date: input.date,
      gigId: input.gigId,
      note: `Manual sale ${id}`,
    }],
  };
}

/** Apply a paid multi-item order atomically to the in-memory app state. */
export function recordMerchOrder(
  products: readonly MerchProduct[],
  orders: readonly MerchOrder[],
  sales: readonly MerchSale[],
  input: Omit<MerchOrder, "id" | "status" | "createdAt" | "subtotal" | "total" | "refundedAmount">,
  ids: { orderId: string; saleIds: string[]; ledgerIds: string[] },
): { products: MerchProduct[]; orders: MerchOrder[]; sales: MerchSale[]; ledgerEntries: MoneyEntry[] } {
  if (!ids.orderId.trim() || orders.some((order) => order.id === ids.orderId)) throw new Error("Order ID is missing or already used.");
  if (!input.lines.length) throw new Error("Add at least one item to the order.");
  if (new Set(input.lines.map((line) => line.productId)).size !== input.lines.length) throw new Error("Each variant may appear only once in an order.");
  if (ids.saleIds.length !== input.lines.length || ids.ledgerIds.length !== input.lines.length * 2) throw new Error("Order IDs are incomplete.");
  validAmount(input.discountAmount, "Discount");
  validAmount(input.taxAmount, "Tax");
  validAmount(input.processingFee, "Processing fee");

  let subtotal = 0;
  const nextProducts = products.map((product) => ({ ...product }));
  const orderLines = input.lines.map((line, index) => {
    if (!Number.isInteger(line.quantity) || line.quantity < 1) throw new Error("Each quantity must be a positive whole number.");
    validAmount(line.unitPrice, "Unit price");
    validAmount(line.unitCost, "Unit cost");
    const product = nextProducts.find((item) => item.id === line.productId && item.active);
    if (!product) throw new Error("An item is missing or inactive.");
    if (product.stockOnHand < line.quantity) throw new Error(`Not enough stock for ${product.name}: ${product.stockOnHand} available.`);
    product.stockOnHand -= line.quantity;
    subtotal += line.quantity * line.unitPrice;
    return { ...line, unitCost: product.unitCost, index };
  });
  if (input.discountAmount > subtotal) throw new Error("Discount cannot exceed the order subtotal.");
  const total = roundCents(subtotal - input.discountAmount + input.taxAmount);
  const order: MerchOrder = {
    ...input,
    id: ids.orderId,
    status: "paid",
    createdAt: new Date().toISOString(),
    subtotal: roundCents(subtotal),
    total,
    lines: orderLines.map(({ index: _index, ...line }) => line),
  };
  const allocate = (amount: number) => {
    let allocated = 0;
    return orderLines.map((line, index) => {
      const share = index === orderLines.length - 1
        ? roundCents(amount - allocated)
        : roundCents(subtotal > 0 ? amount * (line.quantity * line.unitPrice / subtotal) : 0);
      allocated = roundCents(allocated + share);
      return share;
    });
  };
  const discountShares = allocate(input.discountAmount);
  const taxShares = allocate(input.taxAmount);
  const feeShares = allocate(input.processingFee);
  const nextSales = orderLines.map((line, index): MerchSale => ({
    id: ids.saleIds[index]!,
    productId: line.productId,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    unitCost: line.unitCost,
    date: input.date,
    gigId: input.gigId,
    paymentMethod: input.paymentMethod,
    notes: input.notes,
    orderId: ids.orderId,
    channel: input.channel,
    member: input.member,
    discountAmount: discountShares[index]!,
    taxAmount: taxShares[index]!,
    processingFee: feeShares[index]!,
  }));
  const ledgerEntries = nextSales.flatMap((sale, index) => buildMerchLedgerEntries(sale, products.find((product) => product.id === sale.productId)!.name, {
    revenueId: ids.ledgerIds[index * 2]!,
    costId: ids.ledgerIds[index * 2 + 1]!,
  }).map((entry) => ({ ...entry, sourceOrderId: ids.orderId })));
  return { products: nextProducts, orders: [order, ...orders], sales: [...nextSales, ...sales], ledgerEntries };
}

/** Record a full manual refund. External payment systems still require their own confirmed refund action. */
export function refundMerchOrder(
  products: readonly MerchProduct[],
  orders: readonly MerchOrder[],
  refunds: readonly MerchRefund[],
  input: { orderId: string; refundId: string; date: string; restock: boolean; note: string; ledgerIds: string[]; adjustmentIds: string[] },
): { products: MerchProduct[]; orders: MerchOrder[]; refunds: MerchRefund[]; adjustments: MerchInventoryAdjustment[]; ledgerEntries: MoneyEntry[] } {
  if (!input.refundId.trim() || refunds.some((refund) => refund.id === input.refundId)) throw new Error("Refund ID is missing or already used.");
  if (refunds.some((refund) => refund.orderId === input.orderId)) throw new Error("This order already has a recorded refund.");
  const order = orders.find((item) => item.id === input.orderId);
  if (!order || order.status !== "paid") throw new Error("Only a paid order can be refunded once.");
  const cogs = order.lines.reduce((sum, line) => sum + line.quantity * line.unitCost, 0);
  const ledgerEntries: MoneyEntry[] = [
    { id: input.ledgerIds[0]!, type: "collected", amount: -roundCents(order.subtotal - order.discountAmount), label: `Merch refund ${order.id}`, date: input.date, gigId: order.gigId, sourceOrderId: order.id },
  ];
  if (order.taxAmount > 0) ledgerEntries.push({ id: input.ledgerIds[1]!, type: "cost", amount: -order.taxAmount, label: `Reverse merch tax ${order.id}`, date: input.date, gigId: order.gigId, sourceOrderId: order.id });
  if (input.restock && cogs > 0) ledgerEntries.push({ id: input.ledgerIds[2]!, type: "cost", amount: -roundCents(cogs), label: `Reverse merch cost of goods ${order.id}`, date: input.date, gigId: order.gigId, sourceOrderId: order.id });
  const nextProducts = products.map((product) => {
    if (!input.restock) return product;
    const quantity = order.lines.filter((line) => line.productId === product.id).reduce((sum, line) => sum + line.quantity, 0);
    const stockOnHand = product.stockOnHand + quantity;
    if (!Number.isSafeInteger(stockOnHand)) throw new Error("Returned stock quantity is too large.");
    return quantity ? { ...product, stockOnHand } : product;
  });
  const adjustments = input.restock ? order.lines.map((line, index) => ({
    id: input.adjustmentIds[index]!, productId: line.productId, quantityDelta: line.quantity,
    reason: "return" as const, date: input.date, gigId: order.gigId, note: input.note || `Returned from order ${order.id}`, sourceOrderId: order.id,
  })) : [];
  const refund: MerchRefund = { id: input.refundId, orderId: order.id, date: input.date, amount: order.total, restocked: input.restock, note: input.note };
  return {
    products: nextProducts,
    orders: orders.map((item) => item.id === order.id ? { ...item, status: "refunded", refundedAmount: order.total } : item),
    refunds: [refund, ...refunds],
    adjustments,
    ledgerEntries,
  };
}

function roundCents(value: number) {
  if (!Number.isFinite(value)) throw new Error("Order amount must be finite.");
  return Math.round((value + Number.EPSILON) * 100) / 100;
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

export function adjustMerchInventory(
  products: readonly MerchProduct[],
  productId: string,
  quantityDelta: number,
  reason: "restock" | "comp" | "damage" | "correction",
): MerchProduct[] {
  if (!Number.isSafeInteger(quantityDelta) || quantityDelta === 0) throw new Error("Inventory change must be a non-zero whole number.");
  if (reason === "restock" && quantityDelta < 0) throw new Error("Restock quantity must increase stock.");
  if ((reason === "comp" || reason === "damage") && quantityDelta > 0) throw new Error(`${reason} quantity must reduce stock.`);
  const product = products.find((item) => item.id === productId);
  if (!product) throw new Error("Product not found.");
  const stockOnHand = product.stockOnHand + quantityDelta;
  if (!Number.isSafeInteger(stockOnHand) || stockOnHand < 0) throw new Error("Inventory cannot become negative or exceed the safe count.");
  return products.map((item) => item.id === productId ? { ...item, stockOnHand } : item);
}

export function summarizeMerch(
  products: readonly MerchProduct[],
  sales: readonly MerchSale[],
  orders: readonly MerchOrder[] = [],
  refunds: readonly MerchRefund[] = [],
): MerchSummary {
  let unitsSold = 0;
  let grossSales = 0;
  let discounts = 0;
  let costOfGoods = 0;
  let taxCollected = 0;
  let processingFees = 0;
  const refundedOrderIds = new Set(
    orders.filter((order) => order.status === "refunded").map((order) => order.id),
  );
  const restockedRefundIds = new Set(
    refunds.filter((refund) => refund.restocked).map((refund) => refund.orderId),
  );
  for (const sale of sales) {
    if (!Number.isInteger(sale.quantity) || sale.quantity < 1) throw new Error("Sale quantity must be a positive whole number.");
    validAmount(sale.unitPrice, "Sale price");
    validAmount(sale.unitCost, "Unit cost");
    const refunded = sale.orderId !== undefined && refundedOrderIds.has(sale.orderId);
    // Refunded orders no longer count as revenue or sold units.
    if (!refunded) {
      unitsSold += sale.quantity;
      grossSales += sale.quantity * sale.unitPrice;
      discounts += sale.discountAmount ?? 0;
      taxCollected += sale.taxAmount ?? 0;
      costOfGoods += sale.quantity * sale.unitCost;
    } else if (!restockedRefundIds.has(sale.orderId!)) {
      // Keep COGS as an expense unless returned items were actually restocked.
      costOfGoods += sale.quantity * sale.unitCost;
    }
    // Processor fees remain expenses unless a fee reversal is recorded.
    processingFees += sale.processingFee ?? 0;
  }
  const inventoryCostValue = products.reduce((sum, product) => {
    validAmount(product.unitCost, "Product unit cost");
    if (!Number.isInteger(product.stockOnHand) || product.stockOnHand < 0) throw new Error("Stock on hand must be a non-negative whole number.");
    return sum + product.stockOnHand * product.unitCost;
  }, 0);
  return {
    unitsSold,
    grossSales,
    discounts,
    netSales: grossSales - discounts,
    costOfGoods,
    grossProfit: grossSales - discounts - costOfGoods,
    taxCollected,
    processingFees,
    netAfterTaxAndFees: grossSales - discounts - costOfGoods - taxCollected - processingFees,
    lowStockProducts: products.filter((product) => product.active && product.stockOnHand <= product.reorderAt).length,
    inventoryCostValue,
  };
}
