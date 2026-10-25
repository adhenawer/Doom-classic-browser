# Contrato técnico para um mapa original

Este documento contém apenas requisitos públicos de formato e do produto. O criador do mapa não deve consultar `work/DOOM.WAD`, o inventário comercial, sua análise, imagens ou layouts. A geometria deve ser criada do zero; autoria e processo devem ser documentados.

## Entrega autorizada

Criar **Estação Aurora**, nome provisório, com pelo menos três áreas conectadas, um início de jogador single-player, saída funcional, inimigos e recursos suficientes para completar o percurso. Criar um gerador reproduzível, um PWAD apenas com o mapa original e um IWAD para o importador, substituindo E1M1 em uma cópia de Freedoom Phase 1 0.13.0. Colocar os WADs gerados em `web/generated` conforme integração do coordenador. Preservar os outros mapas e recursos livres da base. Incluir BSD de três cláusulas e créditos Freedoom; registrar origem, versão, hashes e licença de qualquer ferramenta/asset adicional. Declarar licença e autoria da geometria e gerador novos.

Não copiar ou redesenhar mapas comerciais. Reescrever um mapa ou seus bytes não elimina direitos sobre o conteúdo reproduzido. Não usar sprites, texturas, música ou coordenadas de WAD comercial. A disponibilidade local de um WAD não autoriza distribuição.

## Compatibilidade do produto

O importador `web/wad.ts` aceita somente assinatura IWAD, tamanho de 12 bytes a 64 MiB, diretório com 1–100000 entradas, todos os lumps dentro do arquivo e presença de E1M1, PLAYPAL, PNAMES e TEXTURE1. Portanto, o PWAD original é um entregável de autoria; o IWAD composto com Freedoom é o arquivo importável. O nome do arquivo não basta para selecionar episódio: o marcador interno deve ser E1M1.

Checkout observado: 073b980 (Chocolate Doom Classic e Crispy High). O coordenador verificou também `origin/main` 55dec9dcfe7557d8e91fedcbc48b9707087a1d26, com Modern HD: seu `web/wad.ts` é idêntico. Esse fato é um alvo de compatibilidade de formato, não evidência de execução no Modern HD. Não houve merge; registrar separadamente qualquer teste no motor de cada revisão.

Classic usa simulação 35 Hz, auto-aim vertical e controles por teclado; não pressupor pulo ou mira vertical. Evitar extensões de port, scripts, slopes, UDMF e formato Hexen. O gerador não precisa alterar motores ou interface.

## Formato Doom vanilla

Inteiros little-endian. Cabeçalho WAD: assinatura de quatro bytes, int32 número de lumps, int32 offset do diretório. Cada entrada tem int32 offset, int32 tamanho e nome de oito bytes com padding NUL. Um marcador E1M1 é seguido imediatamente por: THINGS, LINEDEFS, SIDEDEFS, VERTEXES, SEGS, SSECTORS, NODES, SECTORS, REJECT e BLOCKMAP.

| Lump | Registro | Conteúdo de formato |
|---|---:|---|
| THINGS | 10 bytes | int16 x,y,ângulo,tipo,flags; tipo 1 é início P1 |
| LINEDEFS | 14 bytes | 7 uint16: vértices inicial/final, flags, especial, tag, sidedefs direito/esquerdo; 65535 indica lado ausente |
| SIDEDEFS | 30 bytes | int16 offsets x/y, três nomes de textura de 8 bytes, uint16 setor |
| VERTEXES | 4 bytes | int16 x,y |
| SEGS | 12 bytes | seis palavras: vértices, ângulo, linedef, lado, offset |
| SSECTORS | 4 bytes | uint16 quantidade de segs e primeiro seg |
| NODES | 28 bytes | partição e duas bounding boxes int16; dois filhos uint16, bit 15 marca subsector |
| SECTORS | 26 bytes | int16 piso/teto, nomes flats de 8 bytes, int16 luz/especial/tag |
| REJECT | variável | matriz de visibilidade entre setores, ceil(n²/8) bytes; zeros conservadores são aceitáveis |
| BLOCKMAP | variável | origem int16, dimensões uint16, tabela de offsets em palavras; listas com zero inicial e terminador 65535 |

Gerar BSP, segs, subsectors, nodes e blockmap válidos para a própria geometria, por ferramenta com procedência ou algoritmo próprio verificável. Usar referências dentro dos limites, texturas/flats existentes na base Freedoom e setores fechados orientados corretamente. Preservar espaço suficiente para jogador, alturas livres e passagem entre áreas. Usar especial de saída vanilla (por exemplo 11, switch use exit), validar sua orientação e ativação. Flags dos things devem habilitar a dificuldade testada e single-player. Manter complexidade conservadora para vanilla; contagens baixas não provam ausência de visplane overflow.

## Aceite e evidências

1. Gerar duas vezes com hashes iguais a partir da mesma base e fonte.
2. Validar bounds, ordem/strides e referências dos lumps; nenhum payload comercial no gerador ou saídas.
3. Rodar importador com o IWAD composto e abrir E1M1 no motor real; verificar spawn, três áreas acessíveis, combate/recursos e acionamento da saída.
4. Registrar capturas e quais verificações foram automatizadas ou manuais. Abertura do mapa não prova percurso/saída; sem teste real registrar pendência.
5. Não alegar revisão independente, teste em iPad ou Modern HD sem evidência correspondente. O coordenador integra seleção e validação de produto.
