# 09 — Rastreabilidade dos Requisitos

Cada requisito do documento inicial (§29 e §30) e onde ele é atendido nesta documentação técnica.
Nenhum requisito ficou sem endereço.

## 1. Requisitos funcionais

| RF | Requisito | Atendido por |
|---|---|---|
| RF01 | Cadastrar eleições | `elections` · [02](02-modelo-de-dados.md) §3.3 · `POST /api/admin/elections` |
| RF02 | Cadastrar cargos | `positions` · [02](02-modelo-de-dados.md) §3.4 |
| RF03 | Determinar a ordem dos cargos | `positions.display_order` + `unique (election_id, display_order)` |
| RF04 | Determinar dígitos por cargo | `positions.digits` + trigger `candidates_number_digits` |
| RF05 | Cadastrar candidatos | `candidates` · [02](02-modelo-de-dados.md) §3.5 |
| RF06 | Fotografia dos candidatos | Bucket `candidate-photos` · [08](08-storage.md) |
| RF07 | Cadastrar estudantes | `students` · [02](02-modelo-de-dados.md) §3.2 |
| RF08 | RM como identificador escolar | `students.rm` único; nunca usado como credencial · [03](03-seguranca-sigilo-rls.md) §1 |
| RF09 | Fotografia opcional do estudante | `students.photo_path` anulável · [08](08-storage.md) §4 |
| RF10 | Importar estudantes em lote | `POST /api/admin/students/import` com dry-run · [06](06-api.md) §6 |
| RF11 | Associar estudantes a uma eleição | `election_voters` · [02](02-modelo-de-dados.md) §4.1 |
| RF12 | Organizar estudantes em seções | `sections` + `election_voters.section_id` |
| RF13 | Cadastrar terminais | `terminals` · [04](04-terminais-e-realtime.md) §2 |
| RF14 | Localizar estudante pelo RM | `GET /api/poll-worker/lookup` · [05](05-fluxos.md) §3 |
| RF15 | Visualizar dados antes de liberar | Cartão do eleitor · [07](07-interfaces.md) §2 |
| RF16 | Impedir voto duplicado | `status = 'voted'` terminal + `unique (election_id, student_id)` · [05](05-fluxos.md) §2 |
| RF17 | Liberar o estudante | `POST /api/poll-worker/release` |
| RF18 | Urna detecta a liberação | Broadcast privado + polling de 3 s · [04](04-terminais-e-realtime.md) §4–5 |
| RF19 | Cargos na ordem configurada | `ballot.positions` ordenado por `display_order` · [06](06-api.md) §5 |
| RF20 | Identificar candidato pelo número | `GET /api/ballot-box/candidate` |
| RF21 | Exibir dados do candidato | Tela de votação · [07](07-interfaces.md) §3 |
| RF22 | Voto branco | `vote_type = 'blank'` · [05](05-fluxos.md) §4 |
| RF23 | Voto nulo | `vote_type = 'null'`, resolvido no servidor · [06](06-api.md) §5 |
| RF24 | Corrigir o número | Botão CORRIGE limpa o buffer · [05](05-fluxos.md) §4 |
| RF25 | Exigir confirmação | CONFIRMA obrigatório, inclusive para branco e nulo |
| RF26 | Concluir após o último cargo | `finished: true` + `status = 'voted'` |
| RF27 | Registrar que o estudante votou | `election_voters.voted_at` |
| RF28 | Voto sem vínculo com o estudante | `votes` sem FK para estudante · [03](03-seguranca-sigilo-rls.md) §3 |
| RF29 | Encerrar a eleição | `POST /api/admin/elections/[id]/close` · [05](05-fluxos.md) §1 |
| RF30 | Realizar a apuração | Views `v_results_*` e `v_turnout` · [02](02-modelo-de-dados.md) §6 |

## 2. Requisitos não funcionais

| RNF | Requisito | Atendido por |
|---|---|---|
| RNF01 | Funcionar em navegador | Next.js na Vercel · [01](01-arquitetura.md) §1 |
| RNF02 | Urna simples e em tela cheia | Regras de UI da urna · [07](07-interfaces.md) §3 |
| RNF03 | Vários computadores conectados | Terminais pareados por token · [04](04-terminais-e-realtime.md) §2 |
| RNF04 | Comunicação praticamente em tempo real | Broadcast + fallback de 3 s · [04](04-terminais-e-realtime.md) §4–5 |
| RNF05 | Impedir alterações indevidas via regras do Supabase | RLS negando por padrão · [03](03-seguranca-sigilo-rls.md) §5 |
| RNF06 | Urna sem acesso administrativo | Escopo por tipo de token · [04](04-terminais-e-realtime.md) §3 |
| RNF07 | Mesário sem acesso aos votos | Nenhuma rota de voto aceita token `poll_worker` |
| RNF08 | Impossível saber em quem alguém votou | Esquema, tempo, ordem e interface · [03](03-seguranca-sigilo-rls.md) §3 |
| RNF09 | Ausência de foto não impede votar | Nenhuma validação depende de foto · [08](08-storage.md) §4 |
| RNF10 | Tratar perda de comunicação antes da confirmação | Retentativa idempotente · [05](05-fluxos.md) §5 |

## 3. Decisões que vão além do documento inicial

Pontos que a documentação técnica precisou definir e que o documento inicial deixava em aberto:

| Tema | Decisão | Onde |
|---|---|---|
| Autenticação dos terminais | Token de pareamento, sem login no dia | [04](04-terminais-e-realtime.md) §1 |
| Onde as regras vivem | Route Handlers no servidor; RLS como segunda barreira | [03](03-seguranca-sigilo-rls.md) §2 |
| Vazamento temporal do sigilo | Carimbo truncado na hora e IDs aleatórios em `votes` | [03](03-seguranca-sigilo-rls.md) §3 |
| Momento de gravar o voto | Um voto por cargo, na confirmação, sem lote no fim | [05](05-fluxos.md) §4 |
| Sessão interrompida | Votos parciais permanecem; eleitor retoma no cargo seguinte | [05](05-fluxos.md) §5–6 |
| Realtime sem abrir a tabela | Broadcast privado sem payload, urna busca o estado | [04](04-terminais-e-realtime.md) §4 |
| Congelamento de cadastros | Cargos e candidatos travam ao abrir; eleitores não | [05](05-fluxos.md) §1 |
| Reabertura de eleição | Não existe; encerrar é irreversível | [05](05-fluxos.md) §1 |
