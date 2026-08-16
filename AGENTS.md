# AGENTS.md — RotaComercial

## 1. Visão geral

RotaComercial é uma aplicação web mobile-first para representantes comerciais organizarem sua rotina de campo.

O produto deve ajudar o vendedor a responder rapidamente:

- Quais clientes devo visitar hoje?
- Quando visitei este cliente pela última vez?
- O que aconteceu na última visita?
- Qual necessidade/oportunidade comercial ficou registrada?
- Qual é a melhor sequência de visitas?
- Quais clientes estão pendentes?
- Como organizar minha rota comercial do dia?

O sistema deve evoluir para uma ferramenta de planejamento e execução de rotas comerciais, e não apenas para um CRUD de clientes.

---

## 2. Stack atual

Frontend/backend:

- Next.js 16
- App Router
- React
- TypeScript
- Tailwind CSS

Backend/Banco/Auth:

- Supabase
- PostgreSQL
- Supabase Auth
- Row Level Security (RLS)

Arquitetura atual:

- Server Components para leitura de dados quando apropriado
- Client Components apenas quando há necessidade de interação no navegador
- Supabase client separado para server/client

---

## 3. Estrutura importante

Estrutura aproximada:

src/
  app/
    login/
      page.tsx

    clientes/
      page.tsx

      novo/
        page.tsx

      [id]/
        page.tsx

        visitas/
          nova/
            page.tsx

    planejamento/
      page.tsx

    page.tsx
    layout.tsx
    globals.css

  components/
    logout-button.tsx
    adicionar-planejamento-button.tsx

  lib/
    supabase/
      client.ts
      server.ts

---

## 4. Banco de dados atual

### clientes

Tabela usada para armazenar os clientes pertencentes ao usuário.

Possui, entre outras, informações como:

- id
- user_id
- codigo
- nome
- nome_fantasia
- bairro
- endereco
- numero
- complemento
- telefone
- observacoes
- created_at

A implementação real do banco deve sempre ser inspecionada antes de migrations ou alterações.

### visitas

Estrutura confirmada:

- id: uuid
- user_id: uuid
- cliente_id: uuid
- visitado_em: timestamptz
- resultado: text
- necessidade: text
- observacoes: text
- created_at: timestamptz

Relaciona uma visita a um cliente.

### planejamento

Estrutura inicial:

- id: uuid
- user_id: uuid
- cliente_id: uuid
- data: date
- ordem: integer
- status: text
- observacoes: text
- created_at: timestamptz

Status atualmente previstos:

- planejado
- visitado
- cancelado

Existe restrição para impedir o mesmo cliente de ser planejado duas vezes pelo mesmo usuário na mesma data.

---

## 5. Segurança

RLS é parte obrigatória da arquitetura.

NUNCA desabilitar RLS como solução para problemas.

Cada usuário deve acessar apenas seus próprios dados.

As tabelas utilizam user_id relacionado ao usuário autenticado.

Policies devem utilizar auth.uid() quando apropriado.

Antes de alterar policies:

1. analisar policies existentes;
2. entender o motivo da alteração;
3. evitar políticas permissivas desnecessárias;
4. preservar isolamento entre usuários.

Nunca:

- expor service_role key no frontend;
- enviar secrets para o navegador;
- commitar .env.local;
- colocar chaves privadas no código;
- remover RLS para resolver rapidamente um erro.

---

## 6. Variáveis de ambiente

O projeto utiliza Supabase através de `.env.local`.

O arquivo `.env.local` NÃO deve ser commitado.

Não imprimir secrets em logs ou respostas.

Utilizar somente variáveis NEXT_PUBLIC_* que realmente possam ser públicas no navegador.

---

## 7. Funcionalidades já implementadas

### Autenticação

Status: FUNCIONANDO.

- login via Supabase;
- sessão persistente;
- proteção de páginas;
- logout;
- redirecionamentos básicos.

Não reimplementar autenticação sem necessidade.

### Clientes

Status: FUNCIONANDO.

Implementado:

- listagem;
- cadastro;
- ficha individual;
- navegação `/clientes/[id]`;
- dados protegidos por usuário.

### Visitas

Status: FUNCIONANDO.

Implementado:

- registrar visita;
- resultado;
- necessidade/oportunidade;
- observações;
- data/hora;
- histórico de visitas;
- última visita exibida na ficha;
- visitas ordenadas da mais recente para a mais antiga.

