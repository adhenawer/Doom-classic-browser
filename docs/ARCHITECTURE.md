# Arquitetura do porte para browsers

O produto é um porte web para browsers com teclado físico ou touch. O iPad é um dos dispositivos de uso previstos; a aplicação usa APIs de navegador e não faz seleção de plataforma por user-agent. Há três perfis explícitos: Clássica (Chocolate Doom), Alta (Crispy Doom) e Moderno HD (EDGE-Classic/WebGL2). Instalações novas selecionam Moderno; preferências existentes preservam a escolha. A base Clássica usa Chocolate Doom em C, revisão `a2dfd51fcc00d272dc8a17a97ccd6683333ff4ea`, preservada em `engine/upstream`. Não usamos binários de terceiros. `scripts/prepare-engine.py` cria uma cópia em `build/engine`, verifica contextos dos patches e aplica as adaptações. O build falha se o contexto esperado divergir.

## Responsabilidades

- `engine/turn.c`: controlador de rotação, executado em `G_BuildTiccmd`, uma vez por comando/tic. Mantém frações de ângulo. As setas opostas zeram a rampa; inversão recomeça na velocidade inicial. Parada imediata é padrão; desaceleração é opcional.
- `engine/bridge.c`: entrada C exportada, configuração limitada, suspensão, limpeza de estados e observação somente leitura para testes.
- `web/touch.ts`: HUD multi-pointer com captura independente, joysticks digitais, botões seguráveis, navegação de menus e campo para nomes de save.
- `web/input.ts`: união de fontes touch por ação e códigos físicos pressionados, aliases, remapeamento e validação. Não usa repetição do sistema para movimento. Soltar um alias não solta a ação enquanto outro alias continua pressionado.
- `web/main.ts`: estados interface/jogo/menu/texto, inicialização WASM, arquivos e configurações. Menus de gameplay continuam sendo os do motor. Durante nomes de saves, letras deixam de ser atalhos.
- `web/wad.ts`: limites e verificação estrutural dos IWADs. Não transforma um arquivo desconhecido em confiável; o conteúdo continua sendo interpretado pelo motor dentro do sandbox WASM.
- `web/storage.ts`: transações IndexedDB para conteúdo e preferências. O filesystem persistente do Emscripten guarda saves em outra base IDBFS.
- `scripts/offline.mjs`: inventário e hashes, geração do cache versionado, manifesto e fontes correspondentes.

## Loop e renderização

Uma thread. Asyncify permite ceder ao navegador em `I_Sleep` e a cada iteração do loop original. Nenhum Worker, SharedArrayBuffer ou Pointer Lock é necessário. Nos perfis Clássica/Alta, SDL2 apresenta o framebuffer via Canvas/WebGL e a geometria é rasterizada em software. Moderno usa o backend Sokol GLES3/WebGL2 do EDGE para renderizar geometria/texturas na GPU; não amplia o framebuffer clássico. Os detalhes da terceira integração estão na seção Moderno HD abaixo.

O relógio lógico desconta períodos de suspensão para evitar recuperar milhares de tics ao retornar de outro aplicativo. O motor preserva 35 Hz. O controlador não promete latência inferior a um tic: em primeiro plano o orçamento é aproximadamente 28,6 ms mais entrega de eventos e apresentação, a medir em cada combinação de navegador, dispositivo e teclado.

## Alterações intencionais no comportamento de interface

- Entrada SDL de teclado é ignorada para não duplicar a ponte DOM/C.
- Captura de mouse é desabilitada incondicionalmente.
- Voltar no menu raiz fecha o menu, além de voltar de submenus.
- Rotação padrão de teclado é substituída pelo controlador nas setas da camada web; a física do jogo não é modificada.
- Save completo avisa o host somente depois de renomear o temporário para o arquivo final. O host serializa `syncfs` e confirma persistência somente no callback de conclusão.

## Conteúdo e memória

Freedoom 0.13.0 Phase 1 é baixado na preparação da release, verificado por SHA-256 e hospedado junto ao app. Importações: IWAD de DOOM 1, tamanho máximo de 64 MiB e máximo de oito conteúdos. O WAD ativo é copiado para MEMFS; não se carregam todos os IWADs no motor. Nos perfis Clássica/Alta, o heap WASM começa em 32 MiB e tem teto de 256 MiB. Moderno começa em 512 MiB e pode crescer até 2 GiB. A memória JavaScript e do navegador é adicional e não está coberta por esse teto.

