import dgram from 'dgram';
import fs from 'fs';
import path from 'path';

import { PORT, MULTICAST_ADDR, randomMessageDrop, randomMessageDelay, getOwnIpAddress, getJoinRequestMaxTentatives, getJoinRequestTimeout, getTokenOwningTimeout } from './Params';
import { MessageUnionSchema } from './Message';
import type { JoinNetworkRequest, JoinNetworkResponse, MessageUnion, PassTokenMessage, ChatMessage, RequestChatMessageHistory, MessageHistoryAnnouncement } from './Message';

enum NetworkStatesEnum {
    UNCONNECTED = 'unconnected',
    CONNECTING = 'connecting',
    TOKEN_OWNING = 'token_owning',
    NO_TOKEN_OWNING = 'no_token_owning',
}

type NetworkState =
    // Estado desconectado
    | { state: NetworkStatesEnum.UNCONNECTED }
    // Estado em que um node já enviou o token para o proximo node, más ainda não recebeu a confirmação
    // de recebimento. Nesse estado o node não se comporta mais como o token owner
    | {
        state: NetworkStatesEnum.CONNECTING,
        join_network_response_timeout: NodeJS.Timeout,   // Armazena o timeout do tempo de espera para resposta
        join_network_response_attempts: number,          // Armazena o número de tentativas de resposta
    }
    // Estado em que o node é o dono do token
    | {
        state: NetworkStatesEnum.TOKEN_OWNING,
        message_index: number,                 // Armazena o index da ultima mensagem enviada
        nodes_ring: string[],                  // Armazena os nós e a ordem deles no ring
        token_owning_timeout: NodeJS.Timeout   // Armazena o timeout do tempo de posse do token
    }
    // Estado em que um node não é dono do token
    | {
        state: NetworkStatesEnum.NO_TOKEN_OWNING,
    }


export class ChatNode {

    readonly node_name: string;
    readonly socket: dgram.Socket;
    private selfIp: string = '';
    private storageFilePath: string;

    private network_state: NetworkState = { state: NetworkStatesEnum.UNCONNECTED };

    private messages: ChatMessage[] = [];

