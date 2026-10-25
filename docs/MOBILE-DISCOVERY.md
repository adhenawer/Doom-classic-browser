# Discovery de controles mobile

Data: 25/10/2026. Escopo: levar o porte existente a touch mantendo o teclado completo, as duas resoluções de motor, os saves e a preparação offline. Coordenação: `doom_director`; análise independente: `doom_ux`.

## Evidência e limites

Foram lidos `README.md`, `docs/ARCHITECTURE.md`, `agents/TEAM.md`, `agents/roles/ux.md`, `web/input.ts` e os caminhos de menu/texto/entrada de `web/main.ts`. São fatos locais verificados: a entrada web usa ações remapeáveis e aliases; o motor conserva auto-aim vertical e 35 Hz; os menus e os nomes dos saves pertencem ao motor; a interface HTML já oferece botões operáveis por toque.

A comparação abaixo é uma análise de padrões conhecidos dos jogos, baseada em conhecimento prévio, e não uma auditoria das versões atuais. Tentativas de consulta aos sites oficiais em 25/10/2026 falharam antes de obter HTTP: o proxy de rede configurado estava indisponível (`curl: (7) Failed to connect to proxy`). Não foram executados esses jogos nem medidos seus controles. Links são referências para consulta posterior, sem alegação de conteúdo verificado nesta sessão, ranking de popularidade, afiliação ou endosso.

## Referências de interação

