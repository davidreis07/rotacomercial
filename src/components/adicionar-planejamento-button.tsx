"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getUserEntities } from "@/lib/offline/db";
import { queueEntityMutation } from "@/lib/offline/mutations";
import type { LocalEntity } from "@/lib/offline/types";

type LocalPlanejamento = LocalEntity & { data: string };

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
            data: { session },
            error: userError,
        } = await supabase.auth.getSession();
        const user = session?.user;

        if (userError || !user) {
            setErro("Sessão expirada.");
            setLoading(false);
            return;
        }

        try {
            const planejamento = await getUserEntities<LocalPlanejamento>(
                "planejamento",
                user.id
            );
            const ordem = planejamento.filter((item) => item.data === data).length + 1;
            const now = new Date().toISOString();
            const item = {
                id: crypto.randomUUID(),
                user_id: user.id,
                cliente_id: clienteId,
                data,
                ordem,
                status: "planejado",
                version: 1,
                created_at: now,
                updated_at: now,
            };
            await queueEntityMutation({
                store: "planejamento",
                entityType: "planejamento",
                entity: item,
                operation: "planejamento.create",
                payload: item,
            });
        } catch (error) {
            console.error("Erro ao salvar planejamento localmente:", error);
            setErro("Não foi possível salvar o planejamento neste dispositivo.");
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
