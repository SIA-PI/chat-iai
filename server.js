const express = require('express');
const axios = require('axios');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const rateLimit = require('express-rate-limit');
const logger = require('./data/logger');
const { saveConversation, getConversationsBySession } = require('./data/db');
const { config, validateConfig } = require('./data/config');

const app = express();
const PORT = config.server.port;

// Carregar system prompt do agente IAI
let systemPrompt = '';
try {
  systemPrompt = fs.readFileSync(
    path.join(__dirname, 'data', 'Prompt.md'),
    'utf-8'
  );
} catch (err) {
  // Fallback para quando Prompt.md não estiver disponível
  logger.warn('Não foi possível carregar Prompt.md, usando fallback');
  systemPrompt = 'Você é um assistente amigável de IA chamado IAI. Ajude o usuário da melhor forma possível.';
}

// Rate limiter: 20 requisições por 15 minutos por IP
const chatLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas requisições enviadas. Por favor, aguarde 15 minutos antes de tentar novamente.' }
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/api/chat', chatLimiter, async (req, res) => {
  const { message, sessionId, recaptchaToken } = req.body;

  // Validação de entrada
  const trimmedMessage = typeof message === 'string' ? message.trim() : '';
  const trimmedSessionId = typeof sessionId === 'string' ? sessionId.trim() : '';
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (!trimmedMessage || trimmedMessage.length < 1) {
    return res.status(400).json({ error: 'A mensagem não pode estar vazia.' });
  }
  if (trimmedMessage.length > 2000) {
    return res.status(400).json({ error: 'A mensagem não pode ter mais de 2000 caracteres.' });
  }
  if (!trimmedSessionId || !UUID_REGEX.test(trimmedSessionId)) {
    return res.status(400).json({ error: 'O sessionId é inválido ou está ausente.' });
  }
  if (!recaptchaToken) {
    return res.status(400).json({ error: 'Token de verificação ausente. Por favor, tente novamente.' });
  }

  const configErrors = validateConfig();
  if (configErrors.length > 0) {
    logger.error(`Configuração incompleta: ${configErrors.join(', ')}`);
    return res.status(500).json({ error: 'Erro de configuração no servidor.' });
  }

  // Verificação reCAPTCHA
  const isLocalhost = req.hostname === 'localhost' || req.hostname === '127.0.0.1';
  const isDevelopment = process.env.VERCEL !== '1' || isLocalhost;

  if (!isDevelopment) {
    // Em produção: validação rigorosa
    try {
      const verifyResponse = await axios.post(
        'https://www.google.com/recaptcha/api/siteverify',
        null,
        {
          params: {
            secret: config.recaptcha.secretKey,
            response: recaptchaToken,
            remoteip: req.ip
          }
        }
      );
      const { success, score } = verifyResponse.data;
      logger.info(`reCAPTCHA resposta: success=${success}, score=${score || 'N/A'}`);
      if (!success || (score && score < 0.3)) {
        logger.warn(`reCAPTCHA rejeitado — success=${success}, score=${score}, ip=${req.ip}`);
        return res.status(403).json({ error: 'Verificação de segurança falhou. Por favor, tente novamente.' });
      }
    } catch (captchaError) {
      logger.error(`Falha ao verificar reCAPTCHA: ${captchaError.message}`);
      return res.status(503).json({ error: 'Serviço de verificação indisponível. Tente novamente em instantes.' });
    }
  } else {
    // Em desenvolvimento/Vercel: apenas log de debug
    logger.info(`reCAPTCHA skipped (development mode, VERCEL=${process.env.VERCEL || 'undefined'})`);
  }

  const previousConversations = getConversationsBySession(trimmedSessionId, 10);
  const historyMessages = previousConversations.reverse().flatMap(c => [
    { role: 'user', content: c.question },
    { role: 'assistant', content: c.answer }
  ]);

  const messages = [
    { role: 'system', content: systemPrompt },
    ...historyMessages,
    { role: 'user', content: trimmedMessage }
  ];

  try {
    const response = await axios.post(
      `${config.openai.baseUrl}/chat/completions`,
      {
        model: config.openai.model,
        messages: messages,
        temperature: 0.7
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.openai.apiKey}`
        },
        timeout: 60000
      }
    );

    const reply = response.data.choices?.[0]?.message?.content;

    if (!reply) {
      logger.error(`Resposta inválida da API: ${JSON.stringify(response.data)}`);
      return res.status(500).json({ error: 'Resposta inválida do serviço de IA.' });
    }

    saveConversation(trimmedSessionId, trimmedMessage, reply);

    res.json({ reply });

  } catch (error) {
    if (error.response) {
      logger.error(`Erro da API: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
      res.status(502).json({ error: `Erro do serviço de IA: ${error.response.status}` });
    } else if (error.request) {
      logger.warn(`Timeout da API: ${error.message}`);
      res.status(504).json({ error: 'O serviço de IA demorou muito para responder.' });
    } else {
      logger.error(`Erro interno: ${error.message}`);
      res.status(500).json({ error: 'Erro interno do servidor.' });
    }
  }
});

