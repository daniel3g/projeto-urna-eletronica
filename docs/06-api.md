# 06 — API Interna

Todos os endpoints são Route Handlers do Next.js sob `app/api/`. Formato JSON, textos de erro em
português (chegam à tela sem tradução intermediária).

## 1. Autenticação

| Grupo | Como autentica |
|---|---|
| `/api/admin/*` | Cookie de sessão do Supabase Auth; `profiles.role = 'admin'` |
| `/api/poll-worker/*` | `Authorization: Bearer <token>` de terminal `poll_worker` |
| `/api/ballot-box/*` | `Authorization: Bearer <token>` de terminal `ballot_box` |
| `/api/terminals/pair` | Público (protegido por rate limit e código de uso único) |

## 2. Formato de erro

```json
{
  "error": {
    "code": "voter_already_voted",
    "message": "Este eleitor já votou.",
    "details": { "voted_at": "2026-09-18T13:00:00Z" }
  }
}
```

| Código HTTP | Uso |
|---|---|
| 400 | Requisição malformada |
| 401 | Token ausente, inválido ou revogado |
| 403 | Token do tipo errado, ou admin sem permissão |
| 404 | Recurso inexistente (RM não localizado) |
| 409 | Conflito de estado: eleitor já votou, urna ocupada, eleição fechada |
| 422 | Regra de negócio violada: número com dígitos errados |
| 429 | Rate limit de pareamento |

Códigos de erro previstos: `terminal_not_paired`, `invalid_pairing_code`, `voter_not_found`,
`voter_already_voted`, `voter_already_released`, `ballot_box_busy`, `election_not_open`,
`session_expired`, `position_out_of_order`, `already_recorded`.

## 3. Pareamento

### `POST /api/terminals/pair`

```jsonc
// requisição
{ "pairing_code": "K7MP2Q" }

// 200
{
  "terminal_token": "opaque-32-bytes-base64url",
  "terminal": { "id": "...", "kind": "ballot_box", "label": "Urna 01" },
  "election": { "id": "...", "name": "Eleição do Grêmio 2026", "status": "draft" },
  "section":  { "id": "...", "code": "01", "name": "Laboratório de Informática" }
}
```

O `terminal_token` é devolvido **uma única vez**. Perdido, gera-se novo código.

## 4. Terminal do mesário

### `GET /api/poll-worker/lookup?rm=12345`

```jsonc
// 200
{
  "student": {
    "id": "...", "rm": "12345",
    "full_name": "João Pedro Silva",
    "class_name": "1º INFO",
    "photo_url": "https://.../signed?...",   // null quando não há foto
    "section": { "id": "...", "code": "01", "name": "Laboratório de Informática" }
  },
  "voter_status": "waiting",
  "can_release": true,
  "blocked_reason": null,
  "available_ballot_boxes": [
    { "id": "...", "label": "Urna 01", "busy": false },
    { "id": "...", "label": "Urna 02", "busy": true }
  ]
}
```

Quando o eleitor já votou: `voter_status: "voted"`, `can_release: false`,
`blocked_reason: "Este eleitor já votou às 10h."`

### `GET /api/poll-worker/search?q=joao`

Busca por nome, no máximo 10 resultados. Usada quando o aluno não sabe o RM. Devolve os mesmos
campos de `lookup`, em lista.

### `POST /api/poll-worker/release`

```jsonc
{ "student_id": "...", "ballot_box_terminal_id": "..." }

// 200
{ "released_at": "2026-09-18T13:00:00Z", "ballot_box_label": "Urna 01" }
```

Validações, nesta ordem: eleição aberta → eleitor pertence à eleição → status `waiting` → urna é do
tipo `ballot_box`, ativa, pareada e da mesma seção → urna livre. A gravação e o broadcast ocorrem
na mesma transação lógica; se o broadcast falhar, a liberação continua válida (a urna descobre pelo
polling).

### `POST /api/poll-worker/cancel`

```jsonc
{ "student_id": "..." }
```

Só permitido com status `released` (a urna ainda não iniciou). Devolve o eleitor a `waiting`.

## 5. Terminal da urna

### `GET /api/ballot-box/state`

Endpoint central da urna: o único que ela chama na tela de espera.

```jsonc
// aguardando
{
  "screen": "waiting",
  "election": { "id": "...", "name": "Eleição do Grêmio 2026", "status": "open" },
  "terminal": { "label": "Urna 01", "section_code": "01" },
  "realtime": { "topic": "terminal:<id>", "token": "<jwt-10min>" }
}

// liberado ou em votação
{
  "screen": "voting",
  "session": { "positions_completed": 1, "expires_at": "2026-09-18T13:10:00Z" },
  "ballot": {
    "positions": [
      { "id": "...", "name": "Presidente", "digits": 2, "display_order": 1 },
      { "id": "...", "name": "Secretário", "digits": 2, "display_order": 2 }
    ]
  }
}
```

Note o que **não** aparece: nome, RM, foto ou id do eleitor. A urna não recebe identidade
(ver [03](03-seguranca-sigilo-rls.md), §4). A lista de candidatos também não vem aqui — vem sob
demanda, para não expor o gabarito completo no primeiro carregamento.

### `POST /api/ballot-box/start`

Marca `voting`, grava `voting_started_at`. Idempotente: chamar com a sessão já iniciada devolve
200 com o estado atual.

### `GET /api/ballot-box/candidate?position_id=...&number=15`

```jsonc
// encontrado
{
  "found": true,
  "candidate": {
    "id": "...", "number": "15",
    "name": "João Silva",
    "party_name": "Futuro da Escola", "party_acronym": "FE",
    "photo_url": "https://.../signed?...",
    "deputy_name": "Maria Souza",
    "deputy_photo_url": "https://.../signed?..."
  }
}

// inexistente → voto nulo
{ "found": false, "candidate": null }
```

