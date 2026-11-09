# 07 — Interfaces

## 1. Princípios de interface

| Área | Usuário | Contexto de uso | Prioridade |
|---|---|---|---|
| `/admin` | Professor / organizador | Sentado, com tempo, antes da eleição | Densidade e clareza dos dados |
| `/mesario` | Estudante mesário | Em pé, com fila, repetindo centenas de vezes | Velocidade: uma tela, um campo, Enter |
| `/urna` | Estudante eleitor | Sozinho, 60 segundos, primeira e única vez | Reconhecimento imediato da urna real |

A urna é a única tela com identidade visual própria. Admin e mesário usam a mesma base de
componentes, discreta e funcional.

## 2. Terminal do mesário

```text
┌──────────────────────────────────────────────────────────────┐
│  Eleição do Grêmio 2026        Seção 01 · Mesário 01    ● ok │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│   RM DO ELEITOR                                              │
│   ┌────────────────────────────────┐                         │
│   │ 12345▌                         │   [ BUSCAR ]            │
│   └────────────────────────────────┘                         │
│   não sabe o RM? buscar por nome                             │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  ┌──────────┐   JOÃO PEDRO SILVA                       │  │
│  │  │          │   RM 12345 · 1º INFO                     │  │
│  │  │  FOTO    │   Seção 01 — Laboratório de Informática  │  │
│  │  │          │                                          │  │
│  │  └──────────┘   ● AGUARDANDO VOTAÇÃO                   │  │
│  │                                                        │  │
│  │   Urna:  ( • ) Urna 01     (   ) Urna 02 — em votação  │  │
│  │                                                        │  │
│  │            [  LIBERAR ELEITOR  ]     [ cancelar ]      │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  Liberados nesta seção: 87    ·    Faltam: 63                │
└──────────────────────────────────────────────────────────────┘
```

Estados do cartão do eleitor:

```text
● AGUARDANDO VOTAÇÃO      verde    → botão LIBERAR ativo
● LIBERADO NA URNA 01     âmbar    → botão CANCELAR LIBERAÇÃO
● EM VOTAÇÃO NA URNA 01   azul     → sem ação
● JÁ VOTOU ÀS 10H         cinza    → botão desabilitado, motivo em destaque
```

Após liberar, uma confirmação de 2 segundos ("Encaminhe para a **Urna 01**") e o foco volta
sozinho para o campo de RM. O mesário nunca precisa clicar para atender o próximo da fila.

Sem foto cadastrada, o espaço da foto exibe um avatar com as iniciais — do mesmo tamanho, para que
o layout não dance entre um eleitor e outro:

```text
┌──────────┐
│          │
│    JS    │      JOÃO PEDRO SILVA
│          │      RM 12345 · 1º INFO
└──────────┘
```

## 3. Terminal da urna

Tela cheia, fundo escuro, sem barra de navegação, sem botão de voltar. Tipografia grande o
suficiente para ser lida a um metro de distância.

### Espera

```text
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│                                                              │
│                   URNA ELETRÔNICA                            │
│                                                              │
│              AGUARDANDO LIBERAÇÃO                            │
│                                                              │
│                                                              │
│                                                              │
│  Urna 01 · Seção 01                                    ● ok  │
└──────────────────────────────────────────────────────────────┘
```

### Votação

```text
┌──────────────────────────────────────────────────────────────┐
│  PRESIDENTE                                        1 de 3    │
│                                                              │
│  Seu voto para PRESIDENTE                                    │
│                                                              │
│  NÚMERO:   ┌───┐ ┌───┐                    ┌────────────────┐ │
│            │ 1 │ │ 5 │                    │                │ │
│            └───┘ └───┘                    │      FOTO      │ │
│                                           │                │ │
│  NOME:  JOÃO SILVA                        │                │ │
│  CHAPA: FUTURO DA ESCOLA                  └────────────────┘ │
│                                                              │
│  VICE:  MARIA SOUZA                       ┌────────┐         │
│                                           │  FOTO  │         │
│                                           └────────┘         │
│                                                              │
│  ─────────────────────────────────────────────────────────   │
│  Aperte a tecla:                                             │
│  CONFIRMA para confirmar este voto                           │
│  CORRIGE para digitar de novo                                │
│                                                              │
│      ┌───┐┌───┐┌───┐                                         │
│      │ 1 ││ 2 ││ 3 │      ┌─────────┐                        │
│      ├───┤├───┤├───┤      │ BRANCO  │                        │
│      │ 4 ││ 5 ││ 6 │      ├─────────┤                        │
│      ├───┤├───┤├───┤      │ CORRIGE │                        │
│      │ 7 ││ 8 ││ 9 │      ├─────────┤                        │
│      ├───┴┬──┴┬───┤       │ CONFIRMA│                        │
│      │    │ 0 │   │       └─────────┘                        │
│      └────┴───┴───┘                                          │
└──────────────────────────────────────────────────────────────┘
```

