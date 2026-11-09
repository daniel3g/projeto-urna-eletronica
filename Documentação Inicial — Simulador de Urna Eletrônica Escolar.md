# Documentação Inicial — Simulador de Urna Eletrônica Escolar

## 1. Visão Geral

O projeto consiste no desenvolvimento de uma aplicação web para simular o funcionamento de uma eleição utilizando uma urna eletrônica.

A aplicação será utilizada em um projeto de eleição realizado na escola e terá como objetivo reproduzir, de forma simplificada, o fluxo de identificação do eleitor, liberação pelo mesário, votação em urna eletrônica e apuração dos resultados.

O sistema será desenvolvido utilizando **Next.js** no front-end e back-end da aplicação e **Supabase** para banco de dados, autenticação, armazenamento de imagens e comunicação em tempo real.

---

## 2. Objetivo do Projeto

Desenvolver um sistema capaz de gerenciar uma eleição escolar, permitindo:

- cadastrar eleições;
- cadastrar os cargos disponíveis em cada eleição;
- cadastrar candidatos;
- cadastrar eleitores;
- cadastrar seções eleitorais;
- utilizar diferentes computadores como terminais de mesário e urnas;
- identificar o eleitor pelo RM;
- liberar o eleitor para votação;
- realizar a votação em uma interface semelhante a uma urna eletrônica;
- impedir que um mesmo eleitor vote mais de uma vez;
- registrar votos sem associar o candidato escolhido ao eleitor;
- contabilizar votos válidos, brancos e nulos;
- apresentar os resultados após o encerramento da eleição.

---

## 3. Tecnologias Previstas

### Aplicação

- Next.js
- TypeScript
- React

### Banco de Dados e Serviços

- Supabase PostgreSQL
- Supabase Auth
- Supabase Storage
- Supabase Realtime

### Hospedagem

Inicialmente poderão ser utilizados serviços gratuitos, incluindo:

- Vercel para a aplicação Next.js;
- plano Free do Supabase para banco de dados e demais serviços.

---

# 4. Perfis de Usuário

O sistema deverá possuir diferentes níveis de acesso.

## 4.1 Administrador

Responsável pela configuração da eleição.

Principais permissões:

- criar e editar eleições;
- cadastrar cargos;
- cadastrar candidatos;
- cadastrar ou importar eleitores;
- cadastrar seções;
- configurar terminais;
- acompanhar o andamento da eleição;
- abrir e encerrar a eleição;
- visualizar resultados.

---

## 4.2 Mesário

Utilizará o **Terminal do Mesário**.

O mesário será responsável por:

1. receber o eleitor;
2. solicitar ou consultar seu RM;
3. localizar o estudante no sistema;
4. conferir seus dados;
5. verificar se ele ainda não votou;
6. liberar o eleitor para votação;
7. encaminhá-lo para a urna correspondente.

O mesário não terá acesso ao voto registrado pelo estudante.

---

## 4.3 Eleitor

Utilizará o **Terminal do Eleitor**, simulando a urna eletrônica.

O eleitor não precisará realizar login.

Após ser autorizado pelo mesário, a urna correspondente será liberada automaticamente para iniciar a votação.

---

# 5. Estrutura Geral da Aplicação

Inicialmente a aplicação será dividida em três áreas principais:

```text
/admin
/mesario
/urna
```

## Área Administrativa

Responsável por todos os cadastros e configurações da eleição.

## Terminal do Mesário

Responsável pela identificação e liberação do eleitor.

## Terminal da Urna

Responsável exclusivamente pela votação.

---

# 6. Eleições

O sistema deverá permitir a existência de diferentes eleições.

Exemplos:

- Eleição do Grêmio Estudantil 2026;
- Eleição de Representantes de Sala;
- Eleição Simulada;
- Eleição Escolar 2027.

Cada eleição terá seus próprios:

- cargos;
- candidatos;
- eleitores participantes;
- seções;
- votos;
- resultados.

Estados inicialmente previstos para uma eleição:

```text
Rascunho
Aberta
Encerrada
```

Enquanto estiver em **Rascunho**, poderão ser realizadas configurações e cadastros.

Quando estiver **Aberta**, os terminais poderão realizar a votação.

Depois de **Encerrada**, novos votos não poderão ser registrados.

---

# 7. Cadastro de Cargos

Os cargos não serão fixos no código.

