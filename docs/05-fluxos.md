# 05 — Fluxos e Máquinas de Estado

## 1. Estado da eleição

```text
        ┌──────────┐  abrir   ┌────────┐  encerrar  ┌──────────┐
        │ RASCUNHO │─────────►│ ABERTA │───────────►│ ENCERRADA│
        └──────────┘          └────────┘            └──────────┘
             ▲                                            │
             └──────────────── (não existe) ──────────────┘
```

Não há volta. Reabrir uma eleição encerrada tornaria a apuração contestável; se algo der errado, a
saída é criar uma nova eleição.

**Pré-condições para abrir** (todas verificadas no servidor, com a lista de pendências devolvida ao
admin):

- ao menos um cargo ativo;
- todo cargo ativo com ao menos um candidato ativo;
- todo candidato com número do tamanho exigido pelo cargo;
- ao menos uma seção;
- ao menos uma urna pareada e um terminal de mesário pareado;
- ao menos um eleitor associado.

**Efeitos de abrir:** `status = 'open'`, `opened_at = now()`, cadastros estruturais congelados
pelos triggers.

**Efeitos de encerrar:** `status = 'closed'`, `closed_at = now()`, novas inserções em `votes`
rejeitadas pelo banco, sessões em andamento invalidadas, apuração liberada. Encerrar exige
confirmação por digitação do nome da eleição.

## 2. Estado do eleitor

```text
AGUARDANDO ──libera──► LIBERADO ──urna inicia──► VOTANDO ──último cargo──► VOTOU
    ▲                      │                        │                        │
    └──cancelar────────────┘                        │                    (terminal)
    └──────────timeout / cancelar────────────────────┘
```

| Transição | Quem dispara | Efeitos |
|---|---|---|
| `waiting → released` | Mesário | grava `released_at`, `ballot_box_terminal_id`, `released_by_terminal_id`, gera token de sessão |
| `released → voting` | Urna, ao iniciar | grava `voting_started_at` |
| `voting → voted` | Urna, após o último cargo | grava `voted_at` (truncado na hora), zera token de sessão |
| `released → waiting` | Mesário (cancelar) | limpa liberação; só permitido antes de a urna iniciar |
| `voting → waiting` | Admin (destravar) | ação excepcional, registrada em auditoria; ver §6 |

`voted` é terminal. Nenhuma operação reabre a votação de um eleitor (RF16, RF27).

## 3. Fluxo do terminal do mesário

```text
ELEITOR CHEGA
     ↓
MESÁRIO DIGITA O RM ──────► não encontrado ──► "RM não localizado"
     ↓                                          (busca alternativa por nome)
SISTEMA EXIBE O ELEITOR
  foto (ou avatar), nome, RM, turma, seção, situação
     ↓
MESÁRIO CONFERE A IDENTIDADE
     ↓
SITUAÇÃO?
  ├── já votou ──────────► bloqueado: "Este eleitor já votou às 10h"
  ├── liberado ──────────► "Já liberado na Urna 02" + opção de cancelar
  ├── votando ───────────► "Em votação na Urna 02" (sem ação)
  └── aguardando ────────► botão LIBERAR habilitado
     ↓
ESCOLHE A URNA (auto-selecionada se a seção tiver só uma livre)
     ↓
LIBERAR ──► urna desbloqueia ──► "Encaminhe para a Urna 01"
     ↓
TELA VOLTA AO CAMPO DE RM (foco automático)
```

Detalhes de interface que importam no dia:

- o campo de RM recebe foco automaticamente e é submetido com Enter — o mesário não usa o mouse no
  caminho principal;
- a foto do eleitor, quando existe, ocupa espaço generoso: é o instrumento de conferência;
- sem foto, aparece um avatar com as iniciais e a conferência é feita pelo nome e turma. A ausência
  de foto **nunca** bloqueia (RNF09);
- urnas ocupadas aparecem na lista como indisponíveis, com o rótulo "em votação".

## 4. Fluxo do terminal da urna

