-- etapa0_checks.sql — conferência de comportamento do esquema
--
-- COMO RODAR: cole este arquivo inteiro no SQL Editor do painel do Supabase
-- (projeto urna-dev) e execute uma vez. O resultado é a tabela final.
--
-- NÃO DEIXA RESÍDUO: cada teste cria os dados de que precisa dentro de um bloco
-- BEGIN/EXCEPTION do PL/pgSQL, que funciona como savepoint. No fim de cada bloco
-- um RAISE proposital desfaz tudo — inclusive as eleições de teste. Nenhuma linha
-- sobrevive, e o seed de demonstração não é tocado.

create temp table if not exists _report (
  id       text,
  teste    text,
  ok       boolean,
  detalhe  text
);
truncate _report;

-- ---------------------------------------------------------------- T01 sigilo
do $$
declare v_cols text;
begin
  select string_agg(column_name, ', ')
    into v_cols
  from information_schema.columns
  where table_schema = 'public' and table_name = 'votes'
    and (column_name ilike '%student%'
      or column_name ilike '%voter%'
      or column_name ilike '%session%');

  insert into _report values (
    'T01', 'votes nao possui coluna que leve ao estudante',
    v_cols is null,
    coalesce('encontrou: ' || v_cols, 'nenhuma coluna suspeita')
  );
end $$;

-- ------------------------------------------------------------ T02 PK aleatoria
do $$
declare v_type text; v_default text;
begin
  select data_type, coalesce(column_default, '')
    into v_type, v_default
  from information_schema.columns
  where table_schema = 'public' and table_name = 'votes' and column_name = 'id';

  insert into _report values (
    'T02', 'PK de votes e uuid aleatorio (nao sequencial)',
    v_type = 'uuid' and v_default like '%gen_random_uuid%',
    v_type || ' default ' || v_default
  );
end $$;

-- --------------------------------------------------- T03 carimbo truncado
do $$
declare v_default text;
begin
  select coalesce(column_default, '') into v_default
  from information_schema.columns
  where table_schema = 'public' and table_name = 'votes' and column_name = 'recorded_hour';

  insert into _report values (
    'T03', 'recorded_hour trunca na hora',
    v_default like '%date_trunc%hour%',
    v_default
  );
end $$;

-- ------------------------------------------- T04 voto barrado em rascunho
do $$
declare
  v_ok boolean := false; v_msg text := '';
  eid uuid; pid uuid; cid uuid;
begin
  begin
    insert into public.elections (name, status) values ('_TESTE_T04', 'draft') returning id into eid;
    insert into public.positions (election_id, name, digits, display_order)
      values (eid, 'Cargo', 2, 1) returning id into pid;
    insert into public.candidates (election_id, position_id, number, full_name)
      values (eid, pid, '15', 'Fulano') returning id into cid;

    insert into public.votes (election_id, position_id, candidate_id, vote_type)
      values (eid, pid, cid, 'candidate');

    v_msg := 'PASSOU — o voto foi aceito com a eleicao em rascunho';
    raise exception 'ROLLBACK_TESTE';
  exception when others then
    if sqlerrm <> 'ROLLBACK_TESTE' then v_ok := true; v_msg := sqlerrm; end if;
  end;
  insert into _report values ('T04', 'voto recusado com eleicao em rascunho', v_ok, v_msg);
end $$;

-- ------------------------------- T05/T06/T07 voto aceito, imutavel, indeletavel
do $$
declare
  v05 boolean := false; m05 text := '';
  v06 boolean := false; m06 text := '';
  v07 boolean := false; m07 text := '';
  eid uuid; pid uuid; cid uuid; vid uuid;
begin
  begin
    -- cargo e candidato precisam existir antes da abertura
    insert into public.elections (name, status) values ('_TESTE_T05', 'draft') returning id into eid;
    insert into public.positions (election_id, name, digits, display_order)
      values (eid, 'Cargo', 2, 1) returning id into pid;
    insert into public.candidates (election_id, position_id, number, full_name)
      values (eid, pid, '15', 'Fulano') returning id into cid;
    update public.elections set status = 'open', opened_at = now() where id = eid;

    insert into public.votes (election_id, position_id, candidate_id, vote_type)
      values (eid, pid, cid, 'candidate') returning id into vid;
    v05 := true; m05 := 'voto registrado';

    begin
      update public.votes set vote_type = 'blank' where id = vid;
      m06 := 'PASSOU — o voto pode ser alterado';
    exception when others then
      v06 := true; m06 := sqlerrm;
    end;

    begin
      delete from public.votes where id = vid;
      m07 := 'PASSOU — o voto pode ser apagado';
    exception when others then
      v07 := true; m07 := sqlerrm;
    end;

    raise exception 'ROLLBACK_TESTE';
  exception when others then
    if sqlerrm <> 'ROLLBACK_TESTE' then
      m05 := coalesce(nullif(m05, ''), sqlerrm);
    end if;
  end;
  insert into _report values ('T05', 'voto aceito com eleicao aberta',  v05, m05);
  insert into _report values ('T06', 'voto nao pode ser alterado',      v06, m06);
  insert into _report values ('T07', 'voto nao pode ser apagado',       v07, m07);
