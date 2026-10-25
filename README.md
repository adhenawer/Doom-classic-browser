# DOOM Classic Browser — porte de DOOM para browsers

Porte jogável do **Chocolate Doom em C/WebAssembly para execução no navegador**, com teclado físico, dados locais e modo offline após a preparação inicial. O projeto atende browsers em computadores, notebooks e tablets. O Chrome de um iPad é um dos ambientes de uso previstos.

**[Jogar no browser](https://adhenawer.github.io/Doom-classic-ipad/)** · [Builds e testes](https://github.com/adhenawer/Doom-classic-ipad/actions) · [Validação](docs/VALIDATION.md)

O motor executa mapas reais e preserva as mecânicas clássicas. A distribuição inclui Freedoom Phase 1, com conteúdo livre próprio. Os mapas originais exigem um `DOOM.WAD` ou `DOOM1.WAD` autorizado, importado pelo usuário. Não há telemetria, servidor de jogo ou Pointer Lock.

## Jogar no navegador

1. Abra a URL HTTPS com conexão e teclado físico. Em tablets, paisagem é recomendada; a orientação é livre.
2. Aguarde a preparação offline terminar (aproximadamente 33 MiB de recursos de execução).
3. Selecione **Jogar** com Enter. Quando aparecer a partida suspensa, pressione Enter novamente para retomar e tentar liberar o áudio.
4. Para o conteúdo original, use **Importar WAD** e o seletor de arquivos do browser. A seleção inicial pode usar a interface nativa do sistema; a partida e os menus funcionam pelo teclado.

Nenhum IWAD ou save é enviado ao servidor. O MVP aceita IWADs de DOOM 1 / Freedoom Phase 1; PWADs e DOOM II ficam fora do escopo.

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

Menus nativos: setas, Enter e Backspace. Perguntas do DOOM podem exigir Y/N. Durante nomes de saves, as letras são texto. Remapeie ações em Controles. Browser e sistema operacional podem consumir atalhos antes de entregá-los à página; por isso há alternativas sem modificadores.

Configurações permitem velocidade inicial, aceleração, velocidade máxima, sensibilidade e parada imediata ou desaceleração. A rotação é calculada no motor a 35 Hz. Auto-aim vertical e mecânicas clássicas são preservados. Nos campos numéricos, Enter avança e V retorna.

## Recursos e compatibilidade

O browser precisa oferecer WebAssembly, Canvas/WebGL, Web Audio, IndexedDB e Service Worker em contexto seguro. A jogabilidade requer teclado físico, integrado ou externo; não há controles de toque sobre a partida.

| Ambiente | Evidência disponível |
|---|---|
| Chromium desktop em Linux | Testes automatizados de jogo, áudio, entrada, persistência e offline aprovados |
| WebKit desktop em Linux | Mesma suíte automatizada aprovada; teste offline com servidor desligado |
| Chrome no iPad | Perfil de uso do usuário; validação em dispositivo físico pendente |
| Outros browsers e dispositivos | Validar por combinação de browser, sistema, dispositivo e teclado |

Resultados de um motor desktop não certificam automaticamente todos os browsers que o utilizam. Veja [checklist geral de browsers](docs/BROWSER-CHECKLIST.md) e [perfil complementar do Chrome no iPad](docs/IPAD-CHECKLIST.md).

## Offline e instalação

1. Abra com conexão, fora do modo privado.
2. Aguarde **Preparado para offline neste contexto** e importe seu conteúdo, se desejar.
3. Jogue e salve. A confirmação de persistência aparece na interface (H).
4. Feche a página, desligue a conexão e reabra a mesma URL no mesmo browser/perfil.
5. Se o browser oferecer instalação como PWA, use a opção de instalar ou adicionar à tela inicial. Prepare e valide também esse contexto; não presuma armazenamento compartilhado entre diferentes browsers, perfis e aplicativos instalados.

Saves e preferências usam IndexedDB. O navegador pode remover dados. Exporte backups em **Gerenciar saves e backups**; a exportação pode abrir uma interface nativa. IWADs não entram no backup de saves: preserve suas cópias em arquivos locais.

### Uso pelo browser de um iPad

Abra a mesma URL no Chrome do iPad e use o teclado físico. Quando disponível, a instalação pode ser feita por Compartilhar → Adicionar à Tela de Início. Confira áudio por Enter, teclas reservadas, combinações e reconexão do teclado e reabertura offline no [checklist desse dispositivo](docs/IPAD-CHECKLIST.md). Esses cuidados são específicos desse perfil de browser/sistema; o produto continua sendo o porte web.

## Build e publicação na nuvem

O GitHub Actions compila e publica automaticamente após alterações em `main`. Pelo site do GitHub: **Actions → Build, test and publish DOOM**; use **Run workflow** para repetir. Em **Settings → Pages**, a fonte é **GitHub Actions**. Esse fluxo pode ser acompanhado pelo browser de qualquer dispositivo, inclusive um iPad, sem terminal ou compilação no dispositivo de jogo.

Toolchain: Emscripten 4.0.18 em imagem fixada por digest; Chocolate Doom vendorizado em revisão fixada (`engine/UPSTREAM.json`). SDL e SDL_mixer vêm dos ports dessa toolchain. Freedoom 0.13.0 e as fontes das dependências são verificados por SHA-256.

```sh
npm ci
docker run --rm --user "$(id -u):$(id -g)" -e EM_CACHE=/src/build/emscripten-cache -v "$PWD:/src" -w /src emscripten/emsdk@sha256:bbe90e2b00acbd1a9596087d88305029f383de1eb71c0cdb20f4e19647265450 bash scripts/build-engine.sh
python3 scripts/fetch-content.py
python3 scripts/fetch-dependency-sources.py
npm test
npm run build
npx playwright install --with-deps chromium webkit
npm run test:e2e
```

Esses comandos são para o executor de desenvolvimento na nuvem. A imagem de toolchain inclui Python e CMake. Asyncify permite ceder ao browser durante esperas, transições e o loop original. A versão atual usa uma thread e não requer COOP/COEP.

## Nomes legados e dados existentes

O produto e a PWA se chamam **DOOM Classic Browser**, e o pacote é `doom-classic-browser`. O nome histórico do repositório e o endereço `/Doom-classic-ipad/` foram preservados para manter os links e as instalações existentes. O banco `doom-ipad-v1` conserva os IWADs e as preferências já salvos. Esses identificadores não restringem o browser nem o dispositivo. Veja [arquitetura](docs/ARCHITECTURE.md).

## Licenças e privacidade

Código do port: GPL-2.0-or-later; motor e componentes têm seus avisos preservados em `engine/upstream`. Veja [LICENSE](LICENSE) e [engine/upstream/COPYING.md](engine/upstream/COPYING.md). Freedoom: BSD de 3 cláusulas, com licença e créditos incluídos na publicação. Não distribuímos IWADs comerciais.

A publicação inclui `source.tar.gz` com código correspondente, adaptações e scripts de build. Não inclui IWADs importados, saves ou credenciais. Não há dependências de rede durante a partida preparada para offline. O provedor de hospedagem recebe as requisições normais de download enquanto online.
