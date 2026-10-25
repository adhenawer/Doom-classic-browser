# Revisão independente — controles mobile

Revisor: perfil `doom_qa`, agente separado do implementador. Data: 2026-10-25. Escopo: `web/touch.ts`, `web/input.ts`, integração em `web/main.ts`, HTML/CSS e fila de eventos nativa. Esta revisão distingue inspeção, reprodução de algoritmo e teste no motor real.

## Achados enviados ao coordenador

1. **Alto — estouro da fila ao nomear save.** A versão inicialmente revisada emitia 24 Backspaces, até 20 caracteres e Enter, cada um com keydown/keyup, em um único turno JavaScript. `engine/upstream/src/d_event.c` define `MAXEVENTS 64`, sobrescreve em anel e considera `head == tail` fila vazia. Reprodução independente do algoritmo com Node: nome com 4 caracteres → 58 eventos consumidos; 7 caracteres → 64 postados, zero consumidos, inclusive Enter perdido; 20 caracteres → 90 postados, somente 26 consumidos, nenhum Backspace restante. Corrigir envio em lotes separados pelo avanço do motor ou fornecer ponte de texto dedicada. Revalidar 7/20 caracteres e substituição de nome longo existente.
2. **Médio — mutações DOM contínuas.** A versão inicialmente revisada chama `updateControlExperience` a cada rAF e reatribui quatro textos e dataset sem mudança de modo. Isso inclui região `aria-live`. Recomenda-se cache das propriedades de apresentação; continuar observando menu/texto separadamente. Impacto de desempenho não medido.
3. **Documentação desatualizada.** O discovery inicialmente recomendava paisagem opcional, embora o usuário tenha exigido horizontal. README/arquitetura ainda descreviam ausência de controles touch. Atualizar para o comportamento final.

## Evidências desta revisão

- `npm test`: quatro arquivos de suíte aprovados nesta revisão independente.
- Inspeção: ações virtuais são armazenadas por fonte e unidas às teclas físicas; soltar uma fonte não desativa outra. Remapeamento não muda os nomes das ações touch.
- Inspeção: cada ponteiro captura seu elemento; `pointerup`, `pointercancel` e `lostpointercapture` soltam a respectiva fonte. Há limpeza em reset, menu, suspensão e resize.
- Inspeção: seleção automática usa ponteiro primário coarse e `maxTouchPoints`, com escolha manual persistente; largura isolada não define mobile.
- Inspeção: mobile em retrato mostra aviso sobreposto, resize suspende e resume rejeita retrato. Bloqueio da API de orientação é tentativa; o aviso é o fallback. O usuário pode escolher Desktop manualmente.
- Inspeção: gameplay e menus recebem botões distintos; nome de save usa input HTML para teclado virtual. Movimento/giro continuam digitais pelo controlador já existente, sem alterar mira vertical ou simulação.
- Tentativa de iniciar servidor independente na porta 4174 falhou com `listen EPERM` dentro do sandbox. Os testes E2E reais e capturas do coordenador devem ser registrados separadamente; não são reivindicados como execução deste revisor.

## Reinspeção das correções

O coordenador corrigiu os dois achados de implementação. Revisão independente do código atualizado:

- O nome agora é enviado em lotes de oito teclas (16 eventos), com espera de pelo menos 35 ms e avanço de tic do motor antes do próximo lote. Isso remove o estouro determinístico de 64 eventos identificado acima, sem alterar a fila nativa.
- `saveGeneration` invalida o envio assíncrono quando há reset/suspensão/nova tentativa. Cada lote confere geração, suspensão e estado de edição do motor. A fila não continua recebendo caracteres depois de sair do contexto de save.
- `updateControlExperience` tem cache das propriedades que afetam a apresentação. Sem mudança de modo/visibilidade/menu/texto/orientação, a função retorna sem reatribuir o DOM.

As correções são adequadas por inspeção. O coordenador informou suíte Chromium completa aprovada (12/12), seguida de dois testes mobile reforçados (2/2), incluindo nomes de sete e vinte caracteres e substituição por SHORT com bytes reais do save conferidos. Esses testes foram executados pelo coordenador, não pelo revisor. README, arquitetura e discovery foram atualizados para o comportamento final.