Cores dos botões, seguindo a urna real: BRANCO em branco, CORRIGE em laranja, CONFIRMA em verde.

### Voto nulo

```text
│  NÚMERO:   ┌───┐ ┌───┐                                       │
│            │ 9 │ │ 9 │                                       │
│            └───┘ └───┘                                       │
│                                                              │
│            NÚMERO ERRADO                                     │
│                                                              │
│            VOTO NULO                                         │
│                                                              │
│  Se confirmar, seu voto para PRESIDENTE será NULO.           │
│  Aperte CORRIGE para digitar outro número.                   │
```

### Voto branco

```text
│                                                              │
│                      BRANCO                                  │
│                                                              │
│  Se confirmar, seu voto para PRESIDENTE será EM BRANCO.      │
│  Aperte CORRIGE para escolher um número.                     │
```

### Fim

```text
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│                                                              │
│                        FIM                                   │
│                                                              │
│              Obrigado por votar!                             │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

Exibida por 3 segundos, com o som característico, e a urna volta sozinha para a espera. Não há
botão: o eleitor não precisa fazer nada além de sair.

### Regras de UI da urna

- entrada em tela cheia solicitada no primeiro toque da tela de espera (a API do navegador exige
  gesto do usuário);
- clique direito, seleção de texto, arrastar e atalhos de navegação desativados;
- `beforeunload` bloqueia recarregar acidental durante a votação;
- nenhuma animação de transição entre cargos além do avanço direto — a urna real é seca, e isso
  faz parte do reconhecimento;
- sem cursor visível: a interação é por toque ou teclado.

## 4. Painel administrativo

```text
┌───────────────┬──────────────────────────────────────────────┐
│ ELEIÇÕES      │  Eleição do Grêmio 2026            RASCUNHO  │
│ Estudantes    │  ─────────────────────────────────────────── │
│               │                                              │
│ ─ Grêmio 2026 │  Pronta para abrir?                          │
│   Cargos      │  ✓ 3 cargos ativos                           │
│   Candidatos  │  ✓ 7 candidatos                              │
│   Seções      │  ✓ 2 seções                                  │
│   Eleitores   │  ✗ Urna 02 não foi pareada                   │
│   Terminais   │  ✓ 450 eleitores associados                  │
│   Apuração    │                                              │
│               │            [ ABRIR ELEIÇÃO ]  (desabilitado) │
└───────────────┴──────────────────────────────────────────────┘
```

O checklist de prontidão é a tela mais importante do painel: é ela que evita descobrir na hora que
falta cadastrar algo.

### Acompanhamento durante a votação

```text
┌──────────────────────────────────────────────────────────────┐
│  Eleição do Grêmio 2026                            ABERTA    │
│                                                              │
│  Participação                                                │
│  ████████████████████░░░░░░░░  312 / 450   (69,3%)           │
│                                                              │
│  Seção 01   ████████████░░░░  180 / 250      Urna 01  ● livre│
│  Seção 02   ██████████░░░░░░  132 / 200      Urna 02  ● votando│
│                                                              │
│  Terminais                                                   │
│  Mesário 01   há 2 s      Urna 01   há 1 s                   │
│  Mesário 02   há 3 s      Urna 02   há 1 s                   │
│                                                              │
│                        [ ENCERRAR ELEIÇÃO ]                  │
└──────────────────────────────────────────────────────────────┘
```

Esta tela **não** mostra votos, nem parciais, nem por candidato. Só pessoas e máquinas.

### Apuração

```text
┌──────────────────────────────────────────────────────────────┐
│  PRESIDENTE                                                  │
│                                                              │
│  João Silva          ████████████████████  183   42,6%       │
│  Maria Souza         ████████████████      147   34,2%       │
│  Carlos Lima         █████████              81   18,8%       │
│                                                              │
│  Brancos ............  12    2,8%                            │
│  Nulos ..............   7    1,6%                            │
│  ─────────────────────────────                               │
│  Total ..............  430                                   │
│                                                              │
│  Comparecimento: 430 de 450 eleitores (95,6%)                │
└──────────────────────────────────────────────────────────────┘
```

Disponível somente com a eleição encerrada. Modo de projeção (tela cheia, um cargo por vez) para
divulgar o resultado no auditório.

## 5. Acessibilidade e responsividade

- contraste mínimo AA em todas as telas; a urna usa contraste alto por padrão;
- alvos de toque de no mínimo 48 px na urna e no terminal do mesário;
- a urna assume tela de no mínimo 1024×768 (laboratório escolar) e não pretende ser responsiva
  para celular — é um equipamento fixo;
- o painel administrativo funciona em tablet, para o organizador circular pelas seções.
