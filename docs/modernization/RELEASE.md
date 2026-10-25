# Modernização 0.2.0 — execução e validação

Data: 25/10/2026. Base anterior: `3166c39054d8fa15c6e3d1fa526df22ed8e00c5c`. Produto: DOOM Classic Browser, porte real de Chocolate Doom C/WebAssembly. Publicação: https://adhenawer.github.io/Doom-classic-browser/.

## Resultado para o jogador

Launcher industrial redesenhado, menu com foco explícito, conteúdo/perfil selecionados e orientação antes da partida. Configurações reúnem presets Clássico/Precisão/Ágil, valores de giro, Correr continuamente, Nítido/Suave/CRT, brilho, música e efeitos independentes. As opções são persistentes, reversíveis e incluídas nos backups. Restaurar experiência clássica preserva remapeamentos, conteúdo e saves.

O motor continua renderizando mapas reais. Simulação de 35 Hz, auto-aim, velocidades, armas, inimigos, colisões e HUD autoritativo permanecem Classic. Conforto inverte apenas a entrada Shift. CRT é pós-processamento experimental da imagem, com fallback; não é renderer de geometria novo, resolução interna maior, widescreen ou câmera vertical. Não há dependência de mouse, Pointer Lock, toque ou rede durante o jogo preparado.

Áudio também para quando a aplicação suspende a partida. Pedidos rápidos de suspensão/retomada respeitam a última intenção. Zero de música agora silencia exatamente sua contribuição OPL, preservando efeitos; a síntese e o avanço do tempo musical não são interrompidos por esse mute.

## Execução do roadmap

| Etapa | Evidência e decisão |
|---|---|
| M00 — baseline | [baseline.json](evidence/baseline.json), [launcher anterior](evidence/before-launcher.png), [cartão anterior](evidence/before-level.png); contexto, commit, IWAD/hash e limitações registrados |
| M10 — direção | [DESIGN.md](DESIGN.md): terminal industrial, hierarquia, foco, procedência e prioridades |
| M20 — interface | HTML/CSS originais e configurações integradas; desktop/estreito e fluxos sem mouse |
| M30 — apresentação e resposta | Presets, brilho e modos reversíveis; comparação na mesma cena em [evidências](evidence/) |
| M40 — áudio | Volumes nativos e mute, suspensão de contexto; [revisão independente](QA.md) inclui PCM e alternância rápida de foco |
| M50 — fatia visual | Freedoom E1M1 com efeito autoral e HUD original; [ASSETS.json](ASSETS.json), capturas e custo medido |
| M60 — estudo/protótipo | [RENDERING.md](RENDERING.md): base/alteração de renderer/Crispy comparados; passe WebGL executável integrado. Crispy não foi compilado/adotado; outro renderer de geometria permanece estudo específico |
| M70 — gameplay | [GAMEPLAY.md](GAMEPLAY.md): protótipo `comfort-v1` compatível e proposta `assist-v2` com fronteiras de saves antes de alterar regras. Novas regras não foram habilitadas |
| M80 — release | Testes, revisão independente, distribuição de fonte/licenças, publicação via Actions e rollback abaixo |

## Testes

- Build WASM na imagem Emscripten fixada e build TypeScript/Vite: aprovados.
- Testes Node: **11/11 aprovados**; suíte C de rotação com `-Wall -Wextra -Werror`: aprovada.
- Playwright no build de produção: **16/16 aprovados** (oito cenários em Chromium e oito em WebKit desktop Linux).
- Cenário offline ampliado e repetido isoladamente: **2/2 aprovados**, com servidor HTTP desligado, CRT/brilho/Conforto/música zero persistidos, save carregado e comando de corrida real.
- Fluxos de interface, game feel, áudio e CRT revisados independentemente; nenhum crítico/alto aberto.
- Publicação só ocorre após repetir os gates no GitHub Actions; o link de execução fica no histórico de Actions do repositório.

Os testes existentes cobrem IWAD livre real, fase renderizada, WASD/setas simultâneos, aceleração/limite/soltura, aliases, remapeamento, menus, foco, áudio não nulo, saves, importação/exportação de backup e rejeição de caminhos inválidos. Novos testes cobrem migração de preferências legadas, presets, caminhada/corrida vanilla e inversão por Shift, reset, retorno ao perfil Classic carregando o mesmo save, volumes independentes, mute, suspensão/retomada de áudio e retorno nos novos campos.

O teste CRT lê pixels reais sincronamente após renderização, verifica foco/movimento, pausa e perda real do contexto do efeito com continuação dos tics. WebGL ausente é tratado como fallback, e o relatório de teste deve distinguir fallback de shader exercitado. A prova offline encerra o servidor HTTP em um subdiretório e reabre o motor/save sem fallback de rede.

Revisão por agente separado dos autores: quatro achados médios/baixos corrigidos, sem crítico/alto aberto. [QA.md](QA.md) preserva evidências iniciais e retestes. A primeira execução local teve uma corrida no teste novo (Enter antes do menu de save abrir); o teste passou a aguardar o estado real do motor, como a suíte anterior. Nenhum resultado em hardware físico foi declarado.

