-- 20260824120400_views
-- Views de apuração. Todas com security_invoker: o RLS das tabelas de origem
-- continua valendo através da view (uma view "security definer" seria um furo).
-- Ver docs/02-modelo-de-dados.md §6

create or replace view public.v_results_by_candidate
with (security_invoker = on) as
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

create or replace view public.v_results_totals
with (security_invoker = on) as
select
  v.election_id,
  v.position_id,
  count(*)                                          as total_votes,
  count(*) filter (where v.vote_type = 'candidate') as valid_votes,
  count(*) filter (where v.vote_type = 'blank')     as blank_votes,
  count(*) filter (where v.vote_type = 'null')      as null_votes
from public.votes v
group by v.election_id, v.position_id;

create or replace view public.v_turnout
with (security_invoker = on) as
select
  ev.election_id,
  count(*)                                     as eligible,
  count(*) filter (where ev.status = 'voted')  as voted,
  count(*) filter (where ev.status <> 'voted') as absent,
  round(100.0 * count(*) filter (where ev.status = 'voted')
        / nullif(count(*), 0), 2)              as turnout_pct
from public.election_voters ev
group by ev.election_id;

comment on view public.v_turnout is
  'Conta PESSOAS. v_results_totals conta VOTOS. Os números podem divergir: '
  'uma sessão interrompida deixa votos registrados sem o eleitor marcado como voted.';
