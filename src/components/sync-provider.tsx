"use client";

import { useEffect, useSyncExternalStore } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  getSyncSnapshot,
  startSyncEngine,
  subscribeSync,
  synchronizeNow,
} from "@/lib/offline/sync-engine";

function SyncIndicator() {
  const state = useSyncExternalStore(
    subscribeSync,
    getSyncSnapshot,
    getSyncSnapshot
  );

  const label = !state.online
    ? state.pendingCount > 0
      ? `Offline · ${state.pendingCount} pendente${state.pendingCount > 1 ? "s" : ""}`
      : "Offline"
    : state.phase === "syncing"
      ? "Sincronizando..."
      : state.phase === "conflict"
        ? `${state.conflictCount} conflito${state.conflictCount > 1 ? "s" : ""}`
        : state.phase === "error"
          ? "Erro de sincronização"
          : state.pendingCount > 0
            ? `${state.pendingCount} alteração${state.pendingCount > 1 ? "ões" : ""} pendente${state.pendingCount > 1 ? "s" : ""}`
            : "Online · Sincronizado";

  const color = !state.online
    ? "bg-slate-800 text-white"
    : state.phase === "error" || state.phase === "conflict"
      ? "bg-amber-100 text-amber-900 border-amber-300"
      : state.phase === "syncing" || state.pendingCount > 0
        ? "bg-blue-100 text-blue-900 border-blue-300"
        : "bg-emerald-100 text-emerald-900 border-emerald-300";

  return (
    <button
      type="button"
      onClick={() => void synchronizeNow()}
      title={state.errorMessage ?? "Estado da sincronização"}
      className={`fixed bottom-3 right-3 z-[1000] rounded-full border px-3 py-2 text-xs font-semibold shadow-lg ${color}`}
    >
      {label}
    </button>
  );
}

export function SyncProvider() {
  useEffect(() => {
    const supabase = createClient();
    let stop: (() => void) | undefined;

    void supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) {
        stop?.();
        stop = startSyncEngine(data.session.user.id);
      }
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      stop?.();
      stop = session?.user ? startSyncEngine(session.user.id) : undefined;
    });

    return () => {
      stop?.();
      subscription.subscription.unsubscribe();
    };
  }, []);

  return <SyncIndicator />;
}
