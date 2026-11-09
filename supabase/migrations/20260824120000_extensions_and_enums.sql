-- 20260824120000_extensions_and_enums
-- Extensões e tipos enumerados.
-- Ver docs/02-modelo-de-dados.md §2

create extension if not exists pg_trgm with schema extensions;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'election_status') then
    create type public.election_status as enum ('draft', 'open', 'closed');
  end if;

  if not exists (select 1 from pg_type where typname = 'voter_status') then
    create type public.voter_status as enum ('waiting', 'released', 'voting', 'voted');
  end if;

  if not exists (select 1 from pg_type where typname = 'vote_type') then
    create type public.vote_type as enum ('candidate', 'blank', 'null');
  end if;

  if not exists (select 1 from pg_type where typname = 'terminal_kind') then
    create type public.terminal_kind as enum ('poll_worker', 'ballot_box');
  end if;

  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type public.app_role as enum ('admin', 'operator');
  end if;
end $$;
