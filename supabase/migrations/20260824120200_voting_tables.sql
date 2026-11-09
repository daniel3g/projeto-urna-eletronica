-- 20260824120200_voting_tables
-- Participação do eleitor e votos.
-- Ver docs/02-modelo-de-dados.md §4 e docs/03-seguranca-sigilo-rls.md §3

-- ---------------------------------------------------------- election_voters
create table if not exists public.election_voters (
  id                      uuid primary key default gen_random_uuid(),
  election_id             uuid not null references public.elections(id) on delete cascade,
  student_id              uuid not null references public.students(id) on delete restrict,
  section_id              uuid,
  status                  public.voter_status not null default 'waiting',
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
  constraint election_voters_completed_positive check (positions_completed >= 0),
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

comment on column public.election_voters.positions_completed is
  'Quantos cargos o eleitor já confirmou. Conta QUANTOS, nunca O QUE. '
  'É também o controle de idempotência do endpoint de voto.';

-- Uma urna nunca tem dois eleitores ativos ao mesmo tempo (docs/03 §1, ameaça A4).
create unique index if not exists election_voters_one_active_per_ballot_box
  on public.election_voters (ballot_box_terminal_id)
  where status in ('released', 'voting');

create index if not exists election_voters_lookup
  on public.election_voters (election_id, student_id);

create index if not exists election_voters_by_section
  on public.election_voters (election_id, section_id, status);

-- ------------------------------------------------------------------- votes
--
-- SIGILO DO VOTO — quatro decisões desta tabela não podem ser revertidas:
--   1. Não há coluna apontando para estudante, eleitor ou sessão. Nenhuma.
--   2. A PK é UUID v4 aleatório: bigserial ou UUID v7 revelariam a ordem de inserção.
--   3. recorded_hour é truncado na hora: um timestamp preciso, cruzado com
--      election_voters.voted_at, identificaria o voto de cada aluno com um JOIN trivial.
--   4. on delete restrict: apagar um candidato não pode apagar votos.
-- Ver docs/03-seguranca-sigilo-rls.md §3.
--
create table if not exists public.votes (
  id            uuid primary key default gen_random_uuid(),
  election_id   uuid not null,
  position_id   uuid not null,
  candidate_id  uuid,
  vote_type     public.vote_type not null,
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

comment on table public.votes is
  'Voto anônimo. NUNCA adicionar coluna que permita chegar ao estudante — '
  'nem student_id, nem election_voter_id, nem session_id, nem "apenas para auditoria".';
comment on column public.votes.recorded_hour is
  'Truncado na hora de propósito. Precisão maior reabre a correlação com voted_at.';

create index if not exists votes_apuracao
  on public.votes (election_id, position_id, vote_type, candidate_id);
