# 02 — Modelo de Dados

Todo o DDL abaixo é versionado em `supabase/migrations/`. As políticas RLS ficam em
[03 — Segurança, Sigilo e RLS](03-seguranca-sigilo-rls.md).

## 1. Diagrama de relacionamentos

```text
profiles (admins)
    │ created_by
    ▼
ELECTIONS ──┬── POSITIONS ──── CANDIDATES
            │
            ├── SECTIONS ───── TERMINALS
            │                     ▲
            ├── ELECTION_VOTERS ──┘  (urna liberada / terminal que liberou)
            │        │
            │        └── STUDENTS
            │
            └── VOTES ──┬── POSITIONS
                        └── CANDIDATES (nulo em branco/nulo)

        ╳ NÃO EXISTE  VOTES ──── STUDENTS
        ╳ NÃO EXISTE  VOTES ──── ELECTION_VOTERS
```

`students` é a única entidade que vive fora da eleição: o mesmo aluno participa de várias eleições
através de `election_voters`.

## 2. Tipos enumerados

```sql
create type election_status as enum ('draft', 'open', 'closed');
create type voter_status    as enum ('waiting', 'released', 'voting', 'voted');
create type vote_type       as enum ('candidate', 'blank', 'null');
create type terminal_kind   as enum ('poll_worker', 'ballot_box');
create type app_role        as enum ('admin', 'operator');
```

Mapeamento para a interface em português: `draft/open/closed` → Rascunho/Aberta/Encerrada;
`waiting/released/voting/voted` → Aguardando/Liberado/Votando/Votou;
`candidate/blank/null` → Candidato/Branco/Nulo.

## 3. Tabelas de cadastro

### 3.1 `profiles` — usuários administrativos

```sql
create table public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  full_name  text not null,
  role       app_role not null default 'operator',
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);
```

Somente administradores possuem conta. Mesários e urnas usam token de terminal
(ver [04](04-terminais-e-realtime.md)).

### 3.2 `students` — estudantes

```sql
create table public.students (
  id         uuid primary key default gen_random_uuid(),
  rm         text not null,
  full_name  text not null,
  class_name text,
  photo_path text,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint students_rm_unique unique (rm),
  constraint students_rm_format check (rm ~ '^[0-9A-Za-z._-]{1,20}$')
);

-- requer: create extension if not exists pg_trgm;
create index students_full_name_trgm on public.students
  using gin (full_name gin_trgm_ops);
```

- `rm` é **identificador escolar, nunca senha** (RF08). Conhecer o RM de outro aluno não permite
  votar por ele: quem libera é o mesário, presencialmente.
- `photo_path` é o caminho no bucket `student-photos`, não uma URL. Nulo é válido (RF09, RNF09).
- O índice trigram existe para o mesário localizar por nome quando o aluno não souber o RM.

### 3.3 `elections` — eleições

```sql
create table public.elections (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  status      election_status not null default 'draft',
  opened_at   timestamptz,
  closed_at   timestamptz,
  created_by  uuid references public.profiles(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint elections_closed_after_open
    check (closed_at is null or opened_at is null or closed_at >= opened_at)
);
```

### 3.4 `positions` — cargos

```sql
create table public.positions (
  id            uuid primary key default gen_random_uuid(),
  election_id   uuid not null references public.elections(id) on delete cascade,
  name          text not null,
  digits        smallint not null,
  display_order smallint not null,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  constraint positions_digits_range   check (digits between 1 and 5),
  constraint positions_order_positive check (display_order >= 1),
  constraint positions_unique_order   unique (election_id, display_order),
  constraint positions_unique_name    unique (election_id, name),
  constraint positions_election_key   unique (id, election_id)
);
```

`positions_election_key` parece redundante, mas é o que permite as chaves estrangeiras compostas
das tabelas seguintes — é assim que o banco garante que um candidato jamais pertença a um cargo
de outra eleição.

### 3.5 `candidates` — candidatos

```sql
create table public.candidates (
  id                uuid primary key default gen_random_uuid(),
  election_id       uuid not null,
  position_id       uuid not null,
  number            text not null,
  full_name         text not null,
  ballot_name       text,
  party_name        text,
  party_acronym     text,
  photo_path        text,
  deputy_name       text,
  deputy_photo_path text,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  constraint candidates_number_digits check (number ~ '^[0-9]+$'),
  constraint candidates_unique_number unique (position_id, number),
  constraint candidates_election_key  unique (id, election_id),
  constraint candidates_position_fk
    foreign key (position_id, election_id)
    references public.positions(id, election_id) on delete cascade
);
```

- `number` é **texto**, não inteiro: o cargo "Senador" com 3 dígitos aceita `045`, e `45` não é o
  mesmo número na urna.