## Medições e limites

[Dados completos](evidence/after.json), [launcher novo](evidence/after-launcher.png), [Nítido](evidence/after-level-sharp.png) e [CRT](evidence/after-level-crt.png). O JSON identifica o build medido por hashes de WASM/JS/CSS e registra a árvore ainda modificada antes do commit.

| Modo / cache | Iniciar fase | Cadência rAF p95 | Passe CPU/API p95 | Long tasks na janela |
|---|---:|---:|---:|---:|
| sharp / cold | 3.60 s | 33.4 ms | 0.0 ms | 0 |
| sharp / warm | 2.29 s | 33.4 ms | 0.0 ms | 0 |
| crt / cold | 3.77 s | 50.1 ms | 10.5 ms | 15 |
| crt / warm | 2.31 s | 66.6 ms | 12.3 ms | 23 |

Runtime: **29.78 MiB**, 16 recursos precacheados, sem CDN. O download de código-fonte é separado.

Na baseline, iniciar a fase levou 3,81 s / 2,25 s (frio/quente), com rAF p95 33,3 / 33,4 ms. Nítido manteve a cadência observada dentro da variação dessas amostras; não há prova de ganho de desempenho. **CRT custou mais:** houve aumento de p95/long tasks no executor; por isso fica experimental, opt-in e desligado por padrão. Não promover como modo de desempenho. O número de long tasks não estava instrumentado na captura anterior; não é uma comparação dessa métrica com a baseline.

Orçamento adotado para esta fatia: padrão sem novo contexto/loop e sem regressão funcional; tolerância proposta de 10% sobre p95 rAF da baseline neste executor, atendida pelas amostras Nítido. Isso é um guardrail de laboratório, não certificação de hardware. O CRT não atende um objetivo de igualar o custo de Nítido e não é elegível como padrão nesta release.

O método usa `scripts/measure-browser.mjs`, Chromium headless Linux, 1180×820, Freedoom 0.13.0 E1M1 e 180 callbacks rAF por amostra, duas amostras por modo. Inicialização fria/quente significa contexto/cache do browser; não mede download por uma conexão móvel real. Capturas mostram apresentação e legibilidade observada pelo revisor, não percepção validada por jogadores. O cartão de partida suspensa mudou entre as capturas iniciais/finais; a comparação Nítido/CRT usa a mesma implementação e a cena de spawn, sem teclas.

Cadência de rAF não é FPS de renderização do motor. `renderMs` mede CPU/API de upload e submissão do passe, não GPU. Latência física/Bluetooth, consumo, temperatura, memória total do browser, sustentação de desempenho em tablets e qualidade de escuta são **não medidos**. O heap configurado não equivale à RAM total. A opção CRT acrescenta um contexto, textura e upload de imagem; mantenha Nítido se o custo ou leitura não forem adequados no dispositivo.

## Conteúdo, dados e distribuição

Nenhuma dependência npm nova. SVG/CSS/shader próprios, licença GPL-2.0-or-later e hashes no manifesto de assets. Freedoom e seus créditos permanecem BSD; nenhum conteúdo comercial novo. Não há telemetria nem upload de IWADs/saves. IndexedDB legado, filesystem, save paths, ID/escopo da PWA e origem existentes são preservados. Novos campos ausentes em backups/preferências recebem defaults conservadores.

O build inclui `source.tar.gz` com fontes correspondentes e dependências fixadas; é download separado, não parte do cache de execução. Scripts e toolchain continuam fixados; o código vendorizado upstream não é editado diretamente. O pipeline compila o motor a partir das adaptações, testa e só então publica.

## Abrir e atualizar

1. Abra a URL publicada com conexão no browser/perfil em que você joga.
2. Se já havia uma versão aberta, feche **todas** as abas/instâncias do jogo e reabra para ativar a atualização completa. Não apague os dados do site.
3. Aguarde “Preparado para offline neste contexto”. Em Configurações, escolha os ajustes e salve.
4. Entre em Jogar e pressione Enter no cartão para retomar/tentar liberar áudio. WASD move, setas giram, J atira, E interage, P abre menu e H abre interface; remapeamentos têm prioridade.
5. Salve, feche, desligue a conexão e reabra no mesmo browser/perfil/contexto. Carregue o save e confira as preferências.

## Rollback e pendências

O rollback de experiência é **Restaurar experiência clássica**; preserva remapeamento e saves. O rollback de código é reconstruir/publicar a revisão anterior `3166c39` pelo workflow, sem apagar IndexedDB/IDBFS. O Service Worker só ativa a versão completa após encerrar os clientes; essa regra também vale no rollback.

Pendências humanas: [checklist geral](../BROWSER-CHECKLIST.md), [Chrome no iPad](../IPAD-CHECKLIST.md), escuta/legibilidade/conforto e avaliação de desempenho no dispositivo. Geometria moderna, alta resolução interna, novos mapas/assets e regras de combate da proposta `assist-v2` não estão implementados nesta versão.
