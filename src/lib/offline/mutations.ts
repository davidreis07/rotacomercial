import {
  deleteEntityWithOperation,
  saveEntitiesWithOperation,
  saveVisitWithPlanningOperation,
  saveEntityWithOperation,
} from "./db";
import type {
  EntityStore,
  EntityType,
  LocalEntity,
  OutboxOperation,
  OutboxOperationType,
} from "./types";

type QueueOptions = {
  store: EntityStore;
  entityType: EntityType;
  entity: LocalEntity;
  operation: OutboxOperationType;
  payload: Record<string, unknown>;
  baseVersion?: number | null;
  operationId?: string;
};

function createOperation(options: QueueOptions): OutboxOperation {
  return {
    operation_id: options.operationId ?? crypto.randomUUID(),
    user_id: options.entity.user_id,
    entity_type: options.entityType,
    entity_id: options.entity.id,
    operation: options.operation,
    payload: options.payload,
    base_version: options.baseVersion ?? null,
    status: "pending",
    attempt_count: 0,
    next_attempt_at: Date.now(),
    created_at_local: Date.now(),
    last_error_code: null,
    last_error_message: null,
  };
}

export async function queueEntityMutation(options: QueueOptions) {
  const operation = createOperation(options);
  await saveEntityWithOperation(options.store, options.entity, operation);
  window.dispatchEvent(new CustomEvent("rotacomercial:outbox-changed"));
  return operation;
}

export async function queueEntityDelete(options: QueueOptions) {
  const operation = createOperation(options);
  await deleteEntityWithOperation(
    options.store,
    options.entity.user_id,
    options.entity.id,
    operation
  );
  window.dispatchEvent(new CustomEvent("rotacomercial:outbox-changed"));
  return operation;
}

export async function queueRouteMutation(
  options: QueueOptions & { entities: LocalEntity[] }
) {
  const operation = createOperation(options);
  await saveEntitiesWithOperation(options.store, options.entities, operation);
  window.dispatchEvent(new CustomEvent("rotacomercial:outbox-changed"));
  return operation;
}

export async function queueVisitMutation(options: QueueOptions) {
  const operation = createOperation(options);
  await saveVisitWithPlanningOperation(
    options.entity,
    (options.payload.planejamento_id as string | null) ?? null,
    operation
  );
  window.dispatchEvent(new CustomEvent("rotacomercial:outbox-changed"));
  return operation;
}
