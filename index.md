# Documentação do Sistema ChatNode

## Integrantes

- Adriano Victor
- Antônio Salgueiro
- Filipe Ribeiro
- Pedro Victor Hipólito

## Turma 

SAJ-ADS10 - Sistemas Distribuídos - Graduação [60 h/72 Aulas] 

## Visão Geral

`ChatNode` é uma classe que implementa a logica para um nó de um sistema de chat distribuído.
Ela utiliza um arquitetura de maquina de estados para controlar o estado do nó.

### Principais funcionalidades

- Comunicação utilizando udp multicast
- Exclusão mutua através de token ring
- Capacidade dos nós reconciliarem o histórico de mensagens.
- Capacidade de armazenar o estado em arquivos e restaurar na inicialização

## Docker Compose

O docker compose foi utilizado para simular um ambiente em que cada nó estivesse sendo executado em sua propia maquina com seu propio endereço ip, algo essencial para a comunicação multicast.

Como bonus, o docker também foi utilizado para definir variáveis de ambiente e volumes de persistência.

## Estados do Nó

Um nó pode estar em um dos seguintes estados:

| Estado | Descrição |
|--------|-----------|
| `UNCONNECTED` | Nó ainda não está conectado à rede |
| `CONNECTING` | Nó está tentando se conectar à rede |
| `TOKEN_OWNING` | Nó possui o token e pode enviar mensagens |
| `NO_TOKEN_OWNING` | Nó não possui o token e apenas recebe mensagens |

## Tipos de Mensagem

- `JoinNetworkRequest`: Solicitação para entrar na rede
- `JoinNetworkResponse`: Resposta a uma solicitação de entrada
- `PassTokenMessage`: Transferência do token entre nós
- `ChatMessage`: Mensagem de chat enviada na rede
- `RequestChatMessageHistory`: Solicitação de histórico de mensagens
- `MessageHistoryAnnouncement`: Resposta com histórico de mensagens

## Fluxo de Operação

### Inicialização de um Nó

1. O nó é criado com um nome (normalmente definido pela variável de ambiente `CONTAINER_NAME`)
2. Um socket UDP é criado e vinculado à porta definida
3. O nó carrega mensagens anteriores do armazenamento local
4. O nó tenta se juntar a uma rede existente

### Entrada na Rede

1. O nó envia uma mensagem `JoinNetworkRequest`
2. Se um nó com token receber a solicitação, ele adiciona o novo nó ao anel e responde com `JoinNetworkResponse`
3. Se não houver resposta após várias tentativas, o nó assume que é o primeiro na rede e inicializa uma nova rede

### Passagem de Token

1. Um nó pode possuir o token por um tempo limitado (`getTokenOwningTimeout()`)
2. Após esse tempo, o nó passa o token para o próximo nó no anel
3. A mensagem `PassTokenMessage` inclui o índice atual de mensagens e a lista atualizada de nós

### Envio de Mensagens

1. Apenas o nó que possui o token pode enviar mensagens de chat
2. Cada mensagem possui um índice único e incremental
3. As mensagens são enviadas em triplicata para reduzir chance de perda

### Recuperação de Mensagens Perdidas

1. Cada nó verifica a sequência de índices das mensagens recebidas
2. Se faltarem mensagens, o nó envia uma solicitação `RequestChatMessageHistory`
3. O nó com token responde com as mensagens faltantes via `MessageHistoryAnnouncement`

## Simulação de Condições de Rede

O sistema simula condições reais de rede:
- Atrasos de mensagem (`randomMessageDelay()`)
- Perda de pacotes (`randomMessageDrop()`)

## Persistência de Dados

- As mensagens são armazenadas em arquivos JSON no diretório `data/`
- Cada nó mantém seu próprio arquivo de armazenamento: `[nome_do_nó]_messages.json`
- As mensagens são carregadas na inicialização e salvas quando recebidas

## Tolerância a Falhas

- Mensagens importantes são enviadas em triplicata
- Sistema de recuperação de mensagens perdidas
- Timeouts para detectar falhas na conexão

## Implementação Técnica

### Dependências

- `dgram`: Módulo Node.js para comunicação UDP
- `fs`: Sistema de arquivos para persistência
- `path`: Manipulação de caminhos de arquivo

### Parâmetros de Configuração