Freedoom pode ter mapas que exigem recursos além dos limites vanilla; o MVP valida E1M1 e não afirma que todos os episódios foram concluídos. Os testes não contêm dados comerciais. DOOM.WAD/DOOM1.WAD são suportados como formato e caminho de integração, mas precisam ser testados com arquivos autorizados do usuário.

## Armazenamento e atualização

Saves são separados pelo SHA-256 do IWAD: `/persist/saves/<hash>/doomsavN.dsg`. Backups carregam saves e configurações, sem IWADs. Os caminhos aceitos em backups são restritos e os tamanhos limitados.

Cache de app e IndexedDB têm funções separadas. Uma nova versão só instala após baixar o conjunto completo; não usa `skipWaiting`, preservando a versão em uso até o fechamento dos clientes. Navegação offline resolve `index.html` dentro do escopo, inclusive em subdiretórios. O cache é específico da origem e do contexto de execução; uma aba do Chrome e um app da tela inicial devem ser preparados e testados separadamente.

O precache de uma atualização usa requisições com `cache: no-store`, evitando reutilizar HTML/metadados antigos ou gravar o pacote HD grande no cache HTTP. Cache Storage recebe o conjunto completo separadamente. Preferências, IWADs e saves permanecem no armazenamento existente.

`storage.persist()` é uma solicitação; qualquer navegador pode remover dados, conforme a política do sistema e do perfil. Não há autenticação, telemetria, API externa ou upload de arquivos durante a execução. Download inicial e atualização dependem de rede.

## Reprodutibilidade

Fontes upstream vendorizadas, toolchain fixada por digest, dependências npm exatas com lockfile, Actions fixadas por SHA e conteúdo livre verificado por hash. O objetivo comprovável é recompilar a partir das entradas fixadas. Identidade byte a byte entre executores só pode ser afirmada após comparação específica; não é presumida.

## Endereço e armazenamento

O repositório é `adhenawer/Doom-classic-browser`, publicado sob `/Doom-classic-browser/`. O código usa caminhos relativos e o Service Worker usa o escopo da instalação, portanto o build não depende do nome anterior do repositório.

O banco IndexedDB legado `doom-ipad-v1` e o IDBFS `/persist` são mantidos para acesso aos dados já existentes. O novo caminho continua sob a origem `https://adhenawer.github.io`; o acesso aos dados pressupõe o mesmo browser, perfil e contexto. Uma PWA instalada pode usar contexto próprio, conforme o browser. O namespace dos caches inclui o caminho, então a nova URL precisa de sua própria preparação offline. A identidade e o escopo relativos da PWA passam a resolver no novo caminho. Veja [migração do repositório](REPOSITORY-MIGRATION.md).

## Modernização 0.2.0

`web/preferences.ts` valida e migra preferências legadas sem mudar o banco. Presets alteram apenas parâmetros do controlador existente. `classic-v1` e `comfort-v1` produzem comandos vanilla; autorun inverte somente a ação Shift e os saves mantêm o formato/diretório anterior. Nenhuma regra de colisão, dano, arma ou IA foi alterada.

`web/presentation.ts` mantém Nítido/Suave sem Canvas extra; CRT cria um contexto WebGL 1 e shader próprios. `scripts/prepare-engine.py` adiciona um callback síncrono depois do `SDL_RenderPresent` de frames. Isso permite copiar o drawing buffer antes de ele ser descartado. Um quad faz pós-processamento opcional da imagem, sem substituir o renderer C. Perda de contexto ou falhas restauram a fonte; foco e teclado permanecem no Canvas SDL. Não há loop rAF adicional para o efeito. Os diagnósticos medem submissão CPU/API, não GPU ou FPS do motor.

Volumes web usam setters nativos e variáveis dos menus. Volume OPL zero é silenciado por gate apenas na contribuição musical em `opl/opl_sdl.c`, via adaptação no build; síntese e avanço de tempo continuam, SFX não são zerados por esse gate. O código upstream vendorizado continua intacto. `web_suspend(1)` também solicita suspensão de Web Audio; o primeiro resume ocorre diretamente no gesto de teclado. Conclusões assíncronas reconciliam a última intenção se suspensão e retomada se sobrepuserem, sem repetir indefinidamente por estado interrompido do sistema. Valores nativos de volume são capturados ao voltar à interface e persistidos nas mesmas preferências.

