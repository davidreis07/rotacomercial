# CLAUDE.md — RotaComercial

Leia primeiro `AGENTS.md`.

Ele contém:

- contexto do produto;
- arquitetura;
- banco;
- funcionalidades implementadas;
- regras de segurança;
- sprint atual;
- roadmap.

## Comportamento esperado

Você está trabalhando em um produto existente.

Não trate este repositório como projeto novo.

Antes de escrever código:

1. examine a estrutura do projeto;
2. leia package.json;
3. leia os arquivos relacionados à tarefa;
4. identifique padrões já utilizados;
5. examine integrações com Supabase;
6. preserve comportamento existente.

Não faça grandes refactors sem necessidade.

## Stack

Preservar a stack existente:

- Next.js 16
- App Router
- TypeScript
- React
- Tailwind CSS
- Supabase
- PostgreSQL
- Supabase Auth
- RLS

Não substituir tecnologias sem autorização.

## Supabase

Segurança é obrigatória.

Nunca resolver erros de banco desabilitando RLS.

Nunca expor service_role no frontend.

Nunca colocar secrets no código.

Não alterar schema sem explicar:

- problema;
- migration necessária;
- impacto;
- rollback quando relevante.

## UI

Mobile-first.

A interface deve funcionar muito bem em smartphone.

Priorizar:

- clareza;
- velocidade;
- ações grandes;
- poucos cliques;
- hierarquia visual;
- feedback de loading;
- feedback de erro;
- empty states.

## Sprint atual

A próxima evolução é:

"Minha Rota de Hoje"

A rota `/planejamento` já existe.

Já existe persistência de clientes planejados no Supabase.

A evolução deve separar:

1. clientes planejados hoje;
2. clientes disponíveis.

Clientes planejados devem mostrar informações úteis para execução da rota.

Não implementar mapa ou otimização geográfica nesta sprint.

## Processo

Antes da implementação, responda com:

### Diagnóstico
O que existe atualmente.

### Plano
Arquivos que pretende alterar e por quê.

Depois implemente.

Após implementar:

- execute lint;
- execute build;
- revise erros;
- revise git diff.

Finalize informando:

### Implementado

### Arquivos alterados

### Validação

### Próximo passo sugerido

Não iniciar o próximo passo sem autorização.
