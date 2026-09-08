import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { Field, Input, NativeSelect, Textarea } from "@/components/ui/input";
import { toIsoDay } from "@/lib/format";
import { useMusician } from "@/lib/store";
import {
  GIG_STATUS_LABEL,
  GIG_STATUSES,
  MONEY_TYPE_LABEL,
  MONEY_TYPES,
  PERSON_ROLE_LABEL,
  PERSON_ROLES,
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
  const { composer, gigs, setComposer, addGig, updateGig, removeGig } =
    useMusician();
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

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        onSave({
          name: name.trim(),
          venue: venue.trim(),
          city: city.trim(),
          date,
          fee: Number(fee) || 0,
          conf: Math.min(1, Math.max(0, (Number(conf) || 0) / 100)),
          status,
          notes: notes.trim(),
        });
      }}
    >
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
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Fee">
          <Input
            type="number"
            min={0}
            value={fee}
            onChange={(e) => setFee(e.target.value)}
            placeholder="0"
          />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Status">
          <NativeSelect
            value={status}
            onChange={(e) => setStatus(e.target.value as GigStatus)}
          >
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
      <Field label="Notes">
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Load-in, bill, follow-up…"
        />
      </Field>
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
  const { composer, people, setComposer, addPerson, updatePerson, removePerson } =
    useMusician();
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
        <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Band or person" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Role">
          <NativeSelect
            value={role}
            onChange={(e) => setRole(e.target.value as PersonRole)}
          >
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
  const { composer, money, gigs, setComposer, addMoney, updateMoney, removeMoney } =
    useMusician();
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
          <NativeSelect
            value={type}
            onChange={(e) => setType(e.target.value as MoneyType)}
          >
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
            step="1"
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
  const { composer, profile, setComposer, updateProfile, resetSample, clearAll } =
    useMusician();
  const [draft, setDraft] = useState(profile);
  const open = composer.profileOpen;

  return (
    <Drawer
      open={open}
      onOpenChange={(v) => {
        if (v) setDraft(useMusician.getState().profile);
        setComposer({ profileOpen: v });
      }}
      title="Artist profile"
    >
      {open ? (
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
                onChange={(e) =>
                  setDraft({ ...draft, feeTarget: Number(e.target.value) || 0 })
                }
              />
            </Field>
          </div>
          <Field label="Growth notes">
            <Textarea
              value={draft.notes}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
            />
          </Field>
          <Button type="submit" className="w-full">
            Save profile
          </Button>
          <div className="flex gap-2 pt-2">
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
                toast("Cleared local data");
                setComposer({ profileOpen: false });
              }}
            >
              Clear data
            </Button>
          </div>
        </form>
      ) : null}
    </Drawer>
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
        <Button
          variant="ghost"
          className="h-12 justify-start"
          onClick={() => openGig()}
        >
          Add gig
        </Button>
        <Button
          variant="ghost"
          className="h-12 justify-start"
          onClick={() => openPerson()}
        >
          Add contact
        </Button>
        <Button
          variant="ghost"
          className="h-12 justify-start"
          onClick={() => openMoney()}
        >
          Log money
        </Button>
      </div>
    </Drawer>
  );
}
