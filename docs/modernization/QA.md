# Revisão independente da modernização

Data: 25/10/2026. Revisor: agente `doom_qa`, separado dos autores de interface, gameplay e apresentação. Escopo: diff de C/TypeScript, ciclo de vida, dados, apresentação, áudio e testes. Esta revisão não equivale a teste em iPad físico ou playtest humano.

## Achados

| ID / severidade | Local afetado | Evidência e impacto | Correção recomendada / estado |
|---|---|---|---|
| Q1 — Médio | `web/main.ts`, tratamento de teclado da interface | O retorno por V/Esc/Backspace ocorria depois do retorno antecipado para checkbox/select. O rodapé anunciava esse caminho, mas os novos campos não o executavam; Tab até Voltar ainda funcionava | Tratar retorno dos campos não textuais antes do retorno antecipado. Corrigido pelo integrador; seis combinações de campo/tecla aprovadas no reteste abaixo |
| Q2 — Médio | `engine/bridge.c:web_suspend`, Web Audio | Em Chromium 141, evento blur mostrou cartão suspenso e congelou lógica, mas AudioContext continuou `running`: 32 callbacks em 350 ms, pico PCM 0,0611. Pode continuar som e processamento enquanto a partida está suspensa | Suspender também AudioContext; retomar somente no gesto de teclado permitido. Corrigido pelo integrador; suspensão de callbacks e retomada aprovadas no reteste abaixo |
| Q3 — Médio | `engine/bridge.c:web_mix`, rótulos/documentação de áudio | Música OPL em volume 0 mantém saída residual por atenuação finita; chamar isso de silêncio exato não é correto. Com efeitos 0 e música 0, após 1,5 s de estabilização, pico PCM 0,00302; música 6: 0,0658; música 15: 0,4243; novo 0: 0,00281. Volumes mudam a saída, mas 0 não prova mute | Implementar mute efetivo por canal na integração ou retirar promessa de silêncio exato. Efeitos já iniciados também podem ter cauda. Corrigido pelo integrador com gate somente da contribuição OPL; reteste aprovado abaixo |
| Q4 — Baixo | `docs/modernization/GAMEPLAY.md` | Texto inicial dizia música padrão 8 e reaplicação ao retomar; a integração passou a usar padrão legado 6 e preserva ajuste nativo durante retomada | Corrigido: documento agora informa default 6, aplicação em início/save e preservação do volume nativo ao retomar |

Nenhum achado crítico ou alto foi identificado nesta revisão até a inspeção e as verificações abaixo. Isso não antecipa aprovação do pipeline final. Os estados das correções e dos retestes finais pertencem ao relatório de release do integrador; os registros acima preservam a evidência inicial.

## Inspeção técnica

- `web_comfort` inverte apenas a ação lógica Shift; `G_BuildTiccmd` mantém velocidades vanilla e a física não é substituída. Reset limpa teclas físicas e restaura somente o default da ação de corrida. Os testes integrados precisam confirmar menus, perda de foco e saves.
- `web_mix` limita valores 0–15 e usa a escala nativa ×8. Os sliders nativos e seletores de estado usam as mesmas variáveis. Alterações não são novos assets sonoros.
- A captura CRT ocorre no callback síncrono após o `SDL_RenderPresent` de frames, sem alterar a chamada de criação do renderer. A fonte não fica transparente antes de um upload concluído; contexto perdido e falhas removem a camada e restituem a fonte.
- Shader, textura, buffer e programa têm limpeza explícita, inclusive alocação parcial. A camada não recebe entrada; o foco continua no Canvas original. A pausa tem prioridade visual sobre o passe.
- O pós-processamento é opcional e mantém framebuffer, HUD autoritativo e tics originais. Não equivale a nova geometria, alta resolução interna, widescreen ou simulação a 60 Hz.
- Campos novos são sanitizados com limites finitos e default conservador; bindings válidos e parâmetros legados são preservados. Não houve renomeação de IndexedDB, diretórios de save ou IDs de PWA.
- Recursos novos são TypeScript/C/CSS/SVG inline próprios, sem CDN ou backend. A regra de precache da aplicação continua incluindo os artefatos compilados e preserva ativação segura.

## Verificações executadas pelo revisor

