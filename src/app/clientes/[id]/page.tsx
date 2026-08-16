import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type ClientePageProps = {
    params: Promise<{
        id: string;
    }>;
};

export default async function ClientePage({
    params,
}: ClientePageProps) {
    const { id } = await params;

    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login");
    }

    // Busca o cliente
    const { data: cliente, error: clienteError } = await supabase
        .from("clientes")
        .select(
            `
        id,
        codigo,
        nome,
        nome_fantasia,
        bairro,
        endereco,
        numero,
        complemento,
        telefone,
        observacoes,
        latitude,
        longitude
      `
        )
        .eq("id", id)
        .single();

    if (clienteError || !cliente) {
        notFound();
    }

    // Busca o histórico de visitas deste cliente
    const { data: visitas, error: visitasError } = await supabase
        .from("visitas")
        .select(
            `
        id,
        visitado_em,
        resultado,
        necessidade,
        observacoes,
        created_at
      `
        )
        .eq("cliente_id", id)
        .order("visitado_em", { ascending: false });

    if (visitasError) {
        console.error("Erro ao buscar visitas:", visitasError);
    }

    const historico = visitas ?? [];
    const ultimaVisita = historico[0] ?? null;

    // Monta endereço linha por linha
    const linhaEndereco = [cliente.endereco, cliente.numero, cliente.complemento]
        .filter(Boolean)
        .join(", ");

    function formatarData(data: string) {
        return new Intl.DateTimeFormat("pt-BR", {
            dateStyle: "long",
            timeStyle: "short",
            timeZone: "America/Fortaleza",
        }).format(new Date(data));
    }

    return (
        <main className="min-h-screen bg-slate-50 p-4 sm:p-6">
            <div className="mx-auto max-w-3xl">
                <Link
                    href="/clientes"
                    className="text-sm font-medium text-blue-600 hover:underline"
                >
                    ← Voltar para clientes
                </Link>

                {/* FICHA DO CLIENTE */}
                <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                    {/* Cabeçalho da ficha */}
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                                Dados do cliente
                            </p>

                            <h1 className="mt-1 text-2xl font-bold text-slate-900 leading-tight">
                                {cliente.nome_fantasia || cliente.nome}
                            </h1>

                            {cliente.nome_fantasia && (
                                <p className="mt-0.5 text-sm text-slate-500">
                                    {cliente.nome}
                                </p>
                            )}

                            {cliente.codigo && (
                                <span className="mt-2 inline-block rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                                    Código {cliente.codigo}
                                </span>
                            )}
                        </div>

                        <Link
                            href={`/clientes/${cliente.id}/editar`}
                            className="shrink-0 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                            Editar
                        </Link>
                    </div>

                    {/* Informações de contato e localização */}
                    <div className="mt-6 space-y-4 border-t border-slate-100 pt-5">

                        {/* Telefone */}
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                Telefone
                            </p>
                            {cliente.telefone ? (
                                <a
                                    href={`tel:${cliente.telefone.replace(/\D/g, "")}`}
                                    className="mt-1 inline-flex items-center gap-2 font-medium text-blue-600 hover:underline"
                                >
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        className="h-4 w-4"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                        strokeWidth={2}
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                                        />
                                    </svg>
                                    {cliente.telefone}
                                </a>
                            ) : (
                                <p className="mt-1 text-slate-400 italic text-sm">Não informado</p>
                            )}
                        </div>

                        {/* Endereço */}
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                Endereço
                            </p>
                            {linhaEndereco || cliente.bairro ? (
                                <div className="mt-1 space-y-0.5">
                                    {linhaEndereco && (
                                        <p className="font-medium text-slate-800">
                                            {linhaEndereco}
                                        </p>
                                    )}
                                    {cliente.bairro && (
                                        <p className="text-sm text-slate-600">
                                            {cliente.bairro}
                                        </p>
                                    )}
                                </div>
                            ) : (
                                <p className="mt-1 text-slate-400 italic text-sm">Não informado</p>
                            )}
                        </div>

                        {/* Localização */}
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                Localização
                            </p>
                            {cliente.latitude !== null && cliente.longitude !== null ? (
                                <div className="mt-1">
                                    <p className="font-medium text-emerald-700">
                                        Localização cadastrada
                                    </p>
                                    <p className="mt-0.5 text-sm text-slate-600">
                                        Latitude: {cliente.latitude.toFixed(6)}
                                        <span className="mx-1.5 text-slate-300">•</span>
                                        Longitude: {cliente.longitude.toFixed(6)}
                                    </p>
                                </div>
                            ) : (
                                <p className="mt-1 text-sm italic text-slate-400">
                                    Localização ainda não cadastrada
                                </p>
                            )}
                        </div>

                        {/* Observações */}
                        {cliente.observacoes && (
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                    Observações
                                </p>
                                <p className="mt-1 whitespace-pre-wrap text-slate-700">
                                    {cliente.observacoes}
                                </p>
                            </div>
                        )}
                    </div>
                </section>

                {/* ÚLTIMA VISITA */}
                <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Última visita
                    </p>

                    {ultimaVisita ? (
                        <>
                            <p className="mt-2 font-semibold text-slate-900">
                                {formatarData(ultimaVisita.visitado_em)}
                            </p>

                            {ultimaVisita.resultado && (
                                <div className="mt-4">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                        Resultado
                                    </p>

                                    <p className="mt-1 text-slate-700">
                                        {ultimaVisita.resultado}
                                    </p>
                                </div>
                            )}

                            <div className="mt-4">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                    Necessidade / oportunidade
                                </p>

                                <p className="mt-1 text-slate-700">
                                    {ultimaVisita.necessidade ||
                                        "Nenhuma necessidade registrada."}
                                </p>
                            </div>
                        </>
                    ) : (
                        <p className="mt-2 text-sm text-slate-500">
                            Nenhuma visita registrada para este cliente.
                        </p>
                    )}

                    <Link
                        href={`/clientes/${cliente.id}/visitas/nova`}
                        className="mt-6 block w-full rounded-xl bg-blue-600 px-4 py-3 text-center font-semibold text-white transition hover:bg-blue-700"
                    >
                        + Registrar visita
                    </Link>
                </section>

                {/* HISTÓRICO */}
                <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                    <div className="flex items-center justify-between gap-4">
                        <h2 className="text-lg font-semibold text-slate-900">
                            Histórico de visitas
                        </h2>

                        {historico.length > 0 && (
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                                {historico.length}{" "}
                                {historico.length === 1 ? "visita" : "visitas"}
                            </span>
                        )}
                    </div>

                    {visitasError && (
                        <div className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">
                            Não foi possível carregar o histórico de visitas.
                        </div>
                    )}

                    {!visitasError && historico.length === 0 && (
                        <div className="mt-4 rounded-xl bg-slate-50 p-5 text-center">
                            <p className="text-sm text-slate-500">
                                Nenhuma visita registrada para este cliente.
                            </p>
                        </div>
                    )}

                    {!visitasError && historico.length > 0 && (
                        <div className="mt-5 space-y-4">
                            {historico.map((visita) => (
                                <article
                                    key={visita.id}
                                    className="rounded-xl border border-slate-200 p-4"
                                >
                                    <p className="text-sm font-semibold text-slate-900">
                                        {formatarData(visita.visitado_em)}
                                    </p>

                                    {visita.resultado && (
                                        <div className="mt-3">
                                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                                Resultado
                                            </p>

                                            <p className="mt-1 text-sm text-slate-700">
                                                {visita.resultado}
                                            </p>
                                        </div>
                                    )}

                                    {visita.necessidade && (
                                        <div className="mt-3">
                                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                                Necessidade / oportunidade
                                            </p>

                                            <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                                                {visita.necessidade}
                                            </p>
                                        </div>
                                    )}

                                    {visita.observacoes && (
                                        <div className="mt-3">
                                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                                Observações
                                            </p>

                                            <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">
                                                {visita.observacoes}
                                            </p>
                                        </div>
                                    )}
                                </article>
                            ))}
                        </div>
                    )}
                </section>
            </div>
        </main>
    );
}
