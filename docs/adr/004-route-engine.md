# ADR 004 — Motor de rotas

## Status

Proposto — nenhuma roteirização ou otimização será implementada agora.

## Contexto

O mapa atual liga coordenadas em linha reta e preserva ordem manual. Futuramente o produto pode calcular trajeto viário, ETA e sugerir otimização, com custos e fornecedores variáveis.

## Decisão

Separar três conceitos:

1. **ordem planejada:** domínio interno e editável pelo usuário;
2. **trajeto calculado:** resposta de um `RouteEngine` substituível;
3. **ordem otimizada:** sugestão explícita que só altera a rota após aceite.

Definir futuramente uma interface independente de fornecedor. Não acoplar Planejamento, mapa ou banco ao formato de Google, Mapbox, OSRM ou outro provedor.

## Alternativas

1. **Google Routes/Directions:** ampla cobertura, custo e lock-in/licença.
2. **Mapbox Directions/Optimization:** integração coerente no ecossistema, custo e dependência.
3. **OSRM/Valhalla hospedado:** maior controle, custo operacional e necessidade de dados/infra.
4. **Linha reta atual:** adequada apenas para comunicar sequência, não trajeto.
5. **Algoritmo próprio prematuro:** rejeitado sem matriz viária, restrições e dados confiáveis.

## Consequências

- ordem manual continua autoritativa até aceite de sugestão;
- mapa pode funcionar sem motor de rota;
- cache de respostas depende dos termos do provedor;
- avaliações futuras compararão cobertura brasileira, custo, SLA, ETA e restrições.

## Riscos

- confundir linha aproximada com trajeto real;
- aplicar otimização silenciosa;
- quota/custo inesperado;
- baixa qualidade de coordenadas;
- lock-in do payload;
- indisponibilidade bloquear a rota, caso não exista fallback manual.
