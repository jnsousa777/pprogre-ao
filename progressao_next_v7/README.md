# Progressão Next v7

Aplicativo mobile-first de treino com **Next.js + Vercel + Supabase + OpenAI**.

## O que a IA faz

- Chat sobre seu próprio histórico de treino.
- Análise automática ao finalizar uma sessão.
- Distingue a comparação **mesma rotina × mesma rotina** da comparação **global do exercício entre rotinas**.
- Considera a posição do exercício como contexto de fadiga.
- Não trata exercício pulado como regressão.
- Busca histórico detalhado somente dos exercícios e rotinas relevantes à pergunta.
- Modos **Coach** e **Analista**.

## Segurança

- A `OPENAI_API_KEY` fica apenas no servidor da Vercel.
- O navegador envia um token de sessão do Supabase; a rota de IA valida o usuário antes de aceitar a chamada.
- A requisição para a OpenAI usa `store: false`.
- O contexto é limitado e resumido; o banco inteiro não é enviado a cada pergunta.
- Existe um limite diário configurável por usuário (`AI_DAILY_LIMIT`). O limitador em memória é uma proteção simples para uso pessoal, não um sistema de cobrança robusto para aplicativo público.

## Funcionalidades de treino

- Rotina automática por dia da semana.
- Modo Academia, um exercício por vez.
- Última execução na mesma rotina e última execução global.
- Melhor marca, histórico rápido e PRs.
- Comparação de sessão contra a sessão anterior da mesma rotina.
- Exercício vazio salvo como não realizado, sem virar regressão.
- Importação de Excel/CSV e exportação de histórico.
- Login e sincronização pelo Supabase.
- PWA instalável no Android.

## Banco

A estrutura é a mesma das versões v5/v6. Se o `schema.sql` já foi executado com sucesso, **não rode novamente**.

## Desenvolvimento local

```bash
cp .env.example .env.local
npm install
npm run dev
```

Abra `http://localhost:3000`.

## Testes

```bash
npm test
npm run build
```

## Publicação

Leia `docs/DEPLOY_PC_VERCEL.md`.