- `ballot_name` é o nome de urna (o que aparece em destaque); `full_name` é o nome civil.
- A quantidade de dígitos precisa bater com o cargo, o que uma constraint simples não alcança:

```sql
create or replace function public.enforce_candidate_number_digits()
returns trigger language plpgsql as $fn$
declare required smallint;
begin
  select digits into required from public.positions where id = new.position_id;
  if length(new.number) <> required then
    raise exception 'Numero % nao possui os % digitos exigidos pelo cargo', new.number, required;
  end if;
  return new;
end $fn$;

create trigger candidates_number_digits
  before insert or update on public.candidates
  for each row execute function public.enforce_candidate_number_digits();
```

Alterar `positions.digits` depois de cadastrar candidatos invalidaria os números existentes; a
aplicação bloqueia essa edição quando já houver candidato no cargo.

### 3.6 `sections` — seções eleitorais

```sql
create table public.sections (
  id          uuid primary key default gen_random_uuid(),
  election_id uuid not null references public.elections(id) on delete cascade,
  code        text not null,
  name        text not null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  constraint sections_unique_code  unique (election_id, code),
  constraint sections_election_key unique (id, election_id)
);
```

### 3.7 `terminals` — terminais

```sql
create table public.terminals (
  id                      uuid primary key default gen_random_uuid(),
  election_id             uuid not null,
  section_id              uuid not null,
  kind                    terminal_kind not null,
  label                   text not null,
  token_hash              text,
  pairing_code            text,
  pairing_code_expires_at timestamptz,
  paired_at               timestamptz,
  last_seen_at            timestamptz,
  is_active               boolean not null default true,
  created_at              timestamptz not null default now(),
  constraint terminals_unique_label unique (election_id, label),
  constraint terminals_election_key unique (id, election_id),
  constraint terminals_section_fk
    foreign key (section_id, election_id)
    references public.sections(id, election_id) on delete cascade
);

create unique index terminals_pairing_code_unique
  on public.terminals (pairing_code) where pairing_code is not null;
```

`token_hash` guarda o hash do token de pareamento, nunca o token.
Ver [04 — Terminais e Tempo Real](04-terminais-e-realtime.md).

## 4. Participação e votação

### 4.1 `election_voters` — participação do estudante na eleição

```sql
create table public.election_voters (
  id                      uuid primary key default gen_random_uuid(),
  election_id             uuid not null references public.elections(id) on delete cascade,
  student_id              uuid not null references public.students(id) on delete restrict,
  section_id              uuid,
  status                  voter_status not null default 'waiting',
  ballot_box_terminal_id  uuid,
  released_by_terminal_id uuid,
  released_at             timestamptz,
  voting_started_at       timestamptz,
  voted_at                timestamptz,
  positions_completed     smallint not null default 0,
  session_token_hash      text,
  session_expires_at      timestamptz,
  created_at              timestamptz not null default now(),
  constraint election_voters_unique unique (election_id, student_id),
  constraint election_voters_section_fk
    foreign key (section_id, election_id)
    references public.sections(id, election_id),
  constraint election_voters_ballot_box_fk
    foreign key (ballot_box_terminal_id, election_id)
    references public.terminals(id, election_id),
  constraint election_voters_released_by_fk
    foreign key (released_by_terminal_id, election_id)
    references public.terminals(id, election_id),
  constraint election_voters_voted_consistency
    check ((status = 'voted') = (voted_at is not null))
);

-- Uma urna nunca tem dois eleitores ativos ao mesmo tempo.
create unique index election_voters_one_active_per_ballot_box
  on public.election_voters (ballot_box_terminal_id)
  where status in ('released', 'voting');

create index election_voters_lookup
  on public.election_voters (election_id, student_id);
```

O índice parcial `election_voters_one_active_per_ballot_box` é a defesa estrutural contra o pior
erro operacional possível: dois alunos liberados para a mesma urna. O banco recusa a segunda
liberação mesmo que dois mesários cliquem no mesmo instante.

`positions_completed` é o ponteiro de progresso da sessão. Ele conta *quantos* cargos o eleitor já
confirmou — nunca *o que* foi confirmado.

### 4.2 `votes` — votos

```sql
create table public.votes (
  id            uuid primary key default gen_random_uuid(),   -- UUID v4, aleatório
  election_id   uuid not null,
  position_id   uuid not null,
  candidate_id  uuid,
  vote_type     vote_type not null,
  recorded_hour timestamptz not null default date_trunc('hour', now()),
  constraint votes_candidate_consistency
    check ((vote_type = 'candidate') = (candidate_id is not null)),
  constraint votes_position_fk
    foreign key (position_id, election_id)
    references public.positions(id, election_id) on delete restrict,
  constraint votes_candidate_fk
    foreign key (candidate_id, election_id)
    references public.candidates(id, election_id) on delete restrict
);

create index votes_apuracao on public.votes (election_id, position_id, vote_type, candidate_id);
```

