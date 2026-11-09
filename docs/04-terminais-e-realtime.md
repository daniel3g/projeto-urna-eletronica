# 04 — Terminais e Tempo Real

## 1. Por que pareamento por token

No dia da eleição, o laboratório é ligado por alguém que não é o desenvolvedor. Login com e-mail e
senha em cada máquina significa senhas circulando em papel entre mesários adolescentes, sessões
esquecidas abertas e um ponto de falha logo no início da votação.

O modelo adotado: o administrador cadastra o terminal **antes**, gera um código curto, alguém digita
esse código uma única vez naquela máquina, e o navegador guarda um token de longa duração. A partir
daí a máquina abre direto na tela certa.

## 2. Ciclo de vida do terminal

```text
CADASTRADO ──► CÓDIGO GERADO ──► PAREADO ──► ATIVO ──► REVOGADO
   admin         admin            terminal    dia da     admin
   cria          gera código      digita      eleição    revoga
```

**Cadastro.** O admin cria o terminal com seção, tipo (`poll_worker` ou `ballot_box`) e rótulo
("Urna 01"). `token_hash` fica nulo.

**Código de pareamento.** O admin gera um código de 6 caracteres alfanuméricos, válido por 30
minutos e de uso único. É exibido na tela do painel para ser digitado na máquina de destino.

**Pareamento.** A máquina abre `/urna/pair` (ou `/mesario/pair`), digita o código e chama
`POST /api/terminals/pair`. O servidor valida, gera um token opaco de 32 bytes, grava
`sha256(token + TERMINAL_TOKEN_PEPPER)` em `token_hash`, limpa `pairing_code`, preenche `paired_at`
e devolve o token uma única vez.

**Uso.** O token fica em `localStorage` sob a chave `urna.terminal_token` e vai em toda requisição
como `Authorization: Bearer <token>`. O servidor resolve o terminal pelo hash e atualiza
`last_seen_at`.

**Revogação.** O admin limpa `token_hash` e desativa o terminal. A máquina volta à tela de
pareamento na requisição seguinte. Usado quando um computador é trocado ou some.

### Formato do código

Alfabeto sem caracteres ambíguos: `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (sem `I`, `O`, `0`, `1`).
Exibido como `K7M-P2Q`. Tentativas de pareamento são limitadas a 10 por IP a cada 10 minutos.

## 3. Escopo de cada tipo de terminal

| | Terminal do mesário | Terminal da urna |
|---|---|---|
| Rota | `/mesario` | `/urna` |
| Consulta eleitor por RM | sim | não |
| Vê nome e foto do aluno | sim | não |
| Libera eleitor | sim | não |
| Lê cargos e candidatos | não | sim |
| Registra voto | não | sim |
| Vê apuração | não | não |

Um token do tipo `poll_worker` chamando um endpoint de urna recebe `403`, e vice-versa. A
verificação é feita por um middleware compartilhado (`lib/auth/requireTerminal(kind)`).

## 4. Comunicação mesário → urna

O requisito é RNF04: a urna precisa reagir "praticamente em tempo real" à liberação, sem que o aluno
digite nada.

### Desenho adotado

```text
TERMINAL DO MESÁRIO                SERVIDOR                    URNA 01
        │                             │                           │
        │ POST /poll-worker/release   │                           │
        ├────────────────────────────►│                           │
        │                             │ UPDATE election_voters    │
        │                             │ status = 'released'       │
        │                             │                           │
        │                             │ broadcast em              │
        │                             │ terminal:<urna_id>        │
        │                             ├──────────────────────────►│
        │                             │   { event: "state_changed" }
        │◄────────────────────────────┤                           │
        │   200 { eleitor liberado }  │                           │
        │                             │  GET /ballot-box/state    │
        │                             │◄──────────────────────────┤
        │                             ├──────────────────────────►│
        │                             │  { status, cargos... }    │