O administrador poderá determinar quais cargos existirão em cada eleição.

Exemplo:

| Ordem | Cargo | Dígitos |
|---:|---|---:|
| 1 | Presidente | 2 |
| 2 | Governador | 2 |
| 3 | Senador | 3 |

Em uma eleição de grêmio, por exemplo:

| Ordem | Cargo | Dígitos |
|---:|---|---:|
| 1 | Presidente | 2 |
| 2 | Secretário | 2 |
| 3 | Diretor de Esportes | 2 |

Cada cargo deverá possuir pelo menos:

- nome;
- quantidade de dígitos;
- ordem de votação;
- eleição associada;
- status ativo/inativo.

A ordem determinará a sequência apresentada na urna.

---

# 8. Cadastro de Candidatos

Cada candidato será associado a:

- uma eleição;
- um cargo;
- um número.

Dados inicialmente previstos:

- nome;
- número;
- cargo;
- foto;
- partido ou chapa;
- sigla;
- nome do vice, quando aplicável;
- foto do vice, quando aplicável;
- status ativo/inativo.

Exemplo:

```text
Cargo: Presidente
Número: 15
Nome: João Silva
Chapa: Futuro da Escola
Vice: Maria Souza
```

As fotos dos candidatos serão armazenadas utilizando o Supabase Storage.

A foto do candidato será considerada parte importante da experiência de votação.

---

# 9. Cadastro de Eleitores

Os estudantes serão cadastrados separadamente das eleições.

Cada estudante poderá possuir:

- ID interno;
- RM;
- nome;
- turma;
- foto;
- status ativo/inativo.

O **RM será utilizado como identificador escolar do eleitor**, não como senha.

O estudante poderá existir no sistema independentemente de estar associado a determinada eleição.

---

# 10. Fotos dos Eleitores

A estrutura do sistema permitirá armazenar fotos dos estudantes.

Entretanto, a foto do eleitor será **opcional**.

Essa decisão permite iniciar a eleição mesmo caso não haja tempo de cadastrar as fotografias de todos os estudantes.

Quando houver foto:

```text
[FOTO DO ALUNO]

João Pedro Silva
RM: 123456
Turma: 1º INFO
```

Quando não houver:

```text
[AVATAR PADRÃO]

João Pedro Silva
RM: 123456
Turma: 1º INFO
```

A ausência da foto nunca deverá impedir que o estudante vote.

---

# 11. Importação dos Eleitores

Como poderá existir uma quantidade elevada de estudantes, o sistema deverá permitir importação em lote.

Formato inicial previsto:

```csv
rm,nome,turma
12345,Ana Silva,1 INFO
12346,Carlos Souza,1 INFO
12347,Pedro Santos,2 INFO
```

As fotografias poderão ser adicionadas posteriormente.

---

# 12. Participação do Eleitor em uma Eleição

O cadastro do estudante será separado de sua participação em uma eleição.

Exemplo:

```text
STUDENT
João Silva
RM 12345
```

poderá participar de:

```text
Eleição do Grêmio 2026
Eleição de Representante 2026
Eleição do Grêmio 2027
```

Para isso será criada uma estrutura intermediária semelhante a:

```text
election_voters
```

Ela será responsável por registrar:

- eleição;
- estudante;
- seção;
- situação da votação;
- momento da liberação;
- momento da conclusão da votação.

---

# 13. Status do Eleitor

Durante uma eleição, o eleitor poderá passar pelos seguintes estados:

```text
AGUARDANDO
     ↓
LIBERADO
     ↓
VOTANDO
     ↓
VOTOU
```

### Aguardando

O eleitor ainda não passou pelo terminal do mesário.

### Liberado

O mesário confirmou sua identificação e autorizou o início da votação.

### Votando

A urna iniciou a sessão de votação daquele eleitor.

### Votou

O eleitor concluiu todos os cargos disponíveis na eleição.

Depois desse estado, uma nova votação não poderá ser iniciada para o mesmo eleitor.

---

# 14. Seções Eleitorais

O sistema poderá trabalhar com uma ou várias seções.

Exemplo:

```text
Seção 01 – Laboratório de Informática

Seção 02 – Sala de Tecnologia
```

Os estudantes poderão ser previamente associados a uma seção.

Isso permitirá utilizar várias urnas simultaneamente.

---

# 15. Terminais

Os computadores utilizados durante a eleição poderão ser registrados como terminais.

