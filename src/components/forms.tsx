import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { Field, Input, NativeSelect, Textarea } from "@/components/ui/input";
import { toIsoDay } from "@/lib/format";
import { computePreShowYield } from "@/lib/agent-signal-scoring";
import { suggestedFollowUp, bookingDraft } from "@/lib/booking-workflow";
import { useMusician } from "@/lib/store";
import {
  BILL_ROLES,
  BOOKING_STAGE_LABEL,
  BOOKING_STAGES,
  DEAL_TYPES,
  GIG_STATUS_LABEL,
  GIG_STATUSES,
  MONEY_TYPE_LABEL,
  MONEY_TYPES,
  PERSON_ROLE_LABEL,
  PERSON_ROLES,
  type BillRole,
  type BookingStage,
  type DealType,
  type Gig,
  type GigStatus,
  type MoneyEntry,
  type MoneyType,
  type Person,
  type PersonRole,
} from "@/lib/types";

function todayIso() {
  return toIsoDay(new Date());
}

export function GigDrawer() {
  const { composer, gigs, setComposer, addGig, updateGig, removeGig } = useMusician();
  const editing = gigs.find((g) => g.id === composer.editingGigId);
  const open = composer.gigOpen;
  return (
    <Drawer
      open={open}
      onOpenChange={(v) =>
        setComposer({ gigOpen: v, editingGigId: v ? composer.editingGigId : undefined })
      }
      title={editing ? "Edit gig" : "Add gig"}
    >
      {open ? (
        <GigForm
          key={editing?.id ?? "new"}
          initial={editing}
          onSave={(data) => {
            if (editing) {
              updateGig(editing.id, data);
              toast("Gig updated");
            } else {
              addGig(data);
              toast("Gig added to pipeline");
            }
            setComposer({ gigOpen: false, editingGigId: undefined });
          }}
          onDelete={
            editing
              ? () => {
                  removeGig(editing.id);
                  toast("Gig removed");
                  setComposer({ gigOpen: false, editingGigId: undefined });
                }
              : undefined
          }
        />
      ) : null}
    </Drawer>
  );
}

