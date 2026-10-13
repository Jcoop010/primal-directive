import { useMemo, useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, PackagePlus, Plus, ShoppingBag, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { Card, Eyebrow } from "@/components/ui/card";
import { MetricCard } from "@/components/metric-card";
import { downloadCsv, longDate, money } from "@/lib/format";
import { summarizeMerch } from "@/lib/merch-ops";
import { useMusician } from "@/lib/store";
import { MERCH_CATEGORIES, MERCH_PAYMENT_METHODS, type MerchCategory, type MerchPaymentMethod } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/merch")({ component: MerchPage });

const categoryLabel: Record<MerchCategory, string> = {
  apparel: "Apparel", music: "Music", accessories: "Accessories", stickers: "Stickers", other: "Other",
};

const paymentLabel: Record<MerchPaymentMethod, string> = {
  cash: "Cash", card: "Card", digital: "Digital", other: "Other",
};

function MerchPage() {
  const products = useMusician((s) => s.merchProducts);
  const sales = useMusician((s) => s.merchSales);
  const orders = useMusician((s) => s.merchOrders);
  const refunds = useMusician((s) => s.merchRefunds);
  const adjustments = useMusician((s) => s.merchInventoryAdjustments);
  const recordOrder = useMusician((s) => s.recordMerchOrder);
  const gigs = useMusician((s) => s.gigs);
  const addProduct = useMusician((s) => s.addMerchProduct);
  const adjustProduct = useMusician((s) => s.adjustMerchProduct);
  const refundOrder = useMusician((s) => s.refundMerchOrder);
  const [showProductForm, setShowProductForm] = useState(false);
  const [productName, setProductName] = useState("");
  const [sku, setSku] = useState("");
  const [size, setSize] = useState("");
  const [color, setColor] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [category, setCategory] = useState<MerchCategory>("apparel");
  const [price, setPrice] = useState("30");
  const [unitCost, setUnitCost] = useState("10");
  const [stock, setStock] = useState("24");
  const [reorderAt, setReorderAt] = useState("5");
  const [saleProductId, setSaleProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [salePrice, setSalePrice] = useState("");
  const [saleDate, setSaleDate] = useState(new Date().toISOString().slice(0, 10));
  const [gigId, setGigId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<MerchPaymentMethod>("cash");
  const [saleNotes, setSaleNotes] = useState("");
  const [restockProductId, setRestockProductId] = useState("");
  const [restockQuantity, setRestockQuantity] = useState("12");
  const [adjustmentReason, setAdjustmentReason] = useState<"restock" | "comp" | "damage" | "correction">("restock");
  const [adjustmentNote, setAdjustmentNote] = useState("");
  const [cartItems, setCartItems] = useState<{ productId: string; quantity: number; unitPrice: number; unitCost: number }[]>([]);
  const [discount, setDiscount] = useState("0");
  const [tax, setTax] = useState("0");
  const [fee, setFee] = useState("0");
  const [member, setMember] = useState("");
  const [orderQuery, setOrderQuery] = useState("");

  const summary = useMemo(() => summarizeMerch(products, sales, orders, refunds), [products, sales, orders, refunds]);
  const activeProducts = products.filter((product) => product.active);
  const selectedProduct = products.find((product) => product.id === saleProductId);
  const lowStock = activeProducts.filter((product) => product.stockOnHand <= product.reorderAt);
  const sortedProducts = [...products].sort((a, b) => {
    const lowA = a.active && a.stockOnHand <= a.reorderAt ? 1 : 0;
    const lowB = b.active && b.stockOnHand <= b.reorderAt ? 1 : 0;
    return lowB - lowA || a.name.localeCompare(b.name);
  });
  const filteredOrders = orders.filter((order) => {
    const query = orderQuery.trim().toLowerCase();
    if (!query) return true;
    const gig = gigs.find((item) => item.id === order.gigId);
    const items = order.lines.map((line) => products.find((product) => product.id === line.productId)?.name ?? "").join(" ");
    return [order.id, order.status, order.channel, order.member, order.notes, gig?.venue, gig?.name, items].some((value) => value?.toLowerCase().includes(query));
  });

  function submitProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedPrice = Number(price);
    const parsedCost = Number(unitCost);
    const parsedStock = Number(stock);
    const parsedReorder = Number(reorderAt);
    if (!productName.trim()) return toast.error("Enter a product name.");
    if (![parsedPrice, parsedCost].every((n) => Number.isFinite(n) && n >= 0)) return toast.error("Price and unit cost must be zero or more.");
    if (![parsedStock, parsedReorder].every((n) => Number.isInteger(n) && n >= 0)) return toast.error("Stock and reorder threshold must be whole numbers.");
    addProduct({
      name: productName.trim(), sku: sku.trim(), category, price: parsedPrice, unitCost: parsedCost,
      stockOnHand: parsedStock, reorderAt: parsedReorder, active: true,
      size: size.trim() || undefined, color: color.trim() || undefined, imageUrl: imageUrl.trim() || undefined,
    });
    setProductName(""); setSku(""); setSize(""); setColor(""); setImageUrl(""); setPrice("30"); setUnitCost("10"); setStock("24"); setReorderAt("5");
    setShowProductForm(false);
    toast.success("Merch product added to inventory.");
  }

  function submitSale(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const product = products.find((item) => item.id === saleProductId);
    const parsedQuantity = Number(quantity);
    const parsedPrice = salePrice.trim() === "" ? product?.price : Number(salePrice);
    if (!product) return toast.error("Choose a product to sell.");
    if (!Number.isInteger(parsedQuantity) || parsedQuantity < 1) return toast.error("Quantity must be a whole number above zero.");
    if (parsedPrice === undefined || !Number.isFinite(parsedPrice) || parsedPrice < 0) return toast.error("Enter a valid sale price.");
    try {
      setCartItems((current) => {
        const found = current.find((item) => item.productId === product.id);
        return found
          ? current.map((item) => item.productId === product.id ? { ...item, quantity: item.quantity + parsedQuantity, unitPrice: parsedPrice } : item)
          : [...current, { productId: product.id, quantity: parsedQuantity, unitPrice: parsedPrice, unitCost: product.unitCost }];
      });
      setQuantity("1"); setSalePrice(""); setSaleNotes("");
      toast.success("Item added to this order.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sale could not be recorded.");
    }
  }

  function completeOrder() {
    try {
      recordOrder({
        channel: gigId ? "show" : "table",
        date: saleDate,
        lines: cartItems,
        discountAmount: Number(discount),
        taxAmount: Number(tax),
        processingFee: Number(fee),
        paymentMethod,
        gigId: gigId || undefined,
        member: member.trim() || undefined,
        notes: saleNotes.trim(),
      });
      setCartItems([]); setDiscount("0"); setTax("0"); setFee("0"); setMember(""); setSaleNotes("");
      toast.success("Paid order recorded; inventory and ledger updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Order could not be recorded.");
    }
  }

  function submitRestock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const amount = Number(restockQuantity);
      adjustProduct(restockProductId, amount, adjustmentReason, adjustmentNote.trim() || adjustmentReason);
      toast.success("Inventory adjustment recorded.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Restock failed.");
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Eyebrow>Merch operations</Eyebrow>
          <h2 className="mt-2 text-xl font-extrabold tracking-tight">Merch & inventory</h2>
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted">
            Know what is in the merch bin, what sells at each show, and what needs reordering before the next run.
          </p>
        </div>
        <div className="grid size-11 shrink-0 place-items-center rounded-xl border border-line bg-surface-2">
          <ShoppingBag className="size-5 text-accent" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <MetricCard label="Gross sales" value={money(summary.grossSales)} hint={`less ${money(summary.discounts)} discounts`} />
        <MetricCard label="Net sales" value={money(summary.netSales)} hint="after discounts" />
        <MetricCard label="Gross profit" value={money(summary.grossProfit)} hint="sales less item cost" />
        <MetricCard label="Units sold" value={String(summary.unitsSold)} hint="across recorded sales" />
        <MetricCard label="Inventory at cost" value={money(summary.inventoryCostValue)} hint="current stock value" />
        <MetricCard label="Tax collected" value={money(summary.taxCollected)} hint="manual order entries" />
        <MetricCard label="Processor fees" value={money(summary.processingFees)} hint="manually entered" />
        <MetricCard label="After tax & fees" value={money(summary.netAfterTaxAndFees)} hint="before other costs" />
      </div>

      <Card className="border-warn/30 p-3.5">
        <div className="text-xs font-semibold">Online payments: setup required</div>
        <p className="mt-1 text-xs leading-relaxed text-muted">This screen records orders after you confirm payment. Stripe Checkout, payment links, provider webhooks, and provider-processed refunds are not configured, so no card payment is claimed as collected by the app.</p>
      </Card>

      {lowStock.length > 0 && (
        <Card className="border-warn/40 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warn" />
            <div className="min-w-0">
              <div className="text-sm font-semibold">{lowStock.length} item{lowStock.length === 1 ? "" : "s"} at or below reorder level</div>
              <p className="mt-1 text-xs leading-relaxed text-muted">{lowStock.map((item) => `${item.name} (${item.stockOnHand} left)`).join(" · ")}</p>
            </div>
          </div>
        </Card>
      )}

      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold">Inventory</h3>
        <div className="flex gap-3">
          <button type="button" onClick={() => downloadCsv("merch-inventory.csv", [
            ["name", "sku", "size", "color", "image_url", "category", "price", "unit_cost", "stock_on_hand", "reorder_at", "active"],
            ...products.map((p) => [p.name, p.sku, p.size ?? "", p.color ?? "", p.imageUrl ?? "", p.category, String(p.price), String(p.unitCost), String(p.stockOnHand), String(p.reorderAt), String(p.active)]),
          ])} className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted hover:text-fg">Export</button>
          <button type="button" onClick={() => setShowProductForm((value) => !value)} className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-accent">
            <Plus className="size-3.5" /> Add item
          </button>
        </div>
      </div>

      {showProductForm && (
        <Card className="p-4">
          <h3 className="mb-3 text-sm font-bold">Add merch product</h3>
          <form onSubmit={submitProduct} className="space-y-3">
            <label className="block text-xs font-semibold text-muted">Product name
              <input value={productName} onChange={(e) => setProductName(e.target.value)} placeholder="Settlement logo tee" required className="mt-1 w-full rounded-md border border-line bg-bg px-3 py-2.5 text-sm text-fg" />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs font-semibold text-muted">SKU / variant
                <input value={sku} onChange={(e) => setSku(e.target.value)} placeholder="MOSS-L" className="mt-1 w-full rounded-md border border-line bg-bg px-3 py-2.5 text-sm text-fg" />
              </label>
              <label className="text-xs font-semibold text-muted">Category
                <select value={category} onChange={(e) => setCategory(e.target.value as MerchCategory)} className="mt-1 w-full rounded-md border border-line bg-bg px-3 py-2.5 text-sm text-fg">
                  {MERCH_CATEGORIES.map((item) => <option key={item} value={item}>{categoryLabel[item]}</option>)}
                </select>
              </label>
              <label className="text-xs font-semibold text-muted">Size / variant
                <input value={size} onChange={(e) => setSize(e.target.value)} placeholder="Large" className="mt-1 w-full rounded-md border border-line bg-bg px-3 py-2.5 text-sm text-fg" />
              </label>
              <label className="text-xs font-semibold text-muted">Color
                <input value={color} onChange={(e) => setColor(e.target.value)} placeholder="Moss green" className="mt-1 w-full rounded-md border border-line bg-bg px-3 py-2.5 text-sm text-fg" />
              </label>
              <label className="col-span-2 text-xs font-semibold text-muted">Product image URL (optional)
                <input type="url" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…" className="mt-1 w-full rounded-md border border-line bg-bg px-3 py-2.5 text-sm text-fg" />
              </label>
              <label className="text-xs font-semibold text-muted">Sale price ($)
                <input type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} required className="mt-1 w-full rounded-md border border-line bg-bg px-3 py-2.5 text-sm text-fg" />
              </label>
              <label className="text-xs font-semibold text-muted">Unit cost ($)
                <input type="number" min="0" step="0.01" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} required className="mt-1 w-full rounded-md border border-line bg-bg px-3 py-2.5 text-sm text-fg" />
              </label>
              <label className="text-xs font-semibold text-muted">Opening stock
                <input type="number" min="0" step="1" value={stock} onChange={(e) => setStock(e.target.value)} required className="mt-1 w-full rounded-md border border-line bg-bg px-3 py-2.5 text-sm text-fg" />
              </label>
              <label className="text-xs font-semibold text-muted">Reorder at
                <input type="number" min="0" step="1" value={reorderAt} onChange={(e) => setReorderAt(e.target.value)} required className="mt-1 w-full rounded-md border border-line bg-bg px-3 py-2.5 text-sm text-fg" />
              </label>
            </div>
            <div className="flex gap-2">
              <button type="submit" className="h-10 rounded-md bg-accent px-4 text-sm font-semibold text-accent-fg">Save product</button>
              <button type="button" onClick={() => setShowProductForm(false)} className="h-10 rounded-md border border-line px-4 text-sm font-semibold">Cancel</button>
            </div>
          </form>
        </Card>
      )}

      {orders.length > 0 && (
        <>
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-bold">Order history</h3>
            <button type="button" onClick={() => downloadCsv("merch-orders.csv", [
              ["order_id", "date", "status", "channel", "show", "subtotal", "discount", "tax", "fee", "total", "payment", "member", "notes"],
              ...orders.map((order) => [order.id, order.date, order.status, order.channel, order.gigId ?? "", String(order.subtotal), String(order.discountAmount), String(order.taxAmount), String(order.processingFee), String(order.total), order.paymentMethod, order.member ?? "", order.notes]),
            ])} className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted hover:text-fg">Export orders</button>
          </div>
          <input value={orderQuery} onChange={(event) => setOrderQuery(event.target.value)} placeholder="Search orders, shows, members, or items" className="w-full rounded-md border border-line bg-bg px-3 py-2 text-sm text-fg" />
          {filteredOrders.slice(0, 100).map((order) => (
            <Card key={order.id} className="p-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-xs font-semibold">Order {order.id.slice(0, 8)} · {order.status}</div>
                  <div className="mt-1 text-xs text-muted">{longDate(order.date)} · {order.lines.length} item types · {order.channel}{order.member ? ` · ${order.member}` : ""}</div>
                  <div className="mt-1 text-[10px] text-muted">Subtotal {money(order.subtotal)} · discount {money(order.discountAmount)} · tax {money(order.taxAmount)} · fees {money(order.processingFee)}</div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-sm font-bold">{money(order.total)}</div>
                  {order.status === "paid" && <button type="button" onClick={() => {
                    if (window.confirm("Record a full refund for this order? Process the refund in the payment provider first if this was paid by card.")) {
                      refundOrder(order.id, true, "Full refund; provider action must be completed separately if applicable.");
                      toast.success("Refund recorded and returned items added back to stock.");
                    }
                  }} className="mt-1 text-[10px] font-semibold text-danger">Record full refund</button>}
                </div>
              </div>
            </Card>
          ))}
        </>
      )}

      {adjustments.length > 0 && (
        <details className="rounded-lg border border-line bg-surface p-3.5">
          <summary className="cursor-pointer text-xs font-semibold">Inventory adjustment history ({adjustments.length})</summary>
          <div className="mt-3 space-y-2">
            {adjustments.slice(0, 20).map((adjustment) => {
              const product = products.find((item) => item.id === adjustment.productId);
              return <div key={adjustment.id} className="flex justify-between gap-2 text-xs text-muted"><span>{adjustment.date} · {product?.name ?? "Item"} · {adjustment.reason}</span><span className="font-semibold">{adjustment.quantityDelta > 0 ? "+" : ""}{adjustment.quantityDelta}</span></div>;
            })}
          </div>
        </details>
      )}

      {products.length === 0 ? (
        <Card className="p-5">
          <div className="grid size-10 place-items-center rounded-lg bg-surface-2"><PackagePlus className="size-5 text-accent" /></div>
          <h3 className="mt-3 text-sm font-bold">Start your merch catalog</h3>
          <p className="mt-1 text-sm leading-relaxed text-muted">Add shirts by size/color, vinyl, stickers, hats, posters, or any item you sell. Each variant can have its own stock count and margin.</p>
          <button type="button" onClick={() => setShowProductForm(true)} className="mt-4 h-10 rounded-md bg-accent px-4 text-sm font-semibold text-accent-fg">Add first item</button>
        </Card>
      ) : (
        <div className="space-y-2">
          {sortedProducts.map((product) => {
            const low = product.active && product.stockOnHand <= product.reorderAt;
            return (
              <Card key={product.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold">{product.name}</div>
                    <div className="mt-1 text-xs text-muted">{categoryLabel[product.category]}{product.sku ? ` · ${product.sku}` : ""}{product.size ? ` · ${product.size}` : ""}{product.color ? ` · ${product.color}` : ""}</div>
                    <div className={cn("mt-2 text-xs font-semibold", low ? "text-warn" : "text-muted")}>{product.stockOnHand} in stock{low ? " · REORDER" : ""}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-sm font-bold tabular">{money(product.price)}</div>
                    <div className="mt-1 text-xs text-muted">{money(product.price - product.unitCost)} gross / unit</div>
                    <div className="text-[10px] text-muted">{Math.round((product.price > 0 ? (product.price - product.unitCost) / product.price : 0) * 100)}% margin</div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {activeProducts.length > 0 && (
        <>
          <Eyebrow>Record a sale</Eyebrow>
          <Card className="p-4">
            <p className="mb-3 text-xs leading-relaxed text-muted">Build a multi-item order, then record it after payment has been collected. This manual flow does not process card payments or confirm external provider payments.</p>
            <form onSubmit={submitSale} className="space-y-3">
              <label className="block text-xs font-semibold text-muted">Product
                <select value={saleProductId} onChange={(e) => { const id = e.target.value; setSaleProductId(id); setSalePrice(""); }} required className="mt-1 w-full rounded-md border border-line bg-bg px-3 py-2.5 text-sm text-fg">
                  <option value="">Choose merch item</option>
                  {activeProducts.map((product) => <option key={product.id} value={product.id}>{product.name} — {product.stockOnHand} left</option>)}
                </select>
              </label>
              {selectedProduct && <p className="text-xs text-muted">Default price {money(selectedProduct.price)} · item cost {money(selectedProduct.unitCost)} · {selectedProduct.stockOnHand} in stock</p>}
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs font-semibold text-muted">Quantity
                  <input type="number" min="1" step="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} required className="mt-1 w-full rounded-md border border-line bg-bg px-3 py-2.5 text-sm text-fg" />
                </label>
                <label className="text-xs font-semibold text-muted">Actual unit price ($)
                  <input type="number" min="0" step="0.01" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} placeholder={selectedProduct ? selectedProduct.price.toFixed(2) : "0.00"} className="mt-1 w-full rounded-md border border-line bg-bg px-3 py-2.5 text-sm text-fg" />
                </label>
                <label className="text-xs font-semibold text-muted">Date
                  <input type="date" value={saleDate} onChange={(e) => setSaleDate(e.target.value)} required className="mt-1 w-full rounded-md border border-line bg-bg px-3 py-2.5 text-sm text-fg" />
                </label>
                <label className="text-xs font-semibold text-muted">Payment
                  <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as MerchPaymentMethod)} className="mt-1 w-full rounded-md border border-line bg-bg px-3 py-2.5 text-sm text-fg">
                    {MERCH_PAYMENT_METHODS.map((item) => <option key={item} value={item}>{paymentLabel[item]}</option>)}
                  </select>
                </label>
              </div>
              <label className="block text-xs font-semibold text-muted">Link to show (optional)
                <select value={gigId} onChange={(e) => setGigId(e.target.value)} className="mt-1 w-full rounded-md border border-line bg-bg px-3 py-2.5 text-sm text-fg">
                  <option value="">Not linked to a show</option>
                  {gigs.map((gig) => <option key={gig.id} value={gig.id}>{gig.date || "No date"} · {gig.venue || gig.name}</option>)}
                </select>
              </label>
              <label className="block text-xs font-semibold text-muted">Handled by (optional)
                <input value={member} onChange={(e) => setMember(e.target.value)} placeholder="Band member" className="mt-1 w-full rounded-md border border-line bg-bg px-3 py-2.5 text-sm text-fg" />
              </label>
              <label className="block text-xs font-semibold text-muted">Notes (optional)
                <input value={saleNotes} onChange={(e) => setSaleNotes(e.target.value)} placeholder="Bundle, discount, who handled the table…" className="mt-1 w-full rounded-md border border-line bg-bg px-3 py-2.5 text-sm text-fg" />
              </label>
              <button type="submit" className="h-11 w-full rounded-md bg-accent px-4 text-sm font-semibold text-accent-fg">Add item to order</button>
            </form>
            {cartItems.length > 0 && (
              <div className="mt-4 space-y-3 border-t border-line pt-4">
                <div className="text-sm font-bold">Current order · {cartItems.reduce((sum, item) => sum + item.quantity, 0)} units</div>
                {cartItems.map((item) => {
                  const product = products.find((entry) => entry.id === item.productId);
                  return <div key={item.productId} className="flex justify-between text-xs"><span>{product?.name ?? "Item"} × {item.quantity}</span><span>{money(item.quantity * item.unitPrice)}</span></div>;
                })}
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-xs font-semibold text-muted">Discount ($)<input type="number" min="0" step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} className="mt-1 w-full rounded-md border border-line bg-bg px-3 py-2.5 text-sm text-fg" /></label>
                  <label className="text-xs font-semibold text-muted">Sales tax ($)<input type="number" min="0" step="0.01" value={tax} onChange={(e) => setTax(e.target.value)} className="mt-1 w-full rounded-md border border-line bg-bg px-3 py-2.5 text-sm text-fg" /></label>
                  <label className="text-xs font-semibold text-muted">Processing fee ($)<input type="number" min="0" step="0.01" value={fee} onChange={(e) => setFee(e.target.value)} className="mt-1 w-full rounded-md border border-line bg-bg px-3 py-2.5 text-sm text-fg" /></label>
                  <div className="self-end text-xs text-muted">Total: {money(Math.max(0, cartItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0) - Number(discount) + Number(tax)))}</div>
                </div>
                <button type="button" onClick={completeOrder} className="h-11 w-full rounded-md bg-accent px-4 text-sm font-semibold text-accent-fg">Record paid order</button>
                <button type="button" onClick={() => setCartItems([])} className="w-full py-2 text-xs font-semibold text-muted">Clear cart</button>
              </div>
            )}
          </Card>

          <Eyebrow>Inventory adjustment</Eyebrow>
          <Card className="p-4">
            <form onSubmit={submitRestock} className="space-y-3">
              <label className="block text-xs font-semibold text-muted">Product
                <select value={restockProductId} onChange={(e) => setRestockProductId(e.target.value)} required className="mt-1 w-full rounded-md border border-line bg-bg px-3 py-2.5 text-sm text-fg">
                  <option value="">Choose item</option>
                  {products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs font-semibold text-muted">Reason
                  <select value={adjustmentReason} onChange={(e) => {
                    const next = e.target.value as typeof adjustmentReason;
                    setAdjustmentReason(next);
                    setRestockQuantity((current) => {
                      const amount = Math.abs(Number(current) || 1);
                      return next === "restock" ? String(amount) : next === "comp" || next === "damage" ? String(-amount) : current;
                    });
                  }} className="mt-1 w-full rounded-md border border-line bg-bg px-3 py-2.5 text-sm text-fg">
                    <option value="restock">Restock (+ units)</option><option value="comp">Comp (− units)</option><option value="damage">Damage (− units)</option><option value="correction">Count correction (+/−)</option>
                  </select>
                </label>
                <label className="text-xs font-semibold text-muted">Units {adjustmentReason === "restock" ? "to add" : "change (+/−)"}
                  <input type="number" step="1" value={restockQuantity} onChange={(e) => setRestockQuantity(e.target.value)} required className="mt-1 w-full rounded-md border border-line bg-bg px-3 py-2.5 text-sm text-fg" />
                </label>
              </div>
              <label className="block text-xs font-semibold text-muted">Note (optional)
                <input value={adjustmentNote} onChange={(e) => setAdjustmentNote(e.target.value)} placeholder="Purchase, damaged item, or count explanation" className="mt-1 w-full rounded-md border border-line bg-bg px-3 py-2.5 text-sm text-fg" />
              </label>
              <button type="submit" className="h-10 w-full rounded-md bg-accent px-4 text-sm font-semibold text-accent-fg">Save inventory adjustment</button>
            </form>
          </Card>
        </>
      )}

      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold">Recent sales</h3>
        <button type="button" onClick={() => downloadCsv("merch-sales.csv", [
          ["date", "product", "quantity", "unit_price", "unit_cost", "gross_sales", "discount", "tax", "processing_fee", "gross_profit", "payment", "order_id", "channel", "member", "show", "notes"],
          ...sales.map((sale) => {
            const product = products.find((item) => item.id === sale.productId);
            return [sale.date, product?.name ?? "Deleted product", String(sale.quantity), String(sale.unitPrice), String(sale.unitCost), String(sale.quantity * sale.unitPrice), String(sale.discountAmount ?? 0), String(sale.taxAmount ?? 0), String(sale.processingFee ?? 0), String(sale.quantity * sale.unitPrice - (sale.discountAmount ?? 0) - sale.quantity * sale.unitCost), sale.paymentMethod, sale.orderId ?? "", sale.channel ?? "", sale.member ?? "", sale.gigId ?? "", sale.notes];
          }),
        ])} className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted hover:text-fg">Export sales</button>
      </div>
      {sales.length === 0 ? (
        <Card className="p-4 text-sm text-muted">Your item-level sales, show links, payment methods, and margins will appear here after the first sale.</Card>
      ) : (
        <div className="space-y-2">
          {sales.slice(0, 30).map((sale) => {
            const product = products.find((item) => item.id === sale.productId);
            const gig = gigs.find((item) => item.id === sale.gigId);
            const gross = sale.quantity * sale.unitPrice;
            const profit = sale.quantity * (sale.unitPrice - sale.unitCost);
            return (
              <Card key={sale.id} className="p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{product?.name ?? "Product" } × {sale.quantity}</div>
                    <div className="mt-1 text-xs text-muted">{longDate(sale.date)} · {paymentLabel[sale.paymentMethod]}{gig ? ` · ${gig.venue || gig.name}` : ""}</div>
                    {sale.notes && <div className="mt-1 text-xs text-muted">{sale.notes}</div>}
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-sm font-bold tabular">{money(gross)}</div>
                    <div className={cn("mt-1 text-xs font-semibold", profit < 0 ? "text-danger" : "text-live")}>{money(profit)} gross profit</div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Card className="p-4">
        <div className="flex items-start gap-3">
          <TrendingUp className="mt-0.5 size-4 shrink-0 text-accent" />
          <div>
            <div className="text-sm font-semibold">Built for the road</div>
            <p className="mt-1 text-xs leading-relaxed text-muted">Products can be tracked by size and color, and each order can contain multiple items with discount, tax, processor fee, show, and member attribution. Online checkout, refunds/voids, provider webhooks, and cross-device stock locking are not connected yet.</p>
            <Link to="/money" className="mt-3 inline-flex text-xs font-semibold text-accent">Open money ledger →</Link>
          </div>
        </div>
      </Card>
    </div>
  );
}
