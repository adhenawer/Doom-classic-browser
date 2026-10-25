# Perfil de validação: Chrome no iPad

Este é um perfil específico do **porte para browsers**. Use também o [checklist geral](BROWSER-CHECKLIST.md); o iPad é um dos dispositivos de uso.

**Este checklist está pendente. Nenhum resultado de hardware é inferido a partir dos testes Playwright.**

Registre modelo do iPad, versão do iPadOS, versão do Chrome, modelo/layout do teclado, modo aba ou tela inicial, data e observações. Para este perfil, a referência inicial é iPadOS 17 ou superior. A elegibilidade real depende das APIs detectadas e do comportamento medido.

## Preparação

- [ ] Abrir a URL HTTPS no Chrome, fora de navegação privada.
- [ ] Navegar por toda a interface com setas e Enter, sem mouse/trackpad.
- [ ] Iniciar Freedoom E1M1 e retomar com Enter.
- [ ] Confirmar som e música sem toque para desbloqueio. Se Enter não desbloquear, registrar como falha desse requisito.
- [ ] Importar DOOM.WAD ou DOOM1.WAD autorizado pelo app Arquivos; selecionar e reabrir o motor.
- [ ] Confirmar mapa original, HUD, armas e inimigos com o IWAD importado.

## Teclado e partida

- [ ] W, S, A e D individualmente.
- [ ] W+A, W+D, S+A e S+D.
- [ ] WASD junto com ←/→, J e Shift.
- [ ] Rotação contínua, aceleração, teto e parada imediata.
- [ ] Sensibilidade e desaceleração opcional após alterar configurações.
- [ ] ← e → juntos neutralizam a rotação; inverter reinicia a rampa.
- [ ] Espaço/E abrem portas; J atira; 1–7 e Q/R trocam armas disponíveis.
- [ ] M abre mapa; P abre e fecha menu; Enter confirma; V/Backspace volta.
- [ ] Menus originais de nova partida, opções, volume e dificuldade funcionam pelo teclado.
- [ ] K salva, nome pode conter P/V/H sem disparar atalhos, L carrega.
- [ ] Remapeamento funciona e permanece após fechar/reabrir.
- [ ] Setas e Espaço não deslocam a página durante o jogo.
- [ ] Testar Ctrl, Tab e Esc; registrar atalhos consumidos pelo sistema e usar alternativas.
- [ ] Alternar aplicativos, bloquear/desbloquear tela e voltar sem movimento preso.
- [ ] Desconectar/reconectar o Bluetooth enquanto uma tecla está pressionada; verificar soltura perdida e recuperação por H/Enter ou perda de foco.
- [ ] Tentar deslocamento, giro e tiro simultâneos; registrar limitações de rollover do teclado.

## Offline e dados

- [ ] Aguardar “Preparado para offline neste contexto”.
- [ ] Salvar, voltar com H e confirmar a mensagem de persistência.
- [ ] Fechar a página, ativar modo avião, confirmar Wi-Fi desligado e reabrir no Chrome.
- [ ] Iniciar fase e carregar save sem rede; confirmar música, efeitos e controles.
- [ ] Exportar e importar backup via Arquivos.
- [ ] Adicionar à tela inicial quando disponível; abrir o ícone e repetir preparação e teste offline nesse contexto.
- [ ] Após atualizar o app online, fechar todos os clientes e verificar a próxima abertura offline.
- [ ] Rodar por pelo menos 15 minutos em paisagem, verificando latência, aquecimento, fluidez e áudio.

Limitações conhecidas: quotas e remoção de dados dependem do iPadOS. Eventos Bluetooth de conexão/desconexão não são garantidos para páginas. Orientação e fullscreen não são impostos; Canvas ocupa a área disponível. O seletor de arquivos e exportação podem usar UI nativa na preparação/gerência, fora da jogabilidade.

## Modernização 0.2.0 — validação em dispositivo pendente

- [ ] Conferir novo launcher em paisagem e em tamanho de texto maior, inclusive foco/rolagem em Configurações.
- [ ] Comparar Clássico/Precisão/Ágil andando com WASD; avaliar conforto, não apenas a existência da aceleração.
- [ ] Ativar Correr continuamente; Shift deve caminhar, soltar deve correr; trocar de aplicativo não pode deixar direção/tiro presos.
- [ ] Comparar Nítido/Suave/CRT na mesma cena, incluindo HUD, leitura de inimigos e fadiga; testar retorno a Nítido.
- [ ] Observar desempenho/temperatura/bateria com CRT e sem CRT durante uma sessão; nenhum ganho ou consumo foi certificado em hardware.
- [ ] Ouvir música/efeitos separadamente, zero, níveis intermediários e retorno de outra aplicação; conferir que o áudio para ao suspender.
- [ ] Reabrir offline com CRT/Conforto e preferências salvas; carregar save criado em Classic.
- [ ] Restaurar experiência clássica sem perder remapeamentos, IWADs e saves.

## Alta resolução 0.3.0 — validação física pendente

- [ ] Comparar Clássica 320×200 e Alta 640×400 na mesma cena; conferir legibilidade, HUD e proporção.
- [ ] Conferir teclado, áudio e menus em Alta, inclusive teclas simultâneas e retorno de suspensão.
- [ ] Trocar de resolução com partida salva e conferir os dois perfis de saves e o backup v2.
- [ ] Preparar somente Clássica online; reabrir, trocar para Alta e carregar o save sem rede.
- [ ] Observar estabilidade, aquecimento e consumo com Alta durante sessão prolongada; comparar Nítido e CRT separadamente.


## Moderno HD 0.4.0 — validação física pendente

- [ ] Abrir uma instalação nova em Moderno; em instalação existente selecionar Moderno HD nas configurações.
- [ ] Comparar 1280×960, 1920×1440, 2560×1920 e 3840×2880; registrar estabilidade, nitidez, temperatura e fluidez de cada opção.
- [ ] Conferir HUD moderno legível e completo; trocar para HUD clássico e reiniciar pelo teclado.
- [ ] Comparar materiais HD ligados/desligados na mesma cena; conferir transparências, inimigos e sinalizações.
- [ ] Preparar os 38 recursos (incluindo as 12 partes do pacote HD) antes de desligar a rede; iniciar Moderno pela primeira vez offline.
- [ ] Salvar no Moderno, fechar/reabrir offline e carregar; exportar/restaurar backup v3 incluindo os três perfis.
- [ ] Trocar Moderno/Alta/Clássica sem perder saves; formatos de save são separados e não há conversão de EDGE para os outros motores.
- [ ] Alternar aplicativos durante jogo/áudio, voltar com Enter e confirmar que movimento e áudio retomam juntos.
- [ ] Registrar eventuais encerramentos de aba por memória e remoções de cache pelo iPadOS; qualidade máxima não tem desempenho certificado no dispositivo.

Use uma única aba de jogo por contexto e feche as abas antigas ao atualizar. Não há garantia de sincronização entre duas partidas simultâneas que escrevam nos mesmos saves. Preserve um backup externo antes da atualização.
