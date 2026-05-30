# Guia de Deploy na Vercel

## 📋 Checklist de Segurança

### Variáveis de Ambiente
- [x] `.env.local` contém apenas chaves `NEXT_PUBLIC_*` (públicas)
- [x] Nenhuma chave secreta de servidor no repositório
- [x] `.env.local` está no `.gitignore` e não foi enviado ao GitHub
- [x] `.env.local.example` contém placeholders para referência

### Configuração Supabase Segura
As chaves usadas são:
- `NEXT_PUBLIC_SUPABASE_URL` - URL pública do projeto (seguro expor)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Chave anônima com permissões limitadas (seguro expor)

**Por que é seguro:**
- A chave anônima (`ANON_KEY`) tem permissões limitadas apenas para operações de cliente
- O Supabase usa Row Level Security (RLS) para proteger dados
- A chave de serviço (service role) NÃO está no repositório

## 🚀 Como Fazer Deploy na Vercel

### Passo 1: Conectar Repositório no Vercel
1. Acesse https://vercel.com
2. Faça login com sua conta
3. Clique em "Add New..." → "Project"
4. Selecione "Import Git Repository"
5. Cole: `https://github.com/CFO-Advisor/APP_FINANCAS.git`
6. Clique em "Import"

### Passo 2: Configurar Variáveis de Ambiente
Na página de configuração do projeto no Vercel:

1. Vá para "Environment Variables"
2. Adicione:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-anon-key-aqui
   ```

3. Clique em "Save"

### Passo 3: Deploy
1. Clique em "Deploy"
2. Espere a build completar (2-5 minutos)
3. Seu app estará disponível em uma URL do tipo `seu-app.vercel.app`

## 🔒 Boas Práticas de Segurança Implementadas

### 1. Isolamento de Chaves
- ✅ Chaves públicas com prefixo `NEXT_PUBLIC_*`
- ✅ Nenhuma chave secreta no código-fonte
- ✅ Arquivo `.env.local` não versionado

### 2. Row Level Security (RLS) no Supabase
Todas as tabelas devem ter políticas RLS ativas:
```sql
-- Exemplo: Usuários só podem ver seus próprios dados
CREATE POLICY "Usuários veem seus próprios dados"
  ON sua_tabela
  FOR SELECT
  USING (auth.uid() = user_id);
```

### 3. Proteção de API Routes
Se usar API routes do Next.js:
```typescript
// Sempre validar autenticação
export async function GET(request: Request) {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return Response.json({ error: 'Não autorizado' }, { status: 401 });
  }
  
  // Seu código aqui
}
```

## 📝 Variáveis de Ambiente Requeridas para Vercel

```
NEXT_PUBLIC_SUPABASE_URL=<sua-url-supabase>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<sua-anon-key>
```

**Onde encontrar:**
1. Acesse https://app.supabase.com
2. Selecione seu projeto
3. Vá para Settings → API
4. Copie "Project URL" e "anon public key"

## 🔐 O Que NÃO Fazer

❌ Não adicione ao `.env` ou código:
- Chaves de serviço do Supabase
- Senhas de banco de dados
- Tokens de API de terceiros
- Chaves privadas

❌ Não publique valores sensíveis:
- No repositório público
- Em commits de Git
- Em screenshots

## ✅ Verificação Final

Antes de fazer deploy:

```bash
# 1. Verificar que .env.local não está no Git
git status

# 2. Verificar que .gitignore contém .env*
cat .gitignore | grep ".env"

# 3. Verificar que não há chaves no código
grep -r "SECRET\|PASSWORD\|KEY" src/ --exclude-dir=node_modules
```

## 🆘 Troubleshooting

### "Cannot find module" no build
- Verifique se todas as dependências estão em `package.json`
- Execute `npm install` localmente

### "Missing environment variable"
- Adicione as variáveis no Vercel Settings → Environment Variables
- Rebuildhe o projeto

### CORS errors
- Adicione domínio da Vercel nas configurações CORS do Supabase
- Em Supabase: Settings → API → CORS

## 📚 Recursos Adicionais

- [Documentação Vercel Next.js](https://vercel.com/docs/frameworks/nextjs)
- [Supabase Auth Best Practices](https://supabase.com/docs/guides/auth)
- [Environment Variables no Next.js](https://nextjs.org/docs/basic-features/environment-variables)
- [Segurança no Next.js](https://nextjs.org/docs/app/building-your-application/configuring/environment-variables)
