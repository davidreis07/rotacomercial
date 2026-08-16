"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function LogoutButton() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    async function handleLogout() {
        setLoading(true);

        const supabase = createClient();

        const { error } = await supabase.auth.signOut();

        if (error) {
            console.error("Erro ao sair:", error);
            setLoading(false);
            return;
        }

        router.replace("/login");
    }

    return (
        <button
            type="button"
            onClick={handleLogout}
            disabled={loading}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
        >
            {loading ? "Saindo..." : "Sair"}
        </button>
    );
}