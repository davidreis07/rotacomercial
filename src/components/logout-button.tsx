"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
    clearUserOfflineData,
    countOutboxByStatus,
} from "@/lib/offline/db";
import { synchronizeNow } from "@/lib/offline/sync-engine";

export function LogoutButton() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [erro, setErro] = useState("");

    async function handleLogout() {
        setLoading(true);
        setErro("");

        const supabase = createClient();

        const { data: sessionData } = await supabase.auth.getSession();
        const user = sessionData.session?.user;
        if (user) {
            if (navigator.onLine) await synchronizeNow();
            const pending = await countOutboxByStatus(user.id, [
                "pending",
                "syncing",
                "retry",
                "error",
                "conflict",
            ]);
            if (pending > 0) {
                setErro(
                    `Existem ${pending} alteração${pending > 1 ? "ões" : ""} não sincronizada${pending > 1 ? "s" : ""}. Resolva ou sincronize antes de sair.`
                );
                setLoading(false);
                return;
            }
            await clearUserOfflineData(user.id);
        }

        const { error } = await supabase.auth.signOut();

        if (error) {
            console.error("Erro ao sair:", error);
            setLoading(false);
            return;
        }

        router.replace("/login");
    }

    return (
        <div className="text-right">
            <button
                type="button"
                onClick={handleLogout}
                disabled={loading}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
            >
                {loading ? "Saindo..." : "Sair"}
            </button>
            {erro && <p className="mt-2 max-w-xs text-xs text-red-600">{erro}</p>}
        </div>
    );
}
