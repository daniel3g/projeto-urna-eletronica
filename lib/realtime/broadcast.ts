import "server-only";

/**
 * Envia um evento de broadcast para o tópico de um terminal.
 *
 * A mensagem NÃO carrega dado nenhum — só avisa "seu estado mudou". Quem recebe
 * busca o estado em /api/terminal/state com o próprio token. É esse payload
 * vazio que torna o canal público defensável (doc 04 §4).
 *
 * Usa o endpoint REST de broadcast em vez do cliente JS: no servidor não faz
 * sentido abrir e manter um WebSocket só para disparar uma mensagem.
 */
export async function notifyTerminal(terminalId: string): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) return false;

  try {
    const response = await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [
          {
            topic: `terminal:${terminalId}`,
            event: "state_changed",
            payload: {},
            private: false,
          },
        ],
      }),
    });

    return response.ok;
  } catch {
    // Falhar aqui não é erro de negócio: o polling de 3 s cobre. Quem chama
    // nunca deve desfazer uma liberação porque o aviso não saiu.
    return false;
  }
}
