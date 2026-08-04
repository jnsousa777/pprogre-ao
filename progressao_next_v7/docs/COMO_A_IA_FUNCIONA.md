# Como a IA do Progressão funciona

## Chat

Quando você pergunta “como está minha Scott?”, o navegador:

1. encontra o exercício global `Rosca Scott`;
2. carrega o histórico detalhado dele;
3. inclui os contextos Upper 1 e Upper 2, com posição, séries e e1RM;
4. envia um resumo limitado à rota privada `/api/ai`;
5. a rota valida sua sessão do Supabase e chama a OpenAI no servidor.

Perguntas gerais recebem métricas de frequência, sessões recentes, tendências e resumos dos exercícios. O banco inteiro não é enviado indiscriminadamente.

## Pós-treino

Ao finalizar uma sessão, a IA recebe:

- sessão recém-concluída;
- comparação com a sessão anterior da mesma rotina;
- comparação global de cada exercício;
- exercícios pulados;
- posição dos movimentos no treino;
- tendências relevantes.

## Limitações importantes

- e1RM é estimativa.
- Posição no treino é contexto, não prova de causalidade.
- Uma sessão ruim não prova regressão estrutural.
- A IA não diagnostica lesões nem substitui avaliação profissional.
- O custo da API depende do modelo, do volume de perguntas e do tamanho do contexto.
