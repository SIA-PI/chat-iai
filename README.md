# Chat IA - Backend

Interface de chat com integração direta à API OpenAI e registro de conversas em SQLite.

## Estrutura do Projeto

```
chat-iai/
├── api/                # Funções serverless (Vercel)
│   └── index.js
├── data/               # Dados e configuração
│   ├── config.js       # Configurações centralizadas
│   ├── db.js           # Módulo SQLite
│   └── chat_history.db # Banco de dados (criado automaticamente)
├── public/             # Frontend estático
├── server.js           # Servidor Express (desenvolvimento local)
└── vercel.json         # Configuração Vercel
```

## Configuração

Crie o arquivo `.env` na raiz do projeto:

```env
OPENAI_API_KEY=sua_chave_api
OPENAI_BASE_URL=https://sua-api.com/v1
OPENAI_MODEL=seu_modelo
PORT=3000
```

## Instalação

```bash
npm install
```

## Uso

### Desenvolvimento Local

```bash
npm run dev
```

### Produção

```bash
npm start
```

## API

### POST /api/chat

Envia mensagem para o chat.

**Body:**
```json
{
  "message": "Sua pergunta",
  "sessionId": "identificador-unico"
}
```

**Resposta:**
```json
{
  "reply": "Resposta do modelo"
}
```

## Modelo de Dados

Tabela `conversations`:
- `id` - ID único
- `session_id` - Identificador da sessão
- `question` - Pergunta do usuário
- `answer` - Resposta do modelo
- `created_at` - Data/hora da criação
