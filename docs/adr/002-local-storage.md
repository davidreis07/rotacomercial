# ADR 002 — Armazenamento local

## Status

Proposto — decisão final depende de protótipo e benchmark.

## Contexto

O app precisa armazenar entidades relacionadas, índices de consulta, outbox e migrations no browser. `localStorage` não oferece capacidade, transações ou consultas adequadas.

## Decisão

Usar IndexedDB como tecnologia base. Avaliar **Dexie** como camada preferencial, mas só adotá-lo após um spike comparar ergonomia, bundle, migrations, transações e testes com IndexedDB direto. A camada de domínio dependerá de interfaces próprias, não da API Dexie.

## Alternativas

### IndexedDB direto

- vantagem: zero dependência e controle total;
- desvantagem: API verbosa, transações/migrations mais suscetíveis a erros e maior código próprio.

### Dexie

- vantagem: transações, índices, migrations e TypeScript mais ergonômicos;
- desvantagem: dependência, abstrações próprias e necessidade de validar compatibilidade/eviction.

### localStorage

Rejeitado para dados de domínio: síncrono, sem transações, índices ou escala adequada.

### SQLite/WASM ou OPFS

Não escolhido inicialmente: maior peso e complexidade; suporte/semântica mobile precisam de forte justificativa. Pode ser reavaliado se volume/consultas excederem IndexedDB.

## Consequências

- haverá schema e migrations locais versionados;
- projeções e outbox poderão ser gravadas atomicamente;
- repositórios escondem a implementação;
- será necessário testar quotas, eviction e Safari/iOS.

## Riscos

- dependência de Dexie sem benefício medido;
- bloqueio de upgrade por abas antigas;
- perda por limpeza/pressão de armazenamento;
- XSS acessando dados;
- migrations locais irrecuperáveis.
