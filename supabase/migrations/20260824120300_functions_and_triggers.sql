-- 20260824120300_functions_and_triggers
-- Regras de integridade que constraints declarativas não alcançam.
-- Ver docs/02-modelo-de-dados.md §5

-- ------------------------------------------------------------ updated_at
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $fn$
begin
  new.updated_at := now();
  return new;
end;
$fn$;

drop trigger if exists students_set_updated_at on public.students;
create trigger students_set_updated_at
  before update on public.students
  for each row execute function public.set_updated_at();

drop trigger if exists elections_set_updated_at on public.elections;
create trigger elections_set_updated_at
  before update on public.elections
  for each row execute function public.set_updated_at();

-- ------------------------------------------- número do candidato x dígitos do cargo
create or replace function public.enforce_candidate_number_digits()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $fn$
declare
  required smallint;
begin
  select digits into required from public.positions where id = new.position_id;

  if required is null then
    return new;  -- a FK composta já recusará a linha
  end if;

  if length(new.number) <> required then
    raise exception 'O numero % nao possui os % digitos exigidos pelo cargo',
      new.number, required
      using errcode = 'check_violation';
  end if;

  return new;
end;
$fn$;

drop trigger if exists candidates_number_digits on public.candidates;
create trigger candidates_number_digits
  before insert or update of number, position_id on public.candidates
  for each row execute function public.enforce_candidate_number_digits();

-- ------------------------------------------------ voto só com eleição aberta
create or replace function public.enforce_election_open()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $fn$
begin
  if (select status from public.elections where id = new.election_id) is distinct from 'open' then
    raise exception 'A eleicao nao esta aberta para votacao'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$fn$;

drop trigger if exists votes_only_when_open on public.votes;
create trigger votes_only_when_open
  before insert on public.votes
  for each row execute function public.enforce_election_open();

-- ------------------------------------------------------- votos são imutáveis
create or replace function public.forbid_vote_mutation()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $fn$
begin
  raise exception 'Votos nao podem ser alterados nem removidos'
    using errcode = 'check_violation';
end;
$fn$;

drop trigger if exists votes_immutable on public.votes;
create trigger votes_immutable
  before update or delete on public.votes
  for each row execute function public.forbid_vote_mutation();

-- -------------------------------- cadastros estruturais congelados após a abertura
create or replace function public.forbid_config_change_after_open()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $fn$
declare
  eid uuid;
  st  public.election_status;
begin
  if tg_op = 'DELETE' then
    eid := old.election_id;
  else
    eid := new.election_id;
  end if;

  select status into st from public.elections where id = eid;

  -- Eleição inexistente significa que este DELETE é o cascade de uma eleição já
  -- removida. Bloquear aqui impediria apagar até um rascunho.
  if st is null then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;

  if st is distinct from 'draft' then
    raise exception 'A eleicao ja foi aberta; cargos e candidatos estao bloqueados'
      using errcode = 'check_violation';
  end if;

  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$fn$;

drop trigger if exists positions_frozen_after_open on public.positions;
create trigger positions_frozen_after_open
  before insert or update or delete on public.positions
  for each row execute function public.forbid_config_change_after_open();

drop trigger if exists candidates_frozen_after_open on public.candidates;
create trigger candidates_frozen_after_open
  before insert or update or delete on public.candidates
  for each row execute function public.forbid_config_change_after_open();

-- --------------------------------------------- eleitores travados após encerrar
-- Diferente de cargos e candidatos: com a eleição ABERTA um aluno atrasado ainda
-- pode ser incluído. O bloqueio vale apenas depois do encerramento.
create or replace function public.forbid_voter_change_after_close()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $fn$
declare
  eid uuid;
  st  public.election_status;
begin
  if tg_op = 'DELETE' then
    eid := old.election_id;
  else
    eid := new.election_id;
  end if;

  select status into st from public.elections where id = eid;

  if st is null then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;

  if st = 'closed' then
    raise exception 'A eleicao esta encerrada; os eleitores nao podem mais ser alterados'
      using errcode = 'check_violation';
  end if;

  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$fn$;

drop trigger if exists election_voters_frozen_after_close on public.election_voters;
create trigger election_voters_frozen_after_close
  before insert or update or delete on public.election_voters
  for each row execute function public.forbid_voter_change_after_close();
