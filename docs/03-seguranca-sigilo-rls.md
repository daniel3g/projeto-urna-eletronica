# 03 — Segurança, Sigilo e RLS

## 1. Modelo de ameaças

O adversário realista deste sistema não é um invasor remoto: é um estudante curioso com o navegador
aberto no terminal da urna, ou alguém com acesso ao painel administrativo depois da eleição.

| # | Ameaça | Defesa |
|---|---|---|
| A1 | Aluno vota duas vezes | `status = 'voted'` verificado no servidor + `unique (election_id, student_id)` |
| A2 | Aluno abre o DevTools na urna e chama a API do Supabase direto | RLS nega tudo para `anon`; urna não possui chave com poder de escrita |
| A3 | Alguém descobre em quem um aluno votou | `votes` sem vínculo com estudante + carimbo de tempo truncado + IDs aleatórios |
| A4 | Dois alunos liberados na mesma urna | Índice parcial `election_voters_one_active_per_ballot_box` |
| A5 | Urna liberada por engano em outra seção | Liberação sempre aponta para um `ballot_box_terminal_id` da mesma seção |
| A6 | Mesário consulta o resultado parcial | Terminal do mesário não tem rota nem permissão de leitura em `votes` |
| A7 | Token de terminal copiado para outra máquina | Token vinculado ao terminal, revogável pelo admin, com `last_seen_at` monitorado |
| A8 | Voto registrado depois do encerramento | Trigger `votes_only_when_open` no banco |
| A9 | Candidato removido depois da votação altera a apuração | `on delete restrict` em `votes` + votos imutáveis |

## 2. Fronteiras de confiança

```text
NAVEGADOR (não confiável)
   │  cookie de admin  |  token de terminal  |  JWT de leitura Realtime
   ▼
ROUTE HANDLERS NEXT.JS (confiável) ── única camada que valida regras
   │  service_role key
   ▼
POSTGRES (confiável) ── constraints e triggers como rede de proteção
```

Toda regra de negócio é verificada **no servidor**, mesmo quando a interface já a impede. O botão
"Liberar" fica desabilitado para quem já votou, e ainda assim o handler recusa a operação: a
interface é conveniência, não segurança.

## 3. Sigilo do voto

O princípio da §24 do documento inicial — saber **se** votou, nunca **em quem** — é implementado em
quatro camadas:

**Esquema.** `votes` não tem coluna que aponte para estudante, eleitor da eleição ou sessão.
Ver [02](02-modelo-de-dados.md), §4.2.

**Tempo.** Este é o vazamento não óbvio. Se `votes.created_at` fosse preciso e
`election_voters.voted_at` também, bastaria ordenar as duas tabelas por horário para reconstruir a
correspondência aluno → voto. Por isso:

- `votes.recorded_hour` é truncado com `date_trunc('hour', now())`;
- `election_voters.voted_at` também é gravado truncado na hora;
- nenhuma view ou endpoint expõe os votos em ordem de inserção.

**Ordem.** A chave primária de `votes` é UUID v4 (aleatório). Qualquer identificador sequencial
recriaria a ordem cronológica que o truncamento eliminou.

**Interface.** Não existe tela — nem administrativa — que liste votos individuais. A apuração
trabalha exclusivamente com agregados vindos das views. Uma consulta ad-hoc por SQL também não
ajudaria: os dados necessários para a correlação não existem.

> Consequência aceita: o sistema não consegue anular o voto de um eleitor específico depois de
> registrado. Isso é inerente ao voto secreto e vale também para a urna real.

## 4. Perfis e permissões

| Perfil | Autenticação | Pode ler | Pode escrever |
|---|---|---|---|
| Administrador | Supabase Auth (e-mail + senha) | Tudo, exceto votos individuais | Todos os cadastros; abrir/encerrar eleição |
| Terminal do mesário | Token de terminal | Dados do eleitor da sua seção | `election_voters.status` → `released` |
| Terminal da urna | Token de terminal | Cargos e candidatos da eleição; estado da própria urna | Insere em `votes`; avança a própria sessão |
| Público | — | Nada | Nada |

