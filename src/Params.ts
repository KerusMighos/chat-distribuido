
// Esse arquivo contém as constantes e parâmetros utilizados no projeto


export function randomMessageDrop(): boolean {
    return Math.random() < 0.2;
}

export function randomMessageDelay(): number {
    return 0;
}

export function autoMessagesDelay(): number {
    return (Math.random() * 250) + 250;
}


export const PORT = 5555;

export const MULTICAST_ADDR = "239.255.255.250";

export function getOwnIpAddress(): string {
    const interfaces = require("os").networkInterfaces();
    for (const iface of Object.values(interfaces) as any[]) {
        for (const config of iface || []) {
            if (config.family === "IPv4" && !config.internal) {
                return config.address; // Retorna o primeiro IP externo encontrado
            }
        }
    }
    return "127.0.0.1"; // Caso não encontre, assume localhost
}

export const isMainNode = (): boolean => {

    // O main node tera tempos de espera menores comparardos a nós secundarios
    // Isso tem como objetivo que quando a rede for sofrer uma inicialização fria, ou seja
    // não existe nenhum nó em execução, o nó principal seja o primeiro a entrar na rede e inicializar ela

    // Verifica se o ambiente está configurado para o nó principal
    return process.env.MAIN_NODE === 'true';
    
}

export const isInteractive = (): boolean => {
    // Verifica se o ambiente está configurado para o nó interativo
    return process.env.INTERACTIVE === 'true';
}

export const getBaseDelay = () => {
    return 10;
}

export const getJoinRequestTimeout = () => {
    return 200 * getBaseDelay(); // 2 s
}


export const getJoinRequestMaxTentatives = () => {
    return 3;
}

export const getTokenOwningTimeout = () => {
    return getBaseDelay() * 250 // 2.5 segundos tempo que um no pode ser owner
}



