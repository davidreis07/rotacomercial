import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
    geocodificarComGeoapify,
    type EnderecoGeocodificacao,
} from "@/lib/geocoding/geoapify";

type Props = {
    params: Promise<{ id: string }>;
};

function texto(value: unknown, maxLength: number) {
    return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export async function POST(request: Request, { params }: Props) {
    const { id } = await params;
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ erro: "Sessão expirada." }, { status: 401 });
    }

    const { data: cliente } = await supabase
        .from("clientes")
        .select("id")
        .eq("id", id)
        .single();

    if (!cliente) {
        return NextResponse.json({ erro: "Cliente não encontrado." }, { status: 404 });
    }

    let body: Record<string, unknown>;

    try {
        body = (await request.json()) as Record<string, unknown>;
    } catch {
        return NextResponse.json({ erro: "Dados inválidos." }, { status: 400 });
    }

    const endereco: EnderecoGeocodificacao = {
        endereco: texto(body.endereco, 180),
        numero: texto(body.numero, 30),
        bairro: texto(body.bairro, 100),
        cidade: texto(body.cidade, 100),
        estado: texto(body.estado, 2).toUpperCase(),
        cep: texto(body.cep, 8).replace(/\D/g, ""),
        pais: texto(body.pais, 2).toUpperCase() || "BR",
    };

    if (!endereco.endereco || !endereco.cidade || !/^[A-Z]{2}$/.test(endereco.estado)) {
        return NextResponse.json(
            { erro: "Informe endereço, cidade e UF antes de localizar." },
            { status: 400 }
        );
    }

    if (endereco.pais !== "BR") {
        return NextResponse.json(
            { erro: "Nesta fase, a geocodificação está disponível apenas para endereços no Brasil." },
            { status: 400 }
        );
    }

    try {
        const resultado = await geocodificarComGeoapify(endereco);

        if (!resultado) {
            return NextResponse.json(
                { erro: "Não foi possível localizar este endereço com segurança. Confira cidade, UF e CEP." },
                { status: 422 }
            );
        }

        return NextResponse.json({ resultado });
    } catch (error) {
        const semChave =
            error instanceof Error && error.message === "GEOAPIFY_API_KEY_NOT_CONFIGURED";

        if (!semChave) {
            console.error("Falha ao consultar o serviço de geocodificação.");
        }

        return NextResponse.json(
            {
                erro: semChave
                    ? "Serviço de geocodificação ainda não configurado."
                    : "Serviço de geocodificação indisponível. Tente novamente mais tarde.",
            },
            { status: 503 }
        );
    }
}
