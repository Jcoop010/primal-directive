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
  const gigs = useMusician((s) => s.gigs);
  const addProduct = useMusician((s) => s.addMerchProduct);
  const restockProduct = useMusician((s) => s.restockMerchProduct);
  const recordSale = useMusician((s) => s.recordMerchSale);
  const [showProductForm, setShowProductForm] = useState(false);
  const [productName, setProductName] = useState("");
  const [sku, setSku] = useState("");
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

  const summary = useMemo(() => summarizeMerch(products, sales), [products, sales]);
  const activeProducts = products.filter((product) => product.active);
  const selectedProduct = products.find((product) => product.id === saleProductId);
  const lowStock = activeProducts.filter((product) => product.stockOnHand <= product.reorderAt);
  const sortedProducts = [...products].sort((a, b) => {
    const lowA = a.active && a.stockOnHand <= a.reorderAt ? 1 : 0;
    const lowB = b.active && b.stockOnHand <= b.reorderAt ? 1 : 0;
    return lowB - lowA || a.name.localeCompare(b.name);
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
    });
    setProductName(""); setSku(""); setPrice("30"); setUnitCost("10"); setStock("24"); setReorderAt("5");
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
      recordSale({
        productId: product.id, quantity: parsedQuantity, unitPrice: parsedPrice, unitCost: product.unitCost,
        date: saleDate, gigId: gigId || undefined, paymentMethod, notes: saleNotes.trim(),
      });
      setQuantity("1"); setSalePrice(""); setSaleNotes("");
      toast.success("Sale recorded and inventory reduced.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sale could not be recorded.");
    }
  }

  function submitRestock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const amount = Number(restockQuantity);
      restockProduct(restockProductId, amount);
      toast.success("Inventory restocked.");
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
        <MetricCard label="Merch sales" value={money(summary.grossSales)} hint="recorded revenue" />
        <MetricCard label="Gross profit" value={money(summary.grossProfit)} hint="sales less item cost" />
        <MetricCard label="Units sold" value={String(summary.unitsSold)} hint="across recorded sales" />
        <MetricCard label="Inventory at cost" value={money(summary.inventoryCostValue)} hint="current stock value" />
      </div>

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
            ["name", "sku", "category", "price", "unit_cost", "stock_on_hand", "reorder_at", "active"],
            ...products.map((p) => [p.name, p.sku, p.category, String(p.price), String(p.unitCost), String(p.stockOnHand), String(p.reorderAt), String(p.active)]),
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
                    <div className="mt-1 text-xs text-muted">{categoryLabel[product.category]}{product.sku ? ` · ${product.sku}` : ""}</div>
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
            <p className="mb-3 text-xs leading-relaxed text-muted">A sale reduces on-hand stock, snapshots the item cost for profit reporting, and records the collected revenue in Money.</p>
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
              <label className="block text-xs font-semibold text-muted">Notes (optional)
                <input value={saleNotes} onChange={(e) => setSaleNotes(e.target.value)} placeholder="Bundle, discount, who handled the table…" className="mt-1 w-full rounded-md border border-line bg-bg px-3 py-2.5 text-sm text-fg" />
              </label>
              <button type="submit" className="h-11 w-full rounded-md bg-accent px-4 text-sm font-semibold text-accent-fg">Record sale</button>
            </form>
          </Card>

          <Eyebrow>Restock inventory</Eyebrow>
          <Card className="p-4">
            <form onSubmit={submitRestock} className="flex items-end gap-2">
              <label className="min-w-0 flex-1 text-xs font-semibold text-muted">Product
                <select value={restockProductId} onChange={(e) => setRestockProductId(e.target.value)} required className="mt-1 w-full rounded-md border border-line bg-bg px-3 py-2.5 text-sm text-fg">
                  <option value="">Choose item</option>
                  {products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
                </select>
              </label>
              <label className="w-24 text-xs font-semibold text-muted">Add units
                <input type="number" min="1" step="1" value={restockQuantity} onChange={(e) => setRestockQuantity(e.target.value)} required className="mt-1 w-full rounded-md border border-line bg-bg px-3 py-2.5 text-sm text-fg" />
              </label>
              <button type="submit" aria-label="Restock selected product" className="grid size-10 shrink-0 place-items-center rounded-md bg-accent text-accent-fg"><PackagePlus className="size-4" /></button>
            </form>
          </Card>
        </>
      )}

      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold">Recent sales</h3>
        <button type="button" onClick={() => downloadCsv("merch-sales.csv", [
          ["date", "product", "quantity", "unit_price", "unit_cost", "gross_sales", "gross_profit", "payment", "show", "notes"],
          ...sales.map((sale) => {
            const product = products.find((item) => item.id === sale.productId);
            return [sale.date, product?.name ?? "Deleted product", String(sale.quantity), String(sale.unitPrice), String(sale.unitCost), String(sale.quantity * sale.unitPrice), String(sale.quantity * (sale.unitPrice - sale.unitCost)), sale.paymentMethod, sale.gigId ?? "", sale.notes];
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
            <p className="mt-1 text-xs leading-relaxed text-muted">Track apparel variants separately (for example, shirt color and size as separate SKUs), see reorder alerts, connect sales to a specific gig, and export records. Inventory purchases, card processor fees, sales tax, refunds, and member merch splits still need dedicated workflows before this becomes full merch accounting.</p>
            <Link to="/money" className="mt-3 inline-flex text-xs font-semibold text-accent">Open money ledger →</Link>
          </div>
        </div>
      </Card>
    </div>
  );
}
