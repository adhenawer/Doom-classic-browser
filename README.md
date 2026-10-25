# DOOM Classic Browser — porte de DOOM para browsers

Porte jogável de **DOOM para o navegador, com EDGE-Classic/WebGL2 (Moderno HD), Crispy Doom (Alta) e Chocolate Doom (Clássica), compilados de C/C++ para WebAssembly**, com teclado físico ou controles touch, dados locais e modo offline após a preparação inicial. O projeto atende browsers em computadores, notebooks e tablets. O Chrome de um iPad é um dos ambientes de uso previstos.

**[Jogar no browser](https://adhenawer.github.io/Doom-classic-browser/)** · [Builds e testes](https://github.com/adhenawer/Doom-classic-browser/actions) · [Validação](docs/VALIDATION.md)

O motor executa mapas reais e preserva as mecânicas clássicas. A distribuição inclui Freedoom Phase 1, com conteúdo livre próprio. Os mapas originais exigem um `DOOM.WAD` ou `DOOM1.WAD` autorizado, importado pelo usuário. Não há telemetria, servidor de jogo ou Pointer Lock.

## Jogar no navegador

1. Abra a URL HTTPS com conexão. O browser seleciona automaticamente teclado no desktop ou controles touch no mobile. No mobile, jogue na horizontal; girar para a vertical suspende a partida.
2. Aguarde a preparação offline terminar (inclui o pacote HD de aproximadamente 380 MiB, além dos motores, conteúdo-base e mapa Estação Aurora).
3. Selecione **Jogar** por toque ou Enter. Quando aparecer a partida suspensa, toque em **Retomar partida** ou pressione Enter para retomar e tentar liberar o áudio.
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

## Controles mobile

O joystick esquerdo move e desloca lateralmente; desloque e mantenha o controle direito para girar. Botões permitem segurar tiro, usar e correr junto com movimento e giro, trocar arma, abrir mapa, salvar e carregar. O giro usa a resposta de teclado configurada, com zona morta; os controles são digitais, sem prometer giro proporcional ao arrasto. Auto-aim vertical continua ativo; não há recarga manual ou pulo.

Menus do DOOM têm setas, confirmar, voltar e Sim/Não na tela. Para saves, digite o nome no campo touch (até 20 caracteres ASCII) e toque em **Salvar nome**. O jogo suspende ao perder foco ou girar para vertical. O bloqueio de orientação é tentado quando permitido pelo browser; o aviso de rotação cobre os demais casos. Controles novos integram o cache offline existente.

Veja [discovery e correspondência teclado/touch](docs/MOBILE-DISCOVERY.md) e [revisão independente](docs/MOBILE-QA.md). A análise de padrões de FPS usa conhecimento prévio: consulta online indisponível nesta execução. Validação em celulares e tablets físicos continua pendente.

## Moderno HD 0.4.0

A nova instalação inicia no perfil **Moderno HD**, com geometria renderizada na GPU em WebGL2, resolução de **1920×1440**, 1.115 imagens Freedoom HD, incluindo dois materiais 4K e HUD integrado à cena. Preferências salvas anteriormente mantêm o perfil escolhido. Para ativar numa instalação existente: **Configurações → Resolução do motor → Moderno HD → Salvar configurações**; se já estiver jogando, salve a partida e aplique a reinicialização.

A configuração moderna oferece 1280×960, 1920×1440, 2560×1920 e 3840×2880 em 4:3. Resolução é o desenho real da cena na GPU, independente da escala da página. O HUD pode usar a apresentação contemporânea do motor ou a barra clássica. Mipmaps/trilinear, suavização e HQ2x de UI/sprites tratam a amostragem; não são anunciados como novos modelos 3D ou PBR.

Qualidade visual é a prioridade, conforme solicitado pelo usuário: os orçamentos propostos de 20 MiB de download e 64 MiB de texturas foram retirados. A capacidade física do browser/GPU ainda determina quais configurações conseguem executar. O perfil Moderno usa outro motor e **saves próprios**, sem converter ou sobrescrever os saves Clássica/Alta. Backups v3 incluem os três perfis; v1/v2 continuam aceitos.

O pacote HD é usado somente com o hash exato de Freedoom Phase 1 0.13.0. Conteúdos importados diferentes continuam com sua arte local. A seleção exclui sprites com transparência defeituosa, texturas mascaradas e imagens incompatíveis do pack upstream; nesses casos, o motor mantém os originais. Não há upload dos IWADs ou processamento de IA durante a partida.

Veja [arquitetura e validação da entrega](docs/modern-hd/RELEASE.md), [procedência do conteúdo](docs/modern-hd/CONTENT.md), [direção visual](docs/modern-hd/DESIGN.md) e [QA independente](docs/modern-hd/QA.md).

## Alta resolução 0.3.0

Em **Configurações → Resolução do motor**, escolha **Alta · 640×400 · Crispy Doom** e salve. Se já há uma partida, use **Aplicar nova resolução → Aplicar resolução e reiniciar**; salve o progresso no menu do DOOM antes, pois reiniciar não cria um save. Depois entre em Jogar/Carregar jogo. Preferências antigas continuam em Clássica (320×200).

Alta rasteriza **quatro vezes mais pixels**, mantendo o aspecto de exibição 4:3. Isso melhora o detalhe geométrico sem criar texturas novas; não é zoom/CSS, Full HD ou filtro. O menu permite voltar a Clássica. Cada motor tem saves próprios: a primeira entrada em Alta copia os slots clássicos para o perfil novo, sem sobrescrever os originais. Backups novos incluem ambos; backups antigos continuam aceitos. O cache prepara os dois motores para a troca offline.

Crispy permanece com auto-aim vertical, 35 tics/s e extensões de pulo/mira livre desativadas. Sua simulação não é declarada idêntica à do Chocolate; Clássica mantém a base anterior. O custo da alta resolução precisa ser avaliado em cada dispositivo. Veja [arquitetura, medições e validação](docs/HIRES.md) e [revisão independente](docs/HIRES-QA.md).

## Discovery de próxima evolução gráfica

O [discovery de renderização, nitidez e materiais](docs/discovery/README.md) compara alternativas além de 640×400, filtros, texturas HD/PBR, memória, licenças e viabilidade offline. O estudo original antecede a implementação 0.4.0. A preferência posterior por qualidade visual, sem orçamento artificial de tamanho/CPU/memória, substitui os orçamentos propostos naquela investigação. Os resultados implementados são registrados separadamente na documentação da 0.4.0.

## Modernização 0.2.0

O launcher e as configurações foram redesenhados, com orientação de teclado antes de entrar na partida. Em **Configurações**:

- **Clássico, Precisão e Ágil:** presets de resposta do giro, com ajustes numéricos preservados.
- **Correr continuamente:** opcional; Shift passa a caminhar. Desativado por padrão, sem alterar velocidades, física ou compatibilidade dos saves.
- **Nítido, Suave e CRT:** apresentação opcional do framebuffer; CRT experimental usa um passe WebGL próprio com fallback Nítido e custo adicional medido; Nítido é o padrão. Brilho afeta também o HUD. A resolução interna depende da seleção Clássica/Alta; os filtros preservam esse framebuffer.
- **Música e efeitos independentes:** valores 0–15; zero silencia a respectiva contribuição. Suspender a partida também suspende o áudio; Enter tenta retomá-lo.

**Restaurar experiência clássica** desfaz esses ajustes e preserva o remapeamento. Todas as mudanças continuam locais e disponíveis offline após preparar a nova versão. Veja [execução do roadmap e evidências](docs/modernization/RELEASE.md), [direção visual](docs/modernization/DESIGN.md) e [estudo de renderização](docs/modernization/RENDERING.md). Não há novo renderer de geometria, mira vertical ou assets comerciais adicionados.

## Recursos e compatibilidade

O browser precisa oferecer WebAssembly, Canvas/WebGL, Web Audio, IndexedDB e Service Worker em contexto seguro. A jogabilidade aceita teclado físico ou controles touch. A detecção usa ponteiro primário grosseiro e capacidade de toque, sem depender apenas da largura da tela. Em **Controles → Experiência de controles**, escolha Automática, Mobile ou Desktop; a seleção fica neste navegador. Teclado continua disponível no modo mobile.

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

Abra a mesma URL no Chrome do iPad, em paisagem, com touch ou teclado físico. Quando disponível, a instalação pode ser feita por Compartilhar → Adicionar à Tela de Início. Confira áudio por Enter, teclas reservadas, combinações e reconexão do teclado e reabertura offline no [checklist desse dispositivo](docs/IPAD-CHECKLIST.md). Esses cuidados são específicos desse perfil de browser/sistema; o produto continua sendo o porte web.

## Build e publicação na nuvem

O GitHub Actions compila e publica automaticamente após alterações em `main`. Pelo site do GitHub: **Actions → Build, test and publish DOOM**; use **Run workflow** para repetir. Em **Settings → Pages**, a fonte é **GitHub Actions**. Esse fluxo pode ser acompanhado pelo browser de qualquer dispositivo, inclusive um iPad, sem terminal ou compilação no dispositivo de jogo.

Toolchain: Emscripten 4.0.18 em imagem fixada por digest; Chocolate Doom vendorizado em revisão fixada (`engine/UPSTREAM.json`) e Crispy/EDGE-Classic obtidos de archives com revisão/SHA-256 fixados (`engine/CRISPY.json`, `engine/EDGE.json`). O build Moderno usa CMake 3.31.6 fixado; o conteúdo HD e os avisos são fixados em `engine/MODERN-CONTENT.json`. SDL e SDL_mixer vêm dos ports dessa toolchain. Freedoom 0.13.0 e as fontes das dependências são verificados por SHA-256.

```sh
npm ci
docker run --rm --user "$(id -u):$(id -g)" -e EM_CACHE=/src/build/emscripten-cache -v "$PWD:/src" -w /src emscripten/emsdk@sha256:bbe90e2b00acbd1a9596087d88305029f383de1eb71c0cdb20f4e19647265450 bash scripts/build-engine.sh
python3 scripts/fetch-content.py
python3 scripts/fetch-modern-content.py
python3 scripts/fetch-dependency-sources.py
npm test
npm run build
npx playwright install --with-deps chromium webkit
npm run test:e2e
```

Para testar a importação com um IWAD externo autorizado, sem adicioná-lo à distribuição:

```sh
DOOM_TEST_WAD=work/doom1.wad npx playwright test --project=chromium -g 'IWAD import persists'
```

O diretório `work/` é local, ignorado pelo Git e excluído do pacote de fontes. O teste padrão continua usando Freedoom. Em 25/10/2026, o teste passou no Chromium com o shareware DOOM 1.9 obtido de [Thurbeen/thurbox-doom](https://github.com/Thurbeen/thurbox-doom/blob/main/wad/doom1.wad): 4.196.020 bytes, MD5 `f0cefca49926d00903cf57551d901abe`, SHA-256 `1d7d43be501e67d927e415e0b8f3e29c3bf33075e859721816f652a526cac771`. Foram verificadas importação, persistência após recarga, seleção, rejeição de arquivo inválido e abertura da fase. Isso não valida todos os mapas ou a progressão da campanha. A execução posterior também passou no WebKit desktop após preparar as bibliotecas locais de teste. O shareware não foi incorporado aos assets publicados.

Esses comandos são para o executor de desenvolvimento na nuvem. A imagem de toolchain inclui Python e CMake. Asyncify permite ceder ao browser durante esperas, transições e o loop original. A versão atual usa uma thread e não requer COOP/COEP.

## Equipe de modernização

A [equipe de agentes](agents/README.md) reúne nove especialidades para evoluir design, gráficos e jogabilidade do porte para browsers. Há perfis de trabalho, pesquisa de competências publicadas por estúdios, referências de especialistas, plano incremental e configuração nativa para clientes Codex compatíveis. Veja também [AGENTS.md](AGENTS.md).

A equipe executou a primeira release do [roadmap de modernização](agents/ROADMAP.md), com responsabilidades, evidências e revisão independente. A base Classic continua disponível. A release 0.3.0 adiciona alta resolução com Crispy; novas regras de combate permanecem propostas documentadas.

## Repositório, URL e dados existentes

O repositório passa a se chamar `adhenawer/Doom-classic-browser`, e a URL de publicação passa a ser `https://adhenawer.github.io/Doom-classic-browser/`. Veja o [procedimento de mudança de endereço](docs/REPOSITORY-MIGRATION.md).

O produto e a PWA se chamam **DOOM Classic Browser**, e o pacote é `doom-classic-browser`. O banco legado `doom-ipad-v1` continua preservado para acesso aos IWADs e às preferências existentes; saves continuam no mesmo IDBFS. Os dados são associados à origem e ao contexto do browser, não ao nome do repositório. O novo caminho requer preparar novamente o cache offline e, quando aplicável, a instalação de PWA. Veja [arquitetura](docs/ARCHITECTURE.md).

## Licenças e privacidade

Código anterior do port: GPL-2.0-or-later; bridge Moderno e EDGE-Classic: GPL-3.0-or-later. A distribuição combinada do backend Moderno observa GPLv3 e preserva os avisos de cada componente. Motores e componentes têm seus avisos preservados em `engine/upstream`, `engine/CRISPY.json`, `CRISPY-COPYING.txt`, `EDGE-COPYING.txt`, `EDGE-NOTICES.txt` e `MODERN-CONTENT-COPYING.txt` na publicação. Veja [LICENSE](LICENSE) e [engine/upstream/COPYING.md](engine/upstream/COPYING.md). Freedoom: BSD de 3 cláusulas, com licença e créditos incluídos na publicação. Não distribuímos IWADs comerciais.

A publicação inclui `source.tar.gz` com código correspondente, adaptações e scripts de build. Não inclui IWADs importados, saves ou credenciais. Não há dependências de rede durante a partida preparada para offline. O provedor de hospedagem recebe as requisições normais de download enquanto online.

## The Ultimate Doom na execução local

Com o arquivo autorizado `work/DOOM.WAD` já presente, execute `npm run dev` e abra o endereço local exibido (por padrão, `http://127.0.0.1:5173/`). Em **Selecionar conteúdo**, escolha **The Ultimate Doom · 4 episódios · arquivo local**. O jogo importa o WAD para o armazenamento do navegador, preserva a seleção após recarregar e mantém os saves separados pelo conteúdo. Depois use **Voltar → Jogar**.

O servidor fica restrito a localhost por padrão. O endpoint local não existe em builds/preview; o WAD não entra no Git, nos assets publicados ou no pacote de fontes. O arquivo esperado é Ultimate Doom 1.9, SHA-256 `6fdf361847b46228cfebd9f3af09cd844282ac75f3edbb61ca4cb27103ce2e7f`. A escolha e a abertura da partida foram verificadas no Chromium; isso não valida a campanha inteira.

## Mapa original — Estação Aurora

Em **Selecionar conteúdo**, **Freedoom Phase 1** e **Estação Aurora · mapa original** são opções fixas. Não é preciso importar um arquivo manualmente: ao selecionar Aurora pela primeira vez, o browser verifica e armazena o IWAD composto localmente. É uma primeira fase própria, com três salas, duas passagens, seis inimigos, shotgun, recursos e alcova secreta; após a saída, E1M2 e os outros mapas continuam sendo Freedoom. O layout não reproduz uma fase comercial. O motor Classic preserva as regras clássicas; sprites, sons e texturas são os recursos livres do Freedoom, não os originais comerciais.

`npm run build` gera o mapa a partir de `maps/aurora/layout.json`, usando somente a base Freedoom pinada. O gerador e a geometria novos usam MIT; os assets preservam BSD e créditos. O PWAD `aurora-map.wad` contém apenas o mapa próprio; `aurora.wad` é o IWAD importável com os recursos livres. Ambos e seus créditos entram no cache offline.

Documentação detalhada: [análise estrutural do WAD](docs/maps/WAD-ANALYSIS.md), [inventário completo de metadados](docs/maps/wad-inventory.json), [brief passado ao criador](docs/maps/ORIGINAL-MAP-BRIEF.md), [design e procedência de Aurora](docs/maps/AURORA.md) e [revisão independente](docs/maps/QA.md) e [validação funcional](docs/maps/VALIDATION.md). A análise comercial não é um mapa reconstruível nem fornece assets ao gerador.

Último commit remoto consultado: `55dec9dcfe7557d8e91fedcbc48b9707087a1d26`, Modern HD/WebGL2. O checkout desta entrega permanece em `073b980` com as alterações locais; o importador remoto tem o mesmo contrato, mas esta entrega não foi testada no Modern HD nem aplica automaticamente seu pacote de materiais a um IWAD de hash diferente.

## Build independente do mapa

Execute `npm run build:map` após preparar a base livre com `python3 scripts/fetch-content.py`. A saída `build/aurora/Estacao-Aurora.zip` contém os dois WADs, manifesto, checksums e licenças/créditos. O workflow **Build Aurora map** gera o mesmo pacote no GitHub Actions e disponibiliza o artifact **Estacao-Aurora**, independentemente da compilação dos motores e materiais HD.

A entrega Aurora foi posteriormente integrada ao commit Modern HD `55dec9d`, preservando os perfis gráficos existentes. As evidências anteriores em `docs/maps` identificam a revisão em que cada teste foi executado; não devem ser interpretadas como validação do renderer Modern HD com Aurora.
