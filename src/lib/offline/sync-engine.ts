import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import {
  deleteRemoteEntity,
  getMetadata,
  getPendingEntityIds,
  getUserOutbox,
  markEntitySyncStatus,
  removeOutboxOperation,
  replaceUserEntities,
  setMetadata,
  updateOutboxOperation,
  upsertRemoteEntity,
} from "./db";
import type {
  EntityStore,
  EntityType,
  LocalEntity,
  OutboxOperation,
  SyncSnapshot,
} from "./types";

const STORE_BY_ENTITY: Record<EntityType, EntityStore> = {
  cliente: "clientes",
  visita: "visitas",
  planejamento: "planejamento",
};

const INITIAL_SNAPSHOT: SyncSnapshot = {
  online: typeof navigator === "undefined" ? true : navigator.onLine,
  phase: "synced",
  pendingCount: 0,
  conflictCount: 0,
  errorMessage: null,
  lastSyncedAt: null,
};

type ChangeRow = {
  cursor: number;
  entity_type: EntityType;
  entity_id: string;
  operation: "upsert" | "delete";
};

class SyncFailure extends Error {
  constructor(
    message: string,
    readonly kind: "temporary" | "conflict" | "permanent",
    readonly code: string
  ) {
    super(message);
  }
}

let snapshot = INITIAL_SNAPSHOT;
let activeUserId: string | null = null;
let runningPromise: Promise<void> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function emit(patch: Partial<SyncSnapshot>) {
  snapshot = { ...snapshot, ...patch };
  for (const listener of listeners) listener();
}

export function subscribeSync(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSyncSnapshot() {
  return snapshot;
}

function classifyError(error: PostgrestError | Error) {
  const code = "code" in error ? error.code : "NETWORK_ERROR";
  const message = error.message || "Falha de sincronização.";
  if (code === "40001" || /conflict|version/i.test(message)) {
    return new SyncFailure(message, "conflict", code);
  }
  if (
    code === "NETWORK_ERROR" ||
    code === "PGRST301" ||
    code.startsWith("08") ||
    /fetch|network|timeout|429|5\d\d/i.test(message)
  ) {
    return new SyncFailure(message, "temporary", code);
  }
  return new SyncFailure(message, "permanent", code);
}

async function assertCurrentUser(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user || data.user.id !== userId) {
    throw new SyncFailure("Sessão inválida para sincronização.", "permanent", "AUTH");
  }
}

async function fetchRemoteEntity(
  supabase: SupabaseClient,
  entityType: EntityType,
  entityId: string
) {
  const store = STORE_BY_ENTITY[entityType];
  const { data, error } = await supabase
    .from(store)
    .select("*")
    .eq("id", entityId)
    .maybeSingle();
  if (error) throw classifyError(error);
  return data as LocalEntity | null;
}

async function pushOperation(
  supabase: SupabaseClient,
  operation: OutboxOperation
) {
  const payload = operation.payload;
  let error: PostgrestError | null = null;

  if (operation.operation === "visita.create") {
    ({ error } = await supabase.rpc("registrar_visita_e_concluir_planejamento", {
      p_operation_id: operation.operation_id,
      p_visita_id: operation.entity_id,
      p_cliente_id: payload.cliente_id,
      p_visitado_em: payload.visitado_em,
      p_resultado: payload.resultado ?? null,
      p_necessidade: payload.necessidade ?? null,
      p_observacoes: payload.observacoes ?? null,
      p_planejamento_id: payload.planejamento_id ?? null,
    }));
  } else if (operation.operation === "cliente.create") {
    ({ error } = await supabase.from("clientes").insert(payload));
  } else if (operation.operation === "cliente.update") {
    const patch = payload.patch as Record<string, unknown>;
    const result = await supabase
      .from("clientes")
      .update(patch)
      .eq("id", operation.entity_id)
      .eq("version", operation.base_version)
      .select("id");
    error = result.error;
    if (!error && (result.data?.length ?? 0) === 0) {
      const remote = await fetchRemoteEntity(supabase, "cliente", operation.entity_id);
      const matchesPreviousAttempt =
        remote &&
        Object.entries(patch).every(
          ([field, value]) =>
            (remote as unknown as Record<string, unknown>)[field] === value
        );
      if (!matchesPreviousAttempt) {
        throw new SyncFailure("Cliente alterado em outro dispositivo.", "conflict", "VERSION");
      }
    }
  } else if (operation.operation === "planejamento.create") {
    ({ error } = await supabase.from("planejamento").insert(payload));
  } else if (operation.operation === "planejamento.remove") {
    ({ error } = await supabase.rpc("remover_planejamento", {
      p_operation_id: operation.operation_id,
      p_planejamento_id: operation.entity_id,
      p_expected_version: payload.expected_version,
    }));
  } else if (operation.operation === "planejamento.reorder") {
    ({ error } = await supabase.rpc("reordenar_rota", {
      p_operation_id: operation.operation_id,
      p_data: payload.data,
      p_expected_version: payload.expected_version,
      p_ordered_ids: payload.ordered_ids,
    }));
  }

  if (error) {
    if (error.code === "23505" && operation.operation.endsWith(".create")) {
      const existing = await fetchRemoteEntity(
        supabase,
        operation.entity_type,
        operation.entity_id
      );
      if (existing) return;
    }
    throw classifyError(error);
  }
}

