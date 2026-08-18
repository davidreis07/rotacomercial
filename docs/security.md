# Segurança

## Modelo de confiança

- Supabase Auth autentica usuários.
- RLS no PostgreSQL é a barreira autoritativa entre usuários.
- O browser, IndexedDB futuro e Service Worker são ambientes não confiáveis.
- Dados offline autorizados anteriormente não garantem autorização atual após reconexão.

## Supabase Auth e RLS

- Usar publishable key no browser; nunca `service_role`.
- Toda tabela por usuário deve validar `auth.uid()` em select/insert/update/delete.
- Relações precisam impedir referência cruzada entre usuários, não apenas filtrar a tabela filha.
- Route Handlers usam a sessão do cookie e executam como usuário.
- Testes automatizados de policies são requisito antes de offline/sync.
- A ausência de schema/policies versionados no repositório é risco P0.

## Secrets

- `GEOAPIFY_API_KEY` permanece exclusivamente server-side.
- `.env.local` não é commitado nem impresso.
- Apenas valores realmente públicos usam `NEXT_PUBLIC_*`.
- Logs não devem incluir JWT, cookies, API keys, payloads completos, endereços ou coordenadas precisas.
- Rotação e restrição de quota/origem/IP devem ser aplicadas no provedor quando suportadas.

## Dados locais e IndexedDB

IndexedDB não é um cofre. Scripts executados na mesma origem, extensões, dispositivo comprometido ou XSS podem acessar os dados.

Controles mínimos:

- partição física/lógica por `user_id`;
- nenhum dado antes de identificar sessão/partição correta;
- limpeza no logout e troca de usuário;
- CSP e prevenção de XSS;
- minimizar dados e retenção;
- não armazenar secrets;
- proteger telas contra exposição casual ao retornar do background quando apropriado;
- documentar que criptografia no browser com chave disponível ao app reduz exposição em repouso, mas não resolve XSS.

## Logout e múltiplos usuários

Fluxo alvo:

1. pausar sync;
2. verificar pendências;
3. se online, tentar sincronizar ou permitir logout consciente;
4. apagar base local, caches, chaves e estado em memória daquele usuário;
5. encerrar sessão Supabase;
6. impedir reabertura da partição anterior.

Se offline, logout local deve bloquear imediatamente os dados. Pendências não podem migrar para outro usuário. A política entre “apagar e perder pendências” e “manter cofre bloqueado para recuperação pelo mesmo usuário” precisa de decisão explícita antes da implementação.

## Service Worker e caches futuros

- Não cachear respostas autenticadas indiscriminadamente no Cache Storage.
- App shell pode ser compartilhado; dados de negócio não.
- Versões antigas do Service Worker precisam ser encerradas/migradas com segurança.
- Não interceptar endpoints de auth/sync com estratégia genérica stale-while-revalidate.
- Cache de tiles deve respeitar licença e política do provedor.

## Privacidade de geolocalização

- GPS somente por ação explícita e `getCurrentPosition()`.
- Não usar `watchPosition`, background tracking ou histórico GPS sem novo consentimento/escopo.
- Salvar apenas localização do cliente confirmada, não trajetória do representante.
- Mostrar origem e precisão; não sobrescrever silenciosamente.
- Coordenadas e endereços são dados potencialmente sensíveis e devem obedecer minimização, retenção e finalidade.
- Geocodificação envia endereço a terceiro; isso deve constar na política de privacidade e contrato aplicável.

## Sincronização segura

- Cada operação carrega `user_id` local apenas para partição; o servidor deriva identidade do JWT.
- Servidor ignora/valida ownership vindo do payload.
- Idempotency key não substitui autorização.
- Conflitos e erros não devem retornar dados de outro usuário.
- Payloads precisam de limites de tamanho, schema validation e allowlist de campos.
- Replays são aceitos apenas como operação idempotente do mesmo usuário.

## Ameaças prioritárias

| Ameaça | Mitigação |
| --- | --- |
| XSS lê IndexedDB | CSP, escaping, dependências controladas, sem HTML não confiável |
| Usuário B vê cache de A | partição e purge obrigatório na troca/logout |
| Sync após sessão expirada | refresh e bloqueio antes do push |
| Payload altera `user_id` | identidade derivada do JWT + RLS |
| Dados sensíveis em logs | logging estruturado com redaction |
| Chave externa exposta | Route Handler e env server-only |
| Replay duplica visita | UUID + idempotency ledger/constraint |
| Cache serve resposta autenticada errada | nunca cachear dados de negócio genericamente |

## Checklist antes de produção offline

- policies exportadas/versionadas e testadas;
- threat model revisado;
- CSP definida;
- política de logout com pendências decidida;
- retenção local documentada;
- privacidade de geocodificação publicada;
- recuperação após sessão expirada testada;
- nenhuma credencial em bundles, logs ou IndexedDB.