```text
       ┌──────────────────────┐
       │ AGUARDANDO LIBERAÇÃO │◄──────────────────────┐
       └──────────┬───────────┘                       │
                  │ broadcast / polling               │
                  ▼                                   │
       ┌──────────────────────┐                       │
       │  INICIANDO VOTAÇÃO   │  (2 s, sem interação) │
       └──────────┬───────────┘                       │
                  ▼                                   │
       ┌──────────────────────┐                       │
       │  CARGO n de N        │                       │
       │  digita → confirma   │──► próximo cargo ──┐  │
       └──────────┬───────────┘◄───────────────────┘  │
                  │ último cargo confirmado           │
                  ▼                                   │
       ┌──────────────────────┐                       │
       │         FIM          │  (3 s)                │
       └──────────┬───────────┘───────────────────────┘
```

### Digitação de um cargo

```text
estado inicial: buffer vazio, nenhum candidato

DÍGITO      → acrescenta ao buffer se ainda não atingiu N dígitos
              ao completar N, busca o candidato do cargo pelo número:
                encontrado     → exibe nome, foto, chapa, vice
                não encontrado → exibe "NÚMERO ERRADO / VOTO NULO"
CORRIGE     → limpa o buffer e o candidato; volta ao estado inicial
BRANCO      → só quando o buffer está vazio; marca voto branco
CONFIRMA    → só quando o buffer está completo ou BRANCO está marcado
```

Regras que evitam erro do eleitor:

- CONFIRMA é ignorado com o número incompleto — nada acontece, sem mensagem de erro;
- BRANCO com dígitos já digitados é ignorado; o eleitor precisa CORRIGIR antes;
- o voto nulo por número inexistente exige uma confirmação explícita, com o aviso em destaque;
- teclado físico numérico é aceito, além do teclado na tela (Enter = CONFIRMA, Delete/Backspace =
  CORRIGE, Espaço = BRANCO).

### Registro do voto

Cada CONFIRMA envia uma requisição ao servidor, que em **uma transação**:

1. valida a sessão e que `position_order == positions_completed + 1`;
2. insere a linha em `votes`;
3. incrementa `positions_completed`;
4. se era o último cargo, marca `status = 'voted'` e `voted_at`.

Um voto por vez, gravado na hora. Não há acúmulo local nem envio em lote no fim — o que garante
que uma queda no meio da sessão não perca os cargos já confirmados.

## 5. Falhas e recuperação

| Situação | Comportamento |
|---|---|
| Rede cai antes do CONFIRMA | Nada foi enviado; a tela continua utilizável e o eleitor confirma quando voltar |
| Rede cai durante o CONFIRMA | A urna exibe "Registrando voto..." e repete a requisição a cada 2 s, até 30 s |
| Resposta perdida após gravar | O reenvio traz `position_order` já concluído; o servidor responde `already_recorded` e a urna avança — sem voto duplicado |
| Falha após 30 s | Tela "Falha de comunicação — chame o mesário", com botão de nova tentativa. O voto não foi perdido: os cargos anteriores estão gravados |
| Navegador da urna fechado no meio | Ao reabrir, o token de terminal retoma a sessão exatamente no cargo seguinte |
| Eleitor desiste e sai | O mesário aciona o admin; ver §6 |

A idempotência não precisa de tabela extra: `positions_completed` é o próprio controle. Uma
requisição repetida para um cargo já concluído é reconhecida e respondida com sucesso.

## 6. Casos excepcionais

**Eleitor liberado que desistiu ou foi embora.** A sessão expira em 10 minutos
(`session_expires_at`). Um job leve — executado sob demanda a cada consulta de estado da urna —
devolve o eleitor expirado para `waiting` e libera a urna. Se ele já havia confirmado alguns
cargos, esses votos permanecem: são anônimos e não podem ser identificados para remoção.

**Urna travada com eleitor em `voting`.** O admin usa "Destravar urna" no painel de terminais. A
ação devolve o eleitor a `waiting`, registra em auditoria e exige justificativa. Os cargos já
votados continuam contados; ao retomar, o eleitor segue do ponto em que parou.

**Aluno não cadastrado que apareceu para votar.** Com a eleição aberta o admin ainda pode
cadastrar o estudante e associá-lo à eleição. Cargos e candidatos, não — estão congelados.

**Dois mesários liberam ao mesmo tempo.** O índice parcial no banco faz a segunda operação falhar;
o segundo mesário vê "Esta urna já está ocupada" e escolhe outra.
