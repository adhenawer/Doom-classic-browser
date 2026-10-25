# Arquitetura do porte para browsers

O produto é um porte web para browsers com teclado físico. O iPad é um dos dispositivos de uso previstos; a aplicação usa APIs de navegador e não faz seleção de plataforma por user-agent. O motor é Chocolate Doom em C, revisão `a2dfd51fcc00d272dc8a17a97ccd6683333ff4ea`, preservada em `engine/upstream`. Não usamos binários de terceiros. `scripts/prepare-engine.py` cria uma cópia em `build/engine`, verifica contextos dos patches e aplica as adaptações. O build falha se o contexto esperado divergir.

## Responsabilidades

- `engine/turn.c`: controlador de rotação, executado em `G_BuildTiccmd`, uma vez por comando/tic. Mantém frações de ângulo. As setas opostas zeram a rampa; inversão recomeça na velocidade inicial. Parada imediata é padrão; desaceleração é opcional.
- `engine/bridge.c`: entrada C exportada, configuração limitada, suspensão, limpeza de estados e observação somente leitura para testes.
- `web/input.ts`: conjunto de códigos físicos pressionados, aliases, remapeamento e validação. Não usa repetição do sistema para movimento. Soltar um alias não solta a ação enquanto outro alias continua pressionado.
- `web/main.ts`: estados interface/jogo/menu/texto, inicialização WASM, arquivos e configurações. Menus de gameplay continuam sendo os do motor. Durante nomes de saves, letras deixam de ser atalhos.
- `web/wad.ts`: limites e verificação estrutural dos IWADs. Não transforma um arquivo desconhecido em confiável; o conteúdo continua sendo interpretado pelo motor dentro do sandbox WASM.
- `web/storage.ts`: transações IndexedDB para conteúdo e preferências. O filesystem persistente do Emscripten guarda saves em outra base IDBFS.
- `scripts/offline.mjs`: inventário e hashes, geração do cache versionado, manifesto e fontes correspondentes.

## Loop e renderização

Uma thread. Asyncify permite ceder ao navegador em `I_Sleep` e a cada iteração do loop original. Nenhum Worker, SharedArrayBuffer ou Pointer Lock é necessário. SDL2 apresenta o framebuffer clássico via Canvas/WebGL. Não é renderização 3D acelerada da geometria do DOOM: o renderizador original continua em software.

O relógio lógico desconta períodos de suspensão para evitar recuperar milhares de tics ao retornar de outro aplicativo. O motor preserva 35 Hz. O controlador não promete latência inferior a um tic: em primeiro plano o orçamento é aproximadamente 28,6 ms mais entrega de eventos e apresentação, a medir em cada combinação de navegador, dispositivo e teclado.

## Alterações intencionais no comportamento de interface

- Entrada SDL de teclado é ignorada para não duplicar a ponte DOM/C.
- Captura de mouse é desabilitada incondicionalmente.
- Voltar no menu raiz fecha o menu, além de voltar de submenus.
- Rotação padrão de teclado é substituída pelo controlador nas setas da camada web; a física do jogo não é modificada.
- Save completo avisa o host somente depois de renomear o temporário para o arquivo final. O host serializa `syncfs` e confirma persistência somente no callback de conclusão.

## Conteúdo e memória

Freedoom 0.13.0 Phase 1 é baixado na preparação da release, verificado por SHA-256 e hospedado junto ao app. Importações: IWAD de DOOM 1, tamanho máximo de 64 MiB e máximo de oito conteúdos. O WAD ativo é copiado para MEMFS; não se carregam todos os IWADs no motor. O heap WASM começa em 32 MiB e tem teto de 256 MiB. A memória JavaScript e do navegador é adicional e não está coberta por esse teto.

Freedoom pode ter mapas que exigem recursos além dos limites vanilla; o MVP valida E1M1 e não afirma que todos os episódios foram concluídos. Os testes não contêm dados comerciais. DOOM.WAD/DOOM1.WAD são suportados como formato e caminho de integração, mas precisam ser testados com arquivos autorizados do usuário.

## Armazenamento e atualização

Saves são separados pelo SHA-256 do IWAD: `/persist/saves/<hash>/doomsavN.dsg`. Backups carregam saves e configurações, sem IWADs. Os caminhos aceitos em backups são restritos e os tamanhos limitados.

Cache de app e IndexedDB têm funções separadas. Uma nova versão só instala após baixar o conjunto completo; não usa `skipWaiting`, preservando a versão em uso até o fechamento dos clientes. Navegação offline resolve `index.html` dentro do escopo, inclusive em subdiretórios. O cache é específico da origem e do contexto de execução; uma aba do Chrome e um app da tela inicial devem ser preparados e testados separadamente.

O precache de uma atualização usa requisições com `cache: reload`, evitando copiar HTML e metadados antigos do cache HTTP para o novo cache de versão. Preferências, IWADs e saves permanecem no armazenamento existente.

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