function GigForm({
  initial,
  onSave,
  onDelete,
}: {
  initial?: Gig;
  onSave: (data: Omit<Gig, "id">) => void;
  onDelete?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [venue, setVenue] = useState(initial?.venue ?? "");
  const [city, setCity] = useState(initial?.city ?? "");
  const [date, setDate] = useState(initial?.date ?? "");
  const [fee, setFee] = useState(String(initial?.fee ?? ""));
  const [conf, setConf] = useState(String(Math.round((initial?.conf ?? 0.5) * 100)));
  const [status, setStatus] = useState<GigStatus>(initial?.status ?? "lead");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [venueCapacity, setVenueCapacity] = useState(String(initial?.venueCapacity ?? ""));
  const [capacitySourceUrl, setCapacitySourceUrl] = useState(initial?.capacitySourceUrl || "");
  const [bookingContactName, setBookingContactName] = useState(initial?.bookingContactName || "");
  const [bookingContactSourceUrl, setBookingContactSourceUrl] = useState(initial?.bookingContactSourceUrl || "");
  const [bookingRoute, setBookingRoute] = useState(initial?.bookingRoute || "");
  const [researchSourceUrl, setResearchSourceUrl] = useState(initial?.researchSourceUrl ?? "");
  const [outreachContact, setOutreachContact] = useState(initial?.outreachContact ?? "");
  const [outreachNextFollowUp, setOutreachNextFollowUp] = useState(
    initial?.outreachNextFollowUp ?? "",
  );
  const [outreachLastContactedAt, setOutreachLastContactedAt] = useState(
    initial?.outreachLastContactedAt ?? "",
  );
  const [outreachNotes, setOutreachNotes] = useState(initial?.outreachNotes ?? "");
  const [corridor, setCorridor] = useState(initial?.corridor ?? "");
  const [billRole, setBillRole] = useState<BillRole | "">(initial?.billRole ?? "");
  const [targetWindow, setTargetWindow] = useState(initial?.targetWindow ?? "");
  const [dealType, setDealType] = useState<DealType | "">(initial?.dealType ?? "");
  const [bookingStage, setBookingStage] = useState<BookingStage>(initial?.bookingStage ?? "lead");
  const [epkReady, setEpkReady] = useState(Boolean(initial?.epkReady));
  const [techPlotReady, setTechPlotReady] = useState(Boolean(initial?.techPlotReady));
  const [routingChecked, setRoutingChecked] = useState(Boolean(initial?.routingChecked));
  const [outreachDraft, setOutreachDraft] = useState(initial?.outreachDraft ?? "");
  const [guaranteeOrSplitEst, setGuaranteeOrSplitEst] = useState(
    String(initial?.guaranteeOrSplitEst ?? initial?.fee ?? ""),
  );
  const [estAttendance, setEstAttendance] = useState(String(initial?.estAttendance ?? ""));
  const [merchPerHeadEst, setMerchPerHeadEst] = useState(String(initial?.merchPerHeadEst ?? ""));
  const [roadAndRoomCostEst, setRoadAndRoomCostEst] = useState(
    String(initial?.roadAndRoomCostEst ?? ""),
  );
  const [anchorGapNote, setAnchorGapNote] = useState(initial?.anchorGapNote ?? "");
  const [draftCopied, setDraftCopied] = useState(false);

  const yieldEst = computePreShowYield({
    guaranteeOrSplitEst: Number(guaranteeOrSplitEst) || 0,
    estAttendance: Number(estAttendance) || 0,
    merchPerHeadEst: Number(merchPerHeadEst) || 0,
    roadAndRoomCostEst: Number(roadAndRoomCostEst) || 0,
  });

  function copyOutreachDraft() {
    if (!outreachDraft.trim()) return;
    void navigator.clipboard
      ?.writeText(outreachDraft)
      .then(() => {
        setDraftCopied(true);
        toast.success("Outreach draft copied");
        window.setTimeout(() => setDraftCopied(false), 2000);
      })
      .catch(() => toast.error("Could not copy draft"));
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        try {
          onSave({
            name: name.trim(),
            venue: venue.trim(),
            city: city.trim(),
            date,
            fee: Number(fee) || 0,
            conf: Math.min(1, Math.max(0, (Number(conf) || 0) / 100)),
            status,
            notes: notes.trim(),
            venueCapacity: venueCapacity ? Number(venueCapacity) : undefined,
            capacitySourceUrl: capacitySourceUrl || undefined,
            bookingContactName: bookingContactName || undefined,
            bookingContactSourceUrl: bookingContactSourceUrl || undefined,
            bookingRoute: bookingRoute || undefined,
            researchSourceUrl,
            outreachContact,
            outreachNextFollowUp,
            outreachLastContactedAt,
            outreachNotes,
            corridor: corridor.trim() || undefined,
            billRole: billRole || undefined,
            targetWindow: targetWindow.trim() || undefined,
            dealType: dealType || undefined,
            bookingStage,
            epkReady,
            techPlotReady,
            routingChecked,
            outreachDraft: outreachDraft.trim() || undefined,
            guaranteeOrSplitEst: Number(guaranteeOrSplitEst) || 0,
            estAttendance: Math.max(0, Math.round(Number(estAttendance) || 0)),
            merchPerHeadEst: Number(merchPerHeadEst) || 0,
            roadAndRoomCostEst: Number(roadAndRoomCostEst) || 0,
            anchorGapNote: anchorGapNote.trim() || undefined,
            gapFitScore: initial?.gapFitScore,
            researchVerifiedAt:
              researchSourceUrl === initial?.researchSourceUrl ? initial?.researchVerifiedAt : "",
          });
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Unable to save booking");
        }
      }}
    >
      {/* Sticky Pre-Show Net Yield Summary Bar */}
      <div
        aria-label="Live pre-show net yield summary"
        className="sticky top-0 z-10 -mx-5 border-y border-[#243652] bg-[#0A1628]/95 px-5 py-2.5 backdrop-blur-md"
      >
        <div className="grid grid-cols-4 gap-2 text-center">
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted">
              Net yield
            </div>
            <div
              className={`tabular mt-0.5 text-sm font-bold ${
                yieldEst.netYieldEst >= 0 ? "text-live" : "text-danger"
              }`}
            >
              {yieldEst.netYieldEst >= 0 ? "+" : "-"}$
              {Math.abs(yieldEst.netYieldEst).toFixed(0)}
            </div>
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted">
              Merch gross
            </div>
            <div className="tabular mt-0.5 text-sm font-bold text-fg">
              ${yieldEst.merchGrossEst.toFixed(0)}
            </div>
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted">
              BE heads
            </div>
            <div className="tabular mt-0.5 text-sm font-bold text-fg">
              {yieldEst.breakEvenAttendance === null ? "N/A" : yieldEst.breakEvenAttendance}
            </div>
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted">
              BE $/head
            </div>
            <div className="tabular mt-0.5 text-sm font-bold text-fg">
              {yieldEst.breakEvenMerchPerHead === null
                ? "N/A"
                : `$${yieldEst.breakEvenMerchPerHead.toFixed(2)}`}
            </div>
          </div>
        </div>
      </div>

      <Field label="Opportunity">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Saturday support, festival hold…"
          required
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Venue">
          <Input value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="Room" />
        </Field>
        <Field label="City">
          <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City, ST" />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date">
          <Input
            type="date"
            required={status === "booked"}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>
        <Field label="Fee">
          <Input
            type="number"
            min={0}
            step="0.01"
            value={fee}
            onChange={(e) => setFee(e.target.value)}
            placeholder="0"
          />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Status">
          <NativeSelect value={status} onChange={(e) => setStatus(e.target.value as GigStatus)}>
            {GIG_STATUSES.map((s) => (
              <option key={s} value={s}>
                {GIG_STATUS_LABEL[s]}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Confidence %">
          <Input
            type="number"
            min={0}
            max={100}
            value={conf}
            onChange={(e) => setConf(e.target.value)}
          />
        </Field>
      </div>
      {initial?.stageHistory?.length ? <details className="rounded-lg border border-line p-3 text-xs"><summary className="min-h-11 cursor-pointer py-3 text-muted">Booking stage history</summary><ol className="space-y-2">{initial.stageHistory.map((entry, index) => <li key={index}>{GIG_STATUS_LABEL[entry.from]} → {GIG_STATUS_LABEL[entry.to]} · {entry.at.slice(0, 16).replace("T", " ")} UTC</li>)}</ol></details> : null}
      <Field label="Notes">
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Load-in, bill, follow-up…"
        />
      </Field>
      {/* Section 1: Show Economics & Gap Context */}
      <section
        aria-label="Show economics and routing gap context"
        className="space-y-3 rounded-xl border border-line-strong bg-surface p-3.5"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-fg">1. Show economics &amp; gap context</h3>
          {typeof initial?.gapFitScore === "number" ? (
            <span className="tabular rounded-full border border-live/45 bg-live/12 px-2 py-0.5 text-[11px] font-bold text-live">
              Gap fit {initial.gapFitScore}
            </span>
          ) : null}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Show payout / door est. ($)">
            <Input
              type="number"
              min={0}
              step="1"
              value={guaranteeOrSplitEst}
              onChange={(e) => setGuaranteeOrSplitEst(e.target.value)}
              placeholder="500"
            />
          </Field>
          <Field label="Est. attendance">
            <Input
              type="number"
              min={0}
              step="1"
              value={estAttendance}
              onChange={(e) => setEstAttendance(e.target.value)}
              placeholder="80"
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Merch / head est. ($)">
            <Input
              type="number"
              min={0}
              step="0.5"
              value={merchPerHeadEst}
              onChange={(e) => setMerchPerHeadEst(e.target.value)}
              placeholder="6"
            />
          </Field>
          <Field label="Road &amp; room cost est. ($)">
            <Input
              type="number"
              min={0}
              step="1"
              value={roadAndRoomCostEst}
              onChange={(e) => setRoadAndRoomCostEst(e.target.value)}
              placeholder="350"
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Routing corridor">
            <Input
              value={corridor}
              onChange={(e) => setCorridor(e.target.value)}
              placeholder="I-40 / Southeast…"
            />
          </Field>
          <Field label="Target window">
            <Input
              value={targetWindow}
              onChange={(e) => setTargetWindow(e.target.value)}
              placeholder="Spring 2027 / Oct…"
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Bill role">
            <NativeSelect
              value={billRole}
              onChange={(e) => setBillRole(e.target.value as BillRole | "")}
            >
              <option value="">Unspecified</option>
              {BILL_ROLES.map((role) => (
                <option key={role} value={role}>
                  {role.replace("_", " ")}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Deal type">
            <NativeSelect
              value={dealType}
              onChange={(e) => setDealType(e.target.value as DealType | "")}
            >
              <option value="">Unspecified</option>
              {DEAL_TYPES.map((deal) => (
                <option key={deal} value={deal}>
                  {deal.replace("_", " ")}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </div>
        <Field label="Anchor routing gap note">
          <Input
            value={anchorGapNote}
            onChange={(e) => setAnchorGapNote(e.target.value)}
            placeholder="Bridges Fri Nashville -> Sun Asheville…"
          />
        </Field>
      </section>

      {/* Section 2: Booking Stage & Readiness */}
      <section
        aria-label="Booking stage and readiness"
        className="space-y-3 rounded-xl border border-[#243652] bg-[#0A1628]/80 p-3.5"
      >
        <h3 className="text-sm font-semibold text-fg">2. Booking stage &amp; readiness</h3>
        <Field label="Booking stage">
          <NativeSelect
            value={bookingStage}
            onChange={(e) => setBookingStage(e.target.value as BookingStage)}
          >
            {BOOKING_STAGES.map((stage) => (
              <option key={stage} value={stage}>
                {BOOKING_STAGE_LABEL[stage]}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {[
            { label: "EPK ready", checked: epkReady, toggle: () => setEpkReady((v) => !v) },
            {
              label: "Tech plot ready",
              checked: techPlotReady,
              toggle: () => setTechPlotReady((v) => !v),
            },
            {
              label: "Routing checked",
              checked: routingChecked,
              toggle: () => setRoutingChecked((v) => !v),
            },
          ].map((item) => (
            <label
              key={item.label}
              className={`flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border px-3 text-xs font-semibold transition-colors ${
                item.checked
                  ? "border-live/50 bg-live/12 text-live"
                  : "border-line bg-bg/60 text-soft hover:border-line-strong"
              }`}
            >
              <input
                type="checkbox"
                checked={item.checked}
                onChange={item.toggle}
                className="size-4 accent-[#E25822]"
              />
              <span>{item.label}</span>
            </label>
          ))}
        </div>
      </section>

      {/* Section 3: Outreach Draft */}
      <section
        aria-label="Outreach draft"
        className="space-y-3 rounded-xl border border-[#243652] bg-[#0A1628]/80 p-3.5"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-fg">3. Outreach draft</h3>
          <span className="rounded-full border border-[#E25822]/40 bg-[#E25822]/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#ffb088]">
            Human-reviewed only
          </span>
        </div>
        <Field label="Editable outreach pitch / hold request draft">
          <Textarea
            value={outreachDraft}
            onChange={(e) => setOutreachDraft(e.target.value)}
            rows={5}
            placeholder="Tailored venue pitch or hold request (never auto-sent)…"
          />
        </Field>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11px] text-muted">
            Saved to your private workspace; nothing is emailed automatically.
          </span>
          <button
            type="button"
            disabled={!outreachDraft.trim()}
            onClick={copyOutreachDraft}
            className={`min-h-10 rounded-lg border px-3.5 text-xs font-semibold transition-colors disabled:opacity-40 ${
              draftCopied
                ? "border-live/60 bg-live/15 text-live"
                : "border-line-strong bg-surface-2 text-fg hover:border-[#E25822]"
            }`}
          >
            {draftCopied ? "Copied!" : "Copy draft"}
          </button>
        </div>
      </section>
      <section
        aria-label="Booking research and outreach"
        className="space-y-3 rounded-lg border border-line p-3"
      >
        <h3 className="text-sm font-semibold">Research → pitch → follow-up</h3>
        {initial?.venueCapacity && initial.capacitySourceUrl && (
          <p className="text-xs text-soft">
            Source-cited capacity: {initial.venueCapacity} ·{" "}
            <a
              className="text-accent underline"
              href={initial.capacitySourceUrl}
              target="_blank"
              rel="noreferrer"
            >
              Review capacity evidence
            </a>
          </p>
        )}
        {initial?.bookingContactName && initial.bookingContactSourceUrl && (
          <p className="text-xs text-soft">
            Source-cited contact: {initial.bookingContactName} ·{" "}
            <a
              className="text-accent underline"
              href={initial.bookingContactSourceUrl}
              target="_blank"
              rel="noreferrer"
            >
              Review contact evidence
            </a>
          </p>
        )}
        <p className="text-xs text-muted">
          A recorded source is not booking confirmation. Review the recipient and claims before
          sending anything yourself.
        </p>
        <details className="rounded-lg border border-line p-3 text-xs">
          <summary className="min-h-11 cursor-pointer py-3 font-semibold text-muted">Edit venue facts and evidence</summary>
          <div className="mt-2 space-y-3">
            <Field label="Venue capacity"><Input type="number" min={1} max={1000000} step={1} value={venueCapacity} onChange={e => setVenueCapacity(e.target.value)} /></Field>
            <Field label="Capacity evidence URL"><Input type="url" pattern="https://.*" placeholder="https://" value={capacitySourceUrl} onChange={e => setCapacitySourceUrl(e.target.value)} /></Field>
            <Field label="Public booking contact"><Input value={bookingContactName} onChange={e => setBookingContactName(e.target.value)} /></Field>
            <Field label="Booking contact evidence URL"><Input type="url" pattern="https://.*" placeholder="https://" value={bookingContactSourceUrl} onChange={e => setBookingContactSourceUrl(e.target.value)} /></Field>
            <Field label="Booking submission URL"><Input type="url" pattern="https://.*" placeholder="https://" value={bookingRoute} onChange={e => setBookingRoute(e.target.value)} /></Field>
            <p className="text-muted">Enter only details supported by the linked page. Adding a link records a citation; it does not independently verify the claim.</p>
          </div>
        </details>
        <Field label="Official research source">
          <Input
            type="url"
            value={researchSourceUrl}
            onChange={(e) => setResearchSourceUrl(e.target.value)}
            placeholder="https://"
          />
        </Field>
        <Field label="Booking contact or submission route">
          <Input
            value={outreachContact}
            onChange={(e) => setOutreachContact(e.target.value)}
            placeholder="Official booking URL or a source-supported contact"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Last contacted (manual)">
            <Input
              type="date"
              value={outreachLastContactedAt}
              onChange={(e) => setOutreachLastContactedAt(e.target.value)}
            />
          </Field>
          <Field label="Next booking follow-up">
            <Input
              type="date"
              value={outreachNextFollowUp}
              onChange={(e) => setOutreachNextFollowUp(e.target.value)}
            />
          </Field>
        </div>
        <p className="text-xs text-muted">
          Saving a follow-up date synchronizes one internal task. No email or message is sent.
        </p>
        {status === "outreach" && !outreachNextFollowUp && suggestedFollowUp({ ...initial, status, outreachLastContactedAt } as Gig) && <Button type="button" variant="ghost" onClick={() => setOutreachNextFollowUp(suggestedFollowUp({ ...initial, status, outreachLastContactedAt } as Gig) || "")}>Schedule suggested follow-up (7 days after contact)</Button>}
        <Field label="Conversation and deal notes">
          <Textarea
            value={outreachNotes}
            maxLength={12000}
            onChange={(e) => setOutreachNotes(e.target.value)}
            placeholder="Responses, discussed terms, conditions and next action…"
          />
        </Field>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            const draft = bookingDraft(
              {
                ...initial,
                id: initial?.id ?? "draft",
                name,
                venue,
                city,
                date,
                fee: Number(fee) || 0,
                conf: Number(conf) / 100,
                status,
                notes,
              },
              useMusician.getState().profile,
            );
            setOutreachNotes((previous) =>
              [previous, "DRAFT — NOT SENT\n" + draft].filter(Boolean).join("\n\n"),
            );
            toast("Draft added to notes. Review and save before sending.");
          }}
        >
          Prepare personalized pitch
        </Button>
      </section>
      <div className="flex gap-2 pt-2">
        <Button type="submit" className="flex-1">
          Save gig
        </Button>
        {onDelete ? (
          <Button type="button" variant="ghost" onClick={onDelete}>
            Delete
          </Button>
        ) : null}
      </div>
    </form>
  );
}

export function PersonDrawer() {
  const { composer, people, setComposer, addPerson, updatePerson, removePerson } = useMusician();
  const editing = people.find((p) => p.id === composer.editingPersonId);
  const open = composer.personOpen;
  return (
    <Drawer
      open={open}
      onOpenChange={(v) =>
        setComposer({
          personOpen: v,
          editingPersonId: v ? composer.editingPersonId : undefined,
        })
      }
      title={editing ? "Edit contact" : "Add contact"}
    >
      {open ? (
        <PersonForm
          key={editing?.id ?? "new"}
          initial={editing}
          onSave={(data) => {
            if (editing) {
              updatePerson(editing.id, data);
              toast("Contact updated");
            } else {
              addPerson(data);
              toast("Contact added");
            }
            setComposer({ personOpen: false, editingPersonId: undefined });
          }}
          onDelete={
            editing
              ? () => {
                  removePerson(editing.id);
                  toast("Contact removed");
                  setComposer({ personOpen: false, editingPersonId: undefined });
                }
              : undefined
          }
        />
      ) : null}
    </Drawer>
  );
}

function PersonForm({
  initial,
  onSave,
  onDelete,
}: {
  initial?: Person;
  onSave: (data: Omit<Person, "id">) => void;
  onDelete?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [role, setRole] = useState<PersonRole>(initial?.role ?? "band");
  const [city, setCity] = useState(initial?.city ?? "");
  const [contact, setContact] = useState(initial?.contact ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        onSave({
          name: name.trim(),
          role,
          city: city.trim(),
          contact: contact.trim(),
          notes: notes.trim(),
        });
      }}
    >
      <Field label="Name">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="Band or person"
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Role">
          <NativeSelect value={role} onChange={(e) => setRole(e.target.value as PersonRole)}>
            {PERSON_ROLES.map((r) => (
              <option key={r} value={r}>
                {PERSON_ROLE_LABEL[r]}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="City">
          <Input value={city} onChange={(e) => setCity(e.target.value)} />
        </Field>
      </div>
      <Field label="Contact">
        <Input
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          placeholder="Email, IG, site…"
        />
      </Field>
      <Field label="Notes">
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
      <div className="flex gap-2 pt-2">
        <Button type="submit" className="flex-1">
          Save contact
        </Button>
        {onDelete ? (
          <Button type="button" variant="ghost" onClick={onDelete}>
            Delete
          </Button>
        ) : null}
      </div>
    </form>
  );
}

export function MoneyDrawer() {
  const { composer, money, gigs, setComposer, addMoney, updateMoney, removeMoney } = useMusician();
  const editing = money.find((m) => m.id === composer.editingMoneyId);
  const open = composer.moneyOpen;
  return (
    <Drawer
      open={open}
      onOpenChange={(v) =>
        setComposer({
          moneyOpen: v,
          editingMoneyId: v ? composer.editingMoneyId : undefined,
        })
      }
      title={editing ? "Edit entry" : "Add money"}
    >
      {open ? (
        <MoneyForm
          key={editing?.id ?? "new"}
          initial={editing}
          gigs={gigs}
          onSave={(data) => {
            if (editing) {
              updateMoney(editing.id, data);
              toast("Entry updated");
            } else {
              addMoney(data);
              toast("Money logged");
            }
            setComposer({ moneyOpen: false, editingMoneyId: undefined });
          }}
          onDelete={
            editing
              ? () => {
                  removeMoney(editing.id);
                  toast("Entry removed");
                  setComposer({ moneyOpen: false, editingMoneyId: undefined });
                }
              : undefined
          }
        />
      ) : null}
    </Drawer>
  );
}

function MoneyForm({
  initial,
  gigs,
  onSave,
  onDelete,
}: {
  initial?: MoneyEntry;
  gigs: Gig[];
  onSave: (data: Omit<MoneyEntry, "id">) => void;
  onDelete?: () => void;
}) {
  const [type, setType] = useState<MoneyType>(initial?.type ?? "collected");
  const [amount, setAmount] = useState(String(initial?.amount ?? ""));
  const [label, setLabel] = useState(initial?.label ?? "");
  const [date, setDate] = useState(initial?.date ?? todayIso());
  const [gigId, setGigId] = useState(initial?.gigId ?? "");

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!label.trim()) return;
        onSave({
          type,
          amount: Number(amount) || 0,
          label: label.trim(),
          date,
          gigId: gigId || undefined,
        });
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Type">
          <NativeSelect value={type} onChange={(e) => setType(e.target.value as MoneyType)}>
            {MONEY_TYPES.map((t) => (
              <option key={t} value={t}>
                {MONEY_TYPE_LABEL[t]}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Amount">
          <Input
            type="number"
            min={0}
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </Field>
      </div>
      <Field label="Label">
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Guarantee, merch, gas…"
          required
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Linked gig">
          <NativeSelect value={gigId} onChange={(e) => setGigId(e.target.value)}>
            <option value="">None</option>
            {gigs.map((g) => (
              <option key={g.id} value={g.id}>
                {g.venue || g.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>
      <div className="flex gap-2 pt-2">
        <Button type="submit" className="flex-1">
          Save
        </Button>
        {onDelete ? (
          <Button type="button" variant="ghost" onClick={onDelete}>
            Delete
          </Button>
        ) : null}
      </div>
    </form>
  );
}

export function ProfileDrawer() {
  const { composer, setComposer } = useMusician();
  return (
    <Drawer
      open={composer.profileOpen}
      onOpenChange={(open) => setComposer({ profileOpen: open })}
      title="Artist profile"
    >
      {composer.profileOpen ? <ProfileForm /> : null}
    </Drawer>
  );
}

// Mount a new draft for each opening, after DurableSync has loaded this account.
// A draft created with the shell can contain the demo seed or another account's
// old values and must never replace the current artist profile.
function ProfileForm() {
  const { profile, workspaceOwnerId, setComposer, updateProfile, resetSample, clearAll } = useMusician();
  const [draft, setDraft] = useState(profile);
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        updateProfile(draft);
        toast("Profile saved");
        setComposer({ profileOpen: false });
      }}
    >
      <Field label="Artist / band">
        <Input
          value={draft.artistName}
          onChange={(e) => setDraft({ ...draft, artistName: e.target.value })}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Home city">
          <Input
            value={draft.city}
            onChange={(e) => setDraft({ ...draft, city: e.target.value })}
          />
        </Field>
        <Field label="Genre">
          <Input
            value={draft.genre}
            onChange={(e) => setDraft({ ...draft, genre: e.target.value })}
          />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Typical draw">
          <Input
            value={draft.draw}
            onChange={(e) => setDraft({ ...draft, draw: e.target.value })}
          />
        </Field>
        <Field label="Fee target">
          <Input
            type="number"
            min={0}
            value={draft.feeTarget}
            onChange={(e) => setDraft({ ...draft, feeTarget: Number(e.target.value) || 0 })}
          />
        </Field>
      </div>
      <Field label="EPK URL"><Input type="url" value={draft.epkUrl || ""} placeholder="https://" onChange={(e) => setDraft({ ...draft, epkUrl: e.target.value })} /></Field>
      <Field label="Touring radius (miles)"><Input type="number" min={0} max={25000} value={draft.touringRadiusMiles ?? ""} onChange={(e) => setDraft({ ...draft, touringRadiusMiles: e.target.value === "" ? undefined : Number(e.target.value) })} /></Field>
      <Field label="Audience and markets"><Textarea value={draft.audience || ""} onChange={(e) => setDraft({ ...draft, audience: e.target.value })} placeholder="Describe your actual audience and strongest markets." /></Field>
      <Field label="Growth notes">
        <Textarea
          value={draft.notes}
          onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
        />
      </Field>
      <Button type="submit" className="w-full">Save profile</Button>
      {workspaceOwnerId && <Button type="button" variant="ghost" className="w-full" onClick={() => {
        const state = useMusician.getState();
        const { gigs, people, money, merchProducts, merchSales, merchOrders, merchInventoryAdjustments, merchRefunds, tasks, chat, profile } = state;
        const blob = new Blob([JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), gigs, people, money, merchProducts, merchSales, merchOrders, merchInventoryAdjustments, merchRefunds, tasks, chat, profile }, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "primal-directive-workspace.json"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      }}>Export complete workspace</Button>}
      {!workspaceOwnerId && <div className="flex gap-2 pt-2">
        <Button
          type="button"
          variant="ghost"
          className="flex-1"
          onClick={() => {
            resetSample();
            toast("Sample scene loaded");
            setComposer({ profileOpen: false });
          }}
        >
          Load sample
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="flex-1"
          onClick={() => {
            clearAll();
            toast("Demo data cleared");
            setComposer({ profileOpen: false });
          }}
        >
          Clear demo data
        </Button>
      </div>}
    </form>
  );
}

export function CommandDrawer() {
  const { composer, setComposer, openGig, openPerson, openMoney } = useMusician();
  return (
    <Drawer
      open={composer.commandOpen}
      onOpenChange={(v) => setComposer({ commandOpen: v })}
      title="Quick add"
    >
      <div className="grid gap-2">
        <Button variant="ghost" className="h-12 justify-start" onClick={() => openGig()}>
          Add gig
        </Button>
        <Button variant="ghost" className="h-12 justify-start" onClick={() => openPerson()}>
          Add contact
        </Button>
        <Button variant="ghost" className="h-12 justify-start" onClick={() => openMoney()}>
          Log money
        </Button>
      </div>
    </Drawer>
  );
}
