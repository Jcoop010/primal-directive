import { useEffect, useRef } from "react";
import { loadAppState, saveAppState } from "@/lib/persistence";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useMusician } from "@/lib/store";

/** Bridges the existing Zustand UX to the authenticated server source of truth. */
export function DurableSync() {
  const { user, isPending } = useCurrentUserState();
  const readyFor = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loading = useRef(false);

  useEffect(() => {
    if (isPending || !user) {
      readyFor.current = null;
      return;
    }
    if (readyFor.current === user.id || loading.current) return;
    loading.current = true;

    void loadAppState({ data: {} })
      .then(({ state }) => {
        if (state) {
          useMusician.setState((current) => ({
            ...current,
            gigs: state.gigs,
            people: state.people,
            money: state.money,
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
        readyFor.current = user.id;
      })
      .catch((error) => {
        console.error("[primal-directive] durable load failed", error);
      })
      .finally(() => {
        loading.current = false;
      });
  }, [user, isPending]);

  useEffect(() => {
    if (!user || isPending) return;
    const unsubscribe = useMusician.subscribe(() => {
      if (readyFor.current !== user.id || loading.current) return;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        const current = useMusician.getState();
        void saveAppState({
          data: {
            state: {
              gigs: current.gigs,
              people: current.people,
              money: current.money,
              chat: current.chat,
              profile: current.profile,
            },
          },
        }).catch((error) => console.error("[primal-directive] durable save failed", error));
      }, 650);
    });
    return () => {
      unsubscribe();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [user, isPending]);

  return null;
}