Inicialmente existirão dois tipos:

```text
Terminal do Mesário
Terminal da Urna
```

Exemplo:

```text
Seção 01
├── Terminal Mesário 01
└── Urna 01

Seção 02
├── Terminal Mesário 02
└── Urna 02
```

A liberação de um eleitor deverá estar associada à seção ou urna correspondente.

Isso evita que uma urna diferente inicie a votação por engano.

---

# 16. Fluxo do Terminal do Mesário

O fluxo inicialmente previsto será:

```text
ELEITOR CHEGA À SEÇÃO
        ↓
INFORMA O RM
        ↓
MESÁRIO DIGITA O RM
        ↓
SISTEMA LOCALIZA O ESTUDANTE
        ↓
EXIBE DADOS DO ELEITOR
        ↓
MESÁRIO CONFERE A IDENTIDADE
        ↓
SISTEMA VERIFICA SE JÁ VOTOU
        ↓
MESÁRIO LIBERA O ELEITOR
        ↓
URNA CORRESPONDENTE É LIBERADA
```

Dados exibidos ao mesário:

- foto, quando cadastrada;
- nome;
- RM;
- turma;
- seção;
- situação eleitoral.

Caso o estudante já tenha votado, o sistema não permitirá nova liberação.

---

# 17. Comunicação entre Mesário e Urna

O sistema utilizará o **Supabase Realtime** para comunicação entre os computadores.

Exemplo:

```text
TERMINAL DO MESÁRIO

RM 12345
↓
LIBERAR ELEITOR

        ↓

SUPABASE
status = released

        ↓
      Realtime

        ↓

URNA 01

ELEITOR LIBERADO
INICIAR VOTAÇÃO
```

Dessa forma, o eleitor não precisará informar novamente seu RM na urna.

---

# 18. Terminal da Urna

Enquanto nenhum eleitor estiver autorizado, a urna permanecerá em uma tela de espera.

Exemplo:

```text
URNA ELETRÔNICA

AGUARDANDO LIBERAÇÃO
```

Após a liberação:

```text
INICIANDO VOTAÇÃO
```

A urna apresentará os cargos de acordo com a ordem cadastrada pelo administrador.

---

# 19. Interface da Votação

A interface deverá simular visualmente uma urna eletrônica.

Exemplo:

```text
PRESIDENTE

Número:

[ 1 ][ 5 ]

JOÃO SILVA

[FOTO]

CHAPA: FUTURO DA ESCOLA

VICE:
MARIA SOUZA

BRANCO

CORRIGE          CONFIRMA
```

Também deverá existir um teclado numérico:

```text
1   2   3

4   5   6

7   8   9

    0
```

Botões principais:

```text
BRANCO
CORRIGE
CONFIRMA
```

---

# 20. Identificação do Candidato

Enquanto o eleitor digita o número, o sistema procurará um candidato correspondente ao cargo atual.

Quando o número for válido, serão apresentados:

- nome;
- foto;
- número;
- cargo;
- partido/chapa;
- vice, quando existir;
- foto do vice, quando existir.

---

# 21. Voto Branco

O eleitor poderá selecionar a opção:

```text
BRANCO
```

Depois deverá confirmar sua escolha.

O voto será registrado como voto branco para aquele cargo.

---

# 22. Voto Nulo

Caso o número informado não corresponda a nenhum candidato cadastrado para aquele cargo, a urna deverá apresentar:

```text
NÚMERO ERRADO

VOTO NULO
```

O eleitor poderá:

- corrigir o número;
- confirmar o voto nulo.

---

# 23. Confirmação do Voto

Depois da confirmação de um cargo, a urna avançará automaticamente para o próximo cargo.

Exemplo:

```text
Presidente
   ↓
CONFIRMA
   ↓
Secretário
   ↓
CONFIRMA
   ↓
Representante
   ↓
CONFIRMA
   ↓
FIM
```

Depois do último cargo será apresentada a tela:

```text
FIM
```

Nesse momento o eleitor será marcado como:

```text
VOTOU
```

e a urna retornará ao estado:

```text
AGUARDANDO LIBERAÇÃO
```

---

# 24. Sigilo do Voto

Um dos princípios do sistema será separar:

```text
QUEM VOTOU
```

de:

```text
EM QUEM VOTOU
```

