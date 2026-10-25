# Estação Aurora — E1M1 original

A Estação Aurora é um mapa curto e inédito de base tecnológica. A hipótese de design é que três salas largas, unidas por gargalos curtos, permitem aprender movimento e tiro por teclado, reconhecer ameaças laterais e encontrar a saída sem depender de pulo, mira livre ou chaves. O layout foi escrito do zero em `maps/aurora/layout.json`, a partir exclusivamente do contrato público `ORIGINAL-MAP-BRIEF.md`. O autor não consultou WAD, inventário, análise, imagens ou coordenadas comerciais.

Somente **E1M1** é original Aurora. A saída leva a **E1M2 do Freedoom**; o restante da campanha e todos os assets audiovisuais permanecem Freedoom. Não é uma recriação de mapas comerciais nem uma campanha inteira original.

## Design e aspectos clássicos

O trajeto oeste–leste é Recepção → passagem de serviço → Núcleo de energia → passagem de evacuação → Controle de evacuação. As salas possuem expansões laterais: a rota central é legível, mas inimigos nas laterais convidam o jogador a explorar/estrafar. O Núcleo tem uma alcova de recompensa a norte, marcada como setor secreto vanilla (especial 9); ela é aberta, sem parede falsa ou mecanismo escondido. O segredo recompensa exploração lateral, não conhecimento de um mapa anterior.

Escala, combate e fluxo seguem princípios genéricos clássicos: corredor de 192 unidades, pé-direito de 96 nas passagens e 128–192 nas salas, contraste luminoso 128–224, materiais techbase, arma antes do combate, munição e cura durante a travessia, autoaim vertical, inimigos e pickups vanilla e saída por interruptor. A geometria não reproduz uma fase específica. São seis inimigos (quatro soldados e dois imps), uma shotgun, quatro caixas pequenas de cartuchos, um kit médico, um stimpack e uma armadura verde na alcova. Itens/inimigos estão habilitados nas três dificuldades single-player (flags 7), sem rebalanceamento por dificuldade nesta primeira versão.

O jogador inicia em **(128, 0)**, voltado para leste (ângulo 0). A parede leste de Controle, de **(1536, 96) a (1536, −96)**, tem especial vanilla **11**, textura `SW1COMP` e lado frontal voltado para oeste. Aproxime-se até x≈1490 e pressione E/Espaço. A saída não exige limpar inimigos ou encontrar segredo.

Veja o diagrama original em [aurora-layout.svg](aurora-layout.svg). Ele representa a geometria autoral e não uma imagem extraída de qualquer jogo.

## Construção e procedência

Execute a partir do checkout:

```sh
python3 scripts/build-original-map.py
python3 -m unittest discover -s scripts/tests -p test_original_map.py -v
```

O gerador usa somente a biblioteca padrão Python 3. Não há ferramenta externa de nodes, binário baixado, acesso de rede, aleatoriedade ou relógio nas saídas. `--base` e `--out` permitem construir em pasta separada. A única base aceita tem SHA-256 `7323bcc168c5a45ff10749b339960e98314740a734c30d4b9f3337001f9e703d`: **Freedoom Phase 1 0.13.0**, obtido pelo pipeline existente `scripts/fetch-content.py` de https://github.com/freedoom/freedoom/releases/tag/v0.13.0. Versão, licença BSD de três cláusulas e créditos originais acompanham a publicação em `FREEDOOM-COPYING.txt`, `FREEDOOM-CREDITS.txt` e `FREEDOOM-CREDITS-MUSIC.txt`.

Texturas utilizadas: STARTAN3, BROWN1, TEKWALL4, COMPTALL, SW1COMP; flats FLOOR4_8 e CEIL3_5. Todos foram conferidos na base livre. Música, sons, sprites e texturas são herdados dessa base. Nenhum asset comercial participa do gerador ou das saídas.

Geometria, fonte declarativa, algoritmo e diagrama originais: DOOM Classic Browser contributors, 2026, licença MIT; texto integral e atribuições em [AURORA-CREDITS.txt](AURORA-CREDITS.txt), copiado automaticamente para `web/generated`.

## Implementação vanilla

