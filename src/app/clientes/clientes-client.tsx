"use client";

import { useState } from "react";
import Link from "next/link";

interface Cliente {
    id: string;
    codigo: string | null;
    nome: string;
    nome_fantasia: string | null;
    bairro: string | null;
    endereco: string | null;
    telefone: string | null;
}

export function ClientesClient({ clientes }: { clientes: Cliente[] }) {
    const [busca, setBusca] = useState("");

    const termo = busca.trim().toLowerCase();

    const clientesFiltrados = termo
        ? clientes.filter((c) => {
            return (
                c.nome.toLowerCase().includes(termo) ||
                (c.nome_fantasia?.toLowerCase().includes(termo) ?? false) ||
                (c.codigo?.toLowerCase().includes(termo) ?? false) ||
                (c.bairro?.toLowerCase().includes(termo) ?? false)
            );
        })
        : clientes;

    return (
        <div>
            {/* Campo de busca */}
            <div className="mb-5">
                <div className="relative">
                    <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-slate-400">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-4 w-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
                            />
                        </svg>
                    </span>
                    <input
                        id="busca-clientes"
                        type="search"
                        value={busca}
                        onChange={(e) => setBusca(e.target.value)}
                        placeholder="Buscar por nome, código ou bairro..."
                        className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-10 pr-4 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                </div>
            </div>

            {/* Lista vazia (sem nenhum cliente cadastrado) */}
            {clientes.length === 0 && (
                <section className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
                    <h2 className="text-lg font-semibold text-slate-900">
                        Nenhum cliente cadastrado
                    </h2>
                    <p className="mt-2 text-sm text-slate-500">
                        Cadastre seu primeiro cliente para começar sua base comercial.
                    </p>
                </section>
            )}

            {/* Nenhum resultado na busca */}
            {clientes.length > 0 && clientesFiltrados.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
                    <p className="text-sm font-medium text-slate-500">
                        Nenhum cliente encontrado.
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                        Tente buscar por outro nome, código ou bairro.
                    </p>
                </div>
            )}

            {/* Lista de clientes */}
            {clientesFiltrados.length > 0 && (
                <div className="space-y-3">
                    {clientesFiltrados.map((cliente) => (
                        <Link
                            key={cliente.id}
                            href={`/clientes/${cliente.id}`}
                            className="block"
                        >
                            <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-300 hover:shadow-md">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <h2 className="font-semibold text-slate-900">
                                                {cliente.nome_fantasia || cliente.nome}
                                            </h2>

                                            {cliente.codigo && (
                                                <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                                                    {cliente.codigo}
                                                </span>
                                            )}
                                        </div>

                                        {cliente.nome_fantasia && (
                                            <p className="mt-1 text-sm text-slate-500">
                                                {cliente.nome}
                                            </p>
                                        )}

                                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
                                            {cliente.bairro && (
                                                <span className="font-medium text-slate-700">
                                                    {cliente.bairro}
                                                </span>
                                            )}
                                            {cliente.bairro && cliente.endereco && (
                                                <span className="text-slate-300">•</span>
                                            )}
                                            {cliente.endereco && (
                                                <span>{cliente.endereco}</span>
                                            )}
                                        </div>

                                        {cliente.telefone && (
                                            <p className="mt-1 text-sm text-slate-500">
                                                {cliente.telefone}
                                            </p>
                                        )}
                                    </div>

                                    <span className="text-xl text-slate-400 shrink-0">›</span>
                                </div>
                            </article>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