- `PORT`: Porta UDP para comunicação
- `MULTICAST_ADDR`: Endereço de multicast para a rede
- `getJoinRequestMaxTentatives()`: Número máximo de tentativas de conexão
- `getJoinRequestTimeout()`: Tempo de espera por resposta de conexão
- `getTokenOwningTimeout()`: Tempo máximo de posse do token

## Exemplo de Uso

```javascript
// Criar um nó
const node = new ChatNode();

// Conectar à rede
await node.connect();

// O sistema automaticamente:
// - Tenta entrar em uma rede existente
// - Cria uma nova rede se necessário
// - Envia mensagens simuladas quando possui o token
// - Armazena mensagens recebidas
```

## Analise do log de execução

O log completo pode ser encontrado no arquivo logs.txt e nas imagens dentro da pasta /logs_imagens

### Limpeza

O comando `docker compose down --volumes` é utilizado para apagar todos os dados das execuções anteriores.

```
engineer@notebook:~/codes/atividadesFaculdade/atividadeSistemasDistribuidos/atividade3$ docker compose down --volumes 
WARN[0000] /home/engineer/codes/atividadesFaculdade/atividadeSistemasDistribuidos/atividade3/docker-compose.yaml: `version` is obsolete 
[+] Running 7/7
 ✔ Container atividade3-primeiro-1       Removed                                                                                                 0.0s 
 ✔ Container atividade3-segundo-1        Removed                                                                                                 0.0s 
 ✔ Container atividade3-terceiro-1       Removed                                                                                                 0.0s 
 ✔ Volume atividade3_volume_terceiro_no  Removed                                                                                                 0.0s 
 ✔ Volume atividade3_volume_primeiro_no  Removed                                                                                                 0.0s 
 ✔ Volume atividade3_volume_segundo_no   Removed                                                                                                 0.0s 
 ✔ Network atividade3_udp_network        Removed  

```

### Execução

O comando `docker compose up --build --remove-orphans` cria, inicia os container, e conecta o saída deles ao terminal

```
engineer@notebook:~/codes/atividadesFaculdade/atividadeSistemasDistribuidos/atividade3$ docker compose up --build --remove-orphans 
WARN[0000] /home/engineer/codes/atividadesFaculdade/atividadeSistemasDistribuidos/atividade3/docker-compose.yaml: `version` is obsolete 

(Processo de build, ocultado para melhorar a legibilidade, consulte o arquivo logs.txt)

[+] Running 7/7
 ✔ Network atividade3_udp_network          Created                                                                                               0.1s 
 ✔ Volume "atividade3_volume_terceiro_no"  Created                                                                                               0.0s 
 ✔ Volume "atividade3_volume_primeiro_no"  Created                                                                                               0.0s 
 ✔ Volume "atividade3_volume_segundo_no"   Created                                                                                               0.0s 
 ✔ Container atividade3-terceiro-1         Created                                                                                               0.1s 
 ✔ Container atividade3-segundo-1          Created                                                                                               0.1s 
 ✔ Container atividade3-primeiro-1         Created                                                                                               0.1s 
Attaching to primeiro-1, segundo-1, terceiro-1
```

### Inicialização

```
segundo-1   | Atrasando 10000ms para iniciar o nó...         //Cada nó inicializa com um pouco de atraso 
                                                                para simular os nós entrado na rede em diferentes momentos
primeiro-1  | Atrasando 0ms para iniciar o nó...
primeiro-1  | Arquivo de mensagens não encontrado. Iniciando com armazenamento vazio.     // Nó verifica se o arquivo de backup possui dados
primeiro-1  | Inicializando primeiro...
primeiro-1  | Enviando requisição de entrada na rede                                      // Tenta entrar na rede
terceiro-1  | Atrasando 20000ms para iniciar o nó...
primeiro-1  | Timeout para resposta de entrada na rede                                    // Tempo de resposta se esgota
primeiro-1  | Tentando novamente...                                                       // Tenta novamente
primeiro-1  | Timeout para resposta de entrada na rede
primeiro-1  | Tentativas de entrar em uma rede esgotadas                                  // Tentativas de entrada se esgotam
primeiro-1  | Iniciando nova rede...                                                      // Inicia a rede sendo ele o token owner
primeiro-1  | Rede criada com sucesso
primeiro-1  | Enviando mensagem de chat: Mensagem simulada 02mg | Index da mensagem: 1 | N. msgs:  1     // Como é o token owner,
                                                                                                            pode enviar mensagens 
primeiro-1  | Tempo de posse do token expirado                                            // O tempo de posse do token acaba
primeiro-1  | Unico nó na rede, renovando tempo de posso do token                         // Como é o unico nó na rede, renova seu tempo de posse
primeiro-1  | Tempo de posse do token expirado
primeiro-1  | Unico nó na rede, renovando tempo de posso do token

```