Chromium desktop headless 141.0.7390.37, Linux na nuvem, build local em `http://127.0.0.1:4173`, Freedoom Phase 1 0.13.0 E1M1:

1. Inicialização real, retorno por Enter e áudio PCM não nulo, sem erro JavaScript observado.
2. Suspensão por blur: resultado inicial Q2 acima, com leitura do AudioContext e callbacks reais.
3. Volume pelo menu nativo, usando teclado: P → O → Enter → ↑ → Enter → → → ↓ → ←. Efeitos passaram de 8 a 9 e música de 6 a 5. Após fechar menus, H e Configurações, a interface mostrou 9/5; integração coerente.
4. Comparação PCM em volume 0/6/15/0 com efeitos 0, sem menus durante a medição e janelas separadas de estabilização/coleta. Comprovou mudança de amplitude e a limitação de mute Q3. São medições de PCM, não avaliação acústica.

A suíte C, Node, Playwright Chromium/WebKit, offline com servidor desligado, screenshots comparáveis, atualização e regressões são executadas pelo coordenador e registradas no relatório final. Não se declara aprovação delas por observar apenas código ou relato de implementadores.

## Limites e riscos restantes

- Não houve iPad, teclado Bluetooth físico, escuta humana, medição de consumo ou latência física.
- Não se mediu tempo isolado de GPU ou RAM total. Os tempos do passe são CPU/API; a cadência rAF não é FPS sustentado do renderer.
- DOOM comercial depende de WAD autorizado do usuário; as verificações aqui usam Freedoom livre.
- Percepção de conforto, legibilidade em cada tela e escolha dos presets ainda exigem avaliação do jogador.

## Reteste independente das correções

Executado no Chromium 141.0.7390.37 contra o build de integração `a84b5f6e17af568c`, novo contexto, mesma fase livre. O implementador adicionou suspensão de Web Audio, reconciliação da intenção de áudio e gate da contribuição OPL em volume zero. A revisão estática confirmou que `OPL3_GenerateStream` e o avanço dos eventos de música continuam acontecendo enquanto o passe OPL está silenciado, sem apagar o stream de efeitos.

- **Q1 fechado:** V, Escape e Backspace com foco em `alwaysRun` e em `presentation` retornaram ao launcher: seis combinações aprovadas.
- **Q2 fechado no reteste:** blur levou o contexto a `suspended`; após estabilização, o contador permaneceu 73→73 e o tic 201→201 durante 300 ms. Enter real retomou `running`.
- **Q3 fechado:** com contexto `running`, efeitos/música 0/0 produziram 42 callbacks em 450 ms com pico PCM exatamente 0. Efeitos 0/música 6 produziram pico 0,06412. Efeitos 8/música 0 permaneceram em pico 0 em repouso; ao disparar com J, pico 0,25098. Assim, o mute de música não suprime os tiros. As coletas aguardaram 1,2 s de estabilização, distinguindo caudas de efeitos anteriores.
- **Q4 fechado por inspeção:** defaults e política de persistência/retomada atualizados em `GAMEPLAY.md`.
- Dez sequências blur→Enter dentro da mesma tarefa terminaram com áudio `running` e cartão oculto; uma sequência terminada em blur ficou `suspended`, e Enter real retomou. Não houve erro JavaScript observado.

Depois desse reteste, o implementador limitou a reconciliação assíncrona a alterações de intenção, evitando repetição sem limite em estados interrompidos específicos de plataforma. A inspeção estática aprova essa redução de escopo; o reteste dessa última revisão do helper será registrado abaixo quando o artefato final estiver pronto. O comportamento de WebKit/iPad interrompido pelo sistema não foi executado fisicamente.

### Reteste do helper final

Novo contexto Chromium, artefato `2cc54a82c94e0248`, com a reconciliação limitada a mudança de intenção: dez ciclos imediatos blur→Enter terminaram `state=running`, `webAudioWanted=true` e cartão oculto. Uma sequência blur→Enter→blur terminou `state=suspended`, `webAudioWanted=false` e cartão visível. Enter real retomou `running/true`. Aprovação independente dessa correção concluída. Não restam achados críticos/altos nem Q1–Q4 abertos nesta revisão; a aprovação do pipeline completo e as limitações de hardware continuam separadas.
