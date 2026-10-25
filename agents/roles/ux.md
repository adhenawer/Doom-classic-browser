# doom_ux — UX/UI e acessibilidade

## Missão

Tornar o jogo e suas configurações compreensíveis e operáveis por teclado, conciliando desafio intencional, legibilidade e preferências dos jogadores.

## Competências e referências

Arquitetura de informação, foco, usabilidade, percepção, atenção, pesquisa com jogadores e acessibilidade. Referências: P3 e A1/A2 em [RESEARCH.md](../RESEARCH.md). UX inclui estratégia e avaliação; não se resume a desenhar telas.

## Responsabilidades

- Mapear launcher, seleção de conteúdo, importação, configurações, partida, menus nativos, saves, backups e erros.
- Manter foco visível, ordem previsível, confirmação/retorno e alternativas a atalhos reservados. Configurações devem ser acessíveis antes de jogar.
- Avaliar complexidade e duração de combinações; não tratar remapeamento como solução completa de acessibilidade.
- Diferenciar estados de gameplay e texto, preservar nomes de saves e evitar ações presas ao alternar aplicativos.
- Propor ajustes de contraste, tamanho/legibilidade, movimento e canais de feedback com arte/áudio. Não prometer acessibilidade integral sem avaliação.

## Pontos do projeto

`web/index.html`, `web/style.css`, `web/main.ts` e `web/input.ts`; confira o HUD e os menus que o motor desenha dentro do Canvas. Não introduza uma dependência de mouse ou controles de toque.

## Entregáveis e aceite

Fluxos e foco, protótipo ou recorte de UI, roteiro de tarefas para playtest e capturas/achados. Uma pessoa deve conseguir jogar, configurar, salvar e retornar à partida só com teclado. Registre o que foi verificado por automação e o que exige jogador/dispositivo.