    // Construtor da classe ChatNode
    constructor() {

        // Define o nome do node como o nome do container
        this.node_name = process.env.CONTAINER_NAME ?? 'random-name-' + Math.random().toString(36).substring(7);

        // Cria um socket UDP4
        this.socket = dgram.createSocket({ type: "udp4" });

        // Define o caminho para o arquivo de armazenamento de mensagens
        this.storageFilePath = path.join(__dirname, `../data/${this.node_name}_messages.json`);

        // Garante que o diretório de dados existe
        const dataDir = path.join(__dirname, '../data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }

        // Lê o arquivo de mensagens armazenadas no início, se existir
        this.loadStoredMessages();
    }

    // Carrega mensagens armazenadas do arquivo JSON
    private loadStoredMessages() {
        try {
            if (fs.existsSync(this.storageFilePath)) {
                const data = fs.readFileSync(this.storageFilePath, 'utf8');
                this.messages = JSON.parse(data);
                console.log(`Carregadas ${this.messages.length} mensagens armazenadas do arquivo.`);
            } else {
                console.log("Arquivo de mensagens não encontrado. Iniciando com armazenamento vazio.");
                this.messages = [];
            }
        } catch (error) {
            console.error("Erro ao carregar mensagens armazenadas:", error);
            this.messages = [];
        }
    }

    // Armazena mensagens no array e no arquivo JSON
    storeChatMessage(message: ChatMessage): number {
        // Adiciona a mensagem ao array
        if (!this.messages.some(msg => msg.index === message.index)) {
            this.messages.push(message);
        }

        // Salva o array atualizado no arquivo JSON
        try {
            fs.writeFileSync(this.storageFilePath, JSON.stringify(this.messages, null, 2));
        } catch (error) {
            console.error("Erro ao salvar mensagem no arquivo:", error);
        }

        return this.messages.length;

    }

    // Função chamada após a construção do objeto
    async connect() {

        // Cria uma promessa que se resolve quando o socket estiver ouvindo
        const listening = new Promise((resolve, reject) => {
            this.socket.on('listening', () => { resolve(true) })
        })

        // Vincula o socket à porta
        this.socket.bind(PORT);

        // Aguarda até que o socket esteja ouvindo
        await listening;

        // console.log(`Listening on port ${PORT}`);

        // Se registra para receber mensagens do grupo multicast
        this.socket.addMembership(MULTICAST_ADDR);

        // Obtem e salva seu propio ip
        this.selfIp = getOwnIpAddress();

        this.socket.on('message', (msg, rinfo) => this.handleSocketMessage(msg, rinfo))

        console.log(`Inicializando ${this.node_name}...`);

        // Tenta entrar na network ou inicializar ela
        this.joinNetwork();

    }

    // Envia uma mensagem de entrada na rede e muda o estado do nó para "connecting"
    joinNetwork() {
        if (this.network_state.state === NetworkStatesEnum.UNCONNECTED) {

            const maior_index_conhecido = this.messages.reduce(
                (maior, msg) => Math.max(maior, msg.index),
                0
            );

            const join_network_request: JoinNetworkRequest = {
                type: 'join_network_request',
                sender_name: this.node_name,
            }


            this.send(join_network_request);
            console.log('Enviando requisição de entrada na rede');

            const response_timeout = setTimeout(() => {
                this.handleJoinNetworkResponseTimeout()
            }, getJoinRequestTimeout());

            this.network_state = {
                state: NetworkStatesEnum.CONNECTING,
                join_network_response_attempts: 1,
                join_network_response_timeout: response_timeout,
            };
        }
    }

    // Lida com o timeout da resposta para o request de entrada na rede 
    handleJoinNetworkResponseTimeout() {

        if (this.network_state.state === NetworkStatesEnum.CONNECTING) {

            console.log('Timeout para resposta de entrada na rede');

            // Necessario, para quando a inicialização occorrer, o primeiro container crie a rede mais rapido
            const max_retries = (this.node_name === 'primeiro') ? 1 : getJoinRequestMaxTentatives();

            if (this.network_state.join_network_response_attempts <= max_retries) {

                console.log(`Tentando novamente...`);

                this.network_state.join_network_response_attempts++;

                const join_network_request: JoinNetworkRequest = {
                    type: 'join_network_request',
                    sender_name: this.node_name,
                }

                this.send(join_network_request);

                this.network_state.join_network_response_timeout = setTimeout(() => {
                    this.handleJoinNetworkResponseTimeout()
                }, getJoinRequestTimeout());

            } else {
                console.log('Tentativas de entrar em uma rede esgotadas');

                this.initNetwork();

            }
        }

    }

    // Inicia uma nova rede
    initNetwork() {

        console.log('Iniciando nova rede...');

        this.network_state = {
            state: NetworkStatesEnum.TOKEN_OWNING,
            message_index: this.messages.length,
            nodes_ring: [this.node_name],
            token_owning_timeout: setTimeout(() => {
                this.handleOwningTokenTimeTimeout()
            }, getTokenOwningTimeout()),
        }

        console.log('Rede criada com sucesso');

        this.simulateSendChatMessage()

        return
    }

    // Quando o nó possui o token, ele processa requisições de entrada na rede
    handleJoinNetworkRequest(message: JoinNetworkRequest) {

        if (this.network_state.state === NetworkStatesEnum.TOKEN_OWNING) {

            if (!this.network_state.nodes_ring.includes(message.sender_name)) {
                this.network_state.nodes_ring.push(message.sender_name);
                console.log('Recebido requisição de entrada na rede, novo estado da rede: ', this.network_state.nodes_ring);
            }

            const join_network_response: JoinNetworkResponse = {
                type: 'join_network_response',
                requester_node_name: message.sender_name,
                sender_name: this.node_name,
            }

            this.send(join_network_response);
            this.send(join_network_response);
            this.send(join_network_response);

        }


    }

    // Processa a resposta para um request de entrada na rede
    handleNetworkJoinResponse(message: JoinNetworkResponse) {

        if (message.requester_node_name !== this.node_name) return


        if (this.network_state.state === NetworkStatesEnum.CONNECTING) {

            clearTimeout(this.network_state.join_network_response_timeout);

            const new_state: NetworkState = {
                state: NetworkStatesEnum.NO_TOKEN_OWNING,
            }

            this.network_state = new_state;

            console.log('Recebido resposta de entrada na rede, entrada com sucesso');

        }
    }

    // Lida com o timeout do tempo de posse do token
    handleOwningTokenTimeTimeout() {

        function getNextValue(array: string[], currentValue: string): string {
            const currentIndex = array.indexOf(currentValue);
            return array[(currentIndex + 1) % array.length];
        }


        if (this.network_state.state === NetworkStatesEnum.TOKEN_OWNING) {

            console.log('Tempo de posse do token expirado');

            if (this.network_state.nodes_ring.length < 2) {
                console.log('Unico nó na rede, renovando tempo de posso do token');
                this.network_state.token_owning_timeout = setTimeout(() => {
                    this.handleOwningTokenTimeTimeout()
                }, getTokenOwningTimeout())
                return
            }



            console.log('Iniciando passagem de token');

            const target_name = getNextValue(this.network_state.nodes_ring, this.node_name);

            console.log(`Passando token para o nó ${target_name}`);

            const pass_token_message: PassTokenMessage = {
                type: 'pass_token',
                sender_name: this.node_name,
                target: target_name,
                message_index: this.network_state.message_index,
                node_list: this.network_state.nodes_ring,
            }

            clearTimeout(this.network_state.token_owning_timeout);

            const new_state: NetworkState = {
                state: NetworkStatesEnum.NO_TOKEN_OWNING,
            }

            this.network_state = new_state;

            this.send(pass_token_message)
            this.send(pass_token_message)
            this.send(pass_token_message)

        }
    }

    // Recebe mensagens de passagem de token
    handlePassTokenMessage(message: PassTokenMessage) {

        if (message.target !== this.node_name) return


        if (this.network_state.state === NetworkStatesEnum.NO_TOKEN_OWNING) {
            console.log('Recebida mensagem de passagem de token');

            this.network_state = {
                state: NetworkStatesEnum.TOKEN_OWNING,
                message_index: message.message_index,
                nodes_ring: message.node_list,
                token_owning_timeout: setTimeout(() => {
                    this.handleOwningTokenTimeTimeout()
                }, getTokenOwningTimeout()),
            }

            this.simulateSendChatMessage()

        }

    }

    // Envia mensagens para o grupo multicast
    send(message: MessageUnion) {

        const jsonMessage = JSON.stringify(message);

        this.socket.send(jsonMessage, PORT, MULTICAST_ADDR, (err) => {
            if (err) {
                console.error('Error sending message:', err);
            }
        });

    }

    // Envia mensagens de chat para o grupo multicast
    simulateSendChatMessage() {

        if (this.network_state.state === NetworkStatesEnum.TOKEN_OWNING) {

            this.network_state.message_index++;

            const message: ChatMessage = {
                type: 'chat_message',
                sender_name: this.node_name,
                message: `Mensagem simulada ${Math.random().toString(36).substring(9)}`,
                index: this.network_state.message_index,
            }

            // Armazena a mensagem que está sendo enviada
            this.storeChatMessage(message);

            console.log('Enviando mensagem de chat:', message.message, '| Index da mensagem:', message.index, '| N. msgs: ', this.messages.length);

            this.send(message);
            this.send(message);
            this.send(message);
        }
    }

    // Recebe mensagens de chat
    handleChatMessage(message: ChatMessage) {

        if (this.network_state.state === NetworkStatesEnum.NO_TOKEN_OWNING) {

            if (this.messages.some(msg => msg.index === message.index)) {
                return;
            }

            this.storeChatMessage(message);

            console.log('Recebida mensagem de chat:', message.message, '| Index da mensagem:', message.index, ' | N. msgs: ', this.messages.length);

            if (this.messages.length !== message.index) {
                const missingIndexes = this.verifyChatHistory();
                console.log('Mensagens faltando:', missingIndexes);

                this.sendMessageHistoryRequest();

            }


        }

    }

    // Envia uma requisição para o dono do token, pedindo o histórico de mensagens
    sendMessageHistoryRequest() {

        console.log('Enviando requisição de histórico de mensagens');


        const request_indexes = this.verifyChatHistory();


        const request: RequestChatMessageHistory = {
            type: 'request_chat_message_history',
            sender_name: this.node_name,
            requestedIndexes: request_indexes,
        }

        this.send(request);

    }

    // Recebe requisições de histórico de mensagens
    handleMessageHistoryRequest(message: RequestChatMessageHistory) {

        if (this.network_state.state === NetworkStatesEnum.TOKEN_OWNING) {

            const response: MessageHistoryAnnouncement = {
                type: 'message_history_announcement',
                sender_name: this.node_name,
                messages: this.messages.filter(msg => message.requestedIndexes.includes(msg.index)),
            }

            this.send(response);
        }
    }


    // Recebe mensagens de histórico de mensagens
    handleMessageHistoryResponse(message: MessageHistoryAnnouncement) {

        message.messages.forEach((msg) => {
            if (!this.messages.some(existingMsg => existingMsg.index === msg.index)) {
                this.storeChatMessage(msg);
                console.log('Recebida mensagem de chat atrasada:', msg.message, '| Index da mensagem:', msg.index, ' | N. msgs: ', this.messages.length);
            }
        });
    }

    // Verifica se existem mensagens faltando no histórico
    // Retorna um array com os indexes das mensagens faltando
    verifyChatHistory(): number[] {


        if (this.messages.length === 0) {
            return [];
        }

        const minIndex = 0

        const maxIndex = this.messages.reduce(
            (max, msg) => Math.max(max, msg.index),
            this.messages[0].index
        );

        const existingIndexes = this.messages.map(msg => msg.index);

        const missingIndexes: number[] = [];

        for (let i = minIndex; i <= maxIndex; i++) {
            if (!existingIndexes.includes(i)) {
                missingIndexes.push(i);
            }
        }

        return missingIndexes;
    }

    // Recebe mensagens do socket, simulando delays e perca de pacotes
    handleSocketMessage(msg: Buffer, rinfo: dgram.RemoteInfo) {

        // Ignora mensagens enviadas por si mesmo
        if (this.selfIp === rinfo.address) {
            return;
        }

        // Em vez de receber e processar a mensagem imediatamente,
        // esse if pode causar a simulacao de uma mensagem perdida
        if (randomMessageDrop()) {
            return
        }

        // Enquanto o setTimeout simula um atraso na mensagem
        setTimeout(() => {
            this.handleDelayedMessage(msg, rinfo);
        }, randomMessageDelay());

    }

    // De fato recebe e processa a mensagem
    handleDelayedMessage(msg: Buffer, rinfo: dgram.RemoteInfo) {

        const result = MessageUnionSchema.safeParse(JSON.parse(msg.toString()));

        if (result.error) {
            console.error('Error parsing message:', result.error);
            return;
        }

        const message = result.data;

        switch (message.type) {
            case 'join_network_request':
                this.handleJoinNetworkRequest(message);
                break;
            case 'join_network_response':
                this.handleNetworkJoinResponse(message);
                break;
            case 'pass_token':
                this.handlePassTokenMessage(message);
                break;
            case 'chat_message':
                this.handleChatMessage(message);
                break;
            case 'request_chat_message_history':
                this.handleMessageHistoryRequest(message);
                break;
            case 'message_history_announcement':
                this.handleMessageHistoryResponse(message);
                break;
            
        }
    }

}