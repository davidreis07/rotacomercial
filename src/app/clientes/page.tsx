import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ClientesClient } from "./clientes-client";

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

                {error ? (
                    <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
                        Não foi possível carregar os clientes.
                    </div>
                ) : (
                    <ClientesClient clientes={clientes ?? []} userId={user.id} />
                )}
            </div>
        </main>
    );
}
