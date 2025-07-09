import axios from 'axios';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Só POST é permitido');
  }

  const { message, sessionId } = req.body;
  const webhookUrl = process.env.N8N_WEBHOOK_URL;
  if (!webhookUrl) {
    return res.status(500).json({ error: 'N8N_WEBHOOK_URL não configurado' });
  }
  if (!message || !sessionId) {
    return res.status(400).json({ error: 'message e sessionId são obrigatórios' });
  }

  try {
    const { data } = await axios.post(
      webhookUrl,
      { message, sessionId },
      { headers: { 'Content-Type': 'application/json' }, timeout: 45000 }
    );
    if (!data.output) {
      console.error('Resposta do n8n sem campo output:', data);
      return res.status(502).json({ error: 'Resposta inesperada do n8n' });
    }
    return res.status(200).json({ reply: data.output });
  } catch (err) {
    console.error('Erro ao chamar n8n:', err.response?.data || err.message);
    return res.status(502).json({ error: 'Falha ao chamar o serviço de IA' });
  }
}
