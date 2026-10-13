import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { loadAppState, saveAppState } from "@/lib/persistence";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useMusician } from "@/lib/store";

/** Bridges the existing Zustand UX to the authenticated server source of truth. */
export function DurableSync() {
  const { user, isPending } = useCurrentUserState();
  const readyFor = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loading = useRef(false);
  const loadRequest = useRef(0);
  const activeUserId = useRef<string | null>(null);
  const version = useRef(0);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());

  // Keep queued work from a previous account from starting after an account switch.
  activeUserId.current = !isPending && user ? user.id : null;

  useEffect(() => {
    if (isPending || !user) {
      readyFor.current = null;
      version.current = 0;
      return;
    }
    if (readyFor.current === user.id || loading.current) return;

    const userId = user.id;
    const requestId = ++loadRequest.current;
    loading.current = true;

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
      })
      .catch((error) => {
        if (activeUserId.current !== userId || loadRequest.current !== requestId) return;
        console.error("[primal-directive] durable load failed", error);
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
  }, [user, isPending]);

  useEffect(() => {
    if (!user || isPending) return;
    const userId = user.id;
    const unsubscribe = useMusician.subscribe(() => {
      if (readyFor.current !== userId || activeUserId.current !== userId || loading.current) return;
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
            version.current = result.version;
          })
          .catch((error) => {
            console.error("[primal-directive] durable save failed", error);
            if (activeUserId.current === userId) {
              toast.error(
                error instanceof Error && error.message.includes("Workspace changed in another session")
                  ? "This workspace changed in another session. Reload before making more edits."
                  : "Couldn't save your latest changes. Keep this tab open and retry.",
              );
            }
          });
      }, 650);
    });

    return () => {
      unsubscribe();
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
    };
  }, [user, isPending]);

  return null;
}
