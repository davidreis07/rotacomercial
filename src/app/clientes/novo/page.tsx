"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function NovoClientePage() {
  const router = useRouter();

  const [codigo, setCodigo] = useState("");
  const [nome, setNome] = useState("");
  const [nomeFantasia, setNomeFantasia] = useState("");
  const [bairro, setBairro] = useState("");
  const [endereco, setEndereco] = useState("");
  const [numero, setNumero] = useState("");
  const [complemento, setComplemento] = useState("");
  const [cidade, setCidade] = useState("");
  const [estado, setEstado] = useState("");
  const [cep, setCep] = useState("");
  const [pais, setPais] = useState("BR");
  const [telefone, setTelefone] = useState("");
  const [observacoes, setObservacoes] = useState("");

  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setErro("");

    if (estado && !/^[A-Z]{2}$/.test(estado)) {
      setErro("Informe a UF com duas letras.");
      return;
    }

    if (cep && !/^\d{8}$/.test(cep)) {
      setErro("Informe o CEP com oito números.");
      return;
    }

    if (pais && !/^[A-Z]{2}$/.test(pais)) {
      setErro("Informe o país com duas letras.");
      return;
    }

    setLoading(true);

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

    const { error } = await supabase.from("clientes").insert({
      id: crypto.randomUUID(),
      user_id: user.id,
      codigo: codigo.trim() || null,
      nome: nome.trim(),
      nome_fantasia: nomeFantasia.trim() || null,
      bairro: bairro.trim() || null,
      endereco: endereco.trim() || null,
      numero: numero.trim() || null,
      complemento: complemento.trim() || null,
      cidade: cidade.trim() || null,
      estado: estado.trim().toUpperCase() || null,
      cep: cep.replace(/\D/g, "") || null,
      pais: pais.trim().toUpperCase() || "BR",
      telefone: telefone.trim() || null,
      observacoes: observacoes.trim() || null,
    });

    if (error) {
      console.error("Erro ao cadastrar cliente:", error);
      setErro("Não foi possível cadastrar o cliente. Tente novamente.");
      setLoading(false);
      return;
    }

    router.replace("/clientes");
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/clientes"
          className="text-sm font-medium text-blue-600 hover:underline"
        >
          ← Voltar para clientes
        </Link>

        <header className="mt-4 mb-6">
          <p className="text-sm font-semibold text-blue-600">
            RotaComercial
          </p>

          <h1 className="mt-1 text-2xl font-bold text-slate-900">
            Novo cliente
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Cadastre um cliente da sua rota comercial.
          </p>
        </header>

        <form
          onSubmit={handleSubmit}
          className="space-y-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
        >
          <div>
            <label
              htmlFor="codigo"
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              Código do cliente
            </label>

            <input
              id="codigo"
              value={codigo}
              onChange={(event) => setCodigo(event.target.value)}
              placeholder="Ex.: 3405976"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div>
            <label
              htmlFor="nome"
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              Razão social / Nome *
            </label>

            <input
              id="nome"
              value={nome}
              onChange={(event) => setNome(event.target.value)}
              required
              placeholder="Nome do cliente"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div>
            <label
              htmlFor="nomeFantasia"
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              Nome fantasia
            </label>

            <input
              id="nomeFantasia"
              value={nomeFantasia}
              onChange={(event) => setNomeFantasia(event.target.value)}
              placeholder="Ex.: Mercadinho São José"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div>
            <label
              htmlFor="bairro"
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              Bairro
            </label>

            <input
              id="bairro"
              value={bairro}
              onChange={(event) => setBairro(event.target.value)}
              placeholder="Ex.: Cohab"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div>
            <label
              htmlFor="endereco"
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              Endereço
            </label>

            <input
              id="endereco"
              value={endereco}
              onChange={(event) => setEndereco(event.target.value)}
              placeholder="Rua, avenida..."
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="numero"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Número
              </label>

              <input
                id="numero"
                value={numero}
                onChange={(event) => setNumero(event.target.value)}
                placeholder="Ex.: 125"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div>
              <label
                htmlFor="complemento"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Complemento
              </label>

              <input
                id="complemento"
                value={complemento}
                onChange={(event) => setComplemento(event.target.value)}
                placeholder="Quadra, loja..."
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="cidade" className="mb-2 block text-sm font-medium text-slate-700">
                Cidade
              </label>
              <input
                id="cidade"
                value={cidade}
                onChange={(event) => setCidade(event.target.value)}
                placeholder="Ex.: São Luís"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div>
              <label htmlFor="estado" className="mb-2 block text-sm font-medium text-slate-700">
                Estado / UF
              </label>
              <input
                id="estado"
                value={estado}
                onChange={(event) => setEstado(event.target.value.toUpperCase().slice(0, 2))}
                maxLength={2}
                placeholder="MA"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 uppercase text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="cep" className="mb-2 block text-sm font-medium text-slate-700">
                CEP
              </label>
              <input
                id="cep"
                inputMode="numeric"
                value={cep}
                onChange={(event) => setCep(event.target.value.replace(/\D/g, "").slice(0, 8))}
                maxLength={8}
                placeholder="65000000"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div>
              <label htmlFor="pais" className="mb-2 block text-sm font-medium text-slate-700">
                País
              </label>
              <input
                id="pais"
                value={pais}
                onChange={(event) => setPais(event.target.value.toUpperCase().slice(0, 2))}
                maxLength={2}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 uppercase text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="telefone"
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              Telefone
            </label>

            <input
              id="telefone"
              type="tel"
              value={telefone}
              onChange={(event) => setTelefone(event.target.value)}
              placeholder="(98) 99999-9999"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
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
              rows={4}
              placeholder="Informações importantes sobre o cliente..."
              className="w-full resize-none rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
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
            className="w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Salvando..." : "Salvar cliente"}
          </button>
        </form>
      </div>
    </main>
  );
}