Quatro decisões desta tabela existem exclusivamente para o sigilo (RF28, RNF08) e **não podem ser
alteradas por conveniência**:

1. **Não há coluna de estudante nem de sessão.** Nenhuma, nem "só para auditoria".
2. **A chave primária é UUID aleatório.** Um `bigserial` — ou um UUID v7 — ordenaria os votos por
   inserção e revelaria a sequência dos eleitores na urna.
3. **`recorded_hour` é truncado na hora.** Um `timestamptz` preciso, cruzado com
   `election_voters.voted_at`, identificaria o voto de cada aluno com um `JOIN` trivial.
4. **`on delete restrict`** nas chaves para cargo e candidato: apagar um candidato não pode apagar
   votos nem alterar a apuração.

O mesmo cuidado se aplica a `election_voters.voted_at`, também gravado truncado na hora
(ver [03](03-seguranca-sigilo-rls.md), §3).

## 5. Gatilhos de integridade de negócio

```sql
-- Voto só entra com eleição aberta.
create or replace function public.enforce_election_open()
returns trigger language plpgsql as $fn$
begin
  if (select status from public.elections where id = new.election_id) <> 'open' then
    raise exception 'A eleicao nao esta aberta para votacao';
  end if;
  return new;
end $fn$;

create trigger votes_only_when_open
  before insert on public.votes
  for each row execute function public.enforce_election_open();

-- Votos são imutáveis.
create or replace function public.forbid_vote_mutation()
returns trigger language plpgsql as $fn$
begin
  raise exception 'Votos nao podem ser alterados nem removidos';
end $fn$;

create trigger votes_immutable
  before update or delete on public.votes
  for each row execute function public.forbid_vote_mutation();

-- Cadastros estruturais são congelados a partir da abertura.
create or replace function public.forbid_config_change_after_open()
returns trigger language plpgsql as $fn$
declare eid uuid := coalesce(new.election_id, old.election_id);
begin
  if (select status from public.elections where id = eid) <> 'draft' then
    raise exception 'A eleicao ja foi aberta; cadastros estruturais estao bloqueados';
  end if;
  return coalesce(new, old);
end $fn$;

create trigger positions_frozen_after_open
  before insert or update or delete on public.positions
  for each row execute function public.forbid_config_change_after_open();
```

O gatilho de congelamento vale para `positions` e `candidates`. `election_voters` continua editável
com a eleição aberta — um aluno pode chegar atrasado e precisar ser incluído —, mas nunca depois de
encerrada.

## 6. Views de apuração

```sql
create view public.v_results_by_candidate as
select
  v.election_id,
  p.id   as position_id,
  p.name as position_name,
  p.display_order,
  c.id   as candidate_id,
  c.number,
  coalesce(c.ballot_name, c.full_name) as candidate_name,
  c.party_name,
  count(*) as votes
from public.votes v
join public.positions  p on p.id = v.position_id
join public.candidates c on c.id = v.candidate_id
where v.vote_type = 'candidate'
group by v.election_id, p.id, p.name, p.display_order, c.id, c.number,
         c.ballot_name, c.full_name, c.party_name;

create view public.v_results_totals as
select
  v.election_id,
  v.position_id,
  count(*)                                          as total_votes,
  count(*) filter (where v.vote_type = 'candidate') as valid_votes,
  count(*) filter (where v.vote_type = 'blank')     as blank_votes,
  count(*) filter (where v.vote_type = 'null')      as null_votes
from public.votes v
group by v.election_id, v.position_id;

create view public.v_turnout as
select
  ev.election_id,
  count(*)                                     as eligible,
  count(*) filter (where ev.status = 'voted')  as voted,
  count(*) filter (where ev.status <> 'voted') as absent,
  round(100.0 * count(*) filter (where ev.status = 'voted')
        / nullif(count(*), 0), 2)              as turnout_pct
from public.election_voters ev
group by ev.election_id;
```

`v_turnout` conta pessoas; `v_results_totals` conta votos. Os dois números não precisam coincidir:
uma sessão interrompida deixa o eleitor sem status `voted` mas com votos já registrados nos cargos
que ele confirmou. A tela de apuração exibe as duas grandezas separadamente, com nota de rodapé.

## 7. Convenções

- Chaves primárias: `uuid` com `gen_random_uuid()`.
- Datas: sempre `timestamptz`, gravadas em UTC e exibidas em `America/Sao_Paulo`.
- Nomes de tabela e coluna em inglês, `snake_case`; textos de interface em português.
- Toda alteração de esquema é uma migration nova em `supabase/migrations/`, criada com
  `supabase migration new` e aplicada com `supabase db push` no projeto cloud vinculado. Migrations
  são forward-only e nada é editado manualmente pelo editor SQL do painel — ver
  [01](01-arquitetura.md) §7.
