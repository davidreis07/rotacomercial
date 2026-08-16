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
    latitude: number | null;
    longitude: number | null;
}

type GeoStatus =
    | { tipo: "idle" }
    | { tipo: "capturando" }
    | { tipo: "ok"; lat: number; lng: number; precisao: number }
    | { tipo: "erro"; mensagem: string };

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

    // Coordenadas: iniciam com o que já está no banco
    const [latitude, setLatitude] = useState<number | null>(cliente.latitude ?? null);
    const [longitude, setLongitude] = useState<number | null>(cliente.longitude ?? null);
    const [geoStatus, setGeoStatus] = useState<GeoStatus>({ tipo: "idle" });

    const [loading, setLoading] = useState(false);
    const [erro, setErro] = useState("");

    const jaTemLocalizacao = cliente.latitude !== null && cliente.longitude !== null;

    function capturarLocalizacao() {
        if (!navigator.geolocation) {
            setGeoStatus({
                tipo: "erro",
                mensagem: "Geolocalização não suportada por este navegador.",
            });
            return;
        }

        setGeoStatus({ tipo: "capturando" });

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                const precisao = Math.round(position.coords.accuracy);

                // Validação dos intervalos (banco também valida, mas validamos no front)
                if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
                    setGeoStatus({
                        tipo: "erro",
                        mensagem: "Coordenadas inválidas recebidas do dispositivo.",
                    });
                    return;
                }

                setLatitude(lat);
                setLongitude(lng);
                setGeoStatus({ tipo: "ok", lat, lng, precisao });
            },
            (error) => {
                let mensagem = "Não foi possível obter a localização.";

                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        mensagem =
                            "Permissão de localização negada. Verifique as configurações do navegador.";
                        break;
                    case error.POSITION_UNAVAILABLE:
                        mensagem =
                            "Localização indisponível. Verifique se o GPS está ativado.";
                        break;
                    case error.TIMEOUT:
                        mensagem =
                            "Tempo esgotado para obter a localização. Tente novamente.";
                        break;
                }

                setGeoStatus({ tipo: "erro", mensagem });
            },
            {
                enableHighAccuracy: true,
                timeout: 15000,
                maximumAge: 0,
            }
        );
    }

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        setErro("");

        const coordenadasIncompletas =
            (latitude === null) !== (longitude === null);
        const coordenadasInvalidas =
            latitude !== null &&
            longitude !== null &&
            (latitude < -90 ||
                latitude > 90 ||
                longitude < -180 ||
                longitude > 180);

        if (coordenadasIncompletas || coordenadasInvalidas) {
            setErro("As coordenadas de localização são inválidas. Capture a localização novamente.");
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
                latitude: latitude,
                longitude: longitude,
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

            {/* ======== SEÇÃO LOCALIZAÇÃO ======== */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    📍 Localização
                </p>

                {/* Estado atual das coordenadas no banco */}
                {jaTemLocalizacao && geoStatus.tipo === "idle" && (
                    <div className="rounded-lg bg-green-50 border border-green-200 px-3 py-2.5 text-sm text-green-800">
                        ✓ Localização cadastrada — Lat: {cliente.latitude?.toFixed(6)}, Lng: {cliente.longitude?.toFixed(6)}
                    </div>
                )}

                {/* Feedback durante a captura */}
                {geoStatus.tipo === "capturando" && (
                    <div className="flex items-center gap-2 rounded-lg bg-blue-50 border border-blue-200 px-3 py-2.5 text-sm text-blue-700">
                        <svg
                            className="h-4 w-4 animate-spin shrink-0"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                        >
                            <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="4"
                            />
                            <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8v8z"
                            />
                        </svg>
                        Obtendo localização...
                    </div>
                )}

                {/* Localização capturada com sucesso */}
                {geoStatus.tipo === "ok" && (
                    <div className="rounded-lg bg-green-50 border border-green-200 px-3 py-2.5 text-sm text-green-800 space-y-0.5">
                        <p className="font-semibold">✓ Localização capturada</p>
                        <p>Lat: {geoStatus.lat.toFixed(6)}, Lng: {geoStatus.lng.toFixed(6)}</p>
                        <p className="text-green-700">
                            Precisão aproximada: {geoStatus.precisao} m
                        </p>
                    </div>
                )}

                {/* Erro na captura */}
                {geoStatus.tipo === "erro" && (
                    <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-700">
                        {geoStatus.mensagem}
                    </div>
                )}

                {/* Botão de captura */}
                <button
                    type="button"
                    onClick={capturarLocalizacao}
                    disabled={geoStatus.tipo === "capturando" || loading}
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {geoStatus.tipo === "capturando"
                        ? "Obtendo localização..."
                        : jaTemLocalizacao || geoStatus.tipo === "ok"
                            ? "📍 Atualizar com minha localização atual"
                            : "📍 Usar minha localização atual"}
                </button>

                <p className="text-xs text-slate-400">
                    A localização é capturada pelo GPS do dispositivo somente ao clicar no botão.
                </p>
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