Novos recursos de interface/SVG/shader são próprios e entram no bundle e no precache existentes. Licenças e fonte correspondente continuam na distribuição. Ver [release e revisão](modernization/RELEASE.md).

## Alta resolução 0.3.0

A opção Alta usa um segundo backend fixado: Crispy Doom `fdeabe4c23a833534b70aa84a22f1685aae7125d`. `scripts/fetch-engine-sources.py` verifica bytes/SHA-256, preserva o archive em `build/dependency-sources` para a fonte correspondente e extrai uma cópia intacta. O mesmo adaptador aceita `--high`, aplica mudanças em `build/engine-high` e compila outro loader/factory/WASM. Somente um runtime é instanciado por documento; a seleção só se aplica no próximo boot, após sync/reload explícitos. Classic permanece Chocolate, sem troca silenciosa.

Crispy rasteriza 640×400; os seletores C somente leitura 17/18 expõem o buffer real e 20/21 a área do mundo (640×336 com HUD). Isso é independente do Canvas SDL 640×480 e da escala CSS. Widescreen, freeaim, freelook, pulo, overunder, uncapped e efeitos adicionais ficam desativados; detalhe alto e menu sem Crispness impedem toggles que contrariem o perfil. A simulação continua em 35 Hz, sem promessa de identidade de demos/bugs entre os dois ports.

O backend Alta requer `-sEMULATE_FUNCTION_POINTER_CASTS=1`: ações Crispy são chamadas por ponteiros de três argumentos mesmo quando a função original recebe um. WebAssembly exige assinatura compatível; a emulação conserva o comportamento nativo de argumentos extras ignorados. A flag é exclusiva do link Alta e o custo foi avaliado junto do backend. Não é habilitada no Classic.

Saves Classic mantêm `/persist/saves/<hash>`; Alta usa `/persist/saves-hires/<hash>`. Bootstrap em perfil Alta vazio copia os seis slots Classic e persiste um marcador; nunca substitui os originais ou slots Alta existentes. Não há conversão Alta→Classic. Backup v1 permanece Classic; v2 identifica revisões/perfis e inclui os dois namespaces. Todos os paths/metadados são validados antes das escritas. Ambos os motores e a licença extra entram no precache, permitindo selecionar Alta offline mesmo se somente Classic tiver sido jogado. Ver [resultados e limites](HIRES.md).

## Entrada mobile

A seleção automática exige `(pointer: coarse)` e capacidade de toque (`navigator.maxTouchPoints > 0` ou Touch Events, para browsers que reportam zero pontos); não usa user-agent nem largura como identificação de dispositivo. A preferência Automática/Mobile/Desktop é local (`doom-control-mode`), separada do remapeamento existente. Cada pointer tem uma fonte independente; soltar toque não solta teclas ou outros toques da mesma ação. Cancelamento de ponteiro, perda de captura, resize, suspensão e transições de menu limpam estados. O modo mobile só permite retomar em paisagem e suspende ao girar para vertical; orientação é solicitada ao browser como best effort.

O joystick é digital com zona morta; giro chama a mesma ponte `_web_rotate` e usa a rampa do teclado. A simulação, motores, física, saves e APIs exportadas C não mudam. Nomes de save são enviados em lotes de oito teclas (16 eventos), aguardando avanço do motor para manter a resposta durante a entrada de texto; reset invalida lotes pendentes. Nenhum novo asset externo ou dependência de runtime foi adicionado.


## Moderno HD 0.4.0

O terceiro perfil usa EDGE-Classic fixado em `engine/EDGE.json`, compilado de C/C++ para WASM/WebGL2 em uma thread e sem Pointer Lock. `scripts/fetch-modern-engine.py` verifica archive e preserva a fonte correspondente; `scripts/prepare-modern-engine.py` adapta somente uma cópia e inclui `engine/modern-bridge.cc` e o controlador C de giro já testado. O build usa CMake 3.31.6 e a mesma revisão Emscripten. Dados mínimos de suporte são carregados de `doom-modern.data`; o conjunto exclui packs de outros jogos e gráficos comerciais. Avisos completos permanecem na publicação.

