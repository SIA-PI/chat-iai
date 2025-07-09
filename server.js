// server.js

// Importa as bibliotecas necessárias
const express = require('express');
const axios = require('axios'); // Para fazer requisições HTTP para o n8n
const path = require('path');
const cors = require('cors');
require('dotenv').config(); // Carrega as variáveis de ambiente do arquivo .env

// Inicializa a aplicação Express
const app = express();
const PORT = process.env.PORT || 3000;

// --- Middlewares ---
// Habilita o CORS para permitir requisições do frontend
app.use(cors());
// Habilita o parsing de JSON no corpo das requisições
app.use(express.json());
// Serve os arquivos estáticos (HTML, CSS, JS do cliente) da pasta 'public'
app.use(express.static(path.join(__dirname, 'public')));

// --- Rotas ---

/**
 * Rota principal que serve o arquivo HTML do chat.
 */
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

/**
 * Rota da API para interagir com o webhook do n8n.
 * Recebe uma mensagem e um ID de sessão do frontend.
 */
app.post('/api/chat', async (req, res) => {
  // Extrai a mensagem e o ID da sessão do corpo da requisição
  const { message, sessionId } = req.body;
  
  // Pega a URL do webhook do arquivo .env
  const webhookUrl = process.env.N8N_WEBHOOK_URL;

  // Validação: Verifica se a URL do webhook está configurada
  if (!webhookUrl) {
    console.error("A URL do webhook do n8n não está configurada no arquivo .env");
    return res.status(500).json({ 
      error: "Erro de configuração no servidor. A URL do webhook não foi encontrada." 
    });
  }

  // Validação: Verifica se a mensagem e o ID da sessão foram enviados
  if (!message || !sessionId) {
    return res.status(400).json({ error: 'A mensagem e o sessionId são obrigatórios.' });
  }

  // Monta o payload para enviar ao n8n, exatamente como no código Python
  const payload = {
    message: message,
    sessionId: sessionId
  };

  try {
    // Envia a requisição POST para o webhook do n8n usando axios
    const n8nResponse = await axios.post(webhookUrl, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 45000 // Timeout de 45 segundos
    });

    // Extrai o campo 'output' da resposta do n8n
    const output = n8nResponse.data.output;

    // Validação: Verifica se a resposta do n8n contém o campo 'output'
    if (!output) {
        console.error("A resposta do n8n não continha a chave 'output'. Resposta recebida:", n8nResponse.data);
        return res.status(500).json({ error: "Formato de resposta inesperado do serviço de IA." });
    }

    // Envia a resposta extraída de volta para o frontend
    res.json({ reply: output });

  } catch (error) {
    // Tratamento de erros detalhado
    if (error.response) {
      // O servidor do n8n respondeu com um status de erro (4xx, 5xx)
      console.error('Erro na resposta do n8n:', error.response.status, error.response.data);
      res.status(502).json({ error: `Erro ao comunicar com o serviço de IA: ${error.response.status}` });
    } else if (error.request) {
      // A requisição foi feita, mas não houve resposta (ex: timeout, sem conexão)
      console.error('Nenhuma resposta recebida do n8n:', error.request);
      res.status(504).json({ error: 'O serviço de IA demorou muito para responder (Gateway Timeout).' });
    } else {
      // Um erro ocorreu ao configurar a requisição
      console.error('Erro ao configurar a requisição para o n8n:', error.message);
      res.status(500).json({ error: 'Erro interno do servidor ao tentar contatar o serviço de IA.' });
    }
  }
});

// --- Inicialização do Servidor ---
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
