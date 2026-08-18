import type {
  EntityStore,
  LocalEntity,
  OutboxOperation,
  OutboxStatus,
} from "./types";

const DATABASE_NAME = "rotacomercial-offline";
const DATABASE_VERSION = 1;
const ENTITY_STORES: EntityStore[] = ["clientes", "visitas", "planejamento"];
const ENTITY_TYPES: Record<EntityStore, string> = {
  clientes: "cliente",
  visitas: "visita",
  planejamento: "planejamento",
};

let databasePromise: Promise<IDBDatabase> | null = null;

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

export function entityKey(userId: string, entityId: string) {
  return `${userId}:${entityId}`;
}

export function openOfflineDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB não está disponível."));
  }

  if (!databasePromise) {
    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

      request.onupgradeneeded = () => {
        const database = request.result;

        for (const storeName of ENTITY_STORES) {
          if (!database.objectStoreNames.contains(storeName)) {
            const store = database.createObjectStore(storeName, {
              keyPath: "_key",
            });
            store.createIndex("user_id", "user_id", { unique: false });
          }
        }

        if (!database.objectStoreNames.contains("outbox")) {
          const outbox = database.createObjectStore("outbox", {
            keyPath: "operation_id",
          });
          outbox.createIndex("user_id", "user_id", { unique: false });
        }

        if (!database.objectStoreNames.contains("metadata")) {
          database.createObjectStore("metadata", { keyPath: "key" });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () =>
        reject(new Error("Atualização do banco local bloqueada por outra aba."));
    });
  }

  return databasePromise;
}

export async function saveEntityWithOperation(
  storeName: EntityStore,
  entity: LocalEntity,
  operation: OutboxOperation
) {
  const database = await openOfflineDatabase();
  const transaction = database.transaction([storeName, "outbox"], "readwrite");
  const storedEntity = {
    ...entity,
    _key: entityKey(entity.user_id, entity.id),
    _syncStatus: "pending",
  };

  transaction.objectStore(storeName).put(storedEntity);
  transaction.objectStore("outbox").put(operation);
  await transactionDone(transaction);
}

export async function saveEntitiesWithOperation(
  storeName: EntityStore,
  entities: LocalEntity[],
  operation: OutboxOperation
) {
  const database = await openOfflineDatabase();
  const transaction = database.transaction([storeName, "outbox"], "readwrite");
  const store = transaction.objectStore(storeName);
  for (const entity of entities) {
    store.put({
      ...entity,
      _key: entityKey(entity.user_id, entity.id),
      _syncStatus: "pending",
    });
  }
  transaction.objectStore("outbox").put(operation);
  await transactionDone(transaction);
}

export async function saveVisitWithPlanningOperation(
  visit: LocalEntity,
  planejamentoId: string | null,
  operation: OutboxOperation
) {
  const database = await openOfflineDatabase();
  const transaction = database.transaction(
    ["visitas", "planejamento", "outbox"],
    "readwrite"
  );
  transaction.objectStore("visitas").put({
    ...visit,
    _key: entityKey(visit.user_id, visit.id),
    _syncStatus: "pending",
  });

  if (planejamentoId) {
    const planejamentoStore = transaction.objectStore("planejamento");
    const key = entityKey(visit.user_id, planejamentoId);
    const planejamento = (await requestResult(
      planejamentoStore.get(key)
    )) as LocalEntity | undefined;
    if (planejamento) {
      planejamentoStore.put({
        ...planejamento,
        status: "visitado",
        updated_at: new Date().toISOString(),
        _syncStatus: "pending",
      });
    }
  }

  transaction.objectStore("outbox").put(operation);
  await transactionDone(transaction);
}

export async function deleteEntityWithOperation(
  storeName: EntityStore,
  userId: string,
  entityId: string,
  operation: OutboxOperation
) {
  const database = await openOfflineDatabase();
  const transaction = database.transaction([storeName, "outbox"], "readwrite");
  transaction.objectStore(storeName).delete(entityKey(userId, entityId));
  transaction.objectStore("outbox").put(operation);
  await transactionDone(transaction);
}

export async function replaceUserEntities(
  storeName: EntityStore,
  userId: string,
  entities: LocalEntity[]
) {
  const database = await openOfflineDatabase();
  const pendingIds = new Set(
    (await getUserOutbox(userId))
      .filter((operation) => operation.entity_type === ENTITY_TYPES[storeName])
      .map((operation) => operation.entity_id)
  );
  const transaction = database.transaction(storeName, "readwrite");
  const store = transaction.objectStore(storeName);
  const existing = await requestResult(store.index("user_id").getAll(userId));

  for (const row of existing as LocalEntity[]) {
    if (!pendingIds.has(row.id)) {
      store.delete(entityKey(userId, row.id));
    }
  }

  for (const entity of entities) {
    if (!pendingIds.has(entity.id)) {
      store.put({
        ...entity,
        _key: entityKey(userId, entity.id),
        _syncStatus: "synced",
      });
    }
  }

  await transactionDone(transaction);
}