### Entrada de outros nós na rede

Quando o segundo nó inicializa, a rede já foi inicializada pelo primeiro, então a solicitação de entrada na rede é respondida pelo token owener, que na ocasião é o primeiro nó


```
segundo-1   | Inicializando segundo...
segundo-1   | Enviando requisição de entrada na rede
primeiro-1  | Recebido requisição de entrada na rede, novo estado da rede:  [ 'primeiro', 'segundo' ]
segundo-1   | Recebido resposta de entrada na rede, entrada com sucesso

```

### Passagem de token e envio de mensagens

O tempo de posse do primeiro acaba, más dessa vez a rede possui outro integrante, então o primeiro nó envia uma mensagem para o segundo informando que ele é o novo token owner

```
primeiro-1  | Tempo de posse do token expirado
primeiro-1  | Iniciando passagem de token
primeiro-1  | Passando token para o nó segundo
segundo-1   | Recebida mensagem de passagem de token

```

Logo após virar token owner, o segundo nó pode enviar mensagens

```
segundo-1   | Enviando mensagem de chat: Mensagem simulada bqlr | Index da mensagem: 2 | N. msgs:  1
primeiro-1  | Recebida mensagem de chat: Mensagem simulada bqlr | Index da mensagem: 2  | N. msgs:  2
```

### Reconciliação

Toda mensagem trocada possui um índice linearmente incrementado (0, 1, 2, 3, etc)

Sempre que um nó recebe uma mensagem, ele verifica se ele já possui todas as mensagens com índice menor a essa que ele recebeu

Se ele detectar que estão faltando mensagens, ele envia uma solicitação de histórico que é processada pelo token owner,
recebe as mensagens que não possui e faz a reconciliação


```
segundo-1   | Recebida mensagem de chat: Mensagem simulada 19rd | Index da mensagem: 3  | N. msgs:  2
segundo-1   | Mensagens faltando: [ 0, 1 ]
segundo-1   | Enviando requisição de histórico de mensagens
segundo-1   | Recebida mensagem de chat atrasada: Mensagem simulada 02mg | Index da mensagem: 1  | N. msgs:  3

```

#### Terceiro nó

Observe que como o terceiro nó entra por ultimo, foram trocadas 5 mensagens antes dele entrar,
que são recuperadas por ele através desse processo

```
primeiro-1  | Enviando mensagem de chat: Mensagem simulada r9tm | Index da mensagem: 8 | N. msgs:  8
terceiro-1  | Recebida mensagem de chat: Mensagem simulada r9tm | Index da mensagem: 8  | N. msgs:  3  // Terceiro nó possui 5 mensagens a menos
segundo-1   | Recebida mensagem de chat: Mensagem simulada r9tm | Index da mensagem: 8  | N. msgs:  8
terceiro-1  | Mensagens faltando: [ 0, 1, 2, 3, 4, 5 ]
terceiro-1  | Enviando requisição de histórico de mensagens
terceiro-1  | Recebida mensagem de chat atrasada: Mensagem simulada 02mg | Index da mensagem: 1  | N. msgs:  4
terceiro-1  | Recebida mensagem de chat atrasada: Mensagem simulada bqlr | Index da mensagem: 2  | N. msgs:  5
terceiro-1  | Recebida mensagem de chat atrasada: Mensagem simulada 19rd | Index da mensagem: 3  | N. msgs:  6
terceiro-1  | Recebida mensagem de chat atrasada: Mensagem simulada kvp | Index da mensagem: 4  | N. msgs:  7
terceiro-1  | Recebida mensagem de chat atrasada: Mensagem simulada fm1f | Index da mensagem: 5  | N. msgs:  8
primeiro-1  | Tempo de posse do token expirado
primeiro-1  | Iniciando passagem de token
primeiro-1  | Passando token para o nó segundo
segundo-1   | Recebida mensagem de passagem de token
segundo-1   | Enviando mensagem de chat: Mensagem simulada yn8q | Index da mensagem: 9 | N. msgs:  9   // Reconciliação completa
terceiro-1  | Recebida mensagem de chat: Mensagem simulada yn8q | Index da mensagem: 9  | N. msgs:  9  // Observe que todos os nós possuem 9 mensagens
primeiro-1  | Recebida mensagem de chat: Mensagem simulada yn8q | Index da mensagem: 9  | N. msgs:  9
```

