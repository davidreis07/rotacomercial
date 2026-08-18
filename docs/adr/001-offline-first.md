# ADR 001 — Arquitetura offline-first

## Status

Proposto — aguardando validação antes da implementação.

## Contexto

Representantes trabalham em campo com rede instável. Hoje, leituras e escritas dependem diretamente de Next.js/Supabase; estado em memória é perdido em reload e não existe fila.

## Decisão

Adotar local-first moderado: após bootstrap autenticado, telas operacionais leem do banco local e mutações são persistidas localmente com outbox na mesma transação. Supabase/PostgreSQL permanece a fonte autoritativa compartilhada e RLS permanece obrigatória.

## Alternativas

1. **Online-first com cache de queries:** menor esforço, mas não garante escrita/reload offline.
2. **Somente PWA/app shell:** instala e abre a UI, mas não disponibiliza dados nem mutações.
3. **Local-first completo com CRDT:** poderoso, porém complexidade desproporcional ao domínio atual.
4. **Aplicativo nativo:** maior controle do dispositivo, mas reescrita e nova stack não justificadas agora.

## Consequências

- UI precisa ser desacoplada do Supabase.
- IDs, versões, tombstones e idempotência tornam-se requisitos.
- Estados pendente/conflito precisam fazer parte da UX.
- Desenvolvimento fica mais complexo, mas operação de campo torna-se resiliente.

## Riscos

- inconsistência entre dispositivos;
- dados sensíveis persistidos no browser;
- migrations locais defeituosas;
- promessa offline maior que o cache realmente disponível;
- esforço subestimado de conflito e observabilidade.