export async function upsertRemoteEntity(
  storeName: EntityStore,
  entity: LocalEntity
) {
  const database = await openOfflineDatabase();
  const transaction = database.transaction(storeName, "readwrite");
  transaction.objectStore(storeName).put({
    ...entity,
    _key: entityKey(entity.user_id, entity.id),
    _syncStatus: "synced",
  });
  await transactionDone(transaction);
}

export async function deleteRemoteEntity(
  storeName: EntityStore,
  userId: string,
  entityId: string
) {
  const database = await openOfflineDatabase();
  const transaction = database.transaction(storeName, "readwrite");
  transaction.objectStore(storeName).delete(entityKey(userId, entityId));
  await transactionDone(transaction);
}

export async function getUserEntities<T extends LocalEntity>(
  storeName: EntityStore,
  userId: string
): Promise<T[]> {
  const database = await openOfflineDatabase();
  const transaction = database.transaction(storeName, "readonly");
  return requestResult<T[]>(
    transaction.objectStore(storeName).index("user_id").getAll(userId)
  );
}

export async function getUserOutbox(userId: string): Promise<OutboxOperation[]> {
  const database = await openOfflineDatabase();
  const transaction = database.transaction("outbox", "readonly");
  return requestResult<OutboxOperation[]>(
    transaction.objectStore("outbox").index("user_id").getAll(userId)
  );
}

export async function updateOutboxOperation(operation: OutboxOperation) {
  const database = await openOfflineDatabase();
  const transaction = database.transaction("outbox", "readwrite");
  transaction.objectStore("outbox").put(operation);
  await transactionDone(transaction);
}

export async function getPendingEntityIds(userId: string) {
  const operations = await getUserOutbox(userId);
  return new Set(
    operations
      .map((operation) => `${operation.entity_type}:${operation.entity_id}`)
  );
}

export async function removeOutboxOperation(operationId: string) {
  const database = await openOfflineDatabase();
  const transaction = database.transaction("outbox", "readwrite");
  transaction.objectStore("outbox").delete(operationId);
  await transactionDone(transaction);
}

export async function markEntitySyncStatus(
  storeName: EntityStore,
  userId: string,
  entityId: string,
  status: "synced" | "pending" | "conflict"
) {
  const database = await openOfflineDatabase();
  const transaction = database.transaction(storeName, "readwrite");
  const store = transaction.objectStore(storeName);
  const key = entityKey(userId, entityId);
  const entity = (await requestResult(store.get(key))) as LocalEntity | undefined;
  if (entity) store.put({ ...entity, _syncStatus: status });
  await transactionDone(transaction);
}

export async function getMetadata<T>(key: string): Promise<T | null> {
  const database = await openOfflineDatabase();
  const transaction = database.transaction("metadata", "readonly");
  const result = await requestResult<{ key: string; value: T } | undefined>(
    transaction.objectStore("metadata").get(key)
  );
  return result?.value ?? null;
}

export async function setMetadata<T>(key: string, value: T) {
  const database = await openOfflineDatabase();
  const transaction = database.transaction("metadata", "readwrite");
  transaction.objectStore("metadata").put({ key, value });
  await transactionDone(transaction);
}

export async function countOutboxByStatus(
  userId: string,
  statuses: OutboxStatus[]
) {
  const operations = await getUserOutbox(userId);
  return operations.filter((operation) => statuses.includes(operation.status)).length;
}

export async function clearUserOfflineData(userId: string) {
  const database = await openOfflineDatabase();
  const stores = [...ENTITY_STORES, "outbox", "metadata"];
  const transaction = database.transaction(stores, "readwrite");

  for (const storeName of [...ENTITY_STORES, "outbox"] as const) {
    const store = transaction.objectStore(storeName);
    const rows = await requestResult(store.index("user_id").getAll(userId));
    for (const row of rows as Array<{ _key?: string; operation_id?: string }>) {
      store.delete(row._key ?? row.operation_id!);
    }
  }

  const metadataStore = transaction.objectStore("metadata");
  const metadataRows = await requestResult(metadataStore.getAll());
  for (const row of metadataRows as Array<{ key: string }>) {
    if (row.key.includes(`:${userId}`)) metadataStore.delete(row.key);
  }
  await transactionDone(transaction);
}
