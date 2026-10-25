# Direção visual — Moderno HD

Base: 0.3.0. Escopo desta fatia: launcher, configurações e cartão de retorno. O mundo continua pertencendo ao motor real; o renderer HD é integrado separadamente. Prioridade definida pelo usuário: qualidade visual, sem orçamento artificial de download, CPU ou RAM. Isso não elimina limites de APIs, armazenamento ou hardware.

## Identidade

A direção evolui o terminal oliva para uma instalação sci-fi em carvão e aço azulado, com laranja quente e texto marfim. Ação principal em laranja, título condensado de grande escala, metadados monoespaçados e ações secundárias em linhas discretas. O menu conserva hierarquia e identidade quando o foco é de teclado; nenhum estado depende exclusivamente de hover.

A ambientação é uma ilustração vetorial original de corredor industrial, com profundidade geométrica, chapas, aberturas, grelhas, iluminação quente/fria e porta central. O caption identifica **ILUSTRAÇÃO**. Não é screenshot, renderer de gameplay, preview de PBR ou demonstração do novo motor. Ela não é mostrada sobre a partida.

O nome do produto e os dados são preservados. O conteúdo e o perfil reais continuam nos elementos atualizados por TypeScript, evitando badges falsos de capacidade ou disponibilidade offline.

## Sistema e acessibilidade

- Fundo `#0a0c10`; superfícies `#151a23`; texto principal `#eeece7`; secundário `#a8adb7`; destaque `#ff784f` e destaque suave `#ffd0b8`.
- Fontes locais de sistema. Não há CDN, fontes externas, imagem remota, telemetria ou dependência nova.
- Foco explícito de 3 px com afastamento, diferença de preenchimento e cor de contorno; ações usam os elementos HTML existentes.
- Ordem de ações, IDs, inputs de importação e textos funcionais mantidos. Os números decorativos não são atalhos novos.
- Nada de animação contínua, parallax ou luz piscante. Transições discretas de botões desativadas por `prefers-reduced-motion`.
- Canvas mantém apresentação 4:3 em tela ampla, sem controles de toque sobrepostos. A resolução interna é responsabilidade da integração do motor.
- Uma coluna abaixo de 700 px; duas em desktop/paisagem. Alturas pequenas reduzem título e espaçamento. Preferências longas mantêm rolagem do painel; foco não deve ser recortado na borda.
- O cartão suspenso destaca Enter, áudio e controles padrão; avisa que remapeamentos continuam ativos.

## Procedência

SVG inline em `web/index.html` e CSS foram criados para este projeto pelos agentes. Licença GPL-2.0-or-later, como os fontes do launcher; não reproduzem imagens, texturas, logotipos vetoriais ou modelos de um jogo comercial. Fontes instaladas no sistema não são redistribuídas. Nenhum asset novo de gameplay é introduzido por esta fatia.

## Verificação

Capturas e inspeção local do launcher devem registrar viewport, foco e ausência de overflow. Verificar navegação por setas/Enter/V, painel de configurações, foco visível, modo suspenso e viewport estreito. Esses testes não certificam acessibilidade integral, percepção subjetiva, desempenho do renderer ou Chrome no iPad físico. O coordenador integra a revisão independente e a regressão do jogo.

### Inspeção local realizada

Launcher aberto em Chromium 141 headless Linux, via servidor Vite de desenvolvimento, em 1180×820, 1024×768 e 390×844. Foco inicial em `Jogar`; três ArrowDown + Enter abriram Configurações; V retornou ao menu nos três tamanhos. Campo focado em Configurações exibiu outline sólido de 3 px. Largura de rolagem igual ao viewport em todos os tamanhos: 1180, 1024 e 390 px, sem overflow horizontal. A versão compacta cabe verticalmente em 1180×820; em 1024×768, a página observada tinha 778 px de altura; mobile usa rolagem de página.

Capturas inspecionadas de desktop e mobile: título, ação primária, foco, menu, teclas e metadados permanecem distinguíveis. A ilustração original fica fora da área de gameplay. Evidências de trabalho em `build/modern-ui-evidence/` são artefatos locais ignorados, não uma certificação do navegador físico. O dev não tem confirmação offline; a validação de cache de produção é responsabilidade da integração do coordenador. Não foram feitos playtest humano ou teste no iPad nesta fatia.

