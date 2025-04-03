import { ChatNode } from "./Node";

process.on("SIGTERM", () => {
    console.log("Recebido SIGTERM, encerrando...");
    process.exit(0);
});

async function main() {

    const init_delay = Number(process.env.INIT_DELAY) || 0;

    console.log("Atrasando " + init_delay + "ms para iniciar o nó...");

    await new Promise((resolve) => {
            setTimeout(() => { resolve(true) }, init_delay)
    })

    const n = new ChatNode();

    n.connect()
}

main().catch((err) => {
    console.error("Erro no main:", err);
    process.exit(1);
});