```

**A mensagem de broadcast não carrega dado nenhum.** Ela diz apenas "seu estado mudou, vá buscar".
A urna então consulta o servidor com o próprio token e recebe o que tem direito de ver. Isso
elimina de uma vez a preocupação com o que trafega pelo canal e com quem consegue escutá-lo.

### Por que Broadcast e não Postgres Changes

Escutar mudanças de tabela via Realtime exigiria dar a `anon` permissão de `SELECT` em
`election_voters` — ou seja, abrir a tabela de eleitores para qualquer pessoa com a chave pública.
Inaceitável (ver [03](03-seguranca-sigilo-rls.md), §5). Broadcast em canal privado mantém a tabela
fechada.

### Autorização do canal — resolvido em 26/08/2026

O desenho original previa um JWT curto assinado por nós com `SUPABASE_JWT_SECRET`, carregando a
claim `terminal_id`, com RLS em `realtime.messages` filtrando por essa claim. **Esse caminho não
está disponível neste projeto.**

O `urna-dev` usa **JWT Signing Keys assimétricas (ECC P-256)**. A chave privada fica no Supabase e
nunca é exposta — só o JWKS público. O segredo HS256 legado ainda existe, mas foi rotacionado para
`PREVIOUS KEY` e o próprio painel o descreve como *"used to only verify"*: serve para validar tokens
ainda vivos, não para assinar novos de forma sustentável.

**Decisão: canal público com payload vazio.**

O tópico é `terminal:<terminal_id>`, onde `terminal_id` é um UUID v4. A mensagem continua sem dado
algum — apenas `{ event: "state_changed" }` — e a urna reage buscando o estado no servidor com o
próprio token de terminal.

A segurança não depende do canal, e sim do endpoint de estado. Quem adivinhasse o UUID do tópico
aprenderia somente que *algo* mudou naquele terminal: nenhum nome, nenhum RM, nenhum token de
sessão. Enviando eventos falsos, provocaria no máximo uma consulta de estado extra, que responderia
o mesmo de antes. É o payload vazio — decidido antes, por outro motivo — que torna esta opção
defensável.

**Caminho de upgrade, se um dia for preciso apertar:** login anônimo (`signInAnonymously()`) na
urna, com o `auth.uid()` amarrado ao terminal no momento do pareamento, e RLS em
`realtime.messages` comparando `auth.uid()` com `terminals.realtime_uid`. Usa apenas tokens
assinados pelo próprio Supabase, sem chave nossa. Custa habilitar sign-in anônimo e conviver com
usuários anônimos acumulando em `auth.users`.

> **Alerta operacional, sem relação com o Realtime.** As chaves `anon` e `service_role` são JWTs
> verificados pelo **segredo legado**. Revogar o legado derruba a aplicação inteira, não só o canal.
> Antes do dia da eleição, migrar para as chaves *publishable* e *secret*, que não dependem dele.

## 5. Fallback obrigatório

O Realtime é otimização, não dependência. A urna também consulta `GET /api/ballot-box/state`:

- a cada **3 segundos** enquanto está na tela de espera;
- imediatamente ao receber um broadcast;
- imediatamente ao recuperar a conexão (`online` / `visibilitychange`).

Se o WebSocket cair, a liberação continua funcionando com até 3 segundos de atraso, e o mesário não
percebe diferença. A tela de espera mostra um indicador discreto de conexão:

```text
● tempo real     (verde: WebSocket ativo)
◐ verificando    (âmbar: só polling)
○ sem conexão    (vermelho: servidor inacessível)
```

Durante a votação o polling é suspenso — a urna já está ocupada e não precisa de eventos externos.

## 6. Monitoramento no painel

A tela `/admin/elections/[id]/terminals` mostra, por seção, cada terminal com `last_seen_at`
relativo ("há 4 s"), estado de pareamento e — para urnas — se há eleitor em votação. É por essa
tela que o admin percebe que uma máquina caiu antes que a fila reclame.
