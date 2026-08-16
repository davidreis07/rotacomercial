"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface Cliente {
    id: string;
    codigo: string | null;
    nome: string;
    nome_fantasia: string | null;
    bairro: string | null;
    endereco: string | null;
    numero: string | null;
    complemento: string | null;
    telefone: string | null;
    observacoes: string | null;
}

export function FormEditarCliente({ cliente }: { cliente: Cliente }) {
    const router = useRouter();

    const [codigo, setCodigo] = useState(cliente.codigo || "");
    const [nome, setNome] = useState(cliente.nome || "");
    const [nomeFantasia, setNomeFantasia] = useState(cliente.nome_fantasia || "");
    const [bairro, setBairro] = useState(cliente.bairro || "");
    const [endereco, setEndereco] = useState(cliente.endereco || "");
    const [numero, setNumero] = useState(cliente.numero || "");
    const [complemento, setComplemento] = useState(cliente.complemento || "");
    const [telefone, setTelefone] = useState(cliente.telefone || "");
    const [observacoes, setObservacoes] = useState(cliente.observacoes || "");

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

        const { error } = await supabase
            .from("clientes")
            .update({
                codigo: codigo.trim() || null,
                nome: nome.trim(),
                nome_fantasia: nomeFantasia.trim() || null,
                bairro: bairro.trim() || null,
                endereco: endereco.trim() || null,
                numero: numero.trim() || null,
                complemento: complemento.trim() || null,
                telefone: telefone.trim() || null,
                observacoes: observacoes.trim() || null,
            })
            .eq("id", cliente.id);

        if (error) {
            console.error("Erro ao atualizar cliente:", error);
            setErro("Não foi possível atualizar o cliente. Tente novamente.");
            setLoading(false);
            return;
        }

        router.push(`/clientes/${cliente.id}`);
        router.refresh();
    }

    return (
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

            <div className="flex gap-3">
                <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {loading ? "Salvando..." : "Salvar alterações"}
                </button>

                <button
                    type="button"
                    disabled={loading}
                    onClick={() => router.push(`/clientes/${cliente.id}`)}
                    className="rounded-xl border border-slate-300 bg-white px-4 py-3 font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                >
                    Cancelar
                </button>
            </div>
        </form>
    );
}
