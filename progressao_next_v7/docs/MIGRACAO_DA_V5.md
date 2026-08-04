# Migração da v5/v6 para a v7

- O banco do Supabase continua compatível.
- Não execute o `schema.sql` novamente se ele já terminou com sucesso.
- A atualização não apaga rotinas, sessões, séries ou exercícios.
- Adicione `OPENAI_API_KEY` no Vercel para ativar a IA.
- Troque os arquivos do repositório pelos da v7 e faça um novo commit; a Vercel republica automaticamente.
