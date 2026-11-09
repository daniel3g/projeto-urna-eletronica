-- 20260826120000_cast_vote
-- Registro do voto em uma única transação.
--
-- POR QUE UMA FUNÇÃO, e não dois comandos pela API:
-- inserir em `votes` e incrementar `positions_completed` precisam acontecer
-- juntos. Se o insert passasse e o incremento falhasse, a urna repetiria a
-- requisição e o eleitor votaria DUAS VEZES no mesmo cargo. Aqui isso é
-- impossível: ou os dois acontecem, ou nenhum. Ver docs/05-fluxos.md §4.
--
-- A função também é quem decide o que é voto nulo. O cliente informa o número
-- digitado; se não existir candidato para ele naquele cargo, o voto vira 'null'
-- pelo servidor. A urna não classifica voto.

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
  -- Trava a linha do eleitor: dois cliques simultâneos no CONFIRMA viram fila,
  -- não corrida.
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

  -- Idempotência: a resposta se perdeu e a urna reenviou. O voto já está
  -- gravado; devolvemos sucesso sem gravar de novo.
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

    -- Número sem candidato é voto nulo — decisão do servidor.
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
      status = case when v_next >= v_total then 'voted' else 'voting' end,
      voting_started_at = coalesce(voting_started_at, now()),
      -- voted_at truncado na hora: precisão maior reabriria a correlação com
      -- votes.recorded_hour (docs/03 §3).
      voted_at = case when v_next >= v_total then date_trunc('hour', now()) else voted_at end,
      session_expires_at = case when v_next >= v_total then null else session_expires_at end,
      -- Solta a urna e, de passagem, não deixa registrado em qual urna cada
      -- eleitor votou. `votes` não guarda urna, então nada se perde.
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

-- Só o servidor chama. Sem isto, qualquer um com a chave anônima registraria
-- votos — a função é SECURITY DEFINER e ignoraria o RLS.
revoke execute on function public.cast_vote(uuid, uuid, smallint, public.vote_type, text)
  from public, anon, authenticated;
