"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
    queueEntityDelete,
    queueEntityMutation,
    queueRouteMutation,
} from "@/lib/offline/mutations";
import MapaRota, { type PontoRota } from "./mapa-rota";
import { getMetadata, getUserEntities } from "@/lib/offline/db";
import type { LocalEntity } from "@/lib/offline/types";

interface Cliente {
    id: string;
    codigo: string | null;
    nome: string;
    nome_fantasia: string | null;
    bairro: string | null;
    endereco: string | null;
    numero: string | null;
    complemento: string | null;
    latitude: number | null;
    longitude: number | null;
}

interface PlanejamentoItem {
    id: string;
    user_id: string;
    cliente_id: string;
    data: string;
    ordem: number;
    status: string;
    version: number;
    updated_at: string;
}

interface VisitaInfo {
    visitado_em: string;
    necessidade: string | null;
}

type Props = {
    initialClientes: Cliente[];
    initialPlanejamento: PlanejamentoItem[];
    ultimasVisitas: Record<string, VisitaInfo>;
    data: string;
    userId: string;
    initialRouteVersion: number;
};

export default function PlanejamentoClient({
    initialClientes,
    initialPlanejamento,
    ultimasVisitas,
    data: dataString,
    userId,
    initialRouteVersion,
}: Props) {
    const router = useRouter();
    const [planejamentoList, setPlanejamentoList] = useState<PlanejamentoItem[]>(
        [...initialPlanejamento].sort((a, b) => a.ordem - b.ordem)
    );
    const [clientesList, setClientesList] = useState(initialClientes);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [globalErro, setGlobalErro] = useState<string | null>(null);

    async function getRouteVersion() {
        return (
            (await getMetadata<number>(`route-version:${userId}:${dataString}`)) ??
            initialRouteVersion
        );
    }

    useEffect(() => {
        async function carregarLocal() {
            const [clientesLocais, planejamentoLocal] = await Promise.all([
                getUserEntities<LocalEntity & Cliente>("clientes", userId),
                getUserEntities<LocalEntity & PlanejamentoItem>("planejamento", userId),
            ]);
            const initialized = await getMetadata<number>(`cursor:${userId}`);
            if (clientesLocais.length > 0 || initialized !== null) {
                setClientesList(clientesLocais);
            }
            if (planejamentoLocal.length > 0 || initialized !== null) {
                setPlanejamentoList(
                    planejamentoLocal
                        .filter((item) => item.data === dataString)
                        .sort((a, b) => a.ordem - b.ordem)
                );
            }
        }

        void carregarLocal();
        window.addEventListener("rotacomercial:local-data-changed", carregarLocal);
        window.addEventListener("rotacomercial:outbox-changed", carregarLocal);
        return () => {
            window.removeEventListener("rotacomercial:local-data-changed", carregarLocal);
            window.removeEventListener("rotacomercial:outbox-changed", carregarLocal);
        };
    }, [dataString, userId]);

    // Dicionário de clientes para consulta imediata por ID
    const clientesMap = useMemo(
        () => new Map(clientesList.map((c) => [c.id, c])),
        [clientesList]
    );

    // Clientes planejados na data de hoje
    const clientesPlanejadosIds = new Set(planejamentoList.map((p) => p.cliente_id));

    // Clientes disponíveis para adicionar (não planejados hoje)
    const clientesDisponiveis = clientesList.filter(
        (c) => !clientesPlanejadosIds.has(c.id)
    );

    // Formatar data da visita
    function formatarDataVisita(dataIso: string) {
        try {
            return new Intl.DateTimeFormat("pt-BR", {
                dateStyle: "short",
                timeStyle: "short",
                timeZone: "America/Fortaleza",
            }).format(new Date(dataIso));
        } catch {
            return "Data inválida";
        }
    }

    // Ação: Adicionar cliente à rota do dia
    async function handleAdicionar(clienteId: string) {
        setActionLoading(`add-${clienteId}`);
        setGlobalErro(null);

        const nextOrdem = (planejamentoList.length > 0
            ? Math.max(...planejamentoList.map((p) => p.ordem))
            : 0) + 1;

        const now = new Date().toISOString();
        const novoItem: PlanejamentoItem = {
            id: crypto.randomUUID(),
            user_id: userId,
            cliente_id: clienteId,
            data: dataString,
            ordem: nextOrdem,
            status: "planejado",
            version: 1,
            updated_at: now,
        };

        try {
            await queueEntityMutation({
                store: "planejamento",
                entityType: "planejamento",
                entity: novoItem,
                operation: "planejamento.create",
                payload: { ...novoItem, created_at: now },
            });
        } catch (error) {
            console.error("Erro ao salvar planejamento localmente:", error);
            setGlobalErro("Erro ao salvar a rota neste dispositivo.");
            setActionLoading(null);
            return;
        }

        setPlanejamentoList((prev) => [...prev, novoItem].sort((a, b) => a.ordem - b.ordem));
        setActionLoading(null);
        router.refresh();
    }

    // Ação: Remover cliente do planejamento de hoje
    async function handleRemover(item: PlanejamentoItem) {
        setActionLoading(`remove-${item.id}`);
        setGlobalErro(null);

        try {
            const routeVersion = await getRouteVersion();
            await queueEntityDelete({
                store: "planejamento",
                entityType: "planejamento",
                entity: { ...item, user_id: userId },
                operation: "planejamento.remove",
                payload: { expected_version: routeVersion, data: dataString },
                baseVersion: routeVersion,
            });
        } catch (error) {
            console.error("Erro ao remover planejamento localmente:", error);
            setGlobalErro("Erro ao salvar a remoção neste dispositivo.");
            setActionLoading(null);
            return;
        }

        // Reorganizar ordens restantes
        const restante = planejamentoList.filter((p) => p.id !== item.id);
        const atualizados = restante.map((p) => {
            if (p.ordem > item.ordem) {
                return { ...p, ordem: p.ordem - 1 };
            }
            return p;
        });

        setPlanejamentoList(atualizados.sort((a, b) => a.ordem - b.ordem));
        setActionLoading(null);
        router.refresh();
    }

    // Ação: Mover ordem para cima (Trocar com item anterior)
    async function handleMoverCima(index: number) {
        if (index <= 0) return;

        const itemA = planejamentoList[index];
        const itemB = planejamentoList[index - 1];

        setActionLoading(`move-${itemA.id}`);
        setGlobalErro(null);

        const novaLista = [...planejamentoList];
        [novaLista[index - 1], novaLista[index]] = [itemA, itemB];

        const listaAtualizada = novaLista.map((item, itemIndex) => ({
            ...item,
            ordem: itemIndex + 1,
            updated_at: new Date().toISOString(),
        }));
        try {
            const routeVersion = await getRouteVersion();
            await queueRouteMutation({
                store: "planejamento",
                entityType: "planejamento",
                entity: { ...itemA, user_id: userId },
                entities: listaAtualizada,
                operation: "planejamento.reorder",
                payload: {
                    data: dataString,
                    expected_version: routeVersion,
                    ordered_ids: listaAtualizada.map((item) => item.id),
                },
                baseVersion: routeVersion,
            });
        } catch (error) {
            console.error("Erro ao reordenar localmente:", error);
            setGlobalErro("Erro ao salvar a nova ordem neste dispositivo.");
            setActionLoading(null);
            return;
        }

        setPlanejamentoList(listaAtualizada);
        setActionLoading(null);
        router.refresh();
    }

    // Ação: Mover ordem para baixo (Trocar com item posterior)
    async function handleMoverBaixo(index: number) {
        if (index >= planejamentoList.length - 1) return;

        const itemA = planejamentoList[index];
        const itemB = planejamentoList[index + 1];

        setActionLoading(`move-${itemA.id}`);
        setGlobalErro(null);

        const novaLista = [...planejamentoList];
        [novaLista[index], novaLista[index + 1]] = [itemB, itemA];

        const listaAtualizada = novaLista.map((item, itemIndex) => ({
            ...item,
            ordem: itemIndex + 1,
            updated_at: new Date().toISOString(),
        }));
        try {
            const routeVersion = await getRouteVersion();
            await queueRouteMutation({
                store: "planejamento",
                entityType: "planejamento",
                entity: { ...itemA, user_id: userId },
                entities: listaAtualizada,
                operation: "planejamento.reorder",
                payload: {
                    data: dataString,
                    expected_version: routeVersion,
                    ordered_ids: listaAtualizada.map((item) => item.id),
                },
                baseVersion: routeVersion,
            });
        } catch (error) {
            console.error("Erro ao reordenar localmente:", error);
            setGlobalErro("Erro ao salvar a nova ordem neste dispositivo.");
            setActionLoading(null);
            return;
        }

        setPlanejamentoList(listaAtualizada);
        setActionLoading(null);
        router.refresh();
    }

    // Retorna a cor com base no status da visita/planejado
    function getStatusBadge(status: string) {
        switch (status) {
            case "visitado":
                return (
                    <span className="rounded-lg bg-green-50 px-2 py-1 text-xs font-semibold text-green-700 uppercase">
                        ✓ Visitado
                    </span>
                );
            case "cancelado":
                return (
                    <span className="rounded-lg bg-red-50 px-2 py-1 text-xs font-semibold text-red-700 uppercase">
                        ✗ Cancelado
                    </span>
                );
            default:
                return (
                    <span className="rounded-lg bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700 uppercase">
                        Planejado
                    </span>
                );
        }
    }

    const totalPlanejado = planejamentoList.length;
    const concluidos = planejamentoList.filter((p) => p.status === "visitado").length;
    const cancelados = planejamentoList.filter((p) => p.status === "cancelado").length;
    const restantes = totalPlanejado - concluidos - cancelados;
    const pct = totalPlanejado > 0 ? Math.round((concluidos / totalPlanejado) * 100) : 0;

    const pontosRota = useMemo<PontoRota[]>(() => {
        return planejamentoList.flatMap((item, index) => {
            const cliente = clientesMap.get(item.cliente_id);

            if (
                !cliente ||
                cliente.latitude === null ||
                cliente.longitude === null ||
                !Number.isFinite(cliente.latitude) ||
                !Number.isFinite(cliente.longitude) ||
                cliente.latitude < -90 ||
                cliente.latitude > 90 ||
                cliente.longitude < -180 ||
                cliente.longitude > 180
            ) {
                return [];
            }

            return [{
                clienteId: cliente.id,
                posicao: index + 1,
                nome: cliente.nome_fantasia || cliente.nome,
                codigo: cliente.codigo,
                bairro: cliente.bairro,
                endereco: [cliente.endereco, cliente.numero, cliente.complemento]
                    .filter(Boolean)
                    .join(", ") || null,
                status: item.status,
                latitude: cliente.latitude,
                longitude: cliente.longitude,
            }];
        });
    }, [planejamentoList, clientesMap]);

    const clientesSemLocalizacao = planejamentoList.flatMap((item) => {
        const cliente = clientesMap.get(item.cliente_id);
        const temLocalizacaoValida =
            cliente?.latitude !== null &&
            cliente?.latitude !== undefined &&
            cliente?.longitude !== null &&
            cliente?.longitude !== undefined &&
            Number.isFinite(cliente.latitude) &&
            Number.isFinite(cliente.longitude) &&
            cliente.latitude >= -90 &&
            cliente.latitude <= 90 &&
            cliente.longitude >= -180 &&
            cliente.longitude <= 180;

        return cliente && !temLocalizacaoValida ? [cliente] : [];
    });

    return (
        <div className="mt-6 space-y-8">
            {globalErro && (
                <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
                    {globalErro}
                </div>
            )}

            {/* PROGRESS SUMMARY CARD */}
            {totalPlanejado > 0 && (
                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 mb-6">
                    <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
                        Progresso do dia
                    </h2>
                    <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2">
                        <span className="text-2xl font-bold text-slate-900">
                            {concluidos} de {totalPlanejado} visitas concluídas
                        </span>
                        <span className="text-sm font-semibold text-slate-500">
                            {pct}% completo
                        </span>
                    </div>

                    {/* Progress Bar Container */}
                    <div className="mt-4 w-full bg-slate-100 rounded-full h-3 overflow-hidden border border-slate-200">
                        <div
                            className="bg-blue-600 h-3 rounded-full transition-all duration-500 ease-out"
                            style={{ width: `${pct}%` }}
                        />
                    </div>

                    {/* Counters */}
                    <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs text-slate-600">
                        <div className="rounded-xl bg-slate-50 p-2.5">
                            <span className="block text-base font-bold text-slate-900">{totalPlanejado}</span>
                            Total Planejado
                        </div>
                        <div className="rounded-xl bg-green-50 p-2.5">
                            <span className="block text-base font-bold text-green-700">{concluidos}</span>
                            Concluídos
                        </div>
                        <div className="rounded-xl bg-slate-50 p-2.5">
                            <span className="block text-base font-bold text-slate-700">{restantes}</span>
                            Restantes
                        </div>
                    </div>
                </section>
            )}

            {/* MAPA DA ROTA */}
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
                <div>
                    <h2 className="text-lg font-bold text-slate-900">Mapa da rota</h2>
                    <p className="mt-1 text-xs text-slate-500">
                        Os pontos seguem a ordem manual da lista. A linha indica apenas a sequência aproximada.
                    </p>
                </div>

                {clientesSemLocalizacao.length > 0 && (
                    <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                        <p>
                            {clientesSemLocalizacao.length} {clientesSemLocalizacao.length === 1 ? "cliente da rota ainda não possui" : "clientes da rota ainda não possuem"} localização cadastrada.
                        </p>
                        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                            {clientesSemLocalizacao.map((cliente) => (
                                <Link
                                    key={cliente.id}
                                    href={`/clientes/${cliente.id}/editar`}
                                    className="font-semibold underline underline-offset-2"
                                >
                                    Cadastrar: {cliente.nome_fantasia || cliente.nome}
                                </Link>
                            ))}
                        </div>
                    </div>
                )}

                <div className="mt-4">
                    <MapaRota pontos={pontosRota} />
                </div>
            </section>

            {/* SEÇÃO 1: MINHA ROTA DE HOJE */}
            <section>
                <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-2">
                    <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                        📍 Minha rota de hoje
                        <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-800">
                            {planejamentoList.length}
                        </span>
                    </h2>
                </div>

                {planejamentoList.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
                        <p className="text-sm font-medium text-slate-500">
                            Nenhum cliente na rota de hoje.
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                            Adicione clientes disponíveis na seção abaixo para montar sua rotina.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {planejamentoList.map((item, index) => {
                            const cliente = clientesMap.get(item.cliente_id);
                            if (!cliente) return null;

                            const ultimaVisita = ultimasVisitas[cliente.id];
                            const loading = actionLoading === `move-${item.id}` || actionLoading === `remove-${item.id}`;

                            const isCompleted = item.status === "visitado";
                            const isCancelled = item.status === "cancelado";

                            let cardStatusClasses = "border-slate-200 bg-white";
                            if (isCompleted) {
                                cardStatusClasses = "border-green-200 bg-green-50/10";
                            } else if (isCancelled) {
                                cardStatusClasses = "border-red-100 bg-red-50/5 opacity-70";
                            }

                            return (
                                <article
                                    key={item.id}
                                    className={`rounded-2xl border p-4 shadow-sm transition hover:shadow-md ${cardStatusClasses} ${loading ? "opacity-60 cursor-not-allowed" : ""
                                        }`}
                                >
                                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                        {/* Informações do Cliente Planejado */}
                                        <div className="flex-1 space-y-2">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white shrink-0">
                                                    {index + 1}
                                                </span>
                                                <h3 className="font-semibold text-slate-900">
                                                    {cliente.nome_fantasia || cliente.nome}
                                                </h3>
                                                {cliente.codigo && (
                                                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
                                                        {cliente.codigo}
                                                    </span>
                                                )}
                                                {getStatusBadge(item.status)}
                                            </div>

                                            {/* Endereço */}
                                            <div className="text-xs text-slate-500 space-y-0.5">
                                                {cliente.bairro && (
                                                    <p className="font-medium text-slate-700">
                                                        Bairro: {cliente.bairro}
                                                    </p>
                                                )}
                                                {cliente.endereco && (
                                                    <p>Endereço: {cliente.endereco}</p>
                                                )}
                                            </div>

                                            {/* Informações de Visita */}
                                            {ultimaVisita ? (
                                                <div className="rounded-xl bg-slate-50 p-3 mt-2 border border-slate-100">
                                                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                                                        Último atendimento
                                                    </p>
                                                    <p className="text-xs font-semibold text-slate-700 mt-0.5">
                                                        {formatarDataVisita(ultimaVisita.visitado_em)}
                                                    </p>
                                                    {ultimaVisita.necessidade && (
                                                        <p className="text-xs text-slate-600 mt-1 italic">
                                                            &quot;Necessidade: {ultimaVisita.necessidade}&quot;
                                                        </p>
                                                    )}
                                                </div>
                                            ) : (
                                                <p className="text-xs text-slate-400 italic">
                                                    Nenhuma visita anterior registrada.
                                                </p>
                                            )}
                                        </div>

                                        {/* Ações da Rota */}
                                        <div className="flex flex-wrap gap-2 items-center sm:flex-col sm:items-stretch sm:justify-start shrink-0">
                                            {/* Registrar Visita (Apenas se status for planejado) */}
                                            {item.status === "planejado" && (
                                                <Link
                                                    href={`/clientes/${cliente.id}/visitas/nova?origem=planejamento&planejamentoId=${item.id}`}
                                                    className="inline-flex h-9 items-center justify-center rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white transition hover:bg-blue-700 text-center"
                                                >
                                                    Registrar visita
                                                </Link>
                                            )}

                                            {/* Botões Mover */}
                                            <div className="flex gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => handleMoverCima(index)}
                                                    disabled={index === 0 || loading}
                                                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-white"
                                                    title="Mover para cima"
                                                >
                                                    ▲
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleMoverBaixo(index)}
                                                    disabled={index === planejamentoList.length - 1 || loading}
                                                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-white"
                                                    title="Mover para baixo"
                                                >
                                                    ▼
                                                </button>
                                            </div>

                                            {/* Ir para Ficha do Cliente */}
                                            <Link
                                                href={`/clientes/${cliente.id}`}
                                                className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 text-center"
                                            >
                                                Ver Ficha
                                            </Link>

                                            {cliente.latitude !== null &&
                                                cliente.longitude !== null &&
                                                cliente.latitude >= -90 &&
                                                cliente.latitude <= 90 &&
                                                cliente.longitude >= -180 &&
                                                cliente.longitude <= 180 && (
                                                    <a
                                                        href={`https://www.google.com/maps/dir/?api=1&destination=${cliente.latitude},${cliente.longitude}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex h-9 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 text-center"
                                                    >
                                                        Abrir navegação
                                                    </a>
                                                )}

                                            {/* Remover da Rota */}
                                            <button
                                                type="button"
                                                onClick={() => handleRemover(item)}
                                                disabled={loading}
                                                className="inline-flex h-9 items-center justify-center rounded-lg border border-red-200 bg-red-50 px-3 text-[11px] font-bold text-red-600 transition hover:bg-red-100 disabled:opacity-50"
                                            >
                                                {actionLoading === `remove-${item.id}` ? "Saindo..." : "Remover Rota"}
                                            </button>
                                        </div>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                )}
            </section>

            {/* SEÇÃO 2: CLIENTES DISPONÍVEIS */}
            <section>
                <div className="mb-4 border-b border-slate-200 pb-2">
                    <h2 className="text-lg font-bold text-slate-900">
                        👥 Clientes disponíveis
                    </h2>
                </div>

                {clientesDisponiveis.length === 0 ? (
                    <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center">
                        <p className="text-sm text-slate-500 italic">
                            Nenhum cliente disponível ou todos já foram adicionados à rota.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {clientesDisponiveis.map((cliente) => {
                            const loading = actionLoading === `add-${cliente.id}`;

                            return (
                                <article
                                    key={cliente.id}
                                    className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                                >
                                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                        <div>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <h3 className="font-semibold text-slate-900">
                                                    {cliente.nome_fantasia || cliente.nome}
                                                </h3>
                                                {cliente.codigo && (
                                                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
                                                        {cliente.codigo}
                                                    </span>
                                                )}
                                            </div>

                                            <div className="text-xs text-slate-500 mt-1.5 space-y-0.5">
                                                {cliente.bairro && (
                                                    <p className="font-medium text-slate-700">
                                                        Bairro: {cliente.bairro}
                                                    </p>
                                                )}
                                                {cliente.endereco && (
                                                    <p>Endereço: {cliente.endereco}</p>
                                                )}
                                            </div>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => handleAdicionar(cliente.id)}
                                            disabled={loading}
                                            className="w-full rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50 sm:w-auto shrink-0"
                                        >
                                            {loading ? "Adicionando..." : "+ Adicionar à rota"}
                                        </button>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                )}
            </section>
        </div>
    );
}