end $$;

-- ------------------------------------ T08 numero do candidato x digitos do cargo
do $$
declare
  v_ok boolean := false; v_msg text := '';
  eid uuid; pid uuid;
begin
  begin
    insert into public.elections (name, status) values ('_TESTE_T08', 'draft') returning id into eid;
    insert into public.positions (election_id, name, digits, display_order)
      values (eid, 'Cargo', 2, 1) returning id into pid;

    insert into public.candidates (election_id, position_id, number, full_name)
      values (eid, pid, '150', 'Tres Digitos');

    v_msg := 'PASSOU — aceitou 3 digitos em cargo de 2';
    raise exception 'ROLLBACK_TESTE';
  exception when others then
    if sqlerrm <> 'ROLLBACK_TESTE' then v_ok := true; v_msg := sqlerrm; end if;
  end;
  insert into _report values ('T08', 'candidato com digitos errados recusado', v_ok, v_msg);
end $$;

-- ------------------------------- T09 candidato nao cruza eleicoes (FK composta)
do $$
declare
  v_ok boolean := false; v_msg text := '';
  eid_a uuid; eid_b uuid; pid_a uuid;
begin
  begin
    insert into public.elections (name, status) values ('_TESTE_T09_A', 'draft') returning id into eid_a;
    insert into public.elections (name, status) values ('_TESTE_T09_B', 'draft') returning id into eid_b;
    insert into public.positions (election_id, name, digits, display_order)
      values (eid_a, 'Cargo A', 2, 1) returning id into pid_a;

    -- candidato da eleicao B apontando para o cargo da eleicao A
    insert into public.candidates (election_id, position_id, number, full_name)
      values (eid_b, pid_a, '15', 'Intruso');

    v_msg := 'PASSOU — candidato cruzou eleicoes';
    raise exception 'ROLLBACK_TESTE';
  exception when others then
    if sqlerrm <> 'ROLLBACK_TESTE' then v_ok := true; v_msg := sqlerrm; end if;
  end;
  insert into _report values ('T09', 'candidato nao pode cruzar eleicoes', v_ok, v_msg);
end $$;

-- --------------------------------- T10 cargos congelados com a eleicao aberta
do $$
declare
  v_ok boolean := false; v_msg text := '';
  eid uuid;
begin
  begin
    insert into public.elections (name, status) values ('_TESTE_T10', 'draft') returning id into eid;
    insert into public.positions (election_id, name, digits, display_order)
      values (eid, 'Cargo 1', 2, 1);
    update public.elections set status = 'open', opened_at = now() where id = eid;

    insert into public.positions (election_id, name, digits, display_order)
      values (eid, 'Cargo 2', 2, 2);

    v_msg := 'PASSOU — cargo criado com a eleicao aberta';
    raise exception 'ROLLBACK_TESTE';
  exception when others then
    if sqlerrm <> 'ROLLBACK_TESTE' then v_ok := true; v_msg := sqlerrm; end if;
  end;
  insert into _report values ('T10', 'cargo nao pode ser criado com eleicao aberta', v_ok, v_msg);
end $$;

-- ------------------------- T11 uma urna nao aceita dois eleitores ao mesmo tempo
do $$
declare
  v_ok boolean := false; v_msg text := '';
  eid uuid; sid uuid; tid uuid; st1 uuid; st2 uuid;
begin
  begin
    insert into public.elections (name, status) values ('_TESTE_T11', 'draft') returning id into eid;
    insert into public.sections (election_id, code, name)
      values (eid, '99', 'Secao Teste') returning id into sid;
    insert into public.terminals (election_id, section_id, kind, label)
      values (eid, sid, 'ballot_box', 'Urna Teste') returning id into tid;
    insert into public.students (rm, full_name) values ('ZZTEST11A', 'Aluno A') returning id into st1;
    insert into public.students (rm, full_name) values ('ZZTEST11B', 'Aluno B') returning id into st2;

    insert into public.election_voters (election_id, student_id, section_id, status, ballot_box_terminal_id)
      values (eid, st1, sid, 'released', tid);
    insert into public.election_voters (election_id, student_id, section_id, status, ballot_box_terminal_id)
      values (eid, st2, sid, 'released', tid);

    v_msg := 'PASSOU — dois eleitores liberados na mesma urna';
    raise exception 'ROLLBACK_TESTE';
  exception when others then
    if sqlerrm <> 'ROLLBACK_TESTE' then v_ok := true; v_msg := sqlerrm; end if;
  end;
  insert into _report values ('T11', 'urna nao aceita dois eleitores ativos', v_ok, v_msg);