A planta é uma união de onze retângulos convexos sobre uma grade autoral, com três salas largas e duas passagens. A enumeração das arestas funde fronteiras comuns em linedefs de dois lados e remove texturas médias desses portais. Contornos externos são orientados no sentido horário, com interior no lado direito. Cada célula tem um setor e um subsector com quatro segs inteiros; não é necessário cortar segs porque as partições coincidem com limites da grade.

O BSP é gerado do zero em pós-ordem: separa colunas verticalmente, depois células de cada coluna horizontalmente; cada nó guarda bounding boxes dos respectivos filhos. A última entrada é a raiz; filhos subsector usam o bit 15. SEGS respeitam a orientação/lado do linedef. REJECT tem todos os bits zero, conservador. BLOCKMAP cobre todo o envelope, com listas completas de linedefs compartilhadas pelos blocos, conservadoras para colisão. O custo dessa estratégia é baixo para as 34 linedefs atuais; não é um builder genérico para mapas grandes ou polígonos arbitrários.

Não há UDMF, formato Hexen, scripts, slopes ou extensões de port. O PWAD contém E1M1, os dez lumps vanilla e o patch de título WILV00; o IWAD substitui os onze lumps do mapa e WILV00 na base, preservando byte a byte o payload e a ordem de todos os outros lumps. O título `ESTACAO AURORA` é uma composição nova dos glyphs STCFN da própria base Freedoom, ampliados 2× por replicação de pixels e serializados em posts de patch vanilla, com transparência; não usa fontes comerciais. Esses glyphs permanecem sob BSD de três cláusulas, conforme créditos Freedoom. O manifesto identifica essa derivação. O manifesto `aurora.json` contém nome, SHA-256, tamanho, base, contagens e identificação explícita do único mapa original.

Contagens: 15 things, 24 vértices, 34 linedefs, 44 sidedefs, 44 segs, 11 subsectors, 10 nodes, 11 setores. A complexidade é conservadora; isso sozinho não constitui prova de todos os limites de renderização vanilla.

## Evidência e roteiro de execução

Sete testes estruturais verificam reprodução, formato/ordem/strides, referências, polígonos fechados e orientação, travessia BSP em amostras de todas as células, conectividade e altura de portais, recursos/start/exit, blockmap e preservação integral dos lumps não alterados da base e composição/presença única do título WILV00. As saídas foram geradas repetidamente e comparadas byte a byte. Isso não substitui validação no motor: spawn, navegação, combate, acionamento da saída e captura são validados pelo coordenador, separadamente. Não há alegação de QA independente, teste em iPad ou Modern HD neste documento.

Roteiro automatizável no browser (teclas padrão):

1. Importar `aurora.wad`, iniciar E1M1 em I'm Too Young to Die para inspeção ou Hurt Me Plenty para combate; retomar com Enter.
2. Para uma validação exclusivamente geométrica determinística, digitar o cheat vanilla `iddqd`; registrar que essa rodada não avalia equilíbrio de combate. Deixar a câmera no ângulo inicial leste, sem usar setas de giro.
3. Segurar W e J em etapas curtas, soltando W para eliminar ameaças e observar x pelo bridge existente. Cruzar x=384/512 (primeira passagem/Núcleo), x=1024/1152 (segunda passagem/Controle). O eixo y=0 é desobstruído e passa pela shotgun e recursos; acompanhar saúde e munição para uma rodada sem cheat.
4. No Núcleo, parar próximo a (800,0), usar A para deslocar ao norte (y>96), visitar armadura em (848,192), e D para retornar ao eixo central. O contador de segredo sobe ao pisar nessa célula; não é necessário para a saída.
5. Avançar leste até a colisão com a parede x=1536 (centro do jogador cerca de x=1512; usar pulsos para parar antes). Soltar W/J, pressionar e soltar E. Confirmar intermission; depois confirmar entrada em E1M2 Freedoom. Uma ativação após morrer não valida o percurso.

Para evitar fragilidade, automatizar por coordenadas/estado observados e pulsos de teclado, não por uma única duração fixa: aceleração, autorun e espera de browser alteram distância por tempo de parede. Capturar Recepção, Núcleo, Controle e intermission. No roteiro sem cheat, mirar/girar por teclado e recolher recursos; as ameaças laterais não precisam bloquear o caminho para contar como combate.

Rollback: retirar seleção Aurora e os arquivos gerados; a base Freedoom permanece intacta. Saves separados pelo hash do IWAD composto não devem ser renomeados ou fundidos aos da base.