async function processOutbox(supabase: SupabaseClient, userId: string) {
  let hasUncertainCommit = false;
  const now = Date.now();
  const operations = (await getUserOutbox(userId))
    .filter(
      (operation) =>
        ["pending", "retry", "syncing"].includes(operation.status) &&
        operation.next_attempt_at <= now
    )
    .sort((a, b) => a.created_at_local - b.created_at_local);

  for (const operation of operations) {
    const syncing = { ...operation, status: "syncing" as const };
    await updateOutboxOperation(syncing);
    try {
      await pushOperation(supabase, syncing);
      await removeOutboxOperation(operation.operation_id);
      if (operation.operation !== "planejamento.remove") {
        const remote = await fetchRemoteEntity(
          supabase,
          operation.entity_type,
          operation.entity_id
        );
        if (remote) {
          await upsertRemoteEntity(STORE_BY_ENTITY[operation.entity_type], remote);
        }
      }
    } catch (caught) {
      const failure =
        caught instanceof SyncFailure
          ? caught
          : new SyncFailure("Falha inesperada de sincronização.", "temporary", "UNKNOWN");
      const attempts = operation.attempt_count + 1;
      const status = failure.kind === "conflict"
        ? "conflict"
        : failure.kind === "temporary"
          ? "retry"
          : "error";
      const delay = Math.min(60_000, 1_000 * 2 ** Math.min(attempts, 6));
      await updateOutboxOperation({
        ...operation,
        status,
        attempt_count: attempts,
        next_attempt_at: Date.now() + delay + Math.floor(Math.random() * 500),
        last_error_code: failure.code,
        last_error_message: failure.message,
      });
      if (status === "retry") hasUncertainCommit = true;
      if (status === "conflict") {
        await markEntitySyncStatus(
          STORE_BY_ENTITY[operation.entity_type],
          userId,
          operation.entity_id,
          "conflict"
        );
      }
      if (status !== "retry") break;
    }
  }
  return hasUncertainCommit;
}

