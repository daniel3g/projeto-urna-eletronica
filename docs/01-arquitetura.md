# 01 — Arquitetura

## 1. Visão geral

```text
┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐
│  NAVEGADOR       │   │  NAVEGADOR       │   │  NAVEGADOR       │
│  /admin          │   │  /mesario        │   │  /urna           │
│  (login Supabase)│   │  (token terminal)│   │  (token terminal)│
└────────┬─────────┘   └────────┬─────────┘   └────────┬─────────┘
         │  HTTPS                │                      │  Realtime (leitura)
         ▼                       ▼                      ▼
┌─────────────────────────────────────────────────────────────────┐
│               APLICAÇÃO NEXT.JS (Vercel)                        │
│   React Server Components  ·  Route Handlers  ·  Server Actions │
│   Toda regra de negócio e toda escrita passam por aqui          │
└────────────────────────────┬────────────────────────────────────┘
                             │ service role key (somente servidor)
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                          SUPABASE                               │
│  PostgreSQL  ·  Auth (admins)  ·  Storage  ·  Realtime          │
└─────────────────────────────────────────────────────────────────┘
```

O navegador nunca recebe a `service_role key`. Terminais só falam com o Supabase diretamente para
**ouvir** eventos de tempo real; qualquer leitura de dado ou escrita passa pela aplicação Next.js.

## 2. Camadas

| Camada | Responsabilidade | Onde vive |
|---|---|---|
| Apresentação | Telas do admin, do mesário e da urna | `app/(admin)`, `app/(mesario)`, `app/(urna)` |
| Aplicação | Casos de uso: liberar eleitor, registrar voto, apurar | `lib/services/*` |
| Acesso a dados | Consultas tipadas ao Postgres | `lib/db/*` (cliente `service_role`) |
| Domínio | Regras puras: validação de número, avanço de cargo | `lib/domain/*` (sem I/O, testável isoladamente) |
| Infra | Supabase, Storage, Realtime, tokens | `lib/supabase/*`, `lib/auth/*` |

A camada de domínio não importa nada de Supabase ou Next.js. É nela que ficam as regras testáveis
sem banco: "número com N dígitos", "cargo seguinte", "voto nulo quando não há candidato".

## 3. Estrutura de pastas prevista

```text
app/
  (admin)/admin/
    elections/[id]/{positions,candidates,voters,sections,terminals,results}/
    students/
    login/
  (mesario)/mesario/
    page.tsx                  # busca por RM e liberação
    pair/page.tsx             # pareamento do terminal
  (urna)/urna/
    page.tsx                  # espera → votação → fim
    pair/page.tsx
  api/
    terminals/pair/route.ts
    poll-worker/{lookup,release,cancel}/route.ts
    ballot-box/{state,start,vote,finish}/route.ts
    admin/**/route.ts
lib/
  domain/       # regras puras
  services/     # casos de uso
  db/           # queries
  supabase/     # clientes (server, browser, realtime)
  auth/         # sessão de admin e token de terminal
supabase/
  migrations/   # SQL versionado
  seed.sql      # dados de demonstração
docs/
```

## 4. Clientes Supabase

Três clientes distintos, nunca intercambiáveis:

| Cliente | Chave | Uso | RLS |
|---|---|---|---|
| `createServiceClient()` | `SUPABASE_SERVICE_ROLE_KEY` | Route Handlers e Server Actions | ignora RLS |
| `createServerClient()` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` + cookie | Sessão do admin no servidor | aplica RLS |
| `createRealtimeClient()` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` + JWT de terminal | Escuta no navegador da urna | aplica RLS |

Regra de lint a ser configurada: nenhum arquivo sob `app/**/page.tsx` marcado como `"use client"`
pode importar de `lib/db/*`.

## 5. Variáveis de ambiente

```bash
NEXT_PUBLIC_SUPABASE_URL=            # pública
NEXT_PUBLIC_SUPABASE_ANON_KEY=       # pública
SUPABASE_SERVICE_ROLE_KEY=           # SEGREDO — apenas servidor
SUPABASE_JWT_SECRET=                 # SEGREDO — assina JWT dos terminais
TERMINAL_TOKEN_PEPPER=               # SEGREDO — hash dos tokens de terminal
SUPABASE_DB_URL=                     # SEGREDO — opcional; conexão direta para scripts SQL
```

Nenhuma variável sem o prefixo `NEXT_PUBLIC_` pode ser referenciada em componente cliente.

Cada ambiente carrega as chaves do **seu** projeto Supabase: `.env.local` aponta para `urna-dev`, e
as variáveis de Preview e Production na Vercel apontam para `urna-dev` e `urna-prod`
respectivamente. Apontar o deploy de produção para o projeto de desenvolvimento é o erro mais fácil
de cometer e o mais caro no dia da eleição — a tela de apuração exibe o nome do projeto Supabase em
uso, como verificação visual.