O sistema poderá registrar que determinado estudante concluiu a votação, mas não deverá armazenar uma relação direta entre eleitor e candidato escolhido.

Portanto, a tabela responsável pelos votos **não deverá possuir o ID do estudante**.

Exemplo inadequado:

```text
student_id
candidate_id
```

Esse tipo de relacionamento não deverá existir.

---

# 25. Registro dos Votos

Cada voto poderá armazenar:

- eleição;
- cargo;
- candidato, quando aplicável;
- tipo do voto;
- data/hora do registro.

Tipos previstos:

```text
candidate
blank
null
```

Em português:

```text
Candidato
Branco
Nulo
```

---

# 26. Apuração

Após o encerramento da eleição, o administrador poderá acessar os resultados.

A apuração deverá permitir visualizar, por cargo:

- total de votos;
- votos por candidato;
- votos brancos;
- votos nulos;
- quantidade de eleitores aptos;
- quantidade de estudantes que votaram;
- quantidade de estudantes que não votaram;
- percentual de participação.

Exemplo:

```text
Presidente

João Silva ................. 183 votos
Maria Souza ................ 147 votos
Carlos Lima ................  81 votos

Brancos ....................  12
Nulos ......................   7

Total ...................... 430
```

---

# 27. Estrutura Inicial do Banco de Dados

As principais entidades previstas são:

```text
users
students
elections
positions
candidates
election_voters
sections
terminals
votes
```

Relacionamento conceitual inicial:

```text
ELECTION
│
├── POSITIONS
│      │
│      └── CANDIDATES
│
├── SECTIONS
│      │
│      └── TERMINALS
│
├── ELECTION_VOTERS
│      │
│      └── STUDENTS
│
└── VOTES
       │
       ├── POSITION
       └── CANDIDATE
```

Não existirá relacionamento entre:

```text
VOTES
   ↓
STUDENTS
```

preservando o sigilo da votação.

---

# 28. Armazenamento de Imagens

Inicialmente serão armazenadas:

- fotografias dos candidatos;
- fotografias dos vices;
- fotografias dos eleitores.

As imagens serão armazenadas no Supabase Storage.

Poderão ser utilizados buckets separados, por exemplo:

```text
candidate-photos
student-photos
```

As imagens deverão ser redimensionadas e comprimidas antes ou durante o upload para evitar armazenamento desnecessário.

Uma resolução aproximada de:

```text
400 × 400 pixels
```

já será suficiente para a finalidade do sistema.

---

# 29. Requisitos Funcionais Iniciais

**RF01 —** O sistema deve permitir cadastrar eleições.

**RF02 —** O sistema deve permitir cadastrar cargos para uma eleição.

**RF03 —** O sistema deve permitir determinar a ordem dos cargos.

**RF04 —** O sistema deve permitir determinar a quantidade de dígitos de cada cargo.

**RF05 —** O sistema deve permitir cadastrar candidatos.

**RF06 —** O sistema deve permitir armazenar fotografia dos candidatos.

**RF07 —** O sistema deve permitir cadastrar estudantes.

**RF08 —** O sistema deve utilizar o RM como identificador escolar do estudante.

**RF09 —** O sistema deve permitir fotografia opcional para o estudante.

**RF10 —** O sistema deve permitir importar estudantes em lote.

**RF11 —** O sistema deve permitir associar estudantes a uma eleição.

**RF12 —** O sistema deve permitir organizar estudantes em seções.

**RF13 —** O sistema deve permitir cadastrar terminais.

**RF14 —** O mesário deve poder localizar um estudante utilizando seu RM.

**RF15 —** O mesário deve poder visualizar os dados do estudante antes de liberá-lo.

**RF16 —** O sistema deve impedir que um estudante vote mais de uma vez.

**RF17 —** O mesário deve poder liberar o estudante para votação.

**RF18 —** A urna deve detectar a liberação do eleitor.

**RF19 —** A urna deve apresentar os cargos na ordem configurada.

**RF20 —** A urna deve identificar candidatos pelo número.

**RF21 —** A urna deve exibir os dados do candidato encontrado.

**RF22 —** A urna deve permitir voto branco.

**RF23 —** A urna deve permitir voto nulo.

**RF24 —** A urna deve permitir corrigir o número digitado.

**RF25 —** A urna deve exigir confirmação antes de registrar o voto.

**RF26 —** Após o último cargo, o sistema deve concluir a votação do eleitor.

