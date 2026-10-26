# Revisão independente — Moderno HD

Revisão de integração em 25/10/2026, especialidade `doom_qa`, sobre a base 0.3.0 (`d73fac9537469c64ad7186cde456f58a9481b3ef`). O escopo inclui motor GPU real, controles, apresentação, áudio, saves, importação e offline, preservando Classic/Alta. Não houve teste físico no iPad, teclado Bluetooth, escuta humana ou medição de energia.

## Estado atual — correção de política de áudio em validação

**Candidata atual: 32/32 testes Node aprovados e regressão de política de áudio aprovada em Chromium/WebKit; o novo gate integral terá 44 cenários e ainda está pendente.** O motor local é `67415a9d2222c5895b8dba11132f2bf0a238bea72803d696d2a6be3785f9b10c`, artefato `1cf64351aeed820c`, 42 recursos. Os resultados completos dos candidatos anteriores permanecem separados abaixo.

O [CI da fonte 9bde476](https://github.com/adhenawer/Doom-classic-browser/actions/runs/40242060865) terminou com **41/42 aprovados**, zero skips: Chromium 21/21, WebKit 20/21. Os três motores compilaram e os testes C/Node passaram; publicação bloqueada. A única falha foi o cenário Moderno WebKit no segundo boot para carregar: o poll do menu consumiu os 42.143 ms restantes do orçamento compartilhado de 120 s, sem retornar valor ou snapshot de falha. Não há evidência suficiente para atribuir esse sintoma à perda de F3.

A correção de prontidão abaixo é candidata ao novo gate integral, ainda pendente; os resultados históricos não equivalem a uma aprovação desse código inteiro. A confirmação de configurações por geração passou nos dois browsers do CI.

- Integração local anterior, artefato `ea850db4fedd2174`, 42 recursos, EDGE WASM `d62adb907732032152ddf52a63d558f4232f00262fff030f1b19a3d4013d3e73`: **Chromium HOST 20/20 em 4,8 min; WebKit Docker 17/20 em 24,3 min**.
- Falhas WebKit nessa integração: preferência alwaysRun 0 após reabertura, esperada 1; RPC Enter no último boot Classic do cenário Alta Offline excedeu 360 s; RPC Enter no botão Configurações após o load Moderno sem HD excedeu 600 s. No último, munição 48/48 e load já haviam passado; o Node confirmou a operação pendente em `locator('#settings').press('Enter')`. Não atribuir os dois timeouts ao parser de saves, a uma tecla perdida ou ao GC sem prova.
- Novo artefato `845138da0060e96b`, com a correção da confirmação: **regressão de configurações Chromium HOST aprovada em 2,8 s; regressão de configurações e ClassicOffline WebKit aprovados, juntos, em 54,6 s**. Não foi repetida a integração inteira localmente nesse artefato; o CI 42 faz esse gate.
- A regressão `tests/browser/storage.spec.ts` falhou na versão ea: havia uma gravação enfileirada e não committed, mas a mensagem Stored antiga continuava visível. Após o fix, dois gates IndexedDB intercalam write1/write2: a primeira conclusão não anuncia sucesso da segunda; depois de liberar a segunda transação, reload conserva initial 135, música 11 e alwaysRun true. Nenhum motor é inicializado nesse teste.
- O primeiro save/backup do perfil Alta, o cenário de conforto/teclas após menu e o layout estreito passaram em ambos os browsers na rodada integrada; os sintomas anteriores de fila e transição não reapareceram nesses casos. Isso não resolve os timeouts de RPC registrados nos outros fluxos.
- Permanecem em investigação os timeouts RPC observados no WPE. Uma consulta estática ao especialista do motor não encontrou loop síncrono ilimitado no caminho H→showShell→suspend→configure; as operações examinadas são limitadas e o áudio é assíncrono. Pressão, JSC/IPC, retenção após reload e áudio/foco são hipóteses, **não causas confirmadas ou vazamentos declarados resolvidos**.
- O harness Moderno compartilha 120 s entre asserções de startup/menu/estado/munição, sem renovar o prazo a cada assert. RPCs como `keyboard.press` ainda dependem do limite externo do teste; não se afirma um teto rígido de 120 s para toda operação possível.

Logs atuais: `/tmp/doom-integrated-qa-chromium-final.log`, `/tmp/doom-integrated-qa-webkit-final.log`, `/tmp/doom-integrated-qa-webkit-stage.log`, `/tmp/doom-storage-qa-before-fix.log`, `/tmp/doom-storage-qa-after-fix-chromium.log` e `/tmp/doom-settings-focused-qa-webkit.log`. Capturas/JSON em `build/integrated-qa-chromium-final/`, `build/integrated-qa-webkit-final/`, `build/storage-qa-before-fix/`, `build/storage-qa-after-fix-chromium/` e `build/settings-focused-qa-webkit/`.

**Chrome no iPad, teclado Bluetooth, durabilidade entre processos e escuta humana permanecem sem validação física.** Não houve redução de texturas, resolução, valores esperados ou cobertura para obter os resultados registrados.


### Diagnóstico da prontidão e correção candidata

No artefato A `169cded09a042367`, o cenário Moderno WebKit completo passou em 3,2 min com os mesmos recursos, resolução e prazos. Entretanto, os três anúncios de pronto ocorreram com phase 8 (swap pendente), zero ticks concluídos, zero swaps em estado Level e latch 33 igual a zero. No primeiro: 23:31:29.301 UTC, `make_tic=12`. Isso comprova que os contadores antigos não asseguravam retorno do quadro/tick. Não comprova a causa de todos os bloqueios intermitentes.

Nesse ensaio o F3 do segundo boot foi enviado às 23:33:18.908, retirado da fila às 23:33:19.036 e iniciou o menu às 23:33:19.037. A prévia PNG levou cerca de 79 ms para decodificar e 16 ms para upload; menu observado às 23:33:19.359, munição restaurada 47/47. Não há justificativa nesse resultado para reescrever a prévia, reduzir imagens ou aumentar o prazo. Log `/tmp/doom-modern-diag-a-webkit.log`; capturas em `build/modern-diag-a-webkit/`. A não inclui o refinamento de fase 10; sua fase 8 engloba o swap/SDL. Os contadores A em estado Level não são chamados de prova de RenderView real.

Na candidata B, o motor marca o retorno real de RenderView, consome essa marca após o swap e fixa o latch 33 somente após terminar um WebTick com esse quadro e `make_tic>2`. O callback nativo de tick completo exige esse latch e phase 0 (idle); após dois ticks qualificados, o host suspende dentro desse callback, antes de confirmar a preparação. O polling somente observa a pausa já feita, sem congelar um terceiro tick. Os testes exigem ticks e swaps reais positivos, latch 1 e fase 0 ao retomar. Não foram alterados os orçamentos de teste 120/600 s, as imagens, a resolução, o SDL hint ou as regras35Hz.

A instrumentação é local ao runtime, somente leitura; logs detalhados exigem a flag explícita de teste `doomTraceModern` e ficam desligados no uso normal. Não há transmissão de diagnósticos. A integração preserva também a correção paralela 704c7ea/2c3c87f: busy_wait=0 mantém as esperas nativas cooperativas com o browser quando o relógio lógico está pausado, e um teste Mobile pausa explicitamente dentro do callback pré-swap e exige heartbeat, tics estáveis e retomada. Isso corrige uma possibilidade concreta de starvation; a falha CI não foi atribuída exclusivamente a ela. Candidata integrada aguarda compilação e testes.


### Bloqueio de interface por desbloqueio de áudio não solicitado

O [CI 17b8bcc](https://github.com/adhenawer/Doom-classic-browser/actions/runs/40245749591) aprovou 41/42 cenários. A barreira real de prontidão, o menu de carga HD e a restauração 47/47 passaram. Restou um timeout de 600 s ao selecionar resolução após retornar à interface: o último registro mostrava phase 0/ticks 5/world swaps 5, motor suspenso, e não houve heartbeat. Não se atribui esse bloqueio ao parser de saves ou ao F3, que já haviam passado.

Uma cópia diagnóstica do caso, sem alterar o runtime ou as asserções, instrumentou operações individuais. Ela mostrou uma chamada direta de `AudioContext.resume()` antes de `settings.onclick`, sem pedido `web_audio` do host. O miniaudio fixado registrava listeners de captura para click/touchend e retomava todo dispositivo marcado started, ignorando a pausa do host. Enter no botão da interface gera esse click. O bloqueio, portanto, ocorria antes da configuração executar; não era necessário o seletor estar errado. Reset, configuração nativa, apresentação e foco não tiveram custo comparável nesse ensaio.

O probe passou 1/1 em cerca de três minutos; registrou chamadas síncronas de resume de 21,07 s pelo host e 21,88 s pelo clique em Configurações. Esses tempos são diagnósticos, não benchmark de hardware. Um ambiente adicional de depuração esgotou o disco local durante sua preparação e foi removido; o ensaio não certifica desempenho com armazenamento livre. A violação de política foi comprovada separadamente, sem depender desses tempos: a nova regressão nativa Chromium contra `e00c80f2` falhou exatamente em **esperado 0 chamadas de resume ao abrir Configurações / recebido 1**, com o contexto previamente suspenso. Logs `/tmp/doom-audio-policy-before-fix-chromium.log` e `/tmp/doom-modern-resume-substeps-webkit.log`; cópia do probe em `build/diag-resume/`.

A correção remove somente o registro global de desbloqueio do backend, preservando a ativação explícita do host por Enter/toque. O contrato já retomava o contexto diretamente e a notificação unlocked do backend era apenas informativa para a configuração usada. A função de áudio agora evita API quando o estado já corresponde à intenção, agrupa pedidos iguais pendentes e mantém pedidos opostos no gesto atual. Tickets de operações antigas não apagam operações novas; conclusão tardia reconcilia a intenção quando não há uma transição mais recente pendente. Rejeições/autoplay/interrupted não geram loops de repetição: aguardam outro gesto. Nenhum fechamento de contexto ou hipótese de vazamento foi introduzido como correção sem prova.

**Red→green:** no build corrigido `1cf64351`, o mesmo teste passou em Chromium HOST (16,0 s) e WebKit Docker (30,2 s). Ambos comprovaram zero retomadas na interface/contexto suspenso; uma retomada necessária por Enter; zero chamadas adicionais durante WASD/setas/tiro com contexto running; PCM real e comandos. O arquivo `tests/browser/audio-policy.spec.ts` acrescenta dois casos ao gate, sem remover cobertura anterior. `tests/modern-audio.test.mjs` executa o corpo EM_JS real com contextos controlados e cobre coalescência, intenções opostas, conclusões fora de ordem, troca/fechamento de contexto, rejeições e throw síncrono: **32/32 testes Node** no total, dos quais dez dessa política. Esses testes unitários não certificam APIs ou áudio em hardware.

A candidata também preserva a integração paralela `a092485`: ativação explícita de controles HTML por Enter, foco direto do launcher e verificações de foco/painel antes da seleção. A correção atual ainda depende da nova rodada integral. A demora de retomadas realmente necessárias no WPE permanece uma limitação observada, sem promessa de baixa latência física no iPad.

## Histórico — base 16f3 e integrações anteriores

**Na base `16f3315a5e696112`, oito cenários Moderno locais foram aprovados; a rodada adicional das 20 regressões legadas terminou com 18 aprovadas e duas falhas de cache no Chromium do container.** Os controles com o mesmo servidor/assets passaram no host, sem modificar os testes para esconder essas falhas. A descrição completa está no fechamento adicional abaixo.

O CI da base `55dec9dcfe7557d8e91fedcbc48b9707087a1d26` terminou com 23/28 aprovados e bloqueou corretamente a publicação. Após incorporar os commits externos de Aurora/Mobile, a integração atual possui 40 cenários em 7 specs; essa nova integração exige outra rodada integral e não herda uma aprovação dos testes antigos. A rodada Moderno local inclui uma repetição fresca WebKit após corrigir uma espera assíncrona do teste e aliviar pressão de memória do ambiente; os resultados anteriores reprovados estão registrados abaixo.

- Chromium, artefato `16f3315a5e696112`: 4 aprovados em 2,6 min. GPU/HD/input/PCM/saves/backup/reload/qualidade, offline/context loss, associação/migração e falha 404.
- WebKit final, contexto padrão: 3 aprovados na rodada conjunta (offline completo, associação/migração e falha 404); cenário principal aprovado na repetição fresca em 1,8 min. Todos os oito cenários têm os mesmos recursos, resoluções e asserts planejados, sem skip.
- Ambos os browsers registraram munição esperada 47/real 47 nas fases `HD-reload` e `HD-disabled`, sem entrada extra para alterar o valor. Incluem abrir configurações após carregar, trocar 1920→1280, HD desativado e HUD clássico e carregar o mesmo save novamente.
- O retry WebKit anterior excedeu 600 s ao abrir configurações após segundo runtime/load. O worker demonstrou que munição/hash já haviam sido aprovados. A repetição fresca passou pelo mesmo fluxo depois de aliviar pressão do cgroup; isso não prova ausência universal de vazamentos ou uma causa única para o episódio.
- A suíte descobre 28 casos: 20 regressões existentes, preservadas, e 8 Modernos. A revisão não substitui o resultado do CI ou validação física do usuário.

Artefato validado localmente: `16f3315a5e696112`, 38 recursos. WASM: `1b9f6e3eb39e5ef870f4a59890448f3c4edb51ff4b42da2ad27995dd45ea1b8c`. EPK em MEMFS: 398.681.345 bytes, SHA-256 `f9a2cc0ea9f290af2b04a9b0227aef1fdad7596649e52101842ae6bbf8dc0562`, entregue em 12 partes de até 32 MiB. A fragmentação conserva integralmente os bytes finais e as 1.115 imagens, incluindo os dois materiais 4K.

## Critérios e cobertura

`tests/browser/modern-hd.spec.ts` cobre quatro cenários por browser:

1. Instalação nova Moderno 1920 × 1440; WebGL 2 e dimensões nativas reais; Canvas inteiro dentro do viewport; substituições HD registradas e uploads nativos; pixels de mundo não vazios; movimento/giro simultâneos, rampa/limite/soltura, Shift, tiro/uso, menus, blur, avanço de tics após Enter e PCM; saves EDGE, backup v3, pin incorreto rejeitado, exclusão/restauração, load após reload e após mudar resolução/HD/HUD.
2. Cache completo antes de executar o motor; servidor realmente encerrado antes do primeiro boot; save/load/reload sem rede; perda real de contexto com `WEBGL_lose_context`; suspensão, preservação de dados e reinicialização operável pelo teclado; retorno ao Classic offline.
3. IWAD livre estruturalmente válido com hash diferente não recebe pacote de outra revisão; preferências legadas sem novos campos permanecem Classic.
4. Download de parte HD ausente causa falha explícita de preparação, sem prontidão falsa nem bloqueio das configurações pelo teclado.

Os testes legados selecionam Classic pela interface com `legacy-profile.ts`, tornando explícita a base original após mudar o default. Nenhum assert anterior foi retirado. A leitura de pixels ocorre sincronicamente no callback real de apresentação; não usa fixture de imagem. O teste de áudio observa PCM não nulo e estado do contexto: comprova geração/suspensão, sem afirmar percepção ou latência física. Não há solicitação de Pointer Lock.

## Achados e correções

| ID / severidade | Evidência e impacto | Correção e validação |
|---|---|---|
| Q1 / alto | SDL redimensionava o drawing buffer 1920 × 1440 para 960 × 720 pela dimensão CSS | Separar buffer físico de CSS. Dimensão nativa, WebGL e enquadramento aprovados em Chromium/WebKit |
| Q2 / médio | Após perda de contexto, Enter podia retomar simulação no contexto inválido | Marcar perda e encaminhar a reinício seguro; fluxo Chromium aprovado |
| Q3 / médio | Reinício após perda mostrava painel dentro do shell oculto | Mostrar shell antes da confirmação; fluxo Chromium aprovado |
| Q4 / alto, conteúdo rejeitado | Auditoria de arte encontrou sprites HD com fundo magenta opaco | Excluir essas imagens/máscaras, preservando originais. Capturas inspecionadas sem o defeito |
| Q5 / alto | Três leituras de frame 1920 × 1440 após swap tiveram RGB máximo 0, erro GL 0, apesar da cena visível | SDL/Asyncify cede a execução no swap; mover callback após FinishFrame/commit e antes de SwapBuffers. Pixels reais aprovados nos dois browsers; também protege CRT |
| Q6 / alto | Após blur/Enter, áudio retomava mas o tic e o menu ficavam parados; SDL consumia foco perdido depois da retomada DOM | Host torna-se responsável por suspensão/foco. Preservar eventos rápidos de menu, purgando fila somente ao suspender e emitindo keyups das teclas enviadas. Tic/movimento/save após blur aprovados |
| Q7 / alto | GET monolítico no Vite retornou `net::ERR_CACHE_WRITE_FAILURE` antes do motor | Evitar cache HTTP do conteúdo com `no-store`, mantendo CacheStorage próprio. Chromium aprovado; entrega final fragmentada também evita Response/digest 400 MB |
| Q8 / médio | Falha da primeira instalação SW deixava `navigator.serviceWorker.ready` pendente indefinidamente | Observar falha/redundant e indicar erro sem bloquear menu; cenário 404 aprovado nos dois browsers |
| Q9 / alto, harness | WPE persistente ativava SW mas `cache.put(new Response('hello'))`, sem aplicativo/SW, também retornava com cache vazio | Usar contexto padrão funcional para WK; Chromium mantém perfil normal persistente. Evidência causal abaixo. Não atribuir essa falha ao produto nem declarar persistência WK entre processos |
| Q10 / alto, ensaio sob pressão | WPE padrão excedeu 600 s em Enter no botão Configurações após segundo runtime/load; munição/hash já aprovados, cgroup próximo do limite de 16 GiB | Mesmo fluxo aprovado em repetição fresca em 1,8 min após liberar caches dos nossos trabalhos. Episódio registrado; causa absoluta não fechada, sem prometer comportamento sob toda condição de memória |
| Q11 / baixo, harness | Comparação imediata leu munição 50 versus 47 após menu fechar, antes da ação deferida do ticker | Aguardar por poll o mesmo valor salvo; ambos os loads Chromium devolveram 47 sem comando extra. O load WPE também avançou antes do bloqueio posterior |
| Q12 / baixo, UX | Card de contexto perdido ainda diz Enter para retomar, enquanto o handler encaminha a reinício seguro | Ajustar texto para recuperação/reinício; fluxo seguro funciona, melhoria de redação pendente |

A melhoria de instalação serial por `cache.add`, o uso de `cache.keys` para consultar somente metadados e o guard que evita criar cache vazio durante a checagem foram mantidos como robustez. **Não foram demonstrados como correção causal de Q9**: o probe WPE persistente permaneceu vazio após ambas as tentativas. Instalação falha continua removendo o cache parcial.

## Evidências e limites do harness

A fixture `normal-browser.ts` usa um perfil Chromium normal novo por teste, fechado e removido ao final. O backend privado Chromium rejeitou a antiga resposta monolítica com `UnknownError`; o mesmo build/servidor em perfil normal preparou 28 entradas/~445 MB em menos de 5 s. Não é evidência de quota do iPad. Nenhum perfil pessoal é acessado.

No WPE WebKit persistente, tanto `Cache.addAll` de 100 bytes quanto de 32 MiB — com/sem `Content-Length` e `Cache-Control:no-store` — retornaram sem erro, mas `keys()` era vazio e `match()` ausente. Até `cache.put('./synthetic',new Response('hello'))` falhou desse modo. **O mesmo script em `webkit.launch()` + `browser.newContext()` armazenou todos os seis casos, com status 200, e devolveu o corpo `hello`.** Isso isola um defeito do modo persistente do runner. O contexto padrão WK comprova reload/offline dentro da sessão; não comprova durabilidade entre processos de browser nem comportamento do modo privado de Safari/iPad.

O probe real persistente também mostrou que a falha não era só do indicador: com servidor encerrado, buscar `icon.svg` e reabrir o documento falharam apesar de ~425 MB em disco. Não se usou o tamanho do diretório como prova de cache funcional.

Corpos de rede não são gravados em HAR/tracing, evitando cópias adicionais de centenas de MB pelo inspector. Capturas explícitas, JSON WebGL/enquadramento, marcos nativos e diagnóstico de boot/cache preservam evidências. A remoção de tracing não foi demonstrada como causa única dos atrasos anteriores no WK; houve diferenças de servidor e contexto. Prazos preservados: 120 s por boot, 180 s de preparo e 600 s para cenários com múltiplos boots.

Logs de diagnóstico em `/tmp`:

- `doom-modern-qa-webkit-fragments-first.log`: cenário principal WK aprovado; captura em `build/modern-qa-webkit-fragments-first/modern-hd-Modern-default-r-8986a--native-saves-and-backup-v3-webkit/modern-real-gpu-hd.png`.
- `doom-modern-qa-webkit-fragments-rest.log`: dois cenários aprovados e prontidão offline persistente reprovada.
- `doom-modern-qa-webkit-fragments-offline-diag.log`: controlador presente, worker ativado e cache vazio.
- `doom-modern-cache-probe{,-guard,-serial}.log`: probes reais, incluindo fetch/reload com servidor desligado.
- `doom-modern-cache-api-probe.log` e `doom-modern-cache-api-ephemeral-probe.log`: comparação causal da API, sem motor nem SW.

## Validação física e rollback

Permanecem para o usuário: primeiro preparo fora de navegação privada no Chrome do iPad, permissões/foco do teclado, Enter para áudio, acordar/trocar apps, desconectar/reconectar teclado, limites reais de armazenamento, exportação pelo Arquivos, reabrir depois de encerrar o browser e jogar sem rede. Chromium/WPE não certificam essas condições nem FPS, RAM total, bateria ou compatibilidade universal.

Rollback funcional: selecionar Classic nas configurações e aplicar o reinício explícito. IWADs, banco existente e saves Classic/Alta/Moderno permanecem em namespaces separados; trocar renderer não converte silenciosamente um save nativo EDGE para outro motor.

## Rodada final — evidências adicionais

`/tmp/doom-modern-qa-chromium-final.log`: 4 aprovados em 2,6 min e registros `MODERN_SAVE_RESTORED` esperada 47/real 47 nas fases HD-reload e HD-disabled. `/tmp/doom-modern-qa-webkit-final.log`: 3 aprovados e a corrida da comparação imediata. `/tmp/doom-modern-qa-webkit-final-load-poll.log`: restauração por poll aprovada, bloqueio posterior de abertura de configurações e timeout de 600 s. `/tmp/doom-modern-test-phase-probe.log` e `/tmp/doom-modern-live-page-probe.log`: inspeção temporária do Node worker isolou a etapa; nenhum comando de jogo foi enviado por esses probes e o inspector de loopback foi fechado.

Nesse retry lento, o cgroup alcançou 17,17 GB de 17,18 GB, sem swap e sem OOMkill; WPE chegou a 8,14 GB RSS. Os threads llvmpipe estavam em futex com cerca de 1% CPU; main/ReceiveQueue/helpers JSC tinham carga. Esses dados não provam vazamento nem desempenho físico de GPU. O coordenador liberou páginas frias apenas de nossos builds, sem apagar assets, e QA removeu somente um perfil temporário próprio já encerrado de 425 MB. A repetição fresca começou com cerca de 7,6 GB no cgroup. Diagnóstico em `build/modern-qa-diagnostics/`.

### Fechamento local

`/tmp/doom-modern-qa-webkit-final-fresh.log`: 1 aprovado em 1,8 min, com 47/47 nos dois loads e passagem pelo mesmo botão Configurações do episódio anterior. A repetição não mudou motor, pacote, qualidade, trajetória, controles ou prazo. A soma dos 3 cenários WebKit aprovados na rodada conjunta e desse cenário fresco completa 4 Modernos WebKit; Chromium completou 4 na mesma execução. O CI fornece a validação integral separada de 28 casos. Captura do cenário principal final em `build/modern-qa-webkit-final-fresh/modern-hd-Modern-default-r-8986a--native-saves-and-backup-v3-webkit/modern-real-gpu-hd.png`.

Esse fechamento se refere à primeira rodada Moderno. A análise posterior das regressões/CI identificou as corridas de fila/transição de menu descritas abaixo; a release integrada ainda precisa passar pelo novo gate. Conservam-se o registro Q10, o limite do harness WebKit entre processos e a validação física pendente do usuário.

## Regressões legadas e integração posterior

Execução local da base 16f3, sem alterar os critérios/asserts dos 20 casos existentes:

- 20 casos dos quatro specs `game`, `high-resolution`, `modernization`, `presentation`, worker 1, Chromium e WebKit dentro do container: **18 aprovados e 2 reprovados em 12,1 min**. Chromium: 8/10; WebKit: 10/10.
- As duas falhas foram a preparação offline de Classic e Alta no Chromium Docker: status `Preparação offline falhou (NetworkError)`, antes de encerrar o servidor. Renderização e salvamento funcionavam. Log `/tmp/doom-modern-qa-legacy-final.log` e evidências em `build/modern-qa-legacy-final/`.
- O mesmo script FULLSW, servidor `readFile`/MIME legado, versão 16f3 e todos os 38 recursos passou no Chromium HOST: 39 entradas/~445,35MB, com origem única e com visita prévia a 4173 seguida da origem-alvo. Log `/tmp/doom-modern-qa-legacy-full-cache-host-pair.log`. O Chromium Docker falhou nas duas variantes; quota anunciada era ~20,26 GB, versus ~5,66 GB no host. Isso isola uma diferença de ambiente, sem identificar a causa de baixo nível.
- Controles negativos: corrigir apenas MIME ou trocar para stream não resolveu no container; a API de cache isolada armazenou 100 B/32 MiB e `hello` normalmente. Portanto não se atribui o problema simplesmente a 2 origens, MIME, tamanho de chunk ou inoperância geral da API. **Nenhum beforeEach, assert ou byte foi removido para contornar a falha.**

O CI anterior revelou cinco falhas: duas comparações imediatas de munição Moderno (substituídas pelo mesmo valor com poll), um primeiro save Classic no caso Alta, um comando W que permanecia 0 no WebKit e uma largura 397>390 na interface estreita. As três últimas passaram na execução local; isso não elimina as corridas ou a diferença de layout vistas no CI.

| Achado | Evidência e ação preparada | Validação pendente |
|---|---|---|
| Fila Classic/Alta / alto | `MAXEVENTS=64`; 24 Backspace geram 48 eventos, CLASSIC gera 14 e Enter mais 2. Se o lote chega antes do consumo, o anel pode voltar a `head==tail` e perder os eventos. Coordenador/especialista prepararam ampliação/guardas e um exercício C causal | Rebuild e regressões no novo binário; não resolver com sleeps do teste |
| Transição de menu / alto | Um Wdown aceito após menu nativo fechar pode ser apagado pelo `watchMenu` tardio do próximo rAF. O teste já usava poll, portanto apenas aumentar espera não resolve tecla perdida. Coordenador adicionou reconciliação antes de keydown/keyup/pointerdown e manteve rAF | Nova rodada dos perfis e mobile, sem reduzir a exigência de 25 |
| Largura estreita / médio | CI WebKit mediu 397 para viewport 390; local passou. Especialista de arte preparou correção CSS | Repetir o mesmo limite, incluindo os novos controles Mobile |

A integração após `cef5de` acrescenta seis cenários Aurora e seis Mobile à base 28, totalizando 40. A revisão local 16f3 acima não certifica o novo mapa, os controles de toque ou o resultado dos novos binários. O coordenador executará o gate integral atualizado antes da publicação.


## Binários e correções preparados para o gate integrado

Após integrar `087d000`, a versão local `ea850db4fedd2174` inclui 42 recursos, Aurora e Mobile. O WASM Moderno é `d62adb907732032152ddf52a63d558f4232f00262fff030f1b19a3d4013d3e73`; o log com `__DATE__`/`__TIME__` foi substituído por revisão/backend fixos, sem mudança de regra ou apresentação. Os testes integrados de 40 casos estão em execução; resultados das bases anteriores permanecem históricos.

O teste C liga os `d_event.c` reais: as filas originais de 64 posições falham no lote exato de 64 eventos (24 Backspaces, CLASSIC, Enter); as cópias preparadas com 1024 posições passam FIFO, payload, keyup, 1022 eventos e 286 mil eventos com wrap/drains. Os fontes upstream permanecem intactos. Clássica/Alta possuem 1023 posições utilizáveis, sem promessa de fila ilimitada. Os três executáveis C, 22 testes Node e sete testes Python passaram localmente.

A transição de menu é reconciliada antes de registrar teclas novas, também no keyup, e antes do registro/consulta de ponteiros da camada Mobile. Isso elimina o reset tardio que apagava a primeira tecla após fechar o menu. O seletor de controles exibe **Teclado · sem controles na tela** para o valor persistente `desktop`, preservando o uso exclusivo de teclado no browser de um tablet.
