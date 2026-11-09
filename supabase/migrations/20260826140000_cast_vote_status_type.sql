-- 20260826140000_cast_vote_status_type
-- Corrige o erro 42804 em cast_vote:
--   column "status" is of type voter_status but expression is of type text
--
-- A causa: no UPDATE, `case when ... then 'voted' else 'voting' end` resolve
-- para `text`. Dentro de um CASE os literais não herdam o tipo da coluna de
-- destino — diferente de uma atribuição simples em PL/pgSQL, que faz o cast
-- sozinha. Por isso `v_type := 'null'` funciona e este CASE não funcionava.
--
-- Correção: cast explícito nos dois ramos.

create or replace function public.cast_vote(
  p_terminal_id     uuid,
  p_position_id     uuid,
  p_position_order  smallint,
  p_vote_type       public.vote_type,
  p_candidate_number text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_voter        public.election_voters%rowtype;
  v_position     public.positions%rowtype;
  v_candidate_id uuid;
  v_type         public.vote_type;
  v_total        integer;
  v_next         integer;
begin
  select * into v_voter
  from public.election_voters
  where ballot_box_terminal_id = p_terminal_id
    and status in ('released', 'voting')
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'no_session');
  end if;

  if (select status from public.elections where id = v_voter.election_id) <> 'open' then
    return jsonb_build_object('ok', false, 'code', 'election_not_open');
  end if;

  if p_position_order <= v_voter.positions_completed then
    return jsonb_build_object(
      'ok', true, 'recorded', false, 'reason', 'already_recorded',
      'positions_completed', v_voter.positions_completed,
      'finished', v_voter.status = 'voted'
    );
  end if;

  if p_position_order <> v_voter.positions_completed + 1 then
    return jsonb_build_object('ok', false, 'code', 'position_out_of_order');
  end if;

  select * into v_position
  from public.positions
  where id = p_position_id
    and election_id = v_voter.election_id
    and is_active;

  if not found or v_position.display_order <> p_position_order then
    return jsonb_build_object('ok', false, 'code', 'position_out_of_order');
  end if;

  v_type := p_vote_type;

  if v_type = 'candidate' then
    select id into v_candidate_id
    from public.candidates
    where position_id = p_position_id
      and number = p_candidate_number
      and is_active;

    if v_candidate_id is null then
      v_type := 'null';
    end if;
  end if;

  insert into public.votes (election_id, position_id, candidate_id, vote_type)
  values (v_voter.election_id, p_position_id, v_candidate_id, v_type);

  select count(*) into v_total
  from public.positions
  where election_id = v_voter.election_id and is_active;

  v_next := v_voter.positions_completed + 1;

  update public.election_voters
  set positions_completed = v_next,
      status = case
                 when v_next >= v_total then 'voted'::public.voter_status
                 else 'voting'::public.voter_status
               end,
      voting_started_at = coalesce(voting_started_at, now()),
      voted_at = case when v_next >= v_total then date_trunc('hour', now()) else voted_at end,
      session_expires_at = case when v_next >= v_total then null else session_expires_at end,
      ballot_box_terminal_id = case when v_next >= v_total then null else ballot_box_terminal_id end
  where id = v_voter.id;

  return jsonb_build_object(
    'ok', true, 'recorded', true,
    'vote_type', v_type,
    'positions_completed', v_next,
    'finished', v_next >= v_total
  );
end;
$fn$;

-- CREATE OR REPLACE preserva privilégios, mas reafirmamos para o migration ser
-- autossuficiente se alguém recriar o banco do zero a partir daqui.
grant execute on function public.cast_vote(uuid, uuid, smallint, public.vote_type, text)
  to service_role;

revoke execute on function public.cast_vote(uuid, uuid, smallint, public.vote_type, text)
  from public, anon, authenticated;
