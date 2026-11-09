-- 20260826130000_cast_vote_grant
-- Correção do REVOKE feito em 20260826120000_cast_vote.
--
-- Aquele migration fez `revoke execute ... from public, anon, authenticated`.
-- O problema: no Postgres, o privilégio EXECUTE de uma função nova é concedido
-- a PUBLIC por padrão, e é DAÍ que o service_role herdava o dele. Revogar de
-- PUBLIC tirou o acesso de todo mundo — inclusive do servidor, que é quem
-- legitimamente chama a função. Resultado: 500 ao confirmar o voto.
--
-- A intenção continua a mesma: anon e authenticated não podem executar.
-- A diferença é que agora o service_role recebe o privilégio explicitamente.

grant execute on function public.cast_vote(uuid, uuid, smallint, public.vote_type, text)
  to service_role;

-- Reafirmado por clareza: quem tem a chave anônima não registra voto.
revoke execute on function public.cast_vote(uuid, uuid, smallint, public.vote_type, text)
  from public, anon, authenticated;
