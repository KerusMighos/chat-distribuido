# Usa a imagem base do Node.js
FROM node:22.14-alpine3.20
# Expõe a porta usada para comunicação (não obrigatória, mas ajuda na documentação)
EXPOSE 5555/udp

# Criar diretório de trabalho
WORKDIR /app

# Instalar TypeScript e ts-node globalmente
RUN npm install -g typescript ts-node tsc

# Copiar package.json e package-lock.json (se existir) antes de instalar dependências
COPY package*.json ./

COPY tsconfig.json ./

# Instalar as dependências do projeto
RUN npm install

# Copiar o código-fonte
COPY src ./src

# Definir o comando de execução
CMD ["ts-node", "src/index.ts"]