O terminal da urna nunca lê `students` — ele não precisa saber quem está votando, apenas que uma
sessão está autorizada. Isso satisfaz RNF06 e reforça o sigilo: nem no console do navegador da urna
existe o nome do eleitor atual.

## 5. Políticas RLS

O RLS é a segunda barreira. Com todas as escritas passando pelo servidor com `service_role`
(que ignora RLS), o papel das políticas é garantir que **um vazamento da chave anônima não vire um
vazamento de dados** — e a chave anônima é pública por definição.

```sql
-- Ativar em todas as tabelas do schema public.
alter table public.profiles        enable row level security;
alter table public.students        enable row level security;
alter table public.elections       enable row level security;
alter table public.positions       enable row level security;
alter table public.candidates      enable row level security;
alter table public.sections        enable row level security;
alter table public.terminals       enable row level security;
alter table public.election_voters enable row level security;
alter table public.votes           enable row level security;
```

Sem nenhuma política criada, o padrão do Postgres é negar tudo para `anon` e `authenticated`.
Esse é exatamente o estado desejado para `votes`, `election_voters`, `students` e `terminals`:
**nenhuma política é criada para essas quatro tabelas**. Só o servidor as acessa.

Para as tabelas de configuração, o administrador logado pode ler direto (útil para Server
Components que renderizam listas com a sessão do usuário):

```sql
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $fn$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and is_active
  );
$fn$;

create policy "admin le eleicoes"  on public.elections
  for select to authenticated using (public.is_admin());

create policy "admin le cargos"    on public.positions
  for select to authenticated using (public.is_admin());

create policy "admin le candidatos" on public.candidates
  for select to authenticated using (public.is_admin());

create policy "admin le secoes"    on public.sections
  for select to authenticated using (public.is_admin());
```

Repare que **nenhuma política de `insert`, `update` ou `delete` é criada para ninguém**. Escrita é
privilégio exclusivo dos Route Handlers. Se um dia uma tela precisar escrever direto, a decisão
passa por revisão deste documento.

`profiles` recebe a única política de leitura própria:

```sql
create policy "usuario le proprio perfil" on public.profiles
  for select to authenticated using (id = auth.uid());
```

### Teste de regressão obrigatório

Antes de cada deploy de produção, roda-se um teste que abre um cliente com a chave `anon` sem sessão
e tenta, em sequência: `select` em `votes`, `select` em `students`, `insert` em `votes`,
`update` em `election_voters`. As quatro operações precisam falhar. O teste vive em
`tests/rls.spec.ts` e é bloqueante no CI.

## 6. Segredos

| Segredo | Onde vive | Exposição |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Variável de ambiente da Vercel | Nunca sai do servidor |
| `SUPABASE_JWT_SECRET` | Variável de ambiente da Vercel | Nunca sai do servidor |
| `TERMINAL_TOKEN_PEPPER` | Variável de ambiente da Vercel | Nunca sai do servidor |
| Token de terminal | `localStorage` do terminal | Vale só para aquele terminal, revogável |
| Senha do admin | Supabase Auth (hash) | — |

Tokens de terminal são gravados no banco como `sha256(token + pepper)`. Um dump do banco não
permite se passar por um terminal.

## 7. Auditoria

Fora do MVP, mas com o formato já definido para não exigir mudança de esquema depois:

```sql
create table public.audit_log (
  id          uuid primary key default gen_random_uuid(),
  election_id uuid,
  actor_type  text not null,   -- 'admin' | 'terminal'
  actor_id    uuid,
  action      text not null,   -- 'election.open', 'voter.release', ...
  target_id   uuid,
  metadata    jsonb,
  created_at  timestamptz not null default now()
);
```

`audit_log` registra ações administrativas e liberações. **Registrar um voto não gera entrada de
auditoria** — seria o vazamento temporal do §3 por outra porta.