| Referência | Padrão conhecido a considerar | Aplicação ao porte |
|---|---|---|
| [Call of Duty: Mobile — suporte oficial](https://support.activision.com/cod-mobile) | Movimento sob o polegar esquerdo, câmera à direita, ações de combate separadas; modos de tiro e personalização do HUD | Separar movimento, giro e tiro. Preferir tiro manual segurável, preservando a decisão do jogador e o comportamento do DOOM |
| [PUBG Mobile — site oficial](https://www.pubgmobile.com/) em perspectiva FPP | Joystick esquerdo, câmera por arraste, corrida e ações contextuais; combinações de vários dedos | Identificar cada contato por `pointerId`; mover, girar e atirar precisam coexistir sem um dedo cancelar o outro |
| [Standoff 2 — ajuda oficial](https://help.standoff2.com/) | FPS com câmera por arraste, joystick e botões próprios de tiro e troca de armas | Priorizar botões alcançáveis de tiro, usar e arma; preservar a leitura do mundo e do HUD |

Esses padrões são a hipótese inicial de ergonomia. O layout deve ser validado com pessoas em celulares e tablets. Não copiar HUDs, ícones, imagens ou assets dos jogos citados.

## Decisões para este DOOM

1. Joystick no canto inferior esquerdo: frente/trás e deslocamento lateral. Zona morta evita movimento acidental. Nesta primeira integração, ações digitais reutilizam a entrada existente; não chamar o movimento de analógico se não houver magnitude proporcional no motor.
2. Controle de giro à direita: desloque e mantenha o dedo fora da zona morta para girar continuamente, sem Pointer Lock. A implementação reutiliza a rampa digital do teclado, em vez de implementar deslocamento angular proporcional ao arrasto dos FPS de referência. Indicar claramente seu uso. Preservar a câmera e o auto-aim vertical clássicos: arraste vertical não cria freelook. Não adicionar ADS, pulo, agachar ou recarga, que não pertencem a esta simulação.
3. Tiro manual segurável em botão grande, com usar/abrir portas e troca de arma próximos. Se o giro for por arraste independente, validar o uso simultâneo de giro e tiro; não presumir que três dedos sejam confortáveis para todos.
4. Correr, mapa, menu/pausa e retorno à interface devem estar disponíveis na tela. Os aliases do teclado e o remapeamento continuam funcionando mesmo com o HUD touch visível.
5. No menu DOOM, trocar as ações de combate por navegação explícita: setas, confirmar, voltar, sim/não. A tela desenhada no Canvas não torna suas opções clicáveis; os botões devem enviar comandos de menu existentes.
6. Durante nomes de save, oferecer campo HTML para acionar o teclado virtual e enviar texto aceito pelo motor, mais confirmar e cancelar. Não deixar o fluxo salvar/carregar dependente de teclado físico.
7. Na suspensão, perda de foco, troca de modo, rotação da tela, `pointercancel` e perda de captura, soltar entradas touch e impedir movimento/tiro presos. Soltar touch não pode soltar a mesma ação ainda segurada pelo teclado.
8. Detectar capacidade de interação (`pointer: coarse`, `hover`, `maxTouchPoints`), não apenas largura ou nome do browser. Um notebook estreito continua desktop; um tablet em “site para computador” pode precisar de touch. Oferecer escolha manual Automático/Touch/Desktop para dispositivos híbridos e preferências pessoais.
9. Usar alvos de ao menos 44–48 CSS px como meta de projeto, contraste sobre o jogo, safe-area de recortes e margens para gestos do sistema. Evitar bloquear zoom globalmente; suprimir gestos de rolagem apenas na superfície do jogo. Paisagem obrigatória no mobile: vertical suspende a partida e apresenta aviso de rotação; solicitar trava de orientação apenas quando a API permitir.
10. Todos os recursos devem entrar no bundle/cache existentes, sem dependência de rede durante o jogo. Não mudar bancos, saves, IWADs ou engine para portar a entrada.

## Correspondência com teclado

| Touch | Ação existente / tecla padrão |
|---|---|
| Joystick frente/trás | `forward`/`backward`: W/S ou ↑/↓ |
| Joystick lateral | `strafeLeft`/`strafeRight`: A/D |
| Giro à direita | `turnLeft`/`turnRight`: ←/→ |
| Atirar | `fire`: J/Ctrl esquerdo |
| Correr | `run`: Shift; respeitar a inversão de correr continuamente |
| Usar | `use`: Espaço/E |
| Próxima/anterior arma | `next`/`previous`: Q/R |
| Mapa | `map`: M/Tab |
| Menu | `menu`: P/Esc |
| Salvar/carregar | `save`/`load`: K/L ou F2/F3; também via menu nativo |
| Interface | `shell`: H/F10 |
| Navegar/confirmar/voltar | Setas, Enter e Backspace; Y/N em perguntas |

As ações touch devem ser independentes dos códigos físicos remapeados: mudar W para outra tecla não deve quebrar o joystick.

## Aceite e validação

- Emulação mobile abre com HUD touch e instruções adequadas; desktop comum abre com teclado. Mudança de preferência é reversível e a seleção automática é testada em capacidades distintas.
- Mover + girar + atirar funcionam simultaneamente; cancelar cada ponteiro afeta apenas sua ação. Combinar teclado com touch não perde teclas pressionadas.
- Joystick e tiro são liberados ao suspender, abrir menu ou trocar orientação. Não há rolagem ou seleção de texto na superfície de controle.
- Jogador sem teclado consegue iniciar, pausar, abrir portas, trocar arma, consultar mapa, salvar com nome, carregar e retornar à interface.
- Fazer capturas de launcher e partida nos mesmos estados/cenas Freedoom em desktop e mobile, verificar retrato/paisagem e ausência de sobreposição entre os próprios controles.
- Rodar suítes de entrada, build e E2E para Chromium/WebKit disponíveis. Reabrir preparado offline com controles locais. Os resultados precisam registrar os testes efetivamente executados.
- Validação em iPhone/iPad/Android reais e conforto em sessão prolongada permanecem pendentes até playtest físico; emulação não certifica esses dispositivos. Latência, autonomia e desempenho sustentado não foram medidos neste discovery.

Rollback: reverter os commits da camada touch e sua integração, preservando os dados locais e os caminhos de engine existentes. A escolha Desktop oferece recuperação imediata da apresentação de teclado.
