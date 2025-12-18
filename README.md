# Drawly 🎨

Uma ferramenta de desenho intuitiva e moderna, construída com HTML5 Canvas e JavaScript puro.

![Drawly Preview](preview.png)

## ✨ Funcionalidades

### Ferramentas de Desenho
- **Caneta** - Desenho livre com traço suave
- **Pincel** - Traço mais espesso com efeito de brilho
- **Retângulo** - Formas retangulares
- **Losango** - Formas de diamante
- **Círculo** - Formas circulares
- **Triângulo** - Triângulos direcionais
- **Linha** - Linhas retas
- **Seta** - Linhas com ponta de seta
- **Texto** - Texto multilinhas editável

### Transformações
- **Mover** - Arraste objetos pelo canvas
- **Rotacionar** - Gire objetos usando o handle superior
- **Redimensionar** - Escale objetos pelos cantos ou bordas
- **Seleção Múltipla** - Arraste para selecionar vários objetos

### Personalização
- **Cores** - Paleta de cores predefinidas + seletor personalizado
- **Grossura do Traço** - Ajuste de 1px a 20px
- **Tamanho do Texto** - Controle de tamanho da fonte (12-72px)
- **Estilos de Texto** - Negrito e sublinhado

### Recursos Extras
- **Undo/Redo** - Desfazer e refazer ações
- **Tema Claro/Escuro** - Alterne entre temas
- **Transparência** - Canvas transparente para overlay
- **Snap de Linha** - Alinhe linhas em 90° automaticamente
- **Reconhecimento de Formas** - Converta desenhos à mão livre em formas
- **Exportar** - Salve como imagem PNG
- **Zoom** - Scroll do mouse para zoom in/out
- **Pan** - Mão ou clique do meio para navegar

## 🚀 Como Usar

### Web (Navegador)
1. Clone o repositório:
   ```bash
   git clone https://github.com/masterwillian/draw.git
   ```
2. Abra `index.html` no navegador

### Desktop (Executável)
1. Instale as dependências:
   ```bash
   npm install
   ```
2. Execute em modo desenvolvimento:
   ```bash
   npm start
   ```
3. Para criar o executável:
   ```bash
   npm run build
   ```

## ⌨️ Atalhos de Teclado

| Atalho | Ação |
|--------|------|
| `P` | Ferramenta Caneta |
| `B` | Ferramenta Pincel |
| `R` | Ferramenta Retângulo |
| `C` | Ferramenta Círculo |
| `D` | Ferramenta Losango |
| `L` | Ferramenta Linha |
| `A` | Ferramenta Seta |
| `T` | Ferramenta Texto |
| `V` | Ferramenta Mover |
| `E` | Ferramenta Borracha |
| `H` | Ferramenta Mão (Pan) |
| `Ctrl+Z` | Desfazer |
| `Ctrl+Y` | Refazer |
| `Ctrl+S` | Salvar Imagem |
| `Delete` | Apagar selecionado |
| `+/-` | Zoom In/Out |
| `Shift+Enter` | Nova linha (no texto) |

## 🛠️ Tecnologias

- **HTML5 Canvas** - Renderização de gráficos
- **JavaScript ES6+** - Lógica da aplicação
- **CSS3** - Estilos modernos com glassmorphism
- **Electron** - Versão desktop multiplataforma

## 📁 Estrutura do Projeto

```
draw/
├── index.html      # Estrutura HTML
├── style.css       # Estilos CSS
├── app.js          # Lógica do Canvas
├── main.js         # Processo principal Electron
├── package.json    # Configuração npm/Electron
└── README.md       # Documentação
```

## 📝 Licença

MIT License - Sinta-se livre para usar, modificar e distribuir.

---

Feito com ❤️ por [@masterwillian](https://github.com/masterwillian)
