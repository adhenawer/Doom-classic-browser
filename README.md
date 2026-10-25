# DOOM Classic Browser — porte de DOOM para browsers

Porte jogável de **Chocolate Doom (Clássica) e Crispy Doom (Alta) em C/WebAssembly para execução no navegador**, com teclado físico, dados locais e modo offline após a preparação inicial. O projeto atende browsers em computadores, notebooks e tablets. O Chrome de um iPad é um dos ambientes de uso previstos.

**[Jogar no browser](https://adhenawer.github.io/Doom-classic-browser/)** · [Builds e testes](https://github.com/adhenawer/Doom-classic-browser/actions) · [Validação](docs/VALIDATION.md)

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

## Alta resolução 0.3.0

Em **Configurações → Resolução do motor**, escolha **Alta · 640×400 · Crispy Doom** e salve. Se já há uma partida, use **Aplicar nova resolução → Aplicar resolução e reiniciar**; salve o progresso no menu do DOOM antes, pois reiniciar não cria um save. Depois entre em Jogar/Carregar jogo. Preferências antigas continuam em Clássica (320×200).

Alta rasteriza **quatro vezes mais pixels**, mantendo o aspecto de exibição 4:3. Isso melhora o detalhe geométrico sem criar texturas novas; não é zoom/CSS, Full HD ou filtro. O menu permite voltar a Clássica. Cada motor tem saves próprios: a primeira entrada em Alta copia os slots clássicos para o perfil novo, sem sobrescrever os originais. Backups novos incluem ambos; backups antigos continuam aceitos. O cache prepara os dois motores para a troca offline.

Crispy permanece com auto-aim vertical, 35 tics/s e extensões de pulo/mira livre desativadas. Sua simulação não é declarada idêntica à do Chocolate; Clássica mantém a base anterior. O custo da alta resolução precisa ser avaliado em cada dispositivo. Veja [arquitetura, medições e validação](docs/HIRES.md) e [revisão independente](docs/HIRES-QA.md).

## Discovery de próxima evolução gráfica

O [discovery de renderização, nitidez e materiais](docs/discovery/README.md) compara alternativas além de 640×400, filtros, texturas HD/PBR, memória, licenças e viabilidade offline. Recomenda um protótipo EDGE-Classic/WebGL2 com texturas livres selecionadas, condicionado à validação de memória, teclado e persistência. Esse estudo e seu plano não representam funcionalidades já integradas na versão 0.3.0.

## Modernização 0.2.0

O launcher e as configurações foram redesenhados, com orientação de teclado antes de entrar na partida. Em **Configurações**:

- **Clássico, Precisão e Ágil:** presets de resposta do giro, com ajustes numéricos preservados.
- **Correr continuamente:** opcional; Shift passa a caminhar. Desativado por padrão, sem alterar velocidades, física ou compatibilidade dos saves.
- **Nítido, Suave e CRT:** apresentação opcional do framebuffer; CRT experimental usa um passe WebGL próprio com fallback Nítido e custo adicional medido; Nítido é o padrão. Brilho afeta também o HUD. A resolução interna depende da seleção Clássica/Alta; os filtros preservam esse framebuffer.
- **Música e efeitos independentes:** valores 0–15; zero silencia a respectiva contribuição. Suspender a partida também suspende o áudio; Enter tenta retomá-lo.

**Restaurar experiência clássica** desfaz esses ajustes e preserva o remapeamento. Todas as mudanças continuam locais e disponíveis offline após preparar a nova versão. Veja [execução do roadmap e evidências](docs/modernization/RELEASE.md), [direção visual](docs/modernization/DESIGN.md) e [estudo de renderização](docs/modernization/RENDERING.md). Não há novo renderer de geometria, mira vertical ou assets comerciais adicionados.

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

Toolchain: Emscripten 4.0.18 em imagem fixada por digest; Chocolate Doom vendorizado em revisão fixada (`engine/UPSTREAM.json`) e Crispy Doom obtido de archive com revisão/SHA-256 fixados (`engine/CRISPY.json`). SDL e SDL_mixer vêm dos ports dessa toolchain. Freedoom 0.13.0 e as fontes das dependências são verificados por SHA-256.

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

## Equipe de modernização

A [equipe de agentes](agents/README.md) reúne nove especialidades para evoluir design, gráficos e jogabilidade do porte para browsers. Há perfis de trabalho, pesquisa de competências publicadas por estúdios, referências de especialistas, plano incremental e configuração nativa para clientes Codex compatíveis. Veja também [AGENTS.md](AGENTS.md).

A equipe executou a primeira release do [roadmap de modernização](agents/ROADMAP.md), com responsabilidades, evidências e revisão independente. A base Classic continua disponível. A release 0.3.0 adiciona alta resolução com Crispy; novas regras de combate permanecem propostas documentadas.

## Repositório, URL e dados existentes

O repositório passa a se chamar `adhenawer/Doom-classic-browser`, e a URL de publicação passa a ser `https://adhenawer.github.io/Doom-classic-browser/`. Veja o [procedimento de mudança de endereço](docs/REPOSITORY-MIGRATION.md).

O produto e a PWA se chamam **DOOM Classic Browser**, e o pacote é `doom-classic-browser`. O banco legado `doom-ipad-v1` continua preservado para acesso aos IWADs e às preferências existentes; saves continuam no mesmo IDBFS. Os dados são associados à origem e ao contexto do browser, não ao nome do repositório. O novo caminho requer preparar novamente o cache offline e, quando aplicável, a instalação de PWA. Veja [arquitetura](docs/ARCHITECTURE.md).

## Licenças e privacidade

Código do port: GPL-2.0-or-later; motores e componentes têm seus avisos preservados em `engine/upstream`, `engine/CRISPY.json` e `CRISPY-COPYING.txt` na publicação. Veja [LICENSE](LICENSE) e [engine/upstream/COPYING.md](engine/upstream/COPYING.md). Freedoom: BSD de 3 cláusulas, com licença e créditos incluídos na publicação. Não distribuímos IWADs comerciais.

A publicação inclui `source.tar.gz` com código correspondente, adaptações e scripts de build. Não inclui IWADs importados, saves ou credenciais. Não há dependências de rede durante a partida preparada para offline. O provedor de hospedagem recebe as requisições normais de download enquanto online.
