const MAX_QUESTION_LENGTH = 1200;
const MAX_CONTEXT_CHARS = 90000;
const MAX_CONVERSATION_ITEMS = 8;

export function clampText(value, maxLength) {
  return String(value ?? "").trim().slice(0, maxLength);
}

export function validateAiPayload(payload = {}) {
  const task = payload.task === "post_workout" ? "post_workout" : "chat";
  const mode = payload.mode === "analyst" ? "analyst" : "coach";
  const question = clampText(payload.question, MAX_QUESTION_LENGTH);
  if (task === "chat" && !question) throw new Error("Escreva uma pergunta sobre seus treinos.");

  const conversation = Array.isArray(payload.conversation)
    ? payload.conversation.slice(-MAX_CONVERSATION_ITEMS).map(item => ({
        role: item?.role === "assistant" ? "assistant" : "user",
        text: clampText(item?.text, 1200),
      })).filter(item => item.text)
    : [];

  const context = payload.context && typeof payload.context === "object" ? payload.context : {};
  const contextText = JSON.stringify(context);
  if (contextText.length > MAX_CONTEXT_CHARS) throw new Error("O contexto do treino ficou grande demais. Refine a pergunta.");

  return { task, mode, question, conversation, context, contextText };
}

export function buildAiInstructions({ task, mode }) {
  const voice = mode === "analyst"
    ? "Seja uma analista objetiva, técnica, direta e sem motivação vazia."
    : "Seja uma coach firme, acolhedora e prática, sem bajulação nem frases genéricas.";
  const taskRule = task === "post_workout"
    ? "Analise principalmente o treino recém-concluído, comparando-o com a sessão anterior da mesma rotina e com o histórico global de cada exercício."
    : "Responda exatamente à pergunta do usuário usando somente os dados fornecidos.";

  return `Você é a camada de análise do aplicativo Progressão, especializado em treino de força e hipertrofia.
${voice}
${taskRule}

REGRAS OBRIGATÓRIAS:
- Use somente os dados estruturados enviados. Nunca invente carga, repetição, data, tendência ou causa.
- Diferencie claramente fato medido de hipótese. Diga "pode", "sugere" ou "é compatível" quando houver incerteza.
- Compare exercícios em dois contextos quando disponível: histórico global entre todas as rotinas e histórico dentro da mesma rotina/posição.
- Considere que a posição do exercício pode alterar o desempenho por fadiga; não trate isso como prova causal.
- Exercício pulado não é regressão nem desempenho zero.
- e1RM é uma estimativa para comparação, não uma medição direta de força máxima.
- Não dê diagnóstico médico. Se houver dor, recomende interromper o movimento doloroso e procurar avaliação profissional quando persistente, intensa ou acompanhada de sinais preocupantes.
- Não altere rotinas nem prescreva mudanças radicais com base em uma sessão isolada.
- Responda em português do Brasil.
- Seja específica e curta: priorize o que muda a próxima decisão do usuário.`;
}

export const AI_RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    summary: { type: "string" },
    answer: { type: "string" },
    highlights: { type: "array", items: { type: "string" } },
    attention: { type: "array", items: { type: "string" } },
    recommendation: { type: "string" },
    confidence_note: { type: "string" },
  },
  required: ["title", "summary", "answer", "highlights", "attention", "recommendation", "confidence_note"],
};

export function extractOutputText(response) {
  if (typeof response?.output_text === "string" && response.output_text.trim()) return response.output_text.trim();
  const parts = [];
  for (const item of response?.output || []) {
    for (const content of item?.content || []) {
      if (content?.type === "output_text" && typeof content.text === "string") parts.push(content.text);
    }
  }
  return parts.join("\n").trim();
}

export function parseStructuredAiResponse(response) {
  const text = extractOutputText(response);
  if (!text) throw new Error("A IA não devolveu conteúdo.");
  try {
    return JSON.parse(text);
  } catch {
    return {
      title: "Análise",
      summary: text,
      answer: text,
      highlights: [],
      attention: [],
      recommendation: "",
      confidence_note: "Resposta recebida em formato livre.",
    };
  }
}
