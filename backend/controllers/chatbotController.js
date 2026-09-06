const N8N_TIMEOUT_MS = Number(process.env.N8N_WEBHOOK_TIMEOUT_MS) || 15000;
const FALLBACK_REPLY = "Sorry, I'm having trouble connecting right now. Please try again in a moment.";

/**
 * POST /api/chatbot/message
 *
 * Proxies the user's message to an n8n workflow webhook and returns
 * the bot reply. The n8n webhook URL and optional bearer token live
 * in environment variables — never exposed to the mobile client.
 *
 * Request body:  { message: string, sessionId: string }
 * Response body: { reply: string, sessionId: string }
 */
exports.sendMessage = async (req, res) => {
  const { message, sessionId } = req.body;

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({ error: 'message is required' });
  }
  if (!sessionId || typeof sessionId !== 'string') {
    return res.status(400).json({ error: 'sessionId is required' });
  }

  const webhookUrl = process.env.N8N_WEBHOOK_URL;
  if (!webhookUrl) {
    console.error('[chatbot] N8N_WEBHOOK_URL is not configured');
    return res.status(200).json({
      reply: 'The assistant is not configured yet. Please ask your admin to set up the n8n workflow.',
      sessionId,
    });
  }

  const webhookKey = process.env.N8N_WEBHOOK_KEY;
  const headers = { 'Content-Type': 'application/json' };
  if (webhookKey) {
    headers['Authorization'] = `Bearer ${webhookKey}`;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), N8N_TIMEOUT_MS);

  try {
    const n8nResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ message: message.trim(), sessionId }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!n8nResponse.ok) {
      console.error(`[chatbot] n8n webhook returned ${n8nResponse.status}`);
      return res.status(200).json({ reply: FALLBACK_REPLY, sessionId });
    }

    const data = await n8nResponse.json();

    // n8n may return the reply in various shapes — normalise to { reply }
    const reply =
      data.reply ||
      data.message ||
      data.output ||
      data.text ||
      (typeof data === 'string' ? data : FALLBACK_REPLY);

    return res.status(200).json({
      reply: String(reply),
      sessionId: data.sessionId || sessionId,
    });
  } catch (err) {
    clearTimeout(timeout);

    if (err.name === 'AbortError') {
      console.error(`[chatbot] n8n webhook timed out after ${N8N_TIMEOUT_MS}ms`);
    } else {
      console.error(`[chatbot] n8n webhook error: ${err.message}`);
    }

    return res.status(200).json({ reply: FALLBACK_REPLY, sessionId });
  }
};
