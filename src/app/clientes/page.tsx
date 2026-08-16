import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function ClientesPage() {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login");
    }

    const { data: clientes, error } = await supabase
        .from("clientes")
        .select("id, codigo, nome, nome_fantasia, bairro, endereco, telefone")
        .order("nome", { ascending: true });

    if (error) {
        console.error("Erro ao buscar clientes:", error);
    }

    return (
        <main className="min-h-screen bg-slate-50 p-4 sm:p-6">
            <div className="mx-auto max-w-4xl">

                <header className="mb-6">
                    <Link
                        href="/"
                        className="text-sm font-medium text-blue-600 hover:underline"
                    >
                        ← Voltar
                    </Link>

                    <div className="mt-4 flex items-center justify-between gap-4">
                        <div>
                            <p className="text-sm font-semibold text-blue-600">
                                RotaComercial
                            </p>

                            <h1 className="text-2xl font-bold text-slate-900">
                                Clientes
                            </h1>
                        </div>

                        <Link
                            href="/clientes/novo"
                            className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
                        >
                            + Novo cliente
                        </Link>
                    </div>
                </header>

                {error && (
                    <div className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">
                        Não foi possível carregar os clientes.
                    </div>
                )}

                {!error && clientes?.length === 0 && (
                    <section className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
                        <h2 className="text-lg font-semibold text-slate-900">
                            Nenhum cliente cadastrado
                        </h2>

                        <p className="mt-2 text-sm text-slate-500">
                            Cadastre seu primeiro cliente para começar sua base comercial.
                        </p>
                    </section>
                )}

                {!error && clientes && clientes.length > 0 && (
                    <div className="space-y-3">
                        {clientes.map((cliente) => (
                            <Link
                                key={cliente.id}
                                href={`/clientes/${cliente.id}`}
                                className="block"
                            >
                                <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-300 hover:shadow-md">
                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <h2 className="font-semibold text-slate-900">
                                                    {cliente.nome_fantasia || cliente.nome}
                                                </h2>

                                                {cliente.codigo && (
                                                    <span className="rounded-lg bg-slate-100 px-2 py-1 text-xs text-slate-600">
                                                        {cliente.codigo}
                                                    </span>
                                                )}
                                            </div>

                                            {cliente.nome_fantasia && (
                                                <p className="mt-1 text-sm text-slate-500">
                                                    {cliente.nome}
                                                </p>
                                            )}

                                            {cliente.bairro && (
                                                <p className="mt-3 text-sm font-medium text-slate-700">
                                                    {cliente.bairro}
                                                </p>
                                            )}

                                            {cliente.endereco && (
                                                <p className="mt-1 text-sm text-slate-500">
                                                    {cliente.endereco}
                                                </p>
                                            )}

                                            {cliente.telefone && (
                                                <p className="mt-1 text-sm text-slate-500">
                                                    {cliente.telefone}
                                                </p>
                                            )}
                                        </div>

                                        <span className="text-xl text-slate-400">›</span>
                                    </div>
                                </article>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </main>
    );
}   