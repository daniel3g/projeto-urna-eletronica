-- seed.sql — dados de demonstração
--
-- APLICAR SOMENTE NO urna-dev.
-- Cole este arquivo inteiro no SQL Editor do painel do Supabase e execute.
-- (Com o PostgreSQL client instalado: psql "$SUPABASE_DB_URL" -f supabase/seed.sql)
--
-- Idempotente: pode ser reaplicado sem duplicar nada.
-- Cria uma eleição em RASCUNHO com 3 cargos, 7 candidatos, 2 seções,
-- 4 terminais não pareados e 30 estudantes associados.

begin;

-- ------------------------------------------------------------------ eleição
insert into public.elections (id, name, description, status) values
  ('a0000000-0000-4000-8000-000000000001',
   'Eleição do Grêmio Estudantil 2026',
   'Eleição de demonstração criada pelo seed. Não usar em produção.',
   'draft')
on conflict (id) do nothing;

-- -------------------------------------------------------------------- cargos
insert into public.positions (id, election_id, name, digits, display_order) values
  ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'Presidente',          2, 1),
  ('b0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'Secretário',          2, 2),
  ('b0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', 'Diretor de Esportes', 2, 3)
on conflict (id) do nothing;

-- ---------------------------------------------------------------- candidatos
insert into public.candidates
  (id, election_id, position_id, number, full_name, ballot_name, party_name, party_acronym, deputy_name) values
  ('d0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001',
   'b0000000-0000-4000-8000-000000000001', '15', 'João Silva',      'João Silva',  'Futuro da Escola',  'FE', 'Maria Souza'),
  ('d0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001',
   'b0000000-0000-4000-8000-000000000001', '23', 'Maria Souza',     'Maria',       'União Estudantil',  'UE', 'Pedro Lima'),
  ('d0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001',
   'b0000000-0000-4000-8000-000000000001', '77', 'Carlos Lima',     'Carlinhos',   'Voz Ativa',         'VA', 'Ana Rocha'),
  ('d0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000001',
   'b0000000-0000-4000-8000-000000000002', '10', 'Beatriz Nunes',   'Bia Nunes',   'Futuro da Escola',  'FE', null),
  ('d0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000001',
   'b0000000-0000-4000-8000-000000000002', '20', 'Rafael Antunes',  'Rafa',        'União Estudantil',  'UE', null),
  ('d0000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000001',
   'b0000000-0000-4000-8000-000000000003', '31', 'Luiza Barreto',   'Luiza',       'Voz Ativa',         'VA', null),
  ('d0000000-0000-4000-8000-000000000007', 'a0000000-0000-4000-8000-000000000001',
   'b0000000-0000-4000-8000-000000000003', '44', 'Gustavo Prado',   'Gu Prado',    'Futuro da Escola',  'FE', null)
on conflict (id) do nothing;

-- -------------------------------------------------------------------- seções
insert into public.sections (id, election_id, code, name) values
  ('c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', '01', 'Laboratório de Informática'),
  ('c0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', '02', 'Sala de Tecnologia')
on conflict (id) do nothing;

-- ----------------------------------------------------------------- terminais
-- Sem token_hash: o pareamento acontece na Etapa 2.
insert into public.terminals (id, election_id, section_id, kind, label) values
  ('e0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001',
   'c0000000-0000-4000-8000-000000000001', 'poll_worker', 'Mesário 01'),
  ('e0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001',
   'c0000000-0000-4000-8000-000000000001', 'ballot_box',  'Urna 01'),
  ('e0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001',
   'c0000000-0000-4000-8000-000000000002', 'poll_worker', 'Mesário 02'),
  ('e0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000001',
   'c0000000-0000-4000-8000-000000000002', 'ballot_box',  'Urna 02')
on conflict (id) do nothing;

-- --------------------------------------------------------------- estudantes
-- Sem foto de propósito: o sistema precisa funcionar assim (RF09, RNF09).
insert into public.students (rm, full_name, class_name) values
  ('10001', 'Ana Beatriz Silva',      '1º INFO'),
  ('10002', 'Bruno Carvalho',         '1º INFO'),
  ('10003', 'Camila Ferreira',        '1º INFO'),
  ('10004', 'Daniel Moreira',         '1º INFO'),
  ('10005', 'Eduarda Ramos',          '1º INFO'),
  ('10006', 'Felipe Andrade',         '1º INFO'),
  ('10007', 'Gabriela Pinto',         '1º INFO'),
  ('10008', 'Henrique Dias',          '1º INFO'),
  ('10009', 'Isabela Monteiro',       '1º INFO'),
  ('10010', 'João Pedro Silva',       '1º INFO'),
  ('10011', 'Karina Lopes',           '2º INFO'),
  ('10012', 'Lucas Teixeira',         '2º INFO'),
  ('10013', 'Mariana Costa',          '2º INFO'),
  ('10014', 'Nicolas Barros',         '2º INFO'),
  ('10015', 'Olívia Cardoso',         '2º INFO'),
  ('10016', 'Paulo Henrique Alves',   '2º INFO'),
  ('10017', 'Quezia Martins',         '2º INFO'),
  ('10018', 'Rafael Nogueira',        '2º INFO'),
  ('10019', 'Sofia Almeida',          '2º INFO'),
  ('10020', 'Thiago Mendes',          '2º INFO'),
  ('10021', 'Ursula Batista',         '3º INFO'),
  ('10022', 'Vinícius Rocha',         '3º INFO'),
  ('10023', 'Yasmin Duarte',          '3º INFO'),
  ('10024', 'Arthur Sampaio',         '3º INFO'),
  ('10025', 'Bianca Freitas',         '3º INFO'),
  ('10026', 'Caio Vasconcelos',       '3º INFO'),
  ('10027', 'Débora Siqueira',        '3º INFO'),
  ('10028', 'Enzo Guimarães',         '3º INFO'),
  ('10029', 'Fernanda Peixoto',       '3º INFO'),
  ('10030', 'Gustavo Rezende',        '3º INFO')
on conflict (rm) do nothing;

-- ------------------------------------------------ participação na eleição
-- RM ímpar vai para a Seção 01, RM par para a Seção 02.
insert into public.election_voters (election_id, student_id, section_id)
select
  'a0000000-0000-4000-8000-000000000001'::uuid,
  s.id,
  case when (right(s.rm, 1)::int % 2) = 1
       then 'c0000000-0000-4000-8000-000000000001'::uuid
       else 'c0000000-0000-4000-8000-000000000002'::uuid
  end
from public.students s
where s.rm >= '10001' and s.rm <= '10030'
on conflict (election_id, student_id) do nothing;

commit;

-- Conferência rápida:
--   select name, status from public.elections;
--   select p.name, count(c.id) from public.positions p
--     left join public.candidates c on c.position_id = p.id
--     group by p.name, p.display_order order by p.display_order;
--   select * from public.v_turnout;

-- ---------------------------------------------------------------------------
-- PRIMEIRO ADMINISTRADOR
--
-- profiles referencia auth.users, então o usuário precisa existir antes: crie-o
-- em Authentication > Users no painel do Supabase (e-mail + senha) e então rode,
-- trocando o e-mail:
--
--   insert into public.profiles (id, full_name, role)
--   select id, 'Nome do Administrador', 'admin'
--   from auth.users where email = 'voce@exemplo.com'
--   on conflict (id) do update set role = 'admin';
--
-- Sem essa linha, is_admin() devolve false e nenhuma política de leitura libera nada.
-- ---------------------------------------------------------------------------
