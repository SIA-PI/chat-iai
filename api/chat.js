// api/index.js

// Importa as bibliotecas necessárias
const express = require('express');
const axios = require('axios');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

// Inicializa a aplicação Express
const app = express();

// --- Middlewares ---
app.use(cors());
app.use(express.json());
// Não precisamos mais servir arquivos estáticos daqui, a Vercel fará isso.

// --- Rota da API ---
app.post('/api/chat', async (req, res) => {
  const { message, sessionId } = req.body;
  const webhookUrl = process.env.N8N_WEBHOOK_URL;

  if (!webhookUrl) {
    console.error("A URL do webhook do n8n não está configurada.");
    return res.status(500).json({ 
      error: "Erro de configuração no servidor." 
    });
  }

  if (!message || !sessionId) {
    return res.status(400).json({ error: 'A mensagem e o sessionId são obrigatórios.' });
  }

  const payload = {
    message: message,
    sessionId: sessionId
  };

  try {
    const n8nResponse = await axios.post(webhookUrl, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 45000
    });

    const output = n8nResponse.data.output;

    if (output === undefined) {
        console.error("A resposta do n8n não continha a chave 'output'.", n8nResponse.data);
        return res.status(500).json({ error: "Formato de resposta inesperado do serviço de IA." });
    }

    res.json({ reply: output });

  } catch (error) {
    console.error('Erro ao comunicar com o n8n:', error.message);
    res.status(502).json({ error: 'Ocorreu um erro ao comunicar com o serviço de IA.' });
  }
});

// --- Exportação para a Vercel ---
// Removemos o app.listen e exportamos o app para a Vercel lidar com ele.
module.exports = app;