**RF27 —** O sistema deve registrar que o estudante votou.

**RF28 —** O voto registrado não deve possuir vínculo com o estudante.

**RF29 —** O sistema deve permitir encerrar uma eleição.

**RF30 —** O sistema deve permitir realizar a apuração.

---

# 30. Requisitos Não Funcionais Iniciais

**RNF01 —** A aplicação deverá funcionar através de navegador web.

**RNF02 —** A interface da urna deverá ser simples e adequada para utilização em tela cheia.

**RNF03 —** O sistema deverá funcionar em diferentes computadores conectados à internet ou rede com acesso ao Supabase.

**RNF04 —** A comunicação entre mesário e urna deverá ocorrer praticamente em tempo real.

**RNF05 —** O sistema deverá impedir alterações indevidas nos dados através das regras de acesso do Supabase.

**RNF06 —** O terminal da urna não deverá possuir acesso administrativo.

**RNF07 —** O terminal do mesário não deverá possuir acesso aos votos individuais.

**RNF08 —** O sistema não deverá permitir identificar em qual candidato determinado eleitor votou.

**RNF09 —** A ausência da fotografia do eleitor não poderá impedir a votação.

**RNF10 —** A aplicação deverá possuir tratamento para perda temporária de comunicação com o banco de dados antes da confirmação do voto.

---

# 31. Escopo Inicial — MVP

Para a primeira versão funcional, serão priorizados:

1. cadastro de eleição;
2. cadastro dos cargos;
3. cadastro dos candidatos;
4. cadastro/importação dos estudantes;
5. associação dos estudantes à eleição;
6. terminal do mesário;
7. identificação pelo RM;
8. liberação do eleitor;
9. comunicação Realtime;
10. terminal da urna;
11. votação por número;
12. voto branco;
13. voto nulo;
14. confirmação;
15. bloqueio de voto duplicado;
16. registro anônimo dos votos;
17. encerramento da eleição;
18. apuração.

Recursos adicionais poderão ser implementados posteriormente.

---

# 32. Possíveis Evoluções

Após a primeira versão poderão ser adicionados:

- impressão ou geração de comprovantes administrativos;
- relatórios em PDF;
- painel de participação em tempo real;
- múltiplas eleições simultâneas;
- cadastro de partidos e chapas como entidades próprias;
- auditoria das ações dos administradores e mesários;
- importação de candidatos;
- importação automática das fotos dos estudantes;
- personalização visual da eleição;
- sons semelhantes aos da urna eletrônica;
- tela cheia automática;
- teclado físico dedicado;
- geração de boletim de urna;
- QR Code para configuração dos terminais;
- modo de demonstração;
- eleições simuladas para uso em aulas;
- relatórios históricos de eleições anteriores.

---

# 33. Princípios do Projeto

O desenvolvimento deverá seguir alguns princípios básicos:

### Reutilização

O sistema não será criado exclusivamente para uma única eleição.

Cargos, candidatos e regras deverão ser configuráveis.

### Simplicidade

O fluxo utilizado no dia da eleição deverá exigir poucas ações dos mesários e eleitores.

### Segurança

O sistema deverá impedir votos duplicados e acessos não autorizados.

### Sigilo

O sistema deverá saber **se o estudante votou**, mas nunca deverá ser capaz de determinar **em quem o estudante votou**.

### Flexibilidade

As fotografias dos eleitores serão previstas desde a primeira versão, mas não serão obrigatórias.

### Experiência

A interface da urna deverá se aproximar visual e funcionalmente da experiência de uma urna eletrônica, preservando a simplicidade necessária para o ambiente escolar.

---

# 34. Próximas Etapas de Desenvolvimento

Com a documentação inicial definida, as próximas etapas recomendadas são:

1. definir definitivamente as entidades do banco;
2. elaborar o modelo relacional;
3. definir todas as chaves e relacionamentos;
4. definir regras de integridade;
5. definir políticas RLS do Supabase;
6. modelar o mecanismo de liberação entre mesário e urna;
7. definir como cada terminal será autenticado;
8. detalhar o fluxo completo da votação;
9. criar wireframes das interfaces;
10. iniciar a implementação do banco de dados;
11. iniciar o projeto Next.js;
12. desenvolver o painel administrativo;
13. desenvolver o terminal do mesário;
14. desenvolver o terminal da urna;
15. realizar testes simulando múltiplos terminais.