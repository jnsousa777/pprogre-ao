# Publicar a v7 pelo PC

## 1. GitHub

1. Extraia o ZIP em uma pasta normal do computador.
2. Crie um repositório vazio no GitHub, por exemplo `progressao-treino`.
3. No repositório, clique em **Add file → Upload files**.
4. Abra a pasta extraída no Explorador de Arquivos.
5. Selecione **todo o conteúdo dentro dela** (`app`, `components`, `public`, `package.json` etc.) e arraste para a área de upload do GitHub.
6. Confirme em **Commit changes**.

O `package.json` precisa aparecer na raiz do repositório. Não envie uma pasta externa contendo outra pasta do projeto.

## 2. Criar a chave da OpenAI

1. Entre na plataforma da OpenAI.
2. Crie uma API key de projeto.
3. Configure faturamento/créditos da API.
4. Guarde a chave. Ela começa normalmente com `sk-proj-`.

A assinatura do ChatGPT e a API são cobranças separadas. Não coloque essa chave em arquivos do projeto e não use prefixo `NEXT_PUBLIC_`.

## 3. Vercel

1. Entre no Vercel usando o GitHub.
2. Clique em **Add New → Project**.
3. Importe o repositório.
4. Confirme que o preset detectado é **Next.js**.
5. Abra **Environment Variables** e adicione:

```text
SUPABASE_URL = https://SEU-PROJETO.supabase.co
SUPABASE_PUBLISHABLE_KEY = sb_publishable_...
OPENAI_API_KEY = sk-proj-...
OPENAI_MODEL = gpt-5-mini
AI_DAILY_LIMIT = 60
```

`OPENAI_MODEL` e `AI_DAILY_LIMIT` são opcionais. Os valores acima são os padrões.

6. Clique em **Deploy**.

## 4. Supabase

Depois do deploy, copie a URL final, por exemplo:

```text
https://progressao-treino.vercel.app
```

No Supabase, abra **Authentication → URL Configuration**:

- **Site URL:** `https://progressao-treino.vercel.app`
- **Redirect URLs:** `https://progressao-treino.vercel.app/**`

Salve.

## 5. Primeiro uso

1. Abra a URL do Vercel.
2. Crie sua conta ou entre.
3. Cadastre as rotinas ou importe o histórico.
4. Abra **IA do treino** no menu.
5. Em **Conta e backup**, deixe marcada a análise automática pós-treino caso queira uma chamada da IA ao concluir cada sessão.

## Atualizações futuras

Substitua os arquivos no mesmo repositório e faça um novo commit. O Vercel publica automaticamente. O banco e o histórico do Supabase permanecem intactos.
