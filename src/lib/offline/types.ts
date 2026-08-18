export type EntityType = "cliente" | "visita" | "planejamento";
export type EntityStore = "clientes" | "visitas" | "planejamento";

export type OutboxOperationType =
  | "cliente.create"
  | "cliente.update"
  | "visita.create"
  | "planejamento.create"
  | "planejamento.remove"
  | "planejamento.reorder";

export type OutboxStatus =
  | "pending"
  | "syncing"
  | "retry"
  | "error"
  | "conflict";

export interface LocalEntity {
  id: string;
  user_id: string;
  version?: number;
  created_at?: string;
  updated_at?: string;
  _key?: string;
  _syncStatus?: "synced" | "pending" | "conflict";
}

export interface OutboxOperation {
  operation_id: string;
  user_id: string;
  entity_type: EntityType;
  entity_id: string;
  operation: OutboxOperationType;
  payload: Record<string, unknown>;
  base_version: number | null;
  status: OutboxStatus;
  attempt_count: number;
  next_attempt_at: number;
  created_at_local: number;
  last_error_code: string | null;
  last_error_message: string | null;
}

export type SyncPhase =
  | "synced"
  | "pending"
  | "syncing"
  | "error"
  | "conflict";

export interface SyncSnapshot {
  online: boolean;
  phase: SyncPhase;
  pendingCount: number;
  conflictCount: number;
  errorMessage: string | null;
  lastSyncedAt: number | null;
}
