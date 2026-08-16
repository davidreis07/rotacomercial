"use client";

import { useEffect, useRef } from "react";
import type { Map as LeafletMap } from "leaflet";

export type PontoRota = {
    clienteId: string;
    posicao: number;
    nome: string;
    codigo: string | null;
    bairro: string | null;
    endereco: string | null;
    status: string;
    latitude: number;
    longitude: number;
};

type Props = {
    pontos: PontoRota[];
};

const statusLabel: Record<string, string> = {
    planejado: "Planejado",
    visitado: "Visitado",
    cancelado: "Cancelado",
};

export default function MapaRota({ pontos }: Props) {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<LeafletMap | null>(null);

    useEffect(() => {
        if (!containerRef.current || pontos.length === 0) return;

        let ativo = true;

        async function montarMapa() {
            const L = await import("leaflet");

            if (!ativo || !containerRef.current) return;

            mapRef.current?.remove();
            containerRef.current.replaceChildren();

            const map = L.map(containerRef.current, {
                zoomControl: true,
                scrollWheelZoom: false,
            });
            mapRef.current = map;

            L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
                maxZoom: 19,
            }).addTo(map);

            const coordenadas = pontos.map(
                (ponto) => [ponto.latitude, ponto.longitude] as [number, number]
            );

            for (const ponto of pontos) {
                const statusMarcador = ["planejado", "visitado", "cancelado"].includes(ponto.status)
                    ? ponto.status
                    : "planejado";
                const icone = L.divIcon({
                    className: "rota-marker-wrapper",
                    html: `<span class="rota-marker" data-status="${statusMarcador}" aria-label="Parada ${ponto.posicao}, ${statusLabel[statusMarcador]}">${ponto.posicao}</span>`,
                    iconSize: [32, 32],
                    iconAnchor: [16, 16],
                });

                const popup = document.createElement("div");
                popup.className = "min-w-48 text-sm text-slate-700";

                const titulo = document.createElement("p");
                titulo.className = "font-bold text-slate-900";
                titulo.textContent = `${ponto.posicao}. ${ponto.nome}`;
                popup.appendChild(titulo);

                const detalhes = [
                    ponto.codigo ? `Código: ${ponto.codigo}` : null,
                    ponto.bairro ? `Bairro: ${ponto.bairro}` : null,
                    ponto.endereco ? `Endereço: ${ponto.endereco}` : null,
                    `Status: ${statusLabel[ponto.status] ?? ponto.status}`,
                ].filter((valor): valor is string => Boolean(valor));

                for (const detalhe of detalhes) {
                    const linha = document.createElement("p");
                    linha.className = "mt-1";
                    linha.textContent = detalhe;
                    popup.appendChild(linha);
                }

                const acoes = document.createElement("div");
                acoes.className = "mt-3 flex flex-wrap gap-2";

                const ficha = document.createElement("a");
                ficha.href = `/clientes/${ponto.clienteId}`;
                ficha.className = "font-semibold text-blue-700 underline";
                ficha.textContent = "Abrir ficha";
                acoes.appendChild(ficha);

                const navegacao = document.createElement("a");
                navegacao.href = `https://www.google.com/maps/dir/?api=1&destination=${ponto.latitude},${ponto.longitude}`;
                navegacao.target = "_blank";
                navegacao.rel = "noopener noreferrer";
                navegacao.className = "font-semibold text-emerald-700 underline";
                navegacao.textContent = "Abrir navegação";
                acoes.appendChild(navegacao);
                popup.appendChild(acoes);

                L.marker([ponto.latitude, ponto.longitude], { icon: icone })
                    .addTo(map)
                    .bindPopup(popup, { maxWidth: 280 });
            }

            if (coordenadas.length > 1) {
                L.polyline(coordenadas, {
                    color: "#2563eb",
                    weight: 3,
                    opacity: 0.65,
                    dashArray: "7 7",
                }).addTo(map);
                map.fitBounds(L.latLngBounds(coordenadas), {
                    padding: [28, 28],
                    maxZoom: 16,
                });
            } else {
                map.setView(coordenadas[0], 16);
            }
        }

        void montarMapa();

        return () => {
            ativo = false;
            mapRef.current?.remove();
            mapRef.current = null;
        };
    }, [pontos]);

    if (pontos.length === 0) {
        return (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
                <p className="text-sm font-medium text-slate-600">
                    Nenhum cliente da rota possui localização válida.
                </p>
                <p className="mt-1 text-xs text-slate-500">
                    Cadastre a localização dos clientes para visualizá-los no mapa.
                </p>
            </div>
        );
    }

    return (
        <div
            ref={containerRef}
            className="h-80 w-full overflow-hidden rounded-xl border border-slate-200 sm:h-96"
            role="region"
            aria-label={`Mapa com ${pontos.length} ${pontos.length === 1 ? "cliente" : "clientes"} da rota`}
        />
    );
}
