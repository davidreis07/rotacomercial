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
        observacoes
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

    // Como ordenamos da mais recente para a mais antiga,
    // a primeira posição é a última visita realizada.
    const ultimaVisita = historico[0] ?? null;

    const enderecoCompleto = [
        cliente.endereco,
        cliente.numero,
        cliente.complemento,
    ]
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
                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                            <p className="text-sm font-semibold text-blue-600">
                                RotaComercial
                            </p>

                            <h1 className="mt-1 text-2xl font-bold text-slate-900">
                                {cliente.nome_fantasia || cliente.nome}
                            </h1>

                            {cliente.nome_fantasia && (
                                <p className="mt-1 text-sm text-slate-500">
                                    {cliente.nome}
                                </p>
                            )}
                        </div>

                        {cliente.codigo && (
                            <span className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-medium text-slate-600">
                                Código {cliente.codigo}
                            </span>
                        )}
                    </div>

                    <div className="mt-6 grid gap-4 sm:grid-cols-2">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                Bairro
                            </p>

                            <p className="mt-1 font-medium text-slate-800">
                                {cliente.bairro || "Não informado"}
                            </p>
                        </div>

                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                Telefone
                            </p>

                            <p className="mt-1 font-medium text-slate-800">
                                {cliente.telefone || "Não informado"}
                            </p>
                        </div>
                    </div>

                    <div className="mt-5">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                            Endereço
                        </p>

                        <p className="mt-1 text-slate-800">
                            {enderecoCompleto || "Não informado"}
                        </p>
                    </div>

                    {cliente.observacoes && (
                        <div className="mt-5">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                Observações
                            </p>

                            <p className="mt-1 whitespace-pre-wrap text-slate-700">
                                {cliente.observacoes}
                            </p>
                        </div>
                    )}
                </section>

                {/* RESUMO DA ÚLTIMA VISITA */}
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
                        <>
                            <p className="mt-2 font-medium text-slate-800">
                                Nenhuma visita registrada
                            </p>

                            <div className="mt-5">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                    Necessidade / oportunidade
                                </p>

                                <p className="mt-2 text-slate-500">
                                    Nenhuma necessidade registrada.
                                </p>
                            </div>
                        </>
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