## Reprodução dos testes finais do coordenador

O Chromium disponível no executor foi usado por meio de uma configuração temporária `.mobile-check.config.ts`, que estendia `playwright.config.ts` e selecionava apenas o projeto Chromium com `launchOptions.executablePath: '/usr/bin/chromium'` e `args: ['--no-sandbox']`.

- `npm run test:e2e -- --config=.mobile-check.config.ts`: 12/12 aprovados.
- `npm run test:e2e -- --config=.mobile-check.config.ts tests/browser/mobile.spec.ts`: 2/2 aprovados após os ajustes finais de nome de save e layout.
- O coordenador também informou aprovação de `npm test`, suíte C e build completo com manifesto/cache offline. O build final é recompilado após a atualização desta documentação.

A configuração temporária foi removida da entrega. Esses comandos documentam a execução local; o pipeline padrão continua definido em `playwright.config.ts`. Não houve publicação nesta tarefa.

## Revisão visual independente

Captura inspecionada: `test-results/mobile-mobile-experience-a-662b6--save-name-and-hybrid-input-chromium/mobile-landscape.png`, viewport de 844×390, cena Freedoom E1M1. Os joysticks, tiro e comandos exibem contraste suficiente nesta cena; os controles touch não colidem entre si. O giro tem identificação horizontal e os comandos Interface/Menu permanecem separados dos controles inferiores.

Na captura inicial, Salvar/Carregar cobriam contadores de munição na direita do HUD e Carregar extrapolava ligeiramente seu botão. O coordenador moveu as ações para a margem direita acima do joystick, com colunas de 64 px em landscape de até 400 px de altura. A captura final no mesmo caminho foi reinspecionada independentemente: em 844×390, todos os contadores nativos estão desobstruídos, Carregar cabe no botão e os controles permanecem separados. A ressalva visual está resolvida para esta configuração. O coordenador informou nova execução mobile aprovada (2/2) após o ajuste. A regra para alturas de até 340 px foi inspecionada no CSS, mas não há captura revisada dessa configuração. Esta é inspeção de uma captura, não certificação de todos os tamanhos ou fundos.

## Limites e conclusão

O bloqueador determinístico de fila da versão inicial foi corrigido por inspeção; os E2E finais Chromium foram aprovados conforme relato do coordenador, e a ressalva visual foi resolvida e reinspecionada em 844×390. WebKit não pôde ser executado por ausência de bibliotecas de sistema (incluindo GTK4). Compatibilidade em aparelhos físicos, conforto de três dedos, latência, autonomia e desempenho sustentado não foram medidos. Testes em Chromium emulado não certificam Safari/Chrome no iPad ou Android real. Resultados em aparelhos físicos continuam pendentes.

Rollback: selecionar Desktop recupera imediatamente a interface de teclado; reverter a camada touch e integração preserva bancos, WADs, saves e motores existentes.

## Integração da main atual e correções de publicação

A integração preserva Modern HD e a seleção permanente do Aurora (`671cf6e`). A revisão independente de entrada não encontrou bloqueadores por inspeção na ponte Modern. O teste novo Modern mobile valida o runtime real no CI; os binários Modern e os pacotes HD não estavam disponíveis neste workspace para build completo local após o merge.

Falhas anteriores ao touch foram diagnosticadas pelos logs das builds `40235114291` e `40237233392`. As duas leituras imediatas de munição após carregar save Modern agora aguardam o estado restaurado com `expect.poll`, preservando a comparação do digest. O helper de save Alta envia Backspaces com 8 ms de cadência para não ultrapassar a fila nativa ao automatizar teclado. A primeira tecla após fechar menu é reconciliada antes de registrá-la, evitando que o próximo rAF apague a entrada nova. No touch, um hook anterior ao registro/consulta de ponteiros faz essa reconciliação; QA independente conferiu a ausência de reinserção de fonte já removida.

O WebKit desktop emulado reportou `maxTouchPoints=0`, `pointer: coarse=true` e Touch Events presentes. A detecção agora aceita a capacidade de Touch Events como alternativa aos pontos, sempre exigindo ponteiro primário coarse. O título do launcher usa escala proporcional em telas estreitas para acomodar diferenças de fontes. Foram aprovados localmente, após essas correções: mobile/rotação/save Classic, conforto/teclado/save-load e launcher estreito, três testes Chromium e três WebKit. O save Alta Chromium também passou com a cadência corrigida.