app.post('/api/stream', chatLimiter, async (req, res) => {
  const { message, sessionId, recaptchaToken } = req.body;

  // Validação de entrada
  const trimmedMessage = typeof message === 'string' ? message.trim() : '';
  const trimmedSessionId = typeof sessionId === 'string' ? sessionId.trim() : '';
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (!trimmedMessage || trimmedMessage.length < 1) {
    return res.status(400).json({ error: 'A mensagem não pode estar vazia.' });
  }
  if (trimmedMessage.length > 2000) {
    return res.status(400).json({ error: 'A mensagem não pode ter mais de 2000 caracteres.' });
  }
  if (!trimmedSessionId || !UUID_REGEX.test(trimmedSessionId)) {
    return res.status(400).json({ error: 'O sessionId é inválido ou está ausente.' });
  }
  if (!recaptchaToken) {
    return res.status(400).json({ error: 'Token de verificação ausente. Por favor, tente novamente.' });
  }

  const configErrors = validateConfig();
  if (configErrors.length > 0) {
    logger.error(`Configuração incompleta: ${configErrors.join(', ')}`);
    return res.status(500).json({ error: 'Erro de configuração no servidor.' });
  }

  // Verificação reCAPTCHA
  const isLocalhost = req.hostname === 'localhost' || req.hostname === '127.0.0.1';
  if (!isLocalhost) {
    try {
      const verifyResponse = await axios.post(
        'https://www.google.com/recaptcha/api/siteverify',
        null,
        {
          params: {
            secret: config.recaptcha.secretKey,
            response: recaptchaToken,
            remoteip: req.ip
          }
        }
      );
      const { success, score } = verifyResponse.data;
      logger.info(`reCAPTCHA resposta: success=${success}, score=${score || 'N/A'}`);
      if (!success || (score && score < 0.3)) {
        logger.warn(`reCAPTCHA rejeitado — success=${success}, score=${score}, ip=${req.ip}`);
        return res.status(403).json({ error: 'Verificação de segurança falhou. Por favor, tente novamente.' });
      }
    } catch (captchaError) {
      logger.error(`Falha ao verificar reCAPTCHA: ${captchaError.message}`);
      return res.status(503).json({ error: 'Serviço de verificação indisponível. Tente novamente em instantes.' });
    }
  } else {
    logger.info(`reCAPTCHA skipped em localhost (development mode)`);
  }

  const previousConversations = getConversationsBySession(trimmedSessionId, 10);
  const historyMessages = previousConversations.reverse().flatMap(c => [
    { role: 'user', content: c.question },
    { role: 'assistant', content: c.answer }
  ]);

  const messages = [
    { role: 'system', content: systemPrompt },
    ...historyMessages,
    { role: 'user', content: trimmedMessage }
  ];

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  let fullReply = '';

  try {
    const response = await axios.post(
      `${config.openai.baseUrl}/chat/completions`,
      {
        model: config.openai.model,
        messages: messages,
        temperature: 0.7,
        stream: true
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.openai.apiKey}`
        },
        responseType: 'stream',
        timeout: 60000
      }
    );

    response.data.on('data', (chunk) => {
      const lines = chunk.toString().split('\n').filter(l => l.startsWith('data: '));
      for (const line of lines) {
        const json = line.replace('data: ', '').trim();
        if (json === '[DONE]') {
          res.write('data: [DONE]\n\n');
          return;
        }
        try {
          const parsed = JSON.parse(json);
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) {
            fullReply += delta;
            res.write(`data: ${JSON.stringify({ delta })}\n\n`);
          }
        } catch (_) {}
      }
    });

    response.data.on('end', () => {
      if (fullReply) {
        saveConversation(trimmedSessionId, trimmedMessage, fullReply);
      }
      res.write('data: [DONE]\n\n');
      res.end();
    });

    response.data.on('error', (err) => {
      logger.error(`Erro no stream: ${err.message}`);
      res.write(`data: ${JSON.stringify({ error: 'Erro durante streaming.' })}\n\n`);
      res.end();
    });

  } catch (error) {
    if (error.response) {
      logger.error(`Erro da API no stream: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
      res.write(`data: ${JSON.stringify({ error: `Erro do serviço de IA: ${error.response.status}` })}\n\n`);
    } else if (error.request) {
      logger.warn(`Timeout da API no stream: ${error.message}`);
      res.write(`data: ${JSON.stringify({ error: 'O serviço de IA demorou muito para responder.' })}\n\n`);
    } else {
      logger.error(`Erro interno no stream: ${error.message}`);
      res.write(`data: ${JSON.stringify({ error: 'Erro interno do servidor.' })}\n\n`);
    }
    res.end();
  }
});

app.listen(PORT, () => {
  logger.info(`Servidor rodando em http://localhost:${PORT}`);
});
