# Direção de experiência — M10/M20

## Intenção

DOOM Classic Browser deve dar vontade de jogar e tornar a preparação compreensível. A direção visual é um terminal de acesso a uma instalação industrial: carvão, oliva, marfim e âmbar, composição firme, pistas curtas e foco explícito. A leitura deve anteceder a ornamentação. Não simula uma interface oficial da id Software nem copia assets dos títulos modernos.

A primeira fatia moderniza o launcher, configurações e orientação inicial. O mundo continua sendo renderizado pelo motor real e com o conteúdo do IWAD escolhido. O jogador pode ajustar apresentação e controles sem perder o caminho Classic. CSS, ilustração do launcher e tamanho da captura não representam resolução interna maior ou iluminação nova no mundo.

## Sistema visual

- Fundo `#111210`, superfície oliva `#1d211a`, texto `#ecece2`, texto secundário `#acafa0`, destaque `#e5ba70`.
- Marca em fontes de sistema condensadas quando disponíveis; corpo em fontes de sistema sem serifa; metadados e teclas em monospace. Não há fontes remotas ou novos arquivos de fonte.
- Ação Jogar com preenchimento âmbar; demais ações numeradas e agrupadas. Números são decorativos, não novos atalhos.
- Foco de teclado por contorno de 3 px e afastamento de 4 px; contraste de estado também em preenchimento. Não depender apenas do hover ou de animações.
- Corredor geométrico original: perspectiva simples, silhueta de porta, faixas de luz e volumes. Ilustração identificada como ambientação, escondida de leitores de tela e sem interação.
- Sem animações contínuas; transições curtas de botões respeitam `prefers-reduced-motion`. Sem vinheta ou elementos do launcher sobre a partida.

## Fluxos e teclado

A ordem inicial é preservada: Jogar, Selecionar conteúdo, Importar WAD, Configurações, Controles, Carregar jogo e Gerenciar saves e backups. Setas navegam no menu; Enter ativa; V/Backspace retornam. A importação continua pelo seletor nativo de arquivos. Os campos de opções mantêm controles HTML reais, rótulos e foco visível.

O painel de conteúdo e o perfil selecionado aparecem no launcher, atualizados pela integração TypeScript. A mensagem de estado continua em `role=status` com anúncio educado; a preparação offline deve depender do resultado real do cache, não de uma luz verde decorativa.

Ao iniciar ou retornar de perda de foco, o cartão suspenso orienta Enter/áudio e controles padrão. A legenda avisa que remapeamentos continuam ativos. O cartão desaparece ao retomar: nenhum botão ou joystick visual fica sobre a jogabilidade.

## Responsividade

Duas colunas em paisagem/desktop: contexto e ilustração à esquerda, menu ou opções à direita. Em larguras abaixo de 700 px, uma coluna sem largura mínima fixa. Painéis de configurações rolam internamente em paisagem; em telas estreitas, a página pode rolar. Tela cheia mantém o Canvas em 4:3, sem esticar a geometria.

As capturas comparáveis de launcher e fase ficam em `evidence/`, produzidas pelo coordenador com as mesmas condições. Conferir 1180×820 e um viewport estreito; esses testes não substituem o Chrome no iPad físico nem pesquisa com jogadores.

## Procedência

| Recurso | Autor/origem | Licença | Arquivo-fonte e modificação |
|---|---|---|---|
| Ilustração do corredor | Criada para este projeto pelos agentes nesta tarefa; geometria vetorial original, sem modelo ou textura externo | GPL-2.0-or-later, como o port | SVG inline em `web/index.html`; cor e composição próprias |
| Identidade e estilos | Criados para este projeto pelos agentes nesta tarefa | GPL-2.0-or-later | `web/style.css` |
| Fontes | Fontes instaladas no sistema do jogador; não redistribuídas | Licenças dos respectivos sistemas | Pilhas CSS locais; sem download |
| Mundo/sons de Freedoom | Freedoom 0.13.0, já incluído pelo projeto | BSD de 3 cláusulas | IWAD e créditos existentes, sem modificação nesta fatia de interface |

O hash dos arquivos-fonte pode ser obtido na revisão Git que inclui a entrega. Não são distribuídos assets de DOOM comercial ou de seus jogos modernos por meio desta direção visual.

## Aceite e limites

A estrutura preserva IDs, ordem de ações, elementos nativos, textos de estado, instalação e dados. As verificações da integração incluem fluxo por teclado, configurações, remapeamento, suspensão, jogo real, saves e reabertura offline. Capturas são evidência de implementação e composição, não prova de acessibilidade integral, aumento de FPS ou melhoria perceptiva confirmada por jogadores.

Não foram realizados playtests humanos nem testes físicos de teclado Bluetooth nesta fatia. Caso o guia padrão no cartão suspenso não corresponda a um remapeamento, a indicação de padrões e o painel Controles são o caminho de consulta; uma legenda derivada dos bindings pode ser uma melhoria posterior.

## Verificação local desta fatia

Foi aberto o launcher no Chromium desktop headless em 1180×820 e 390×844. A largura de rolagem observada foi igual à largura do viewport nos dois casos (sem overflow horizontal). Foco inicial em Jogar, três setas para baixo e Enter abriram Configurações; V voltou ao menu. As capturas foram inspecionadas visualmente. O ambiente dev não confirma o Service Worker de produção; a preparação offline é validada na suíte de integração do build pelo coordenador.

## Inspeção da integração final

As capturas `evidence/after-launcher.png`, `after-level-sharp.png` e `after-level-crt.png` foram inspecionadas após a integração. No launcher, ação primária e foco se distinguem das demais opções; conteúdo/perfil e estados permanecem separados da ambientação. Na cena inicial de Freedoom E1M1, Nítido e CRT preservam enquadramento 4:3, arma e HUD completos, com valores de vida/munição legíveis na captura. O CRT suaviza e escurece levemente bordas e detalhes; não foi observado bloqueador visual nessa cena. O revisor desta seção foi autor da interface, mas não do módulo gráfico: esta inspeção complementa a revisão independente de QA e não substitui essa revisão nem um playtest humano.

O custo adicional observado em `evidence/after.json` (p95 de 10,5–12,3 ms de CPU/API do passe, com aumento de long tasks) reforça manter Nítido como padrão e CRT como escolha experimental reversível. A captura inicial não testa inimigos em movimento, outros ambientes, dificuldade de leitura em telas pequenas ou luz ambiente. Recomenda-se voltar a Nítido e ajustar brilho caso a vinheta/linhas reduzam leitura ou conforto; não há recomendação de CRT como melhoria universal de qualidade ou desempenho. Não foram realizados teste de escuta, medição física de latência ou teste no iPad nesta inspeção.
