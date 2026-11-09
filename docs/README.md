# Documentação Técnica — Simulador de Urna Eletrônica Escolar

Esta pasta detalha *como* o sistema descrito em
[`../Documentação Inicial — Simulador de Urna Eletrônica Escolar.md`](../Documenta%C3%A7%C3%A3o%20Inicial%20%E2%80%94%20Simulador%20de%20Urna%20Eletr%C3%B4nica%20Escolar.md)
será construído. O documento inicial permanece como a fonte de verdade do **escopo e dos requisitos**;
os arquivos abaixo definem arquitetura, modelo de dados, segurança, contratos de API e plano de implementação.

## Índice

| Documento | Conteúdo |
|---|---|
| [01 — Arquitetura](01-arquitetura.md) | Visão geral, camadas, estrutura de pastas, ambientes |
| [02 — Modelo de Dados](02-modelo-de-dados.md) | Entidades, DDL, chaves, integridade, índices, views de apuração |
| [03 — Segurança, Sigilo e RLS](03-seguranca-sigilo-rls.md) | Modelo de ameaças, sigilo do voto, políticas RLS, segredos |
| [04 — Terminais e Tempo Real](04-terminais-e-realtime.md) | Pareamento por token, canal Realtime privado, fallback |
| [05 — Fluxos e Máquinas de Estado](05-fluxos.md) | Eleição, eleitor, sessão de votação, casos de exceção |
| [06 — API Interna](06-api.md) | Contratos dos Route Handlers, erros, idempotência |
| [07 — Interfaces](07-interfaces.md) | Wireframes das três áreas e regras de UI da urna |
| [08 — Storage de Imagens](08-storage.md) | Buckets, nomenclatura, processamento, URLs assinadas |
| [09 — Rastreabilidade](09-rastreabilidade.md) | RF01–RF30 e RNF01–RNF10 → onde cada um é atendido |
| [10 — Roadmap](10-roadmap.md) | Ordem de implementação, testes e ensaio do dia da eleição |

## Decisões arquiteturais fundamentais

Três decisões orientam todo o restante e não devem ser revertidas sem revisar estes documentos:

1. **Terminais são pareados por token, não por login.** Nenhum aluno ou mesário digita senha no dia
   da eleição. O administrador cadastra o terminal, gera um código de pareamento e o computador guarda
   um token de longa duração. Detalhes em [04](04-terminais-e-realtime.md).
2. **Nenhuma escrita sensível parte do navegador.** Liberar eleitor, registrar voto, abrir e encerrar
   eleição acontecem em Route Handlers do Next.js executados no servidor. O RLS do Supabase é a
   *segunda* barreira, configurado para negar por padrão. Detalhes em [03](03-seguranca-sigilo-rls.md).
3. **O sigilo é garantido pelo esquema, não por disciplina de código.** A tabela `votes` não possui
   — e nunca poderá possuir — coluna que referencie o estudante. O carimbo de tempo do voto é
   deliberadamente impreciso para impedir correlação temporal. Detalhes em
   [02](02-modelo-de-dados.md) e [03](03-seguranca-sigilo-rls.md).
4. **Supabase Cloud, sem banco local.** Dois projetos hospedados — `urna-dev` e `urna-prod` — e o
   esquema é aplicado exclusivamente pela CLI (`supabase db push`), a partir das migrations
   versionadas no repositório. Detalhes em [01](01-arquitetura.md) §6–7.