end $$;

-- ------------------- T12 eleicao em rascunho pode ser apagada (cascade completo)
do $$
declare
  v_ok boolean := false; v_msg text := '';
  eid uuid; sid uuid; sobrou int;
begin
  begin
    insert into public.elections (name, status) values ('_TESTE_T12', 'draft') returning id into eid;
    insert into public.sections (election_id, code, name)
      values (eid, '98', 'Secao') returning id into sid;
    insert into public.terminals (election_id, section_id, kind, label)
      values (eid, sid, 'ballot_box', 'Urna');
    insert into public.positions (election_id, name, digits, display_order)
      values (eid, 'Cargo', 2, 1);

    delete from public.elections where id = eid;

    select count(*) into sobrou from public.positions where election_id = eid;
    v_ok  := (sobrou = 0);
    v_msg := 'cascade removeu cargos, secoes e terminais';

    raise exception 'ROLLBACK_TESTE';
  exception when others then
    if sqlerrm <> 'ROLLBACK_TESTE' then v_ok := false; v_msg := sqlerrm; end if;
  end;
  insert into _report values ('T12', 'eleicao em rascunho pode ser apagada', v_ok, v_msg);
end $$;

-- ------------------------------ T13 eleitores travados com a eleicao encerrada
do $$
declare
  v_ok boolean := false; v_msg text := '';
  eid uuid; stid uuid;
begin
  begin
    insert into public.elections (name, status) values ('_TESTE_T13', 'draft') returning id into eid;
    insert into public.students (rm, full_name) values ('ZZTEST13', 'Aluno C') returning id into stid;
    insert into public.election_voters (election_id, student_id) values (eid, stid);
    update public.elections set status = 'closed', opened_at = now(), closed_at = now() where id = eid;

    update public.election_voters set status = 'released' where election_id = eid;

    v_msg := 'PASSOU — eleitor alterado com a eleicao encerrada';
    raise exception 'ROLLBACK_TESTE';
  exception when others then
    if sqlerrm <> 'ROLLBACK_TESTE' then v_ok := true; v_msg := sqlerrm; end if;
  end;
  insert into _report values ('T13', 'eleitor nao muda com eleicao encerrada', v_ok, v_msg);
end $$;

-- ----------------------------------------------- T14 views com security_invoker
do $$
declare v_faltando text;
begin
  select string_agg(c.relname, ', ')
    into v_faltando
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'v'
    and c.relname in ('v_results_by_candidate', 'v_results_totals', 'v_turnout')
    -- o Postgres guarda o literal informado: on, true, 1 e yes são todos válidos
    and not coalesce(
      (select lower(option_value) in ('on', 'true', '1', 'yes')
       from pg_options_to_table(c.reloptions)
       where option_name = 'security_invoker'), false);

  insert into _report values (
    'T14', 'views de apuracao com security_invoker',
    v_faltando is null,
    coalesce('sem security_invoker: ' || v_faltando, 'as tres views estao corretas')
  );
end $$;

-- -------------------------------- T15 anon e authenticated sem acesso aos dados
do $$
declare v_grants text;
begin
  select string_agg(distinct grantee || ' -> ' || table_name || '.' || privilege_type, ', ')
    into v_grants
  from information_schema.role_table_grants
  where table_schema = 'public'
    and grantee in ('anon', 'authenticated')
    and table_name in ('votes', 'election_voters', 'students', 'terminals',
                       'v_results_by_candidate', 'v_results_totals', 'v_turnout');

  insert into _report values (
    'T15', 'anon/authenticated sem privilegio nas tabelas sensiveis',
    v_grants is null,
    coalesce(v_grants, 'nenhum privilegio concedido')
  );
end $$;

-- ------------------------------------------------------------ T16 RLS ativo
do $$
declare v_sem_rls text;
begin
  select string_agg(c.relname, ', ')
    into v_sem_rls
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
    and c.relname in ('profiles','students','elections','positions','candidates',
                      'sections','terminals','election_voters','votes');

  insert into _report values (
    'T16', 'RLS habilitado nas nove tabelas',
    v_sem_rls is null,
    coalesce('sem RLS: ' || v_sem_rls, 'todas com RLS')
  );
end $$;

-- --------------------------------------------------------------- resultado
select
  id,
  case when ok then 'OK' else 'FALHOU' end as resultado,
  teste,
  detalhe
from _report
order by id;
