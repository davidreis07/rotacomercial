import Link from "next/link";
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
        <header className="flex items-center justify-between gap-4">
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
            Em breve seus clientes, visitas e planejamento diário aparecerão
            aqui.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/planejamento"
              className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              Planejamento do dia
            </Link>

            <Link
              href="/clientes"
              className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Ver meus clientes
            </Link>
          </div>        </section>
      </div>
    </main>
  );
}