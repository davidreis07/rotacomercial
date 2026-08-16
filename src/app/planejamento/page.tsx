import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdicionarPlanejamentoButton } from "@/components/adicionar-planejamento-button";

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

  const clientesPlanejados = new Set(
    (planejamento ?? []).map((item) => item.cliente_id)
  );

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

        {(clientesError || planejamentoError) && (
          <div className="mt-6 rounded-xl bg-red-50 p-4 text-sm text-red-700">
            Não foi possível carregar o planejamento.
          </div>
        )}

        {!clientesError && (
          <section className="mt-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold text-slate-900">
                Clientes
              </h2>

              <span className="text-sm text-slate-500">
                {planejamento?.length ?? 0} planejados
              </span>
            </div>

            {clientes?.length === 0 && (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center">
                <p className="text-sm text-slate-500">
                  Nenhum cliente cadastrado.
                </p>
              </div>
            )}

            <div className="space-y-3">
              {clientes?.map((cliente) => {
                const jaPlanejado = clientesPlanejados.has(cliente.id);

                return (
                  <article
                    key={cliente.id}
                    className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-slate-900">
                            {cliente.nome_fantasia || cliente.nome}
                          </h3>

                          {cliente.codigo && (
                            <span className="rounded-lg bg-slate-100 px-2 py-1 text-xs text-slate-600">
                              {cliente.codigo}
                            </span>
                          )}
                        </div>

                        {cliente.bairro && (
                          <p className="mt-2 text-sm font-medium text-slate-700">
                            {cliente.bairro}
                          </p>
                        )}

                        {cliente.endereco && (
                          <p className="mt-1 text-sm text-slate-500">
                            {cliente.endereco}
                          </p>
                        )}
                      </div>

                      {jaPlanejado ? (
                        <span className="rounded-xl bg-green-50 px-4 py-2 text-center text-sm font-semibold text-green-700">
                          ✓ Planejado
                        </span>
                      ) : (
                        <AdicionarPlanejamentoButton
                          clienteId={cliente.id}
                          data={hoje}
                        />
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}