### Planejamento

Status: EM DESENVOLVIMENTO.

Implementado:

- tabela `planejamento`;
- RLS;
- `/planejamento`;
- listagem de clientes;
- adicionar cliente ao planejamento do dia;
- persistência no Supabase.

---

## 8. Sprint atual

Objetivo:

# Minha Rota de Hoje

Transformar `/planejamento` em uma ferramenta operacional para o vendedor.

Fluxo desejado:

Planejamento do dia
        |
        v
Minha rota de hoje
        |
        +-- Cliente 1
        +-- Cliente 2
        +-- Cliente 3
        |
        v
Execução das visitas

A tela deverá evoluir para mostrar duas áreas:

### Minha rota de hoje

Mostrar somente clientes planejados.

Para cada cliente, idealmente mostrar:

- ordem;
- nome;
- código;
- bairro;
- endereço;
- última visita;
- última necessidade/oportunidade;
- status.

Ações previstas:

- abrir cliente;
- remover do planejamento;
- reorganizar ordem;
- registrar visita;
- futuramente iniciar navegação.

### Clientes disponíveis

Clientes que ainda não estão no planejamento.

Ação:

- adicionar à rota.

---

## 9. Roadmap posterior

Depois da Sprint "Minha Rota de Hoje":

### Execução da rota

- marcar atendimento;
- registrar visita a partir da rota;
- atualizar status;
- indicar visitas concluídas;
- mostrar progresso diário.

### Geolocalização

Adicionar coordenadas aos clientes.

Possíveis campos:

- latitude
- longitude

### Mapa

Exibir clientes planejados no mapa.

### Otimização de rota

Gerar sequência eficiente de visitas considerando localização.

Não implementar algoritmo complexo de otimização prematuramente.

Primeiro garantir:

1. dados corretos;
2. planejamento;
3. execução;
4. geolocalização;
5. mapa;
6. otimização.

---

## 10. Regras de desenvolvimento

Antes de modificar código:

1. analisar o código existente;
2. entender o fluxo atual;
3. identificar arquivos afetados;
4. preservar funcionalidades existentes.

Não reescrever arquivos grandes desnecessariamente.

Preferir alterações pequenas e incrementais.

Evitar dependências novas quando uma solução simples com a stack atual for suficiente.

Não inventar APIs ou bibliotecas.

---

## 11. Qualidade

Código deve ser:

- TypeScript tipado;
- legível;
- modular;
- simples;
- seguro;
- mobile-first;
- preparado para manutenção.

Evitar:

- `any` desnecessário;
- duplicação;
- componentes gigantes;
- lógica de negócio espalhada;
- chamadas desnecessárias ao banco;
- estados duplicados;
- dependências desnecessárias.

---

## 12. Validação

Depois de alterações relevantes executar, conforme disponível no projeto:

npm run lint

e:

npm run build

Corrigir erros reais antes de considerar a tarefa concluída.

Não alterar configurações apenas para esconder erros de lint ou TypeScript.

---

## 13. Git

Trabalhar com alterações pequenas e rastreáveis.

Antes de grandes mudanças:

git status

Depois da implementação, revisar:

git diff

Commits devem representar unidades lógicas.

Exemplos:

feat: add daily route planning

feat: add visit history

fix: preserve auth session on logout

refactor: extract route client card

---

## 14. UX

O produto é mobile-first.

O usuário principal estará frequentemente:

- na rua;
- usando celular;
- entre visitas;
- com pouco tempo para interação.

Portanto:

- ações principais devem ser grandes;
- informações essenciais devem aparecer rapidamente;
- evitar telas congestionadas;
- reduzir quantidade de cliques;
- priorizar leitura rápida;
- estados devem ser visualmente claros.

---

## 15. Regra para agentes

Ao receber uma nova tarefa:

1. leia este AGENTS.md;
2. analise os arquivos relacionados;
3. verifique o estado atual;
4. apresente um plano curto;
5. implemente somente o necessário;
6. preserve funcionalidades existentes;
7. valide TypeScript/lint/build;
8. apresente arquivos alterados;
9. informe possíveis riscos;
10. não avance automaticamente para outra sprint.

Se houver diferença entre esta documentação e o código real, o código e o schema real do banco devem ser investigados antes de qualquer decisão destrutiva.