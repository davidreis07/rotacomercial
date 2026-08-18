# ADR 003 — Estratégia de sincronização

## Status

Proposto — requer pré-requisitos de schema autorizados.

## Contexto

Mutações offline precisam sobreviver a reload, retry e múltiplos dispositivos. O modelo atual não confirma versões, tombstones nem idempotency keys.

## Decisão

Adotar outbox local transacional, push idempotente e pull incremental por cursor servidor. Usar UUID criado no cliente. Conflitos são detectados por versão do servidor; last-write-wins por relógio do dispositivo é proibido.

## Alternativas

1. **Repetir chamadas Supabase quando online:** perde intenção em reload e duplica creates após timeout.
2. **Supabase Realtime como sync:** útil como sinal, mas não garante replay completo nem operação offline.
3. **Last-write-wins:** simples, porém perde alterações silenciosamente e relógios não são confiáveis.
4. **CRDT/event sourcing completo:** capacidade superior, complexidade excessiva para o estágio atual.

## Consequências

- comandos compostos exigem endpoint/RPC atômico;
- servidor precisa de versão, cursor, tombstone e idempotência durável;
- UI expõe pendências/conflitos;
- testes de rede instável tornam-se gate de release.

## Riscos

- cursor com lacunas;
- retry não idempotente;
- outbox presa;
- conflitos frequentes de rota;
- retenção insuficiente de tombstones;
- migrations servidor/local incompatíveis.
