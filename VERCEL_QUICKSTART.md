# 🚀 Deploy na Vercel em 5 Minutos

## ⚡ Quick Start

### Passo 1: Conectar Repositório (1 min)
```
1. Acesse https://vercel.com/new
2. Clique em "Import Git Repository"
3. Autorize GitHub
4. Cole: https://github.com/CFO-Advisor/APP_FINANCAS.git
5. Clique "Import"
```

### Passo 2: Adicionar Variáveis de Ambiente (2 min)

Na tela de configuração do Vercel, vá para **Environment Variables** e adicione:

| Chave | Valor | Onde encontrar |
|-------|-------|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://seu-projeto.supabase.co` | Supabase → Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `sb_publishable_...` | Supabase → Settings → API → anon public key |

### Passo 3: Deploy (2 min)
```
1. Clique "Deploy"
2. Espere 2-3 minutos
3. Pronto! ✅ App está em produção
```

## 🔐 Segurança Garantida ✅

- ✅ Nenhuma chave secreta no repositório
- ✅ `.env.local` não foi commitado
- ✅ Apenas chaves públicas (`NEXT_PUBLIC_*`) no código
- ✅ Supabase com Row Level Security

**Seu app é seguro para produção!**

## 📱 Seu App Estará Em

```
https://seu-projeto.vercel.app
```

## 🎯 O Que Testar Após Deploy

- [ ] Login/Signup funcionando
- [ ] Banco de dados carregando corretamente
- [ ] Upload de arquivos (se aplicável)
- [ ] Funcionalidades de relatório
- [ ] Responsividade no mobile

## 📞 Precisa de Ajuda?

- **Erro de build?** → Verifique `DEPLOYMENT.md`
- **Variáveis faltando?** → Confira `SECURITY_CHECKLIST.md`
- **Dúvidas de segurança?** → Leia `SECURITY_CHECKLIST.md`

---

**Documentação completa:** Veja `DEPLOYMENT.md` para instruções detalhadas
