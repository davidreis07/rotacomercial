"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getMetadata, getUserEntities, getUserOutbox } from "@/lib/offline/db";
import { queueVisitMutation } from "@/lib/offline/mutations";
import type { LocalEntity, OutboxOperation } from "@/lib/offline/types";

type ClienteLocal = LocalEntity & {
  nome: string;
  nome_fantasia: string | null;
  codigo: string | null;
  bairro: string | null;
  endereco: string | null;
};

type PlanejamentoLocal = LocalEntity & {
  cliente_id: string;
  data: string;
  ordem: number;
  status: string;
};

type LoadState = "loading" | "ready" | "no-session" | "unavailable";

function hojeEmFortaleza() {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Fortaleza",
  });
}

export function OfflineClient() {
  const [state, setState] = useState<LoadState>("loading");
  const [userId, setUserId] = useState<string | null>(null);
  const [clientes, setClientes] = useState<ClienteLocal[]>([]);
  const [planejamento, setPlanejamento] = useState<PlanejamentoLocal[]>([]);
  const [outbox, setOutbox] = useState<OutboxOperation[]>([]);
  const [lastSync, setLastSync] = useState<number | null>(null);
  const [selected, setSelected] = useState<PlanejamentoLocal | null>(null);
  const [resultado, setResultado] = useState("");
  const [necessidade, setNecessidade] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [feedback, setFeedback] = useState("");
  const [saving, setSaving] = useState(false);

  const loadLocalData = useCallback(async (knownUserId?: string) => {
    try {
      let currentUserId = knownUserId ?? userId;
      if (!currentUserId) {
        const { data } = await createClient().auth.getSession();
        currentUserId = data.session?.user.id ?? null;
      }
      if (!currentUserId) {
        setState("no-session");
        return;
      }

      const [localClientes, localPlanejamento, localOutbox, syncedAt] =
        await Promise.all([
          getUserEntities<ClienteLocal>("clientes", currentUserId),
          getUserEntities<PlanejamentoLocal>("planejamento", currentUserId),
          getUserOutbox(currentUserId),
          getMetadata<number>(`last-sync:${currentUserId}`),
        ]);

      setUserId(currentUserId);
      setClientes(localClientes);
      setPlanejamento(
        localPlanejamento
          .filter((item) => item.data === hojeEmFortaleza())
          .sort((a, b) => a.ordem - b.ordem)
      );
      setOutbox(localOutbox);
      setLastSync(syncedAt);
      setState("ready");
    } catch {
      setState("unavailable");
    }
  }, [userId]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadLocalData(), 0);
    return () => window.clearTimeout(timeout);
  }, [loadLocalData]);

  const clientesMap = useMemo(
    () => new Map(clientes.map((cliente) => [cliente.id, cliente])),
    [clientes]
  );

  async function registrarVisita(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId || !selected) return;
    setSaving(true);
    setFeedback("");
    const now = new Date().toISOString();
    const visita = {
      id: crypto.randomUUID(),
      user_id: userId,
      cliente_id: selected.cliente_id,
      planejamento_id: selected.id,
      visitado_em: now,
      resultado: resultado.trim() || null,
      necessidade: necessidade.trim() || null,
      observacoes: observacoes.trim() || null,
      created_at: now,
      updated_at: now,
      version: 1,
    };

    try {
      await queueVisitMutation({
        store: "visitas",
        entityType: "visita",
        entity: visita,
        operation: "visita.create",
        payload: visita,
      });
      setSelected(null);
      setResultado("");
      setNecessidade("");
      setObservacoes("");
      setFeedback("Visita salva neste dispositivo e pendente de sincronização.");
      await loadLocalData(userId);
    } catch {
      setFeedback("Não foi possível salvar a visita neste dispositivo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 text-slate-900 sm:p-6">
      <div className="mx-auto max-w-3xl space-y-5">
        <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-blue-600">RotaComercial</p>
          <h1 className="mt-1 text-2xl font-bold">Modo offline</h1>
          <p className="mt-2 text-sm text-slate-600">
            Sem conexão. Os dados abaixo são o último snapshot disponível neste dispositivo.
          </p>
          {lastSync && (
            <p className="mt-2 text-xs text-slate-500">
              Última sincronização: {new Date(lastSync).toLocaleString("pt-BR")}
            </p>
          )}
        </header>

        {state === "loading" && <p>Carregando dados locais...</p>}
        {state === "no-session" && (
          <div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
            Nenhuma sessão local disponível. Conecte-se à internet e entre novamente.
          </div>
        )}
        {state === "unavailable" && (
          <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
            O armazenamento local não está disponível neste navegador.
          </div>
        )}

        {state === "ready" && (
          <>
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-bold">Minha rota de hoje</h2>
                <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800">
                  {outbox.length} pendente{outbox.length === 1 ? "" : "s"}
                </span>
              </div>

              {planejamento.length === 0 ? (
                <p className="mt-4 text-sm text-slate-500">
                  Nenhum cliente no snapshot da rota de hoje.
                </p>
              ) : (
                <div className="mt-4 space-y-3">
                  {planejamento.map((item, index) => {
                    const cliente = clientesMap.get(item.cliente_id);
                    return (
                      <article key={item.id} className="rounded-xl border border-slate-200 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold">
                              {index + 1}. {cliente?.nome_fantasia || cliente?.nome || "Cliente"}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              {[cliente?.bairro, cliente?.endereco].filter(Boolean).join(" · ")}
                            </p>
                            <p className="mt-2 text-xs font-semibold uppercase text-slate-500">
                              {item.status}
                            </p>
                          </div>
                          {item.status === "planejado" && (
                            <button
                              type="button"
                              onClick={() => setSelected(item)}
                              className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white"
                            >
                              Registrar visita
                            </button>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>

            {selected && (
              <form onSubmit={registrarVisita} className="space-y-3 rounded-2xl border border-blue-200 bg-white p-5 shadow-sm">
                <h2 className="font-bold">Registrar visita offline</h2>
                <input
                  value={resultado}
                  onChange={(event) => setResultado(event.target.value)}
                  placeholder="Resultado da visita"
                  className="w-full rounded-xl border border-slate-300 px-4 py-3"
                />
                <textarea
                  value={necessidade}
                  onChange={(event) => setNecessidade(event.target.value)}
                  placeholder="Necessidade / oportunidade"
                  rows={3}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3"
                />
                <textarea
                  value={observacoes}
                  onChange={(event) => setObservacoes(event.target.value)}
                  placeholder="Observações"
                  rows={3}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3"
                />
                <div className="flex gap-2">
                  <button disabled={saving} className="flex-1 rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white disabled:opacity-50">
                    {saving ? "Salvando..." : "Salvar neste dispositivo"}
                  </button>
                  <button type="button" onClick={() => setSelected(null)} className="rounded-xl border border-slate-300 px-4 py-3 font-semibold">
                    Cancelar
                  </button>
                </div>
              </form>
            )}

            {feedback && (
              <div className="rounded-xl bg-blue-50 p-4 text-sm text-blue-800">{feedback}</div>
            )}

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="font-bold">Clientes disponíveis localmente</h2>
              <p className="mt-2 text-sm text-slate-600">{clientes.length} cliente{clientes.length === 1 ? "" : "s"} no dispositivo.</p>
            </section>

            <div className="rounded-xl bg-slate-200 p-4 text-sm text-slate-700">
              O mapa, a geocodificação e a navegação externa precisam de conexão.
            </div>
          </>
        )}
      </div>
    </main>
  );
}