Checagem estrutural confirmou preservação de todos os IDs anteriores, inclusive referências SVG, sem duplicação. Em contexto Chromium com movimento reduzido, `transitionDuration` do botão foi `0s`. `git diff --check` passou.

## HUD Moderno nativo — recorte adicional

`engine/modern-hud.lua` redefine somente `new_overlay_status()` do script Lua nativo do EDGE. Usa cards discretos de saúde, armadura e munição em marfim/âmbar/aço; os números saem de `player.health()`, `player.total_armor()`, `player.main_ammo(1)` e o tipo/capacidade de munição do motor. Indicadores de chaves/cartões/skulls continuam usando o inventário nativo completo. Nenhum HUD HTML/JS tenta manter uma cópia do estado de jogo.

Fonte: `CON_FONT_2`, já definido em `edge_defs/scripts/fonts.ddf` como TrueType `ECFONT02.ttf` (Fira Code). `TTF_SMOOTHING=ALWAYS` já pertence à definição upstream. Os avisos SIL Open Font License e copyright estão no inventário preloaded `licenses/License Attribution.txt`; não há novo download ou fonte comercial. Texto do overlay usa caracteres ASCII para não depender de glifos UTF-8 fora do mapeamento do motor.

Integração sem recompilar WASM: depois da factory carregar seus arquivos e antes de `callMain`, ler `/edge_defs/scripts/lua/edge_hud.lua`, acrescentar o texto de `engine/modern-hud.lua` e regravar esse mesmo arquivo em MEMFS. `ProcessAllInPack` lê o diretório de suporte na inicialização; `ProcessLuaHUDInPack` entrega o script ao compilador Lua, e a última definição da função substitui o desenho do overlay. O launcher deve incluir o texto no bundle local/offline; não carregar código de servidor externo durante a partida.

O script preserva `draw_all()`, HUDs Classic 0/1, automap, `edge_air_bar`, `edge_time_bar`, passos e lifecycle do upstream. O estilo novo é chamado apenas no overlay nativo; valor 0 continua desenhando o HUD clássico. A seleção explícita desse estilo e sua persistência pertencem à integração do coordenador. O overlay novo exige teste de execução, leitura de valores antes/depois de tiro/dano, armadura/chaves, automap e captura comparável após a integração. A análise de API e fonte foi realizada; o script isolado não é prova de execução no browser.

Verificação isolada do HUD: sintaxe compilada pelo próprio Lua C fornecido no upstream fixado; harness de API confirmou os casos saúde100/armadura0/munição50, arma sem munição exibindo `--`, saúde negativa, capacidade de munição zero e as oito chaves/skulls. Quadros não recebem larguras negativas, e chamadas de `ammomax` não recebem o tipo zero. Esse harness não rasteriza fontes nem substitui captura/teste no motor integrado.

### Inspeção visual da integração real do HUD

Foi inspecionada a captura `build/modern-qa-chromium-nostore/modern-hd-Modern-default-r-8986a--native-saves-and-backup-v3-chromium/modern-real-gpu-hd.png`, produzida pelo caso Chromium da integração em viewport 1180×820. O Canvas aparece completo em 4:3, com margens laterais simétricas; arma centralizada e todos os três cards visíveis. Saúde, armadura e munição compartilham alinhamento superior e inferior, margens internas consistentes e afastamento das bordas do jogo. A arma permanece entre os grupos de informação, sem ser coberta pelos números.

Os valores **100**, **0** e **44** são distinguíveis sobre as superfícies escuras translúcidas. A tipografia monoespaçada TrueType evita o contorno de patch verde do overlay upstream. Rótulos pequenos funcionam como contexto secundário; valores e barras recebem a hierarquia principal. Âmbar/marfim e aço se relacionam com o launcher, enquanto os sinais clássicos de perigo do cenário continuam visíveis. Não foi observado corte, sobreposição indevida ou bloqueador de leitura nessa captura. Chaves ausentes da imagem não constituem prova visual do layout quando todas são possuídas; essa situação permanece coberta apenas pelo harness de estado até uma captura específica no motor.