async function bootstrap(supabase: SupabaseClient, userId: string) {
  for (const storeName of ["clientes", "visitas", "planejamento"] as const) {
    const { data, error } = await supabase.from(storeName).select("*");
    if (error) throw classifyError(error);
    await replaceUserEntities(storeName, userId, (data ?? []) as LocalEntity[]);
  }

  const { data, error } = await supabase
    .from("sync_changes")
    .select("cursor")
    .order("cursor", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw classifyError(error);
  await setMetadata(`cursor:${userId}`, data?.cursor ?? 0);
}

async function pullChanges(supabase: SupabaseClient, userId: string) {
  const cursor = await getMetadata<number>(`cursor:${userId}`);
  if (cursor === null) {
    await bootstrap(supabase, userId);
    return;
  }

  const { data, error } = await supabase
    .from("sync_changes")
    .select("cursor, entity_type, entity_id, operation")
    .gt("cursor", cursor)
    .order("cursor", { ascending: true })
    .limit(500);
  if (error) throw classifyError(error);

  const pendingIds = await getPendingEntityIds(userId);
  for (const change of (data ?? []) as ChangeRow[]) {
    const key = `${change.entity_type}:${change.entity_id}`;
    const store = STORE_BY_ENTITY[change.entity_type];
    if (pendingIds.has(key)) {
      const operations = await getUserOutbox(userId);
      for (const operation of operations.filter(
        (item) => `${item.entity_type}:${item.entity_id}` === key
      )) {
        await updateOutboxOperation({
          ...operation,
          status: "conflict",
          last_error_code: "REMOTE_CHANGE",
          last_error_message: "O registro foi alterado remotamente.",
        });
      }
      await markEntitySyncStatus(store, userId, change.entity_id, "conflict");
    } else if (change.operation === "delete") {
      await deleteRemoteEntity(store, userId, change.entity_id);
    } else {
      const remote = await fetchRemoteEntity(supabase, change.entity_type, change.entity_id);
      if (remote) await upsertRemoteEntity(store, remote);
    }
    await setMetadata(`cursor:${userId}`, change.cursor);
  }
}

async function refreshRouteVersions(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("rota_estado")
    .select("data, version");
  if (error) throw classifyError(error);
  for (const route of data ?? []) {
    await setMetadata(`route-version:${userId}:${route.data}`, route.version);
  }
}

async function refreshSnapshot(userId: string, errorMessage: string | null = null) {
  const operations = await getUserOutbox(userId);
  const conflicts = operations.filter((operation) => operation.status === "conflict").length;
  const errors = operations.filter((operation) => operation.status === "error").length;
  const pending = operations.filter((operation) => operation.status !== "error").length;
  emit({
    online: navigator.onLine,
    phase: conflicts > 0 ? "conflict" : errors > 0 || errorMessage ? "error" : pending > 0 ? "pending" : "synced",
    pendingCount: pending,
    conflictCount: conflicts,
    errorMessage,
    lastSyncedAt: await getMetadata<number>(`last-sync:${userId}`),
  });
}

export async function synchronizeNow() {
  if (!activeUserId || !navigator.onLine) return;
  if (runningPromise) return runningPromise;

  runningPromise = (async () => {
    const userId = activeUserId!;
    emit({ online: true, phase: "syncing", errorMessage: null });
    try {
      const supabase = createClient();
      await assertCurrentUser(supabase, userId);
      const hasUncertainCommit = await processOutbox(supabase, userId);
      if (!hasUncertainCommit) {
        await pullChanges(supabase, userId);
        await refreshRouteVersions(supabase, userId);
      }
      const syncedAt = Date.now();
      await setMetadata(`last-sync:${userId}`, syncedAt);
      await refreshSnapshot(userId);
      window.dispatchEvent(new CustomEvent("rotacomercial:local-data-changed"));
    } catch (error) {
      await refreshSnapshot(
        userId,
        error instanceof Error ? error.message : "Falha de sincronização."
      );
    } finally {
      runningPromise = null;
    }
  })();

  return runningPromise;
}

function onOnline() {
  emit({ online: true });
  void synchronizeNow();
}

function onOffline() {
  emit({ online: false, phase: snapshot.pendingCount ? "pending" : snapshot.phase });
}

function onOutboxChanged() {
  if (!activeUserId) return;
  void refreshSnapshot(activeUserId).then(() => {
    if (navigator.onLine) void synchronizeNow();
  });
}

export function startSyncEngine(userId: string) {
  activeUserId = userId;
  window.addEventListener("online", onOnline);
  window.addEventListener("offline", onOffline);
  window.addEventListener("rotacomercial:outbox-changed", onOutboxChanged);
  void refreshSnapshot(userId).then(() => synchronizeNow());
  retryTimer = setInterval(() => void synchronizeNow(), 30_000);

  return () => {
    window.removeEventListener("online", onOnline);
    window.removeEventListener("offline", onOffline);
    window.removeEventListener("rotacomercial:outbox-changed", onOutboxChanged);
    if (retryTimer) clearInterval(retryTimer);
    retryTimer = null;
    activeUserId = null;
  };
}
