# Estratégia de testes

## Objetivos

Detectar regressões de domínio, violações de isolamento, perda/duplicação de operações offline e falhas específicas de dispositivos móveis. A estratégia será implementada em fases; nenhum framework é instalado nesta sprint.

## Pirâmide proposta

1. **Unitários:** regras puras, rápidos e numerosos.
2. **Integração:** repositórios, IndexedDB, Supabase local/teste e providers simulados.
3. **E2E:** jornadas essenciais online/offline em browser real.
4. **Testes de contrato/segurança:** schema, RLS e integrações externas.

## Testes unitários

Cobrir:

- validação/normalização de Cliente, endereço e Localização;
- transições de status de parada;
- cálculo de progresso;
- compactação e ordenação de rota;
- criação de comandos e dependências da outbox;
- classificação de erros em retry, conflito e falha permanente;
- backoff com jitter usando relógio controlado;
- merge de campos e detecção de conflitos;
- validação conservadora da resposta Geoapify;
- formatação temporal com política de timezone definida.

Regras de domínio devem ser funções puras sem React ou Supabase.

## Testes de integração

### Repositório local

- transação grava projeção e outbox juntas;
- rollback não deixa mutação órfã;
- migrations locais preservam dados;
- partições de usuários são isoladas;
- índices suportam rota, busca de cliente e histórico;
- reload recupera pendências e conflitos.

### Sincronização

- create offline seguido de update antes do primeiro push;
- timeout após commit remoto e antes do ack local;
- retry com a mesma idempotency key;
- dependência cliente → visita;
- pull incremental sem lacunas em timestamps iguais;
- tombstone remove projeção sem ressuscitar entidade;
- lease recupera operação presa em `syncing`.

### Supabase

Usar projeto local/efêmero ou ambiente isolado. Nunca executar testes destrutivos contra produção. Aplicar migrations reais e criar usuários distintos por teste.

## Testes de RLS

Para cada tabela/comando:

- usuário A lê/escreve seus dados;
- usuário A não lê, altera ou exclui dados de B;
- inserts com `user_id` de B falham;
- relações cruzadas falham mesmo quando a linha filha usa A;
- usuário anônimo não acessa dados;
- RPCs/Route Handlers mantêm identidade e não usam `service_role`;
- geocodificação de cliente de outro usuário retorna not found/forbidden sem vazar existência.

Policies devem ser testadas em SELECT, INSERT, UPDATE e DELETE separadamente.

## Testes E2E

Jornadas críticas:

1. login → clientes → ficha → logout;
2. montar e reordenar rota;
3. registrar visita pela rota e atualizar progresso;
4. capturar GPS com API simulada;
5. geocodificar, cancelar substituição e confirmar explicitamente;
6. abrir mapa com zero, um e vários clientes;
7. bootstrap → ficar offline → executar rota → reconectar → sincronizar;
8. trocar usuário no mesmo dispositivo sem vazamento.

## Testes offline e rede instável

Executar matriz com:

- offline antes de abrir;
- queda durante leitura;
- queda antes do commit local;
- queda depois do commit local;
- queda durante request remoto;
- resposta perdida após commit remoto;
- alternância online/offline repetida;
- 429, 401, 403, 409/412, 422 e 5xx;
- latência alta e requests fora de ordem;
- app encerrado no meio da sincronização.

Verificar invariantes: nenhuma perda, nenhuma duplicação, UI não mente sobre sync e retry sobrevive ao reload.

## Testes de conflitos

### Cliente

- dispositivos editam campos diferentes: merge previsto;
- editam o mesmo campo: conflito visível;
- GPS em um e geocodificação em outro: Localização tratada como grupo indivisível.

### Visita

- mesma operação reenviada várias vezes cria uma visita;
- duas visitas legítimas distintas permanecem duas;
- cliente remoto removido gera conflito recuperável.

### Rota

- dois dispositivos reordenam a mesma versão;
- status muda enquanto ordem conflita;
- cliente é adicionado/removido durante resolução;
- rota final tem ordem determinística e sem duplicatas.

## Mapas e integrações

- Leaflet deve ser testado sem `window` no SSR e com cleanup no unmount.
- Falha de tiles não bloqueia lista.
- URLs externas recebem coordenadas válidas.
- Geoapify deve usar mock/fixture em CI; poucos smoke tests reais, controlados por quota e segredo.
- Contratos do provider devem usar fixtures versionadas sem dados reais sensíveis.

## Dispositivos móveis

Cobrir Chromium Android e Safari iOS em versões suportadas, incluindo:

- viewport pequena, touch e teclado virtual;
- IndexedDB sob pressão/eviction;
- suspensão e retomada do app;
- permissões GPS negada, indisponível e timeout;
- modo economia de bateria;
- instalação/atualização PWA futura;
- acessibilidade, foco, contraste e targets de toque.

## Qualidade e gates

Gate mínimo atual: lint, TypeScript via build, build de produção e `git diff --check`.

Gates futuros:

- unit/integration sem flakiness;
- testes de RLS obrigatórios para migrations;
- E2E smoke por pull request;
- suíte offline/conflitos antes de release;
- orçamento de bundle e performance mobile;
- zero segredo detectado no bundle/log de teste.

## Dados de teste

Usar factories determinísticas, UUIDs controláveis e relógio falso. Endereços/coordenadas devem ser sintéticos ou públicos, nunca clientes reais. Cada teste limpa apenas seu namespace/projeto isolado.

## Critérios de aceite do offline-first

- visita offline persiste após reload e sincroniza uma vez;
- status e progresso permanecem coerentes;
- conflito de rota não é sobrescrito silenciosamente;
- logout impede acesso aos dados locais anteriores;
- falhas transitórias recuperam sem intervenção;
- falhas permanentes são acionáveis e não entram em loop.
