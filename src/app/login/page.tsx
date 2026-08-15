import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "@/components/logout-button";

export default async function Home() {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login");
    }

    return (
        <main className="min-h-screen bg-slate-50 p-6">
            <div className="mx-auto max-w-4xl">
                <header className="flex items-center justify-between">
                    <div>
                        <p className="text-sm font-semibold text-blue-600">
                            RotaComercial
                        </p>

                        <h1 className="mt-1 text-2xl font-bold text-slate-900">
                            Minha rotina comercial
                        </h1>

                        <p className="mt-1 text-sm text-slate-500">
                            {user.email}
                        </p>
                    </div>

                    <LogoutButton />
                </header>

                <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <p className="text-sm text-slate-500">
                        Bem-vindo ao RotaComercial.
                    </p>

                    <h2 className="mt-1 text-xl font-semibold text-slate-900">
                        Sua área de trabalho está pronta.
                    </h2>

                    <p className="mt-3 text-slate-600">
                        Em breve seus clientes, visitas e planejamento diário
                        aparecerão aqui.
                    </p>
                </section>
            </div>
        </main>
    );
}