### Desligamento dos nós

Os nós são desligados:

```
primeiro-1  | Enviando mensagem de chat: Mensagem simulada xho | Index da mensagem: 11 | N. msgs:  11
terceiro-1  | Recebida mensagem de chat: Mensagem simulada xho | Index da mensagem: 11  | N. msgs:  11
segundo-1   | Recebida mensagem de chat: Mensagem simulada xho | Index da mensagem: 11  | N. msgs:  11
^CGracefully stopping... (press Ctrl+C again to force)
[+] Stopping 3/3
 ✔ Container atividade3-primeiro-1  Stopped                                                                                                      0.3s 
 ✔ Container atividade3-segundo-1   Stopped                                                                                                      0.4s 
 ✔ Container atividade3-terceiro-1  Stopped                                                                                                      0.3s 
canceled
```

### E iniciados novamente

```
engineer@notebook:~/codes/atividadesFaculdade/atividadeSistemasDistribuidos/atividade3$ docker compose up --build --remove-orphans 
[+] Running 3/0
 ✔ Container atividade3-primeiro-1  Created                                                                                                      0.0s 
 ✔ Container atividade3-terceiro-1  Created                                                                                                      0.0s 
 ✔ Container atividade3-segundo-1   Created                                                                                                      0.0s 
Attaching to primeiro-1, segundo-1, terceiro-1
```

### Carregamento das mensagens salvas

Dessa vez o nó carrega 11 mensagens do arquivo de salvamento

```
primeiro-1  | Atrasando 0ms para iniciar o nó...
primeiro-1  | Carregadas 11 mensagens armazenadas do arquivo.
primeiro-1  | Inicializando primeiro...
```

Observer o terceiro nó iniciando, recuperando 11 mensagens, e reconciliando as novas mensagens

```
terceiro-1  | Carregadas 11 mensagens armazenadas do arquivo.
terceiro-1  | Inicializando terceiro...
terceiro-1  | Enviando requisição de entrada na rede
primeiro-1  | Recebido requisição de entrada na rede, novo estado da rede:  [ 'primeiro', 'segundo', 'terceiro' ]
terceiro-1  | Recebido resposta de entrada na rede, entrada com sucesso
primeiro-1  | Tempo de posse do token expirado
primeiro-1  | Iniciando passagem de token
primeiro-1  | Passando token para o nó segundo
segundo-1   | Recebida mensagem de passagem de token
segundo-1   | Enviando mensagem de chat: Mensagem simulada yf1r | Index da mensagem: 17 | N. msgs:  17
primeiro-1  | Recebida mensagem de chat: Mensagem simulada yf1r | Index da mensagem: 17  | N. msgs:  17
terceiro-1  | Recebida mensagem de chat: Mensagem simulada yf1r | Index da mensagem: 17  | N. msgs:  12
terceiro-1  | Mensagens faltando: [ 0, 12, 13, 14, 15, 16 ]
terceiro-1  | Enviando requisição de histórico de mensagens
terceiro-1  | Recebida mensagem de chat atrasada: Mensagem simulada c05i | Index da mensagem: 13  | N. msgs:  13
terceiro-1  | Recebida mensagem de chat atrasada: Mensagem simulada r7qk | Index da mensagem: 14  | N. msgs:  14
terceiro-1  | Recebida mensagem de chat atrasada: Mensagem simulada wu02 | Index da mensagem: 12  | N. msgs:  15
terceiro-1  | Recebida mensagem de chat atrasada: Mensagem simulada 0ji9 | Index da mensagem: 15  | N. msgs:  16
terceiro-1  | Recebida mensagem de chat atrasada: Mensagem simulada y93f | Index da mensagem: 16  | N. msgs:  17
```
