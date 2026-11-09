# 08 — Storage de Imagens

## 1. Buckets

| Bucket | Conteúdo | Acesso |
|---|---|---|
| `candidate-photos` | Fotos de candidatos e vices | Privado |
| `student-photos` | Fotos dos estudantes | Privado |

Ambos privados. Fotos de menores de idade não ficam em URL pública adivinhável, e as fotos dos
candidatos seguem a mesma regra por simetria — não há ganho em torná-las públicas.

O acesso se dá por URLs assinadas geradas no servidor, com validade de 1 hora, embutidas nas
respostas da API (`photo_url` em [06](06-api.md)). Nenhuma política de Storage permite leitura por
`anon`; a assinatura é sempre emitida pelo Route Handler que já autorizou o pedido.

## 2. Nomenclatura

```text
candidate-photos/<election_id>/<candidate_id>.webp
candidate-photos/<election_id>/<candidate_id>-vice.webp
student-photos/<student_id>.webp
```

O banco guarda apenas o caminho (`photo_path`), nunca a URL. URLs assinadas expiram; caminhos não.
Fotos de estudante não são agrupadas por eleição: o aluno é reaproveitado entre eleições.

## 3. Processamento antes do upload

Redimensionamento e compressão acontecem **no navegador**, antes de enviar, via `canvas`:

| Parâmetro | Valor |
|---|---|
| Dimensão | 400 × 400 px, recorte central quadrado |
| Formato | WebP, com JPEG como alternativa em navegador antigo |
| Qualidade | 0,82 |
| Tamanho alvo | 30–60 KB por foto |
| Limite aceito no upload | 5 MB antes do processamento |

450 estudantes a ~50 KB somam cerca de 22 MB — folgado dentro do 1 GB do plano Free do Supabase,
mesmo com várias eleições.

O servidor valida o que chega: tipo MIME real (não apenas a extensão), dimensão máxima e tamanho
máximo de 200 KB pós-processamento. Um cliente adulterado não consegue subir arquivo arbitrário.

## 4. Foto do eleitor é opcional

Regra absoluta (RF09, RNF09): nenhuma operação de votação verifica a existência de foto.

- `students.photo_path` é anulável;
- a interface do mesário renderiza avatar com iniciais quando não há foto, no mesmo espaço;
- a importação em lote nunca traz foto — elas são adicionadas depois, quando houver tempo;
- não existe validação, alerta ou bloqueio associado à ausência de foto. O painel apenas informa,
  como estatística, quantos alunos ainda não têm foto.

## 5. Fluxo de upload

```text
ADMIN escolhe arquivo
      ↓
NAVEGADOR valida tipo e tamanho (até 10 MB na entrada)
      ↓
NAVEGADOR recorta ao quadrado central, redimensiona (400×400) e gera WebP
      ↓  ~50 KB
SERVER ACTION uploadPhoto  →  confere os bytes iniciais, envia ao Storage
      ↓                       com service_role e grava photo_path
REVALIDATE da página
```

O caminho do objeto é definido pelo servidor, nunca enviado pelo cliente.

> **Mudança em relação ao desenho original.** A primeira versão deste documento previa URL de upload
> assinada, com o navegador enviando direto ao Storage para não ocupar o payload da função
> serverless. Como o redimensionamento acontece **antes** do envio, o que trafega são ~50 KB — bem
> dentro do limite de 1 MB de uma Server Action. A URL assinada exigiria um cliente Supabase no
> navegador, duas viagens e mais caminhos de erro, sem ganho real nessa escala. Se um dia houver
> upload de originais sem processamento, o desenho assinado volta a fazer sentido.

### Validação no servidor

O `Content-Type` declarado não é levado em conta. A Server Action lê os primeiros bytes e confirma a
assinatura do formato:

| Formato | Bytes iniciais |
|---|---|
| WebP | `52 49 46 46` … `57 45 42 50` (`RIFF`/`WEBP`) |
| JPEG | `FF D8 FF` |
| PNG | `89 50 4E 47` |

Arquivo que não bate com nenhuma delas é recusado, e o bucket ainda impõe o teto de 256 KB por
objeto — um cliente adulterado esbarra nas duas barreiras.

## 6. Substituição e remoção

Trocar uma foto sobrescreve o mesmo caminho (o nome deriva do id, não do arquivo original) e
invalida o cache com um parâmetro de versão na URL assinada. Remover uma foto apaga o objeto e zera
`photo_path`.

Excluir um candidato depois da votação não é permitido ([02](02-modelo-de-dados.md), §4.2), então a
foto também permanece — a apuração precisa exibir o candidato.

## 7. Evoluções previstas

- importação em lote de fotos por arquivo ZIP, casando `<rm>.jpg` com o estudante;
- captura por webcam no próprio painel, para fotografar alunos sem foto no dia do cadastro;
- limpeza periódica de objetos órfãos (arquivo no bucket sem linha correspondente no banco).