Chamado quando o buffer completa a quantidade de dígitos do cargo. As fotos dos candidatos do cargo
atual são pré-carregadas ao entrar nele, para que a imagem apareça instantaneamente.

### `POST /api/ballot-box/vote`

```jsonc
{
  "position_id": "...",
  "position_order": 1,
  "vote_type": "candidate",     // "candidate" | "blank" | "null"
  "candidate_number": "15"      // ausente em branco/nulo
}

// 200
{ "recorded": true, "positions_completed": 1, "next_position_order": 2, "finished": false }

// reenvio após sucesso perdido
{ "recorded": false, "reason": "already_recorded", "positions_completed": 1,
  "next_position_order": 2, "finished": false }
```

Transação no servidor:

1. sessão válida e não expirada; eleição `open`;
2. `position_order == positions_completed + 1` — fora de ordem devolve 409 `position_out_of_order`;
3. se `vote_type = "candidate"`, resolve `candidate_number` → `candidate_id` **no servidor**. Número
   inexistente é convertido em `vote_type = "null"`: o cliente não decide o que é voto nulo;
4. `insert into votes`;
5. `positions_completed = positions_completed + 1`;
6. se foi o último cargo: `status = 'voted'`, `voted_at = date_trunc('hour', now())`,
   `session_token_hash = null`, e `finished: true`.

O corpo da requisição **nunca** contém identificador de eleitor. O vínculo existe apenas no token
de sessão, que é usado para autorizar e imediatamente descartado do caminho da escrita.

### `POST /api/ballot-box/finish`

Chamada de cortesia após a tela FIM: solta a urna e devolve `screen: "waiting"`. A conclusão real
já aconteceu no último `vote`; se esta chamada se perder, nada quebra.

## 6. Administração

> **Implementação:** as operações administrativas são **Server Actions**, não Route Handlers. O
> motivo é a autenticação: terminais mandam `Authorization: Bearer`, o que exige um endpoint HTTP;
> o admin já chega com cookie de sessão, e a Server Action dá o mesmo resultado com menos código e
> tipagem de ponta a ponta. A autorização é idêntica — `requireAdmin()` seguido do cliente
> `service_role`. A tabela abaixo descreve as operações; os métodos e caminhos servem de referência
> caso alguma delas precise virar endpoint de verdade (integração externa, por exemplo).

| Método | Rota | Descrição |
|---|---|---|
| `GET/POST` | `/api/admin/elections` | Lista e cria eleições |
| `PATCH` | `/api/admin/elections/[id]` | Edita (somente em rascunho) |
| `GET` | `/api/admin/elections/[id]/readiness` | Checklist de pré-condições de abertura |
| `POST` | `/api/admin/elections/[id]/open` | Abre a eleição |
| `POST` | `/api/admin/elections/[id]/close` | Encerra (exige `confirm_name`) |
| `GET/POST/PATCH/DELETE` | `/api/admin/elections/[id]/positions` | Cargos |
| `GET/POST/PATCH/DELETE` | `/api/admin/elections/[id]/candidates` | Candidatos |
| `GET/POST/PATCH/DELETE` | `/api/admin/elections/[id]/sections` | Seções |
| `GET/POST/DELETE` | `/api/admin/elections/[id]/terminals` | Terminais |
| `POST` | `/api/admin/terminals/[id]/pairing-code` | Gera código de pareamento |
| `POST` | `/api/admin/terminals/[id]/revoke` | Revoga o token |
| `POST` | `/api/admin/terminals/[id]/unlock` | Destrava urna (exige justificativa) |
| `GET/POST` | `/api/admin/students` | Estudantes |
| `POST` | `/api/admin/students/import` | Importa CSV |
| `POST` | `/api/admin/elections/[id]/voters` | Associa estudantes à eleição |
| `GET` | `/api/admin/elections/[id]/progress` | Participação ao vivo (sem votos) |
| `GET` | `/api/admin/elections/[id]/results` | Apuração (somente com eleição encerrada) |

### `POST /api/admin/students/import`

Recebe `multipart/form-data` com o CSV `rm,nome,turma`. Processa em modo *dry-run* primeiro:

```jsonc
{
  "dry_run": true,
  "summary": { "total": 412, "to_create": 400, "to_update": 10, "errors": 2 },
  "errors": [
    { "line": 57, "rm": "12345", "message": "RM duplicado no arquivo" },
    { "line": 88, "rm": "",      "message": "RM obrigatório" }
  ]
}
```

O admin revê o resumo e confirma com `commit: true`. RM existente atualiza nome e turma; nunca
duplica aluno. Aceita `;` como separador e detecta BOM UTF-8 — planilhas exportadas do Excel em
português costumam trazer os dois.

### `GET /api/admin/elections/[id]/results`

```jsonc
{
  "election": { "name": "Eleição do Grêmio 2026", "closed_at": "..." },
  "turnout": { "eligible": 450, "voted": 430, "absent": 20, "turnout_pct": 95.56 },
  "positions": [
    {
      "name": "Presidente",
      "candidates": [
        { "number": "15", "name": "João Silva",  "votes": 183, "pct": 42.56 },
        { "number": "23", "name": "Maria Souza", "votes": 147, "pct": 34.19 }
      ],
      "blank_votes": 12,
      "null_votes": 7,
      "total_votes": 430
    }
  ]
}
```

Com a eleição ainda aberta, o endpoint responde 409 `election_not_closed`. Enquanto isso, o painel
usa `/progress`, que expõe apenas quantas pessoas votaram por seção — nunca votos.
