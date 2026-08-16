"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function NovaVisitaPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const origem = searchParams.get("origem");

  const clienteId = params.id;

  const [resultado, setResultado] = useState("");
  const [necessidade, setNecessidade] = useState("");
  const [observacoes, setObservacoes] = useState("");

  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    setErro("");

    const supabase = createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setErro("Sua sessão expirou. Entre novamente.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.from("visitas").insert({
      user_id: user.id,
      cliente_id: clienteId,
      visitado_em: new Date().toISOString(),
      resultado: resultado.trim() || null,
      necessidade: necessidade.trim() || null,
      observacoes: observacoes.trim() || null,
    });

    if (error) {
      console.error("Erro ao registrar visita:", error);

      setErro(
        `Erro: ${error.message} | Código: ${error.code}`
      );

      setLoading(false);
      return;
    }

    if (origem === "planejamento") {
      const hoje = new Date().toLocaleDateString("en-CA", {
        timeZone: "America/Fortaleza",
      });
      const { error: updateError } = await supabase
        .from("planejamento")
        .update({ status: "visitado" })
        .eq("user_id", user.id)
        .eq("cliente_id", clienteId)
        .eq("data", hoje);

      if (updateError) {
        console.error("Erro ao atualizar status do planejamento:", updateError);
      }
      router.push("/planejamento");
    } else {
      router.push(`/clientes/${clienteId}`);
    }
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-2xl">
        <Link
          href={origem === "planejamento" ? "/planejamento" : `/clientes/${clienteId}`}
          className="text-sm font-medium text-blue-600 hover:underline"
        >
          {origem === "planejamento" ? "← Voltar para a rota" : "← Voltar para o cliente"}
        </Link>

        <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <p className="text-sm font-semibold text-blue-600">
            RotaComercial
          </p>

          <h1 className="mt-1 text-2xl font-bold text-slate-900">
            Registrar visita
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Registre o resultado da visita e as próximas oportunidades.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            <div>
              <label
                htmlFor="resultado"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Resultado da visita
              </label>

              <input
                id="resultado"
                type="text"
                value={resultado}
                onChange={(event) => setResultado(event.target.value)}
                placeholder="Ex.: Pedido realizado"
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div>
              <label
                htmlFor="necessidade"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Necessidade / oportunidade
              </label>

              <textarea
                id="necessidade"
                value={necessidade}
                onChange={(event) => setNecessidade(event.target.value)}
                placeholder="Ex.: Precisa repor produto X na próxima semana"
                rows={4}
                className="w-full resize-none rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div>
              <label
                htmlFor="observacoes"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Observações
              </label>

              <textarea
                id="observacoes"
                value={observacoes}
                onChange={(event) => setObservacoes(event.target.value)}
                placeholder="Informações importantes sobre a visita..."
                rows={5}
                className="w-full resize-none rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            {erro && (
              <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
                {erro}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Salvando visita..." : "Salvar visita"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}