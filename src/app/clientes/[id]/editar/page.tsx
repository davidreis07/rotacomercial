import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FormEditarCliente } from "./form-editar";

type Props = {
    params: Promise<{
        id: string;
    }>;
};

export default async function EditarClientePage({ params }: Props) {
    const { id } = await params;
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login");
    }

    const { data: cliente, error } = await supabase
        .from("clientes")
        .select("*")
        .eq("id", id)
        .single();

    if (error || !cliente) {
        notFound();
    }

    return (
        <main className="min-h-screen bg-slate-50 p-4 sm:p-6">
            <div className="mx-auto max-w-2xl">
                <Link
                    href={`/clientes/${id}`}
                    className="text-sm font-medium text-blue-600 hover:underline"
                >
                    ← Voltar para a ficha
                </Link>

                <header className="mt-4 mb-6">
                    <p className="text-sm font-semibold text-blue-600">
                        RotaComercial
                    </p>

                    <h1 className="mt-1 text-2xl font-bold text-slate-900">
                        Editar cliente
                    </h1>

                    <p className="mt-1 text-sm text-slate-500">
                        Altere as informações cadastrais do cliente.
                    </p>
                </header>

                <FormEditarCliente cliente={cliente} />
            </div>
        </main>
    );
}
