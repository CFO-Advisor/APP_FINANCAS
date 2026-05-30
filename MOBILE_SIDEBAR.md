# 📱 Comportamento do Sidebar em Mobile

## Visão Geral

O sidebar da aplicação possui um comportamento totalmente responsivo, adaptando-se automaticamente para diferentes tamanhos de tela:

- **Desktop (≥768px):** Sidebar visível com opção de retrair
- **Mobile (<768px):** Sidebar como drawer (gaveta) que abre/fecha

## 📐 Comportamento Desktop

### Sidebar Expandido
- **Largura:** 240px (`w-60`)
- **Exibição:** Lado esquerdo fixo
- **Conteúdo visível:** 
  - Logo com texto
  - Menu completo com rótulos
  - Botão "Sair"

### Sidebar Retraído
- **Largura:** 64px (`w-16`)
- **Exibição:** Ícones apenas
- **Ativação:** Clique no botão de chevron (→/←) ao lado do sidebar
- **Transição:** Suave em 200ms

**Benefício:** Aproveita espaço horizontal sem perder navegação rápida

## 📱 Comportamento Mobile

### Top Bar Fixa
- **Altura:** 56px (h-14)
- **Posição:** Fixa no topo da página
- **Conteúdo:**
  - Logo + Texto "CFO Advisor"
  - Botão de tema (light/dark)
  - **Botão de menu (☰)** - Abre o drawer

### Drawer (Gaveta)
- **Largura:** 288px (`w-72`)
- **Posição:** Fixa na esquerda, desliza da esquerda para direita
- **Comportamento:**
  - **Fechado (padrão):** Fora da tela (`-translate-x-full`)
  - **Aberto:** Desliza para dentro com transição suave
  - **Transição:** 300ms com easing `ease-in-out`

### Overlay (Sobreposição)
- **Cor:** Preto semi-transparente (`bg-black/40`)
- **Efeito:** Backdrop blur para destaque visual
- **Ação:** Clique fecha o drawer
- **Transição:** 200ms suave

### Como Usar em Mobile
1. **Abrir menu:**
   - Toque no ícone de menu (☰) no canto superior direito da top bar
   
2. **Navegar:**
   - Toque em um item do menu
   - O drawer fecha automaticamente após navegação
   
3. **Fechar menu:**
   - Toque no ícone X no canto superior direito do drawer
   - Toque na área escura do lado (overlay)
   - Navegue para outra página

## 🎨 Detalhes Visuais

### Cores e Estilos
```
Top Bar:
- Fundo: bg-sidebar/95 (com transparência)
- Backdrop: blur-sm
- Bordas: border-b border-border

Drawer:
- Fundo: bg-sidebar
- Bordas: border-r border-border
- Sombra: shadow-lg (destaque visual)

Overlay:
- Cor: bg-black/40
- Efeito: backdrop-blur-sm
```

### Transições
```
Drawer: 300ms ease-in-out (entrada/saída)
Overlay: 200ms (fade in/out)
Buttons: Feedback visual imediato
```

## 🔧 Implementação Técnica

### Componente Principal
- **Arquivo:** `src/components/layout/app-sidebar.tsx`
- **Tipo:** Client Component (`'use client'`)
- **State Management:** React hooks (`useState`)

### Breakpoints
- **Mobile (padrão):** Drawer + Top Bar
- **Desktop (md: 768px+):** Sidebar fixo + Collapse button

### Componentes Utilizados
- **Layout:** Flexbox
- **Animações:** Tailwind CSS transitions
- **Ícones:** Lucide React (Menu, X, ChevronLeft)
- **Classes:** CNS utility para classes condicionais

## 🚀 Performance

### Otimizações Implementadas
- ✅ Renderização condicional (não renderiza drawer em desktop)
- ✅ Transições CSS (não JavaScript)
- ✅ Backdrop blur nativo (GPU acelerado)
- ✅ Z-index management (40/50 para overlay/drawer)

### Bundle Impact
Sem impacto adicional — usa apenas Tailwind CSS e React hooks

## 📋 Checklist de Funcionalidades

- [x] Sidebar retraível em desktop
- [x] Drawer em mobile com animação
- [x] Overlay com close ao clicar
- [x] Auto-close ao navegar
- [x] Transições suaves
- [x] Responsive em todos os tamanhos
- [x] Acessibilidade (titles, semantic HTML)
- [x] Dark mode support

## 🐛 Troubleshooting

### Drawer não abre
- Verifique se está em tamanho mobile (<768px)
- Clique no ícone de menu (☰) na top bar

### Sidebar desaparece no desktop
- Verifique a largura da janela (mínimo 768px)
- Limpe o cache do navegador

### Transição não funciona
- Verifique se Tailwind CSS está carregado
- Verifique a classe `transition-transform duration-300`

## 📱 Testes Recomendados

1. **Desktop:**
   - Redimensione para ver breakpoint (768px)
   - Clique para retrair/expandir sidebar
   - Verifique alinhamento do conteúdo

2. **Mobile (emulator ou real):**
   - Abra/feche o drawer várias vezes
   - Teste clique no overlay
   - Teste navegação entre páginas
   - Teste scroll dentro do drawer
   - Teste em orientação landscape/portrait

3. **Performance:**
   - Teste em dispositivo real
   - Observe jank ou lag nas transições
   - Verifique carregamento de página

## 📚 Referências

- [Next.js Responsive Design](https://nextjs.org/docs/app/building-your-application/styling)
- [Tailwind CSS Responsive](https://tailwindcss.com/docs/responsive-design)
- [Lucide React Icons](https://lucide.dev)

---

**Última atualização:** 2026-05-29
**Versão:** 1.0
**Status:** ✅ Produção-Ready
