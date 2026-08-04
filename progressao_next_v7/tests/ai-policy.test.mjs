import test from "node:test";
import assert from "node:assert/strict";
import { buildAiInstructions, extractOutputText, parseStructuredAiResponse, validateAiPayload } from "../lib/ai-policy.js";

test("payload limita conversa e preserva modos", () => {
  const result = validateAiPayload({
    task: "post_workout", mode: "analyst", question: "Analise", context: { ok: true },
    conversation: Array.from({ length: 12 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", text: `m${i}` })),
  });
  assert.equal(result.task, "post_workout");
  assert.equal(result.mode, "analyst");
  assert.equal(result.conversation.length, 8);
});

test("instruções proíbem transformar exercício pulado em regressão", () => {
  const instructions = buildAiInstructions({ task: "chat", mode: "coach" });
  assert.match(instructions, /Exercício pulado não é regressão/);
  assert.match(instructions, /e1RM é uma estimativa/);
});

test("extrai e interpreta Structured Output", () => {
  const value = { title: "Treino", summary: "Bom", answer: "Evoluiu", highlights: [], attention: [], recommendation: "Manter", confidence_note: "Base moderada" };
  const raw = { output: [{ content: [{ type: "output_text", text: JSON.stringify(value) }] }] };
  assert.equal(extractOutputText(raw), JSON.stringify(value));
  assert.deepEqual(parseStructuredAiResponse(raw), value);
});