Para executar WebKit neste workspace sem alterar o sistema, bibliotecas Debian assinadas foram extraídas sob `/tmp/doom-webkit-libs` e associadas ao bundle Playwright em `/workspace/.cache/ms-playwright`. A pré-checagem de dependências globais foi dispensada apenas nessa execução local, pois não lê os diretórios extraídos; o browser real executou os testes. Nenhuma checagem ou dependência do CI foi removida. Resultado de CI/publicação deve ser conferido na execução mais recente de GitHub Actions; esta seção registra a evidência local, não antecipa o deploy.

### Primeira execução completa no CI

A execução `40239176184` aprovou 37/40 testes, incluindo **todos os novos testes mobile em Classic e Modern nos dois browsers**. O gate corretamente bloqueou o deploy. Restaram duas confirmações falsas de persistência em Chromium e um timeout de abertura do menu Modern no WebKit.

Foi identificada uma corrida de interface: `saveSettings` preservava o texto de sucesso de uma gravação anterior enquanto a nova transação ainda aguardava `oncomplete`. Tanto um preset quanto `selectClassic` já tinham colocado esse mesmo texto na tela; automação/navegação podiam interpretar o sucesso antigo e recarregar antes da gravação nova terminar. A interface agora anuncia “Armazenando configurações…” antes de iniciar a gravação, e só confirma sucesso depois do commit IndexedDB. Revisão independente concordou com o diagnóstico.

O primeiro frame HD no WebKit pode ocupar o processo além dos cinco segundos padrão de uma asserção. A confirmação de consumo do comando de carga e a restauração da munição usam agora o orçamento de 120 segundos já existente para startup, dentro do teste de 600 segundos. As verificações de menu, conteúdo restaurado e digest permanecem. A fonte EDGE fixada foi consultada e confirma que `MenuClear` sucede a solicitação diferida, enquanto `GameDoLoadGame` só executa no ciclo seguinte.

### Prontidão e suspensão cooperativa do Moderno

A versão integrada `9bde476` aprovou 41/42 testes no CI; restou a carga inicial de save HD no WebKit. A avaliação do menu excedeu até os 42 segundos restantes do orçamento compartilhado, sem retornar um valor. Portanto a investigação deixou de tratar o caso apenas como uma asserção de cinco segundos.

A fonte EDGE mostra `EdgeDisplay` antes de `TryRunTicCommands`, yield Asyncify dentro de SwapBuffers e `busy_wait` ativado por padrão. Um contador de comandos observado durante esse yield não prova que o frame/tick terminou. A adaptação web agora sinaliza `onTickComplete` somente depois de `EdgeTicker` retornar. Após dois ciclos completos em Level e tics >2, o host realiza a pausa inicial **dentro desse callback**, antes do retorno de WebTick; só então confirma o motor pronto. O polling posterior não pode pausar um terceiro ciclo em andamento. O build web também desativa a espera ocupada: os caminhos de espera cedem via `emscripten_sleep(5)`, permitindo timers/input JS com relógio lógico congelado. Simulação de 35 Hz e formatos de save permanecem; a política de espera muda e não se afirma latência idêntica.

O motor foi recompilado localmente com a toolchain fixada. O cenário Modern mobile foi reforçado: pausa lógica disparada dentro do callback pré-SwapBuffers, heartbeat JavaScript durante a pausa, tics estáveis, retomada de tics, movimento, tiro, save e rotação. Passou em Chromium (14 s) e WebKit (18 s), dois testes. A carga completa HD permanece dependente da nova execução de CI; esses testes locais não certificam o pacote HD ou um aparelho físico.

A main integrada já define limite de 60 minutos para acomodar instalação fria dos browsers (cerca de 12 minutos na execução anterior), os três motores e os 42 testes; esse limite foi preservado. Nenhum teste/assert foi removido. Os logs de startup registram a conclusão de aquecimento e o envio único de carga, sem reenviar F3 por retry.
