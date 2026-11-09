-- 20260824120100_core_tables
-- Cadastros: perfis, estudantes, eleições, cargos, candidatos, seções, terminais.
-- Ver docs/02-modelo-de-dados.md §3

-- ---------------------------------------------------------------- profiles
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  full_name  text not null,
  role       public.app_role not null default 'operator',
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.profiles is
  'Usuários administrativos. Mesários e urnas NÃO possuem conta: usam token de terminal.';

-- ---------------------------------------------------------------- students
create table if not exists public.students (
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

comment on column public.students.rm is
  'Identificador escolar do aluno. NUNCA é credencial: quem autoriza a votação é o mesário.';
comment on column public.students.photo_path is
  'Caminho no bucket student-photos. Nulo é válido — a foto é opcional (RF09, RNF09).';

create index if not exists students_full_name_trgm
  on public.students using gin (full_name extensions.gin_trgm_ops);

-- ---------------------------------------------------------------- elections
create table if not exists public.elections (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  status      public.election_status not null default 'draft',
  opened_at   timestamptz,
  closed_at   timestamptz,
  created_by  uuid references public.profiles(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint elections_closed_after_open
    check (closed_at is null or opened_at is null or closed_at >= opened_at)
);

-- ---------------------------------------------------------------- positions
create table if not exists public.positions (
  id            uuid primary key default gen_random_uuid(),
  election_id   uuid not null references public.elections(id) on delete cascade,
  name          text not null,
  digits        smallint not null,
  display_order smallint not null,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  constraint positions_digits_range   check (digits between 1 and 5),
  constraint positions_order_positive check (display_order >= 1),
  constraint positions_unique_name    unique (election_id, name),
  constraint positions_election_key   unique (id, election_id),
  -- Deferrable para permitir reordenar cargos em uma única transação
  -- (a troca de posições passa por um estado transitoriamente duplicado).
  constraint positions_unique_order   unique (election_id, display_order)
    deferrable initially deferred
);

comment on constraint positions_election_key on public.positions is
  'Alvo das chaves estrangeiras compostas: garante que candidatos e votos nunca cruzem eleições.';

-- ---------------------------------------------------------------- candidates
create table if not exists public.candidates (
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

comment on column public.candidates.number is
  'Texto, não inteiro: em um cargo de 3 dígitos, 045 e 45 não são o mesmo número.';

-- ---------------------------------------------------------------- sections
create table if not exists public.sections (
  id          uuid primary key default gen_random_uuid(),
  election_id uuid not null references public.elections(id) on delete cascade,
  code        text not null,
  name        text not null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  constraint sections_unique_code  unique (election_id, code),
  constraint sections_election_key unique (id, election_id)
);

-- ---------------------------------------------------------------- terminals
create table if not exists public.terminals (
  id                      uuid primary key default gen_random_uuid(),
  election_id             uuid not null,
  section_id              uuid not null,
  kind                    public.terminal_kind not null,
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

comment on column public.terminals.token_hash is
  'sha256(token + TERMINAL_TOKEN_PEPPER). O token em si nunca é persistido.';

create unique index if not exists terminals_pairing_code_unique
  on public.terminals (pairing_code) where pairing_code is not null;
