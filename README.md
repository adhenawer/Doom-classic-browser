# DOOM Classic — iPad, teclado e offline

Port real do **Chocolate Doom em C / WebAssembly**, com Freedoom Phase 1 livre. Sem clone JavaScript, telemetria, servidor de jogo ou Pointer Lock. O IWAD original de DOOM deve ser importado pelo proprietário.

Estado: MVP compilado no executor de nuvem e testado em Chromium e WebKit desktop automatizados. **Nenhum teste em iPad físico foi realizado pelo desenvolvedor.** Publicação e GitHub Actions dependem do acesso de escrita da integração ao repositório. Os resultados reais ficam em [docs/VALIDATION.md](docs/VALIDATION.md).

## Jogar pelo iPad

Após o workflow verde e a publicação, abra `https://adhenawer.github.io/Doom-classic-ipad/` no Chrome. Espere a preparação offline terminar (cerca de 33 MiB). Selecione Jogar com Enter. Quando aparecer a tela de partida suspensa, pressione Enter novamente para retomar e tentar liberar o áudio.

Freedoom contém mapas, arte e sons próprios. Para os mapas originais, importe seu `DOOM.WAD` ou `DOOM1.WAD` autorizado pelo seletor do app Arquivos. Nenhum arquivo é enviado ao servidor. Este MVP aceita IWADs de DOOM 1 / Freedoom Phase 1; PWADs e DOOM II ficam fora do escopo.

| Ação | Teclas padrão |
|---|---|
| Mover / deslocar lateralmente | W/S, A/D; ↑/↓ também avançam/recuam |
| Girar continuamente | ←/→ |
| Atirar | J ou Ctrl esquerdo |
| Correr | Shift |
| Usar / abrir portas | Espaço ou E |
| Armas | 1–7; Q próxima, R anterior |
| Mapa | M ou Tab |
| Menu do DOOM | P ou Esc |
| Confirmar / voltar | Enter; V ou Backspace |
| Salvar / carregar | K / L ou F2 / F3 |
| Voltar à interface, fora do menu DOOM | H ou F10 |

Menus nativos: setas, Enter e Backspace. Perguntas nativas do DOOM podem exigir Y/N. Durante a digitação de nomes de saves, as letras são texto. Remapeie ações em Controles. O iPadOS pode consumir combinações antes de entregá-las ao navegador.

Configurações permitem velocidade inicial, aceleração, velocidade máxima, sensibilidade e parada imediata ou desaceleração. A rotação é calculada no motor a 35 Hz. Auto-aim vertical e mecânicas clássicas são preservados.

## Offline e instalação

1. Abra com conexão no Chrome, fora do modo privado.
2. Aguarde **Preparado para offline neste contexto** e importe seu conteúdo, se desejar.
3. Jogue e salve. A confirmação de persistência aparece na interface (H).
4. Feche a página, desligue a conexão e reabra para confirmar a preparação.
5. Para instalar: Compartilhar → Adicionar à Tela de Início, quando disponível. Abra o ícone e prepare/teste esse contexto separadamente. Não presumimos armazenamento compartilhado com a aba do Chrome.

Saves e preferências usam IndexedDB. O navegador pode remover dados. Exporte backups em Gerenciar saves e backups; a exportação pode abrir interface nativa. IWADs não entram no backup de saves e devem ser preservados no Arquivos.

## Somente nuvem, sem terminal no iPad

O GitHub Actions compila e publica automaticamente após alterações em `main`. No GitHub pelo navegador: Actions → Build, test and publish DOOM → veja o resultado; use Run workflow para repetir. Em Settings → Pages, a fonte deve ser GitHub Actions. Não são necessários Mac, Xcode, jailbreak ou compilação local.

## Desenvolvimento na nuvem

Toolchain: Emscripten 4.0.18 em imagem fixada por digest; Chocolate Doom vendorizado em revisão fixada (engine/UPSTREAM.json). SDL e SDL_mixer vêm dos ports dessa toolchain. Freedoom 0.13.0 é verificado por SHA-256.

```sh
npm ci
docker run --rm -v "$PWD:/src" -w /src emscripten/emsdk@sha256:bbe90e2b00acbd1a9596087d88305029f383de1eb71c0cdb20f4e19647265450 bash scripts/build-engine.sh
python3 scripts/fetch-content.py
python3 scripts/fetch-dependency-sources.py
npm test
npm run build
npx playwright install --with-deps chromium webkit
npm run test:e2e
```

Os comandos são para o executor de nuvem, não para executar no iPad. A imagem de toolchain já inclui Python e CMake. O adaptador usa Asyncify para ceder ao navegador durante esperas, transições e a execução contínua, mantendo o loop original. A primeira versão usa uma thread; não requer COOP/COEP.

## Licenças e privacidade

Código do port: GPL-2.0-or-later; motor e componentes têm seus avisos preservados em `engine/upstream`. Veja [LICENSE](LICENSE) e [engine/upstream/COPYING.md](engine/upstream/COPYING.md). Freedoom: BSD de 3 cláusulas, com licença e créditos incluídos na publicação. Não distribuímos IWADs comerciais.

A publicação inclui `source.tar.gz` com código correspondente, adaptações e scripts de build. Não inclui IWADs importados, saves ou credenciais. Nenhuma telemetria; sem dependências de rede durante a partida offline. O provedor de hospedagem recebe apenas as requisições normais de download enquanto online.