## 6. Ambientes — Supabase Cloud

O projeto **não usa Supabase local**. Não há `supabase start`, nem Docker, nem banco na máquina do
desenvolvedor: todo o desenvolvimento aponta para projetos hospedados na nuvem, e o esquema é
aplicado pela CLI do Supabase (§7).

| Ambiente | Projeto Supabase (cloud) | Aplicação | Uso |
|---|---|---|---|
| Desenvolvimento / Homologação | `urna-dev` | `next dev` + Preview da Vercel | Codificação diária e ensaio geral |
| Produção | `urna-prod` | Produção da Vercel | Dia da eleição |

**Dois projetos, não um.** O ensaio geral gera votos de teste, e voto de teste no mesmo banco da
eleição real contamina a apuração de forma irreversível — `votes` é imutável por trigger
([02](02-modelo-de-dados.md) §5). O plano Free permite 2 projetos ativos por organização, exatamente
o necessário; confirme o limite vigente antes de criar.

> Se houver apenas um projeto, a regra mínima é nunca ensaiar dentro da eleição real: crie uma
> eleição "Ensaio" separada e encerre-a. O banco impede apagá-la enquanto houver votos
> (`on delete restrict`), então ela permanece no histórico — basta ignorá-la na apuração.

### Pausa automática do plano Free

Projetos Free são pausados após um período sem uso. Um `urna-prod` pausado no dia da eleição
significa nenhuma votação. Reative e valide o projeto de produção alguns dias antes e novamente na
véspera; entre o cadastro e o dia da eleição costuma haver justamente uma ou duas semanas de
inatividade.

## 7. Migrations com a CLI do Supabase

```bash
# uma vez por máquina
npm i -D supabase
npx supabase login

# uma vez por clone do repositório (pede a senha do banco)
npx supabase link --project-ref <ref-do-urna-dev>

# a cada mudança de esquema
npx supabase migration new create_votes_table   # gera supabase/migrations/<timestamp>_*.sql
#   … edita o arquivo SQL …
npx supabase db push                            # aplica no projeto vinculado

# tipos TypeScript gerados a partir do esquema real
npx supabase gen types typescript --linked > lib/db/types.ts
```

Regras de trabalho:

- **Migrations são forward-only.** Migration já aplicada não se edita; corrige-se com uma nova. Como
  `urna-dev` é compartilhado e remoto, editar o passado quebra o histórico de quem já aplicou.
- **Nada é criado pelo editor SQL do painel.** Alteração feita pelo painel não existe no repositório
  e reaparece como divergência no próximo push. Se acontecer, `npx supabase db pull` gera a migration
  correspondente antes de qualquer novo `db push`.
- **Produção recebe as mesmas migrations, na mesma ordem.** Trocar o vínculo para `urna-prod`
  (`supabase link --project-ref <ref-do-urna-prod>`) e rodar `db push`. Nunca um SQL manual diferente
  em produção.
- **Confira o vínculo antes de qualquer comando destrutivo.** `npx supabase projects list` mostra qual
  projeto está vinculado. `supabase db reset --linked` **apaga e recria o banco remoto** — vale só
  para `urna-dev`, jamais com `urna-prod` vinculado.

### Seed

Sem banco local, o seed não roda automaticamente em nenhum comando. Aplique-o **pelo SQL Editor do
painel do Supabase**: abra `supabase/seed.sql`, cole o conteúdo e execute — com o projeto `urna-dev`
selecionado.

`supabase/seed.sql` é idempotente (`on conflict do nothing`) e roda dentro de uma transação, então
pode ser reaplicado sem duplicar dados nem deixar estado pela metade.

> Não usamos `psql` porque ele não está instalado nesta máquina — a CLI do Supabase não o traz junto.
> Se você instalar o PostgreSQL client depois, `psql "$SUPABASE_DB_URL" -f supabase/seed.sql` passa a
> ser a alternativa direta.

### `.gitignore`

```gitignore
.env*.local
supabase/.temp/
supabase/.branches/
```

## 8. Contingência no dia da eleição

O sistema depende de internet para alcançar o Supabase (RNF03). Medidas previstas:

- a urna mantém a tela de votação funcional durante quedas curtas e só falha na confirmação,
  exibindo "tentando novamente" em vez de perder o voto (ver [05](05-fluxos.md), §5);
- cada voto confirmado é gravado individualmente, então uma queda no meio da sessão preserva os
  cargos já votados e a urna retoma exatamente no cargo seguinte;
- lista impressa de eleitores por seção como plano B de identificação, caso o terminal do mesário caia.
