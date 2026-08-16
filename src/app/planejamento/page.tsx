import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PlanejamentoClient from "./planejamento-client";

export default async function PlanejamentoPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const hoje = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Fortaleza",
  });

  const { data: clientes, error: clientesError } = await supabase
    .from("clientes")
    .select("id, codigo, nome, nome_fantasia, bairro, endereco")
    .order("nome", { ascending: true });

  const { data: planejamento, error: planejamentoError } = await supabase
    .from("planejamento")
    .select("id, cliente_id, ordem, status")
    .eq("data", hoje)
    .order("ordem", { ascending: true });

  const plannedClientIds = planejamento?.map((p) => p.cliente_id) || [];
  const ultimasVisitas: Record<string, { visitado_em: string; necessidade: string | null }> = {};

  if (plannedClientIds.length > 0) {
    const { data: visitas, error: visitasError } = await supabase
      .from("visitas")
      .select("cliente_id, visitado_em, necessidade")
      .in("cliente_id", plannedClientIds)
      .order("visitado_em", { ascending: false });

    if (visitas && !visitasError) {
      for (const v of visitas) {
        if (!ultimasVisitas[v.cliente_id]) {
          ultimasVisitas[v.cliente_id] = {
            visitado_em: v.visitado_em,
            necessidade: v.necessidade,
          };
        }
      }
    }
  }

  const hasError = !!(clientesError || planejamentoError);

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-4xl">
        <Link
          href="/"
          className="text-sm font-medium text-blue-600 hover:underline"
        >
          ← Voltar
        </Link>

        <header className="mt-4">
          <p className="text-sm font-semibold text-blue-600">
            RotaComercial
          </p>

          <h1 className="mt-1 text-2xl font-bold text-slate-900">
            Planejamento do dia
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Organize os clientes que pretende visitar hoje.
          </p>
        </header>

        {hasError ? (
          <div className="mt-6 rounded-xl bg-red-50 p-4 text-sm text-red-700">
            Não foi possível carregar o planejamento.
          </div>
        ) : (
          <PlanejamentoClient
            initialClientes={clientes || []}
            initialPlanejamento={planejamento || []}
            ultimasVisitas={ultimasVisitas}
            data={hoje}
            userId={user.id}
          />
        )}
      </div>
    </main>
  );
}