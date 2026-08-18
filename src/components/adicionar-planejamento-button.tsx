"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Props = {
    clienteId: string;
    data: string;
};

export function AdicionarPlanejamentoButton({
    clienteId,
    data,
}: Props) {
    const router = useRouter();

    const [loading, setLoading] = useState(false);
    const [erro, setErro] = useState("");

    async function adicionar() {
        setLoading(true);
        setErro("");

        const supabase = createClient();

        const {
            data: { user },
            error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
            setErro("Sessão expirada.");
            setLoading(false);
            return;
        }

        const { count, error: countError } = await supabase
            .from("planejamento")
            .select("*", { count: "exact", head: true })
            .eq("data", data);

        if (countError) {
            setErro(countError.message);
            setLoading(false);
            return;
        }

        const { error } = await supabase
            .from("planejamento")
            .insert({
                id: crypto.randomUUID(),
                user_id: user.id,
                cliente_id: clienteId,
                data,
                ordem: (count ?? 0) + 1,
                status: "planejado",
            });

        if (error) {
            console.error("Erro ao adicionar ao planejamento:", error);

            setErro(`${error.message} (${error.code})`);
            setLoading(false);
            return;
        }

        router.refresh();
    }

    return (
        <div>
            <button
                type="button"
                onClick={adicionar}
                disabled={loading}
                className="w-full rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50 sm:w-auto"
            >
                {loading ? "Adicionando..." : "+ Planejar visita"}
            </button>

            {erro && (
                <p className="mt-2 max-w-xs text-xs text-red-600">
                    {erro}
                </p>
            )}
        </div>
    );
}
