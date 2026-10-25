# Revisão independente — Moderno HD

Revisão de integração em 25/10/2026, especialidade `doom_qa`, sobre a base 0.3.0 (`d73fac9537469c64ad7186cde456f58a9481b3ef`). O escopo inclui motor GPU real, controles, apresentação, áudio, saves, importação e offline, preservando Classic/Alta. Não houve teste físico no iPad, teclado Bluetooth, escuta humana ou medição de energia.

## Estado da validação

A repetição final Chromium/WebKit ainda está pendente após corrigir o harness WebKit descrito em Q9. Resultados anteriores não substituem essa rodada nem o gate integral do CI.

- Chromium aprovou os quatro cenários Moderno na versão monolítica `eeb84bce562ea0a6`.
- WebKit aprovou o cenário gráfico completo no transporte fragmentado `a768a36fe564dd36`, em 2,3 min, mais associação/migração e falha 404. O primeiro cenário incluiu três boots, pixels reais, controles, PCM, saves/backup/reload e load após trocar para 1280 sem HD e com HUD clássico.
- O offline fragmentado WebKit revelou um defeito do **contexto persistente WPE do harness**, isolado por um probe de API sem o aplicativo. O cenário será repetido no contexto padrão funcional, sem remover assert ou aumentar prazo.
- A suíte descobre 28 casos: 20 regressões existentes, preservadas, e 8 Modernos. O CI executa o conjunto completo antes da publicação.

Artefato atual para a repetição: `16f3315a5e696112`, 38 recursos. WASM: `1b9f6e3eb39e5ef870f4a59890448f3c4edb51ff4b42da2ad27995dd45ea1b8c`. EPK em MEMFS: 398.681.345 bytes, SHA-256 `f9a2cc0ea9f290af2b04a9b0227aef1fdad7596649e52101842ae6bbf8dc0562`, entregue em 12 partes de até 32 MiB. A fragmentação conserva integralmente os bytes finais e as 1.115 imagens, incluindo os dois materiais 4K.

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
