-- 20260824120500_rls
-- Row Level Security. Segunda barreira: com todas as escritas passando pelo servidor
-- (service_role, que ignora RLS), o papel das políticas é garantir que um vazamento da
-- chave anônima — que é pública por definição — não vire vazamento de dados.
-- Ver docs/03-seguranca-sigilo-rls.md §5

alter table public.profiles        enable row level security;
alter table public.students        enable row level security;
alter table public.elections       enable row level security;
alter table public.positions       enable row level security;
alter table public.candidates      enable row level security;
alter table public.sections        enable row level security;
alter table public.terminals       enable row level security;
alter table public.election_voters enable row level security;
alter table public.votes           enable row level security;

-- ---------------------------------------------------------------------------
-- Tabelas sem NENHUMA política: o padrão do Postgres é negar tudo para anon e
-- authenticated. É exatamente o estado desejado. Só o servidor as acessa.
-- Os REVOKE abaixo removem os grants que o Supabase concede por padrão a novas
-- tabelas no schema public, para que nem a permissão de tabela exista.
-- ---------------------------------------------------------------------------
revoke all on public.votes           from anon, authenticated;
revoke all on public.election_voters from anon, authenticated;
revoke all on public.students        from anon, authenticated;
revoke all on public.terminals       from anon, authenticated;

revoke all on public.v_results_by_candidate from anon, authenticated;
revoke all on public.v_results_totals       from anon, authenticated;
revoke all on public.v_turnout              from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Leitura do administrador nas tabelas de configuração, para Server Components
-- que renderizam listas com a sessão do usuário.
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $fn$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and is_active
  );
$fn$;

drop policy if exists "usuario le proprio perfil" on public.profiles;
create policy "usuario le proprio perfil" on public.profiles
  for select to authenticated using (id = auth.uid());

drop policy if exists "admin le eleicoes" on public.elections;
create policy "admin le eleicoes" on public.elections
  for select to authenticated using (public.is_admin());

drop policy if exists "admin le cargos" on public.positions;
create policy "admin le cargos" on public.positions
  for select to authenticated using (public.is_admin());

drop policy if exists "admin le candidatos" on public.candidates;
create policy "admin le candidatos" on public.candidates
  for select to authenticated using (public.is_admin());

drop policy if exists "admin le secoes" on public.sections;
create policy "admin le secoes" on public.sections
  for select to authenticated using (public.is_admin());

-- Nenhuma política de INSERT, UPDATE ou DELETE é criada para ninguém.
-- Escrita é privilégio exclusivo dos Route Handlers com service_role.
-- Se um dia uma tela precisar escrever direto, a decisão passa por revisão
-- de docs/03-seguranca-sigilo-rls.md.
