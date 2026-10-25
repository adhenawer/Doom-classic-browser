# Arquitetura do MVP

O motor é Chocolate Doom em C, revisão `a2dfd51fcc00d272dc8a17a97ccd6683333ff4ea`, preservada em `engine/upstream`. Não usamos binários de terceiros. `scripts/prepare-engine.py` cria uma cópia em `build/engine`, verifica contextos dos patches e aplica as adaptações. O build falha se o contexto esperado divergir.

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

O relógio lógico desconta períodos de suspensão para evitar recuperar milhares de tics ao retornar de outro aplicativo. O motor preserva 35 Hz. O controlador não promete latência inferior a um tic: em primeiro plano o orçamento é aproximadamente 28,6 ms mais entrega de eventos e apresentação, a medir no iPad.

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

`storage.persist()` é uma solicitação; o iPadOS ainda pode remover dados. Não há autenticação, telemetria, API externa ou upload de arquivos durante a execução. Download inicial e atualização dependem de rede.

## Reprodutibilidade

Fontes upstream vendorizadas, toolchain fixada por digest, dependências npm exatas com lockfile, Actions fixadas por SHA e conteúdo livre verificado por hash. O objetivo comprovável é recompilar a partir das entradas fixadas. Identidade byte a byte entre executores só pode ser afirmada após comparação específica; não é presumida.