O host monta IDBFS uma única vez em `/persist` antes de `callMain`. O backend não monta nem sincroniza o mesmo volume por conta própria. Saves nativos usam `/persist/saves-modern/<iwadSHA256>/savegame/slot000` até `slot007`, com arquivos `.esg`/preview próprios. O diretório temporário `current` fica fora dos backups. O callback após a cópia completa aciona a fila de sync do host. Backup v3 valida os três perfis e só permite namespaces e arquivos conhecidos; backups v1/v2 continuam preservados. Nenhuma conversão `.dsg`→EDGE é presumida.

A resolução moderna é selecionada como dimensão do drawing buffer GPU, com pixels quadrados em 4:3. A janela SDL não é redimensionável por CSS, evitando que o tamanho visual reduza silenciosamente o buffer solicitado. O seletor aceita 1280×960/1920×1440/2560×1920/3840×2880; trocar perfil, resolução, pacote HD ou HUD requer reinício após persistência. Perda do contexto suspende comandos/áudio e impede retomar naquele contexto; Enter oferece reinício controlado. Simulação e controlador permanecem em 35 Hz, com auto-aim vertical e extensões de pulo/câmera livre desligadas, sem afirmar identidade de física/demos com Chocolate.

As texturas opcionais são associadas exclusivamente ao hash conhecido do Freedoom; tamanho/SHA são verificados antes de escrita em MEMFS. O gerador `scripts/fetch-modern-content.py` valida origem, dimensões lógicas e cobertura, seleciona 1.113 PNGs reconstruídos em 4× e dois materiais CC0 4096×4096, com bytes originais preservados, e produz EPK determinístico. Não traz scripts do PK3 upstream. Imagens opacas 4× entram no caminho nativo HIRES; originais de sprites/grades/HUD com transparência permanecem corretos. Mipmaps/trilinear e HQ2x nativo para UI/sprites são apresentação; não implementam PBR. Contadores 23/24/25 observam registro de substituições, chamadas nativas de upload e maior largura decodificada antes do upload; não consultam a memória física da GPU.

Os três loaders/WASM, data e pacote HD entram no inventário offline. Os antigos bancos, namespaces e identidade PWA são preservados. A preferência do usuário remove os orçamentos propostos no discovery; parâmetros de heap/build e limites físicos de WebGL/browser continuam explícitos. Uma instalação nova seleciona Moderno; preferências existentes são sanitizadas sem selecionar outro motor silenciosamente. [Resultados de validação](modern-hd/RELEASE.md).

Na integração Moderno HD, a fila dos perfis Clássica/Alta é adaptada de 64 para 1024 posições (1023 utilizáveis), preservando os fontes upstream. Um teste C liga `d_event.c` real e cobre o lote de 64 eventos que antes fazia a fila aparentar vazia, campos/FIFO e solturas. A transição de menu é reconciliada antes de novos eventos físicos e antes do registro/consulta de ponteiros, impedindo que o reset de um rAF posterior apague entrada nova.

A prontidão do Moderno é confirmada ao final de ciclos completos de `WebTick`, depois do retorno de `EdgeTicker`; o host efetua a pausa inicial nesse callback. Observar apenas `make_tic` durante um yield de Asyncify não era uma barreira de conclusão do frame. A adaptação web usa espera cooperativa de até 5 ms nos caminhos de espera nativos, em vez de busy-spin, preservando o relógio lógico de 35 Hz e permitindo ao browser processar retomada/foco mesmo com o jogo suspenso. Isso altera agendamento, sem alterar regras ou saves.

Na interface HTML, Enter ativa botões/links explicitamente após os ramos de jogo e formulários; isso preserva a navegação de teclado mesmo com a interceptação de eventos de janela usada para bloquear o caminho SDL duplicado. Voltar à interface e sair da página suspendem sem focar o overlay intermediário; o foco vai diretamente ao launcher quando aplicável.

O host também é a autoridade de áudio: o port não registra o desbloqueio global de miniaudio por click/touchend, que podia retomar o contexto antes de um botão da interface enquanto o jogo estava pausado. Enter e gestos do jogo usam a ponte explícita. Ela evita transições redundantes, agrupa pedidos pendentes iguais e respeita a intenção mais recente sem repetir falhas de autoplay em loop. Há uma regressão nativa por browser e testes unitários do corpo EM_JS real; a política não implica áudio ou latência certificados no iPad.
