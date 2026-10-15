import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { loadAppState, saveAppState } from "@/lib/persistence";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useMusician } from "@/lib/store";
import { emptyPlanning } from "@/lib/artist-planning";
const PERSISTED_KEYS = ['gigs', 'people', 'money', 'merchProducts', 'merchSales', 'merchOrders', 'merchInventoryAdjustments', 'merchRefunds', 'tasks', 'planning', 'chat', 'profile'] as const;

/** Bridges the existing Zustand UX to the authenticated server source of truth. */
export function DurableSync() {
  const { user, isPending } = useCurrentUserState();
  const userId = user?.id ?? null;
  const readyFor = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loading = useRef(false);
  const loadRequest = useRef(0);
  const activeUserId = useRef<string | null>(null);
  const version = useRef(0);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const retrySave = useRef<(() => void) | null>(null);
  const dirty = useRef(false);
  const changeVersion = useRef(0);
  const [syncStatus, setSyncStatus] = useState<"loading" | "ready" | "error" | "unsaved">("loading");

  // Keep queued work from a previous account from starting after an account switch.
  activeUserId.current = !isPending ? userId : null;
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!dirty.current || !activeUserId.current) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);

  useEffect(() => {
    if (isPending || !userId) {
      readyFor.current = null;
      version.current = 0;
      dirty.current = false;
      setSyncStatus("loading");
      return;
    }
    if (readyFor.current === userId || loading.current) return;

    const requestId = ++loadRequest.current;
    loading.current = true;
    setSyncStatus("loading");

    void loadAppState({ data: {} })
      .then(({ state, version: loadedVersion }) => {
        if (activeUserId.current !== userId || loadRequest.current !== requestId) return;
        version.current = loadedVersion;
        if (state) {
          useMusician.setState((current) => ({
            ...current,
            gigs: state.gigs,
            people: state.people,
            money: state.money,
            merchProducts: state.merchProducts ?? [],
            merchSales: state.merchSales ?? [],
            merchOrders: state.merchOrders ?? [],
            merchInventoryAdjustments: state.merchInventoryAdjustments ?? [],
            merchRefunds: state.merchRefunds ?? [],
            tasks: state.tasks ?? [],
            planning: state.planning ?? emptyPlanning(),
            composer: { gigOpen: false, personOpen: false, moneyOpen: false, profileOpen: false, commandOpen: false },
            chat: state.chat,
            profile: state.profile,
          }));
        } else {
          // A first-time account must never inherit the browser's demo seed.
          useMusician.setState((current) => ({
            ...current,
            gigs: [],
            people: [],
            money: [],
            merchProducts: [],
            merchSales: [],
            merchOrders: [],
            merchInventoryAdjustments: [],
            merchRefunds: [],
            tasks: [],
            planning: emptyPlanning(),
            composer: { gigOpen: false, personOpen: false, moneyOpen: false, profileOpen: false, commandOpen: false },
            chat: [],
            profile: {
              artistName: "",
              city: "",
              genre: "",
              draw: "",
              feeTarget: 0,
              notes: "",
            },
          }));
        }
        readyFor.current = userId;
        dirty.current = false;
        changeVersion.current = 0;
        setSyncStatus("ready");
      })
      .catch((error) => {
        if (activeUserId.current !== userId || loadRequest.current !== requestId) return;
        console.error("[primal-directive] durable load failed", error);
        setSyncStatus("error");
        toast.error("Your saved workspace couldn't load. Refresh and try again before editing.");
      })
      .finally(() => {
        if (loadRequest.current === requestId) loading.current = false;
      });

    return () => {
      if (loadRequest.current === requestId) {
        loadRequest.current += 1;
        loading.current = false;
      }
    };
  }, [userId, isPending]);

  useEffect(() => {
    if (!userId || isPending) return;
    const scheduleSave = () => {
      if (readyFor.current !== userId || activeUserId.current !== userId || loading.current) return;
      dirty.current = true;
      const snapshotVersion = ++changeVersion.current;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        timer.current = null;
        if (activeUserId.current !== userId || readyFor.current !== userId) return;

        const current = useMusician.getState();
        const state = {
          gigs: current.gigs,
          people: current.people,
          money: current.money,
          merchProducts: current.merchProducts,
          merchSales: current.merchSales,
          merchOrders: current.merchOrders,
          merchInventoryAdjustments: current.merchInventoryAdjustments,
          merchRefunds: current.merchRefunds,
          tasks: current.tasks,
          planning: current.planning,
          chat: current.chat,
          profile: current.profile,
        };

        // Serialize writes and compare server versions so stale tabs cannot overwrite newer saves.
        saveQueue.current = saveQueue.current
          .catch(() => undefined)
          .then(async () => {
            if (activeUserId.current !== userId || readyFor.current !== userId) return;
            const result = await saveAppState({
              data: { state, expectedVersion: version.current },
            });
            if (activeUserId.current === userId && readyFor.current === userId) {
              version.current = result.version;
              if (snapshotVersion === changeVersion.current) {
                dirty.current = false;
                setSyncStatus('ready');
              }
            }
          })
          .catch((error) => {
            console.error("[primal-directive] durable save failed", error);
            if (activeUserId.current === userId) {
              const conflict = error instanceof Error && error.message.includes("Workspace changed in another session");
              if (conflict) {
                readyFor.current = null;
                setSyncStatus("error");
              } else setSyncStatus('unsaved');
              toast.error(
                conflict
                  ? "This workspace changed in another session. Reload before making more edits."
                  : "Couldn't save your latest changes. Keep this tab open and retry.",
              );
            }
          });
      }, 650);
    };
    const unsubscribe = useMusician.subscribe((state, previous) => {
      if (PERSISTED_KEYS.some(key => state[key] !== previous[key])) scheduleSave();
    });
    retrySave.current = scheduleSave;

    return () => {
      unsubscribe();
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      retrySave.current = null;
    };
  }, [userId, isPending]);

  if (syncStatus === "ready") return null;
  if (syncStatus === 'unsaved') return <div role="alert" className="fixed inset-x-4 bottom-24 z-40 mx-auto flex max-w-lg flex-wrap items-center justify-between gap-3 rounded-lg border border-danger bg-surface p-4 text-sm text-fg"><p>Changes are not saved yet. Keep this tab open.</p><button type="button" className="min-h-11 rounded-md border border-line px-3 font-semibold text-accent" onClick={() => retrySave.current?.()}>Retry save</button></div>;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed inset-0 z-[100] grid place-items-center bg-bg/95 px-5 py-8 backdrop-blur-sm"
    >
      <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-card">
        <div className="text-[11px] font-bold tracking-[0.22em] text-accent">PRIMAL DIRECTIVE</div>
        <h2 className="mt-3 text-xl font-extrabold tracking-tight">
          {syncStatus === "error" ? "Workspace not loaded" : "Loading your workspace"}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          {syncStatus === "error"
            ? "Your saved data could not be verified. Editing is paused to protect your work. Check your connection and reload to try again."
            : "We're retrieving your saved workspace before enabling edits."}
        </p>
        {syncStatus === "error" && (
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 inline-flex h-10 items-center justify-center rounded-lg bg-accent px-4 text-sm font-bold text-white"
          >
            Reload workspace
          </button>
        )}
      </div>
    </div>
  );
}
