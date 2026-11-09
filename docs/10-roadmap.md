# 10 — Roadmap de Implementação

Ordem pensada para que exista **algo demonstrável desde a segunda etapa**, e para que a parte mais
arriscada (comunicação entre terminais) seja validada cedo, não na véspera.

## Etapa 0 — Fundação

- projeto Next.js com TypeScript e App Router;
- dois projetos no Supabase Cloud: `urna-dev` e `urna-prod` ([01](01-arquitetura.md) §6);
- CLI do Supabase instalada e `supabase link` apontando para `urna-dev`;
- migrations com todo o DDL de [02](02-modelo-de-dados.md), aplicadas com `supabase db push`;
- tipos gerados com `supabase gen types typescript --linked`;
- clientes Supabase separados por papel ([01](01-arquitetura.md) §4);
- `seed.sql` idempotente com uma eleição de demonstração: 3 cargos, 7 candidatos, 30 alunos, 2 seções.

**Pronto quando:** `npx supabase db push` leva o esquema inteiro para um projeto cloud vazio, e o
seed colado no SQL Editor deixa a eleição de demonstração pronta para uso.

> Sem Docker e sem `psql` nesta máquina: `db push`, `link` e `gen types` falam direto com o projeto
> remoto e não precisam de nenhum dos dois. O que **não** está disponível é o que depende de banco
> local — `supabase start`, `supabase db diff` e `supabase db reset` sem `--linked`.

## Etapa 1 — Cadastros e painel

- login do administrador (Supabase Auth);
- CRUD de eleições, cargos, candidatos, seções;
- CRUD de estudantes e importação CSV com dry-run;
- associação de estudantes à eleição e à seção;
- upload de fotos com redimensionamento no navegador.

**Pronto quando:** uma eleição completa é montada pelo painel, sem SQL manual.

## Etapa 2 — Terminais e tempo real

Etapa deliberadamente antecipada: é o único ponto com dependência de detalhe da plataforma
([04](04-terminais-e-realtime.md) §4).

- cadastro de terminais, geração de código e pareamento;
- `GET /api/ballot-box/state` com o JWT de canal;
- broadcast privado e fallback por polling;
- tela de espera da urna reagindo a uma liberação simulada.

**Pronto quando:** um clique no painel acende a tela de outro computador em menos de 1 segundo, e
continua funcionando com o WebSocket desligado à força.

## Etapa 3 — Terminal do mesário

- busca por RM e por nome;
- cartão do eleitor com foto ou avatar;
- verificação de situação e bloqueio de quem já votou;
- liberação com escolha de urna e cancelamento;
- contadores da seção.

**Pronto quando:** um mesário atende 10 alunos seguidos sem tocar no mouse.

## Etapa 4 — Terminal da urna

- máquina de estados da votação;
- teclado na tela e teclado físico;
- busca de candidato por número, com foto;
- branco, nulo, corrige, confirma;
- registro de voto transacional e idempotente;
- tela FIM e retorno à espera;
- tela cheia e bloqueio de atalhos.

**Pronto quando:** uma votação completa de 3 cargos ocorre do início ao fim, e desligar a rede no
meio não perde nem duplica voto.

## Etapa 5 — Abertura, encerramento e apuração

- checklist de prontidão e abertura da eleição;
- painel de acompanhamento (pessoas, nunca votos);
- encerramento com confirmação;
- apuração por cargo, comparecimento, modo de projeção.

**Pronto quando:** o resultado de uma eleição simulada confere com a contagem manual dos votos
inseridos.

## Etapa 6 — Endurecimento e ensaio geral

- teste de RLS bloqueante no CI ([03](03-seguranca-sigilo-rls.md) §5);
- teste de sigilo: tentativa deliberada de correlacionar `votes` e `election_voters`, que precisa
  falhar;
- teste de concorrência: duas liberações simultâneas na mesma urna;
- ensaio com 4 máquinas reais e ao menos 30 votantes;
- procedimento impresso para os mesários.

## Testes automatizados

| Camada | Ferramenta | Cobre |
|---|---|---|
| Domínio | Vitest | Dígitos, avanço de cargo, classificação branco/nulo |
| Banco | `supabase/tests/etapa0_checks.sql` (SQL Editor) | Constraints, triggers, índice parcial da urna, RLS |
| API | Vitest + supertest | Cada endpoint com token errado, estado errado, ordem errada |
| Segurança | Vitest | Cliente `anon` recusado em `votes`, `students`, `election_voters` |
| Ponta a ponta | Playwright | Fluxo mesário → urna com dois contextos de navegador |

O teste de ponta a ponta com dois contextos simultâneos é o mais valioso do conjunto: é o único que
exercita a liberação real entre duas máquinas.

## Checklist do dia da eleição

Uma página impressa, verificada na véspera:

1. projeto `urna-prod` **ativo, não pausado**, com todas as migrations aplicadas
   (`npx supabase db push` sem pendências);
2. eleição em Rascunho com o checklist de prontidão todo verde;
3. todos os terminais pareados e com `last_seen_at` recente;
4. urnas em tela cheia, testadas com um voto de teste **no `urna-dev`**, nunca em produção;
5. lista impressa de eleitores por seção, como contingência;
6. eleição aberta apenas no momento do início;
7. ao final: encerrar, conferir comparecimento, apurar, projetar.

## Evoluções pós-MVP

Da §32 do documento inicial, em ordem de custo-benefício:

1. som da urna (baixo custo, alto impacto na experiência);
2. boletim de urna e relatório em PDF;
3. painel de participação em tempo real para projeção;
4. auditoria completa (`audit_log` já modelado em [03](03-seguranca-sigilo-rls.md) §7);
5. importação de fotos em lote por ZIP;
6. importação de candidatos;
7. chapas e partidos como entidades próprias;
8. QR Code para pareamento de terminal;
9. modo de demonstração para uso em aula;
10. histórico comparativo entre eleições.
