export type EnderecoGeocodificacao = {
    endereco: string;
    numero?: string;
    bairro?: string;
    cidade: string;
    estado: string;
    cep?: string;
    pais: string;
};

export type ResultadoGeocodificacao = {
    latitude: number;
    longitude: number;
    enderecoFormatado: string;
    precisao: string;
    confianca: number;
};

type GeoapifyFeature = {
    properties?: {
        lat?: number;
        lon?: number;
        formatted?: string;
        country_code?: string;
        state_code?: string;
        city?: string;
        postcode?: string;
        housenumber?: string;
        result_type?: string;
        rank?: {
            confidence?: number;
            confidence_city_level?: number;
            match_type?: string;
        };
    };
};

type GeoapifyResponse = {
    features?: GeoapifyFeature[];
};

const tiposAceitaveis = new Set(["building", "amenity", "street"]);

function normalizarTexto(value: string | undefined) {
    return (value ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase();
}

function normalizarNumero(value: string | undefined) {
    return normalizarTexto(value).replace(/[^a-z0-9]/g, "");
}

export async function geocodificarComGeoapify(
    endereco: EnderecoGeocodificacao
): Promise<ResultadoGeocodificacao | null> {
    const apiKey = process.env.GEOAPIFY_API_KEY;

    if (!apiKey) {
        throw new Error("GEOAPIFY_API_KEY_NOT_CONFIGURED");
    }

    const consulta = [
        [endereco.endereco, endereco.numero].filter(Boolean).join(", "),
        endereco.bairro,
        endereco.cidade,
        endereco.estado,
        endereco.cep,
        endereco.pais === "BR" ? "Brasil" : endereco.pais,
    ]
        .filter(Boolean)
        .join(", ");

    const params = new URLSearchParams({
        text: consulta,
        format: "geojson",
        limit: "1",
        lang: "pt",
        filter: "countrycode:br",
        apiKey,
    });

    const response = await fetch(
        `https://api.geoapify.com/v1/geocode/search?${params.toString()}`,
        {
            headers: { Accept: "application/geo+json" },
            cache: "no-store",
            signal: AbortSignal.timeout(10000),
        }
    );

    if (!response.ok) {
        throw new Error(`GEOAPIFY_HTTP_${response.status}`);
    }

    const data = (await response.json()) as GeoapifyResponse;
    const properties = data.features?.[0]?.properties;

    if (!properties) return null;

    const latitude = properties.lat;
    const longitude = properties.lon;
    const confianca = properties.rank?.confidence ?? 0;
    const confiancaCidade = properties.rank?.confidence_city_level ?? 0;
    const tipo = properties.result_type ?? "desconhecida";
    const paisCorreto = properties.country_code?.toLowerCase() === "br";
    const cidadeCorreta =
        normalizarTexto(properties.city) === normalizarTexto(endereco.cidade);
    const estadoCorreto =
        properties.state_code?.toUpperCase() === endereco.estado.toUpperCase();
    const cepCorreto =
        !endereco.cep || properties.postcode?.replace(/\D/g, "") === endereco.cep;
    const numeroCorreto =
        !endereco.numero ||
        normalizarNumero(properties.housenumber) === normalizarNumero(endereco.numero);
    const tipoCompativel = endereco.numero
        ? tipo === "building" || tipo === "amenity"
        : tiposAceitaveis.has(tipo);
    const coordenadasValidas =
        typeof latitude === "number" &&
        typeof longitude === "number" &&
        Number.isFinite(latitude) &&
        Number.isFinite(longitude) &&
        latitude >= -90 &&
        latitude <= 90 &&
        longitude >= -180 &&
        longitude <= 180;

    const resultadoSeguro =
        coordenadasValidas &&
        paisCorreto &&
        cidadeCorreta &&
        estadoCorreto &&
        cepCorreto &&
        numeroCorreto &&
        confianca >= 0.7 &&
        confiancaCidade >= 0.7 &&
        tipoCompativel;

    if (!resultadoSeguro || latitude === undefined || longitude === undefined) {
        return null;
    }

    const precisao = properties.rank?.match_type
        ? `${tipo}:${properties.rank.match_type}`
        : tipo;

    return {
        latitude,
        longitude,
        enderecoFormatado: properties.formatted ?? endereco.endereco,
        precisao,
        confianca,
    };
}
