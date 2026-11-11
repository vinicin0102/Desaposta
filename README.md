# Método Desaposta

Página de vendas mobile, VSL, vídeos de anúncio e imagens de checkout do **Método Desaposta**, um app com jogos que dão a mesma faísca da aposta, sem dinheiro envolvido.

## Página de vendas

O site está na raiz do repositório. Para publicar, suba estes arquivos juntos, na mesma pasta:

| Arquivo | O que é |
|---|---|
| `index.html` | Página de vendas completa (pensada para celular) |
| `vsl.mp4` | Mini VSL vertical com legendas (55 s) |
| `vsl-poster.jpg` | Imagem mostrada enquanto o vídeo carrega |

`src/desaposta.html` é a mesma página, sem o cabeçalho `<html>`/`<head>`, usada na prévia. Para editar, mexa nela e gere o `index.html` de novo (veja abaixo), ou edite o `index.html` direto.

**Antes de rodar anúncio:**
- Cole o link do checkout em `CHECKOUT_URL`, no `<script>` do final do `index.html`.
- Ajuste o preço (R$ 37 é um exemplo) na seção de oferta e na barra fixa.
- Troque os depoimentos de exemplo (marcados "Exemplo") por depoimentos reais, com autorização.
- Preencha os links de Termos, Privacidade e Suporte no rodapé.

## Imagens do checkout

Na pasta `imagens-checkout/`:

- `capa-produto-1080x1080.png`: imagem do produto
- `banner-topo-1600x400.png`: banner do topo (computador)
- `banner-topo-mobile-1080x540.png`: banner do topo (celular)
- `banner-lateral-600x1200.png`: banner lateral
- `selo-garantia-600x600.png`: selo de garantia de 7 dias (fundo transparente)

## Vídeos (pasta `video/`)

| Arquivo | O que é |
|---|---|
| `desaposta-anuncio.mp4` | Anúncio de 55 s com narração, trilha, efeitos e legendas (é a VSL) |
| `desaposta-anuncio-sem-legenda.mp4` | Mesmo anúncio, sem legendas |
| `desaposta-app-demo.mp4` | Gravação de tela simulada do app (26 s, sem áudio) |
| `ad/audio/*.wav` | Faixas separadas: narração, trilha, efeitos e mixagem |

Tudo é gerado por código. É preciso ter Node.js e o Google Chrome (ou o Edge) instalados.

```bash
cd video
npm install
node ad/build-audio.js   # narração (voz neural), trilha, efeitos e linha do tempo
node ad/render.js        # grava os dois MP4 do anúncio
node render.js           # grava a demo do app
node checkout/make.js    # gera as imagens do checkout (rode duas vezes na primeira vez, por causa do selo)
```

Para mudar as falas do anúncio, edite `video/ad/scenes.js`.

## Gerar o index.html a partir de src/

```bash
{ printf '<!doctype html>\n<html lang="pt-BR">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'; sed -n '1,/<\/style>/p' src/desaposta.html | grep -v 'claude:viewport'; printf '</head>\n<body>\n'; sed -n '/<\/style>/,$p' src/desaposta.html | tail -n +2; printf '</body>\n</html>\n'; } > index.html
```