A referência `docs/hires-evidence/high.png` da 0.3.0 mostra o HUD original completo e o mesmo IWAD, mas a pose/câmera, iluminação aparente e composição são diferentes. A comparação permite distinguir o desenho de HUD tradicional do overlay novo; **não é um benchmark pareado de detalhe por pixel, FOV, contraste ou desempenho**. Na imagem nova, o cenário tem contornos amostrados mais finamente e o overlay dá mais espaço vertical à cena do que a barra clássica. A arma continua sendo um sprite, com definição artística limitada pelo asset de origem; esta entrega não o transforma em modelo 3D nem comprova qualidade uniforme de todos os assets.

A captura anterior `build/modern-qa-probe.png`, que parecia mostrar corte e arma lateral, foi descartada da avaliação do produto: o harness de servidor omitia MIME CSS e o browser não aplicava os estilos. A integração corrigida e a medição do coordenador confirmaram Canvas CSS aproximadamente 1093×820 centrado em 1180×820, com drawing buffer/viewport 1920×1440. Não foi aplicada compensação artificial da posição da arma.

O piso tem padrões finos contrastados. É necessário observar câmera em movimento para avaliar aliasing temporal; uma imagem estática não demonstra cintilação. Nenhum resultado de benchmark 4K, consumo de recursos, teste físico no iPad ou avaliação humana de conforto é atribuído a esta inspeção. O revisor desenhou o launcher/HUD e inspecionou sua integração; essa inspeção complementa a QA independente do coordenador e não deve ser chamada de revisão de autoria independente.

### Correção de largura do título com fontes de sistema

O CI WebKit da revisão `55dec9d` encontrou `scrollWidth=397` em viewport 390 px. O cenário foi reproduzido em WebKit local disponibilizando DejaVu Sans Bold somente no harness como substituto de `Arial Black`: o título `DOOM`, com o tamanho já existente de 112 px e letter-spacing de -0,045 em, ocupava aproximadamente 374,7 px dentro de uma coluna de 346 px. Com margem esquerda de 22 px, a área de rolagem atingia 397 px. Os elementos que transbordavam eram `h1`, seu header e o contêiner principal; a diferença não vinha da resolução do motor.

A correção remove `Arial Black` da cadeia de fallback do título e solicita `Liberation Sans`/`Arial` antes da família genérica. Impact, Haettenschweiler e Arial Narrow Bold continuam prioritários quando instalados. Corpo, números, tamanhos de fonte e layout de foco permanecem iguais. Não há fonte nova distribuída, redução de texto nem ocultação de overflow da página. No mesmo cenário de fonte do harness, o título passou a caber na coluna e a largura da página voltou a 390 px. O font-face DejaVu de reprodução não é incluído na aplicação.

Após a correção, o smoke de launcher e Configurações passou em Chromium e WebKit nas três dimensões: 1180×820, 1024×768 e 390×844. Em ambos os browsers, `scrollWidth` foi respectivamente 1180, 1024 e 390, tanto no menu quanto no painel. Setas mantiveram foco entre Jogar/Selecionar conteúdo, Enter abriu Configurações, V retornou a Jogar e o foco do painel manteve outline de 3 px. O título continuou em 112 px no viewport estreito antes e depois da mudança. Capturas estreita/desktop WebKit foram inspecionadas; composição e leitura foram preservadas. Registro local: `build/modern-ui-evidence/font-fallback-verification.json` e capturas `*-fontfix-*.png`. Nenhum motor foi iniciado e nenhum artefato de `dist` foi reconstruído nessa verificação; hardware físico permanece pendente.

A integração posterior `087d000` também adotou escala de título proporcional (`25vw`) nas janelas estreitas. As métricas 397→390 e 112 px registradas acima identificam o ensaio isolado da troca de fallback sobre `cef5de7`, antes dessa integração; não descrevem o tamanho final do título em toda largura. O smoke de regressão da build integrada deve confirmar novamente ausência de overflow.
