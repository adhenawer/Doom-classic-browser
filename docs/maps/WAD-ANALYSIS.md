# Análise estrutural caixa branca do WAD local

Inspeção realizada em 25/10/2026, somente leitura, sobre `work/DOOM.WAD`. O conteúdo comercial permaneceu local e não foi incorporado ao Git. Esta análise exporta metadados e estatísticas agregadas; não exporta payloads, coordenadas, paredes, setores individuais, composições de texturas, sons ou imagens. Não é engenharia reversa da campanha em forma de um mapa reproduzível.

## Resultado verificado

O arquivo contém **36 mapas, E1M1–E4M9**, e não apenas uma fase ou episódio. O diretório contém 2.306 entradas válidas; os 36 blocos de mapa têm os dez lumps vanilla na ordem esperada. Nenhum erro foi detectado nas verificações estruturais implementadas. Isso não prova que cada mapa foi jogado nem que toda dependência semântica do motor foi validada.

- Assinatura: IWAD; tamanho: 12.408.292 bytes.
- SHA-256: `6fdf361847b46228cfebd9f3af09cd844282ac75f3edbb61ca4cb27103ce2e7f`.
- Diretório em 12.371.396; tamanho de 36.896 bytes; termina exatamente no EOF.
- Soma dos tamanhos de payloads: 12.370.751 bytes. Há 633 bytes não referenciados entre o cabeçalho e o diretório, compatíveis com padding; seu conteúdo/finalidade não foi interpretado.
- Nenhuma sobreposição entre intervalos adjacentes não vazios ordenados; para este arquivo sem sobreposições, isso também exclui sobreposições de payloads. Nenhum payload intercepta cabeçalho ou diretório.
- O hash corresponde ao arquivo esperado documentado no projeto como Ultimate Doom 1.9. O script não autentica procedência, licença de aquisição ou versão por si só.

O inventário JSON lista **todas** as entradas por índice, nome, offset, tamanho, categoria e resultado de bounds, mantendo nomes repetidos. Um conjunto simples de nomes perderia informação importante: lumps de mapa repetem seus nomes por nível, e há recursos globais duplicados. O motor resolve nomes globais pela ordem de busca (normalmente a última ocorrência), enquanto mapas dependem de offsets relativos ao marcador, não de uma busca global por THINGS.

## Categorias de todo o diretório

A classificação usa marcadores de namespace aninhados S/P/F (incluindo subgrupos numerados), nomes convencionais e nomes exatos de recursos conhecidos. É classificação estrutural, não decodificação integral de cada asset. A categoria `other` cobre imagens da interface, intermission, menus, títulos e outros lumps fora dos namespaces. Não assumir que todo lump dessa categoria é uma imagem válida.

| Categoria | Entradas | Bytes |
|---|---:|---:|
| palette_lighting | 2 | 19456 |
| end_screen_text | 1 | 4000 |
| demo | 4 | 35008 |
| map_marker | 36 | 0 |
| map_data | 360 | 3622871 |
| texture_definition | 3 | 20082 |
| fm_instrument_bank | 1 | 11908 |
| gus_instrument_mapping | 1 | 5342 |
| sound_pc_speaker | 122 | 7169 |
| sound_digital | 122 | 1222616 |
| music | 45 | 853307 |
| other | 371 | 1197012 |
| namespace_marker | 14 | 0 |
| sprite | 764 | 2220668 |
| patch | 353 | 2713040 |
| flat | 107 | 438272 |

## Formatos e dependências

WAD usa inteiros little-endian: cabeçalho de 12 bytes (assinatura, contagem int32, offset int32); diretório de entradas de 16 bytes (offset int32, tamanho int32, nome de oito bytes). Marcadores e lumps de tamanho zero podem legitimamente não possuir dados. Nomes não são identificadores globais únicos.

Cada marcador de mapa é seguido por THINGS (10 bytes/registro), LINEDEFS (14), SIDEDEFS (30), VERTEXES (4), SEGS (12), SSECTORS (4), NODES (28), SECTORS (26), REJECT e BLOCKMAP. As estruturas públicas foram conferidas em `engine/upstream/src/doom/doomdata.h`; a especificação utilizável para criar conteúdo novo está no brief separado.

A cadeia é: THINGS fornece objetos/start; LINEDEFS referencia VERTEXES e SIDEDEFS; SIDEDEFS referencia SECTORS e texturas; SEGS referencia vértices e linhas; SSECTORS indexa intervalos de SEGS; NODES organiza filhos BSP (bit 15 indica subsector). SECTORS referencia flats e condições de piso/teto. REJECT contém uma matriz setor×setor; BLOCKMAP contém origem, dimensões, offsets em palavras e listas de linedefs terminadas em 65535. NODES, SEGS, SSECTORS e BLOCKMAP são derivados da geometria e devem ser reconstruídos quando ela mudar. O relatório não fornece essa geometria.

Verificações executadas em todos os mapas: sequência de lumps, divisibilidade dos registros, bounds dos índices de vértices/sidedefs/setores/linedefs, intervalos dos subsectors, bounds dos filhos BSP, tamanho mínimo de REJECT, tamanho/tabela de células BLOCKMAP, offsets das listas, zero inicial, terminadores e índices de linedefs. O valor 65535 foi tratado como sidedef ausente. Não foram testados ciclos/topologia BSP, correspondência espacial das caixas, winding, fechamento dos setores, validade dos specials/tags, tipos/flags de objetos, necessidade de texturas em cada superfície ou alcançabilidade da saída.

PLAYPAL é paleta RGB (normalmente 14 × 256 × 3 = 10.752 bytes); COLORMAP oferece mapas de índices para luz/efeitos (aqui 8.704 bytes). Os tamanhos presentes correspondem a essas convenções. Flats têm 4.096 bytes por imagem 64×64 sem cabeçalho; os 107 flats presentes têm esse tamanho agregado. Sprites, patches e muitas imagens UI usam o formato patch Doom: dimensões/offsets int16, offsets de colunas uint32 e posts com terminadores. Essas imagens não foram renderizadas nem seus posts integralmente validados.

PNAMES declara 351 nomes de patches, resolvidos sem distinguir maiúsculas/minúsculas como o motor. Todos encontram lumps no arquivo. TEXTURE1 contém 125 definições; TEXTURE2 contém 162. Foram validados limites da tabela de offsets, cabeçalhos de 22 bytes, registros de patch de 10 bytes e índices PNAMES: zero falhas. Não foi exportada a composição de nenhuma textura. Não foi validado se todo nome de parede/flat utilizado em todos os mapas está semanticamente resolvido ou se o patch apontado contém uma imagem decodificável.

DS* designa convencionalmente áudio digital DMX (cabeçalho com formato, taxa e contagem, seguido de amostras); DP* sons para PC speaker; D_* geralmente música MUS; GENMIDI é banco FM/OPL; DMXGUS é mapeamento de instrumentos; DEMO* são fluxos de comandos de jogo; ENDOOM é tela de texto 80×25 com caractere/atributo. Esses rótulos seguem convenções dos nomes: streams de áudio/música/demos não foram decodificados ou reproduzidos. Sprites dependem das convenções de frames/rotações e tabelas de estados do motor; músicas/som/intermission também dependem dos nomes esperados pelo código. A presença nominal não prova correção funcional.

## Estatísticas agregadas dos mapas

Contagens não descrevem posições nem conectividade. `BSP` conta nodes; `SS` conta subsectors. A coluna REJECT é o tamanho presente, que corresponde ao mínimo ceil(setores²/8) em todos os mapas.

| Mapa | Things | Linhas | Lados | Vértices | Segs | SS | BSP | Setores | REJECT bytes |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| E1M1 | 143 | 486 | 666 | 470 | 747 | 239 | 238 | 88 | 968 |
| E1M2 | 262 | 1033 | 1323 | 942 | 1463 | 448 | 447 | 200 | 5000 |
| E1M3 | 380 | 1026 | 1326 | 946 | 1445 | 461 | 460 | 177 | 3917 |
| E1M4 | 254 | 830 | 1054 | 780 | 1172 | 355 | 354 | 139 | 2416 |
| E1M5 | 293 | 825 | 1053 | 746 | 1141 | 384 | 383 | 143 | 2557 |
| E1M6 | 463 | 1352 | 1727 | 1207 | 1862 | 606 | 605 | 250 | 7813 |
| E1M7 | 358 | 958 | 1223 | 896 | 1371 | 467 | 466 | 170 | 3613 |
| E1M8 | 126 | 333 | 511 | 328 | 586 | 177 | 176 | 74 | 685 |
| E1M9 | 237 | 653 | 902 | 581 | 978 | 288 | 287 | 147 | 2702 |
| E2M1 | 127 | 415 | 550 | 371 | 597 | 180 | 179 | 92 | 1058 |
| E2M2 | 311 | 1610 | 2076 | 1537 | 2268 | 725 | 724 | 245 | 7504 |
| E2M3 | 229 | 953 | 1145 | 874 | 1209 | 315 | 314 | 128 | 2048 |
| E2M4 | 265 | 1117 | 1439 | 1054 | 1589 | 497 | 496 | 205 | 5254 |
| E2M5 | 326 | 1353 | 1710 | 1235 | 1847 | 620 | 619 | 241 | 7261 |
| E2M6 | 326 | 1094 | 1324 | 967 | 1409 | 460 | 459 | 181 | 4096 |
| E2M7 | 235 | 1764 | 2252 | 1626 | 2438 | 818 | 817 | 323 | 13042 |
| E2M8 | 66 | 218 | 278 | 216 | 310 | 130 | 129 | 27 | 92 |
| E2M9 | 53 | 166 | 198 | 160 | 209 | 68 | 67 | 19 | 46 |
| E3M1 | 92 | 208 | 274 | 194 | 298 | 94 | 93 | 39 | 191 |
| E3M2 | 208 | 494 | 625 | 531 | 734 | 287 | 286 | 68 | 578 |
| E3M3 | 209 | 1102 | 1394 | 986 | 1478 | 441 | 440 | 192 | 4608 |
| E3M4 | 374 | 1099 | 1369 | 1027 | 1498 | 474 | 473 | 186 | 4325 |
| E3M5 | 291 | 1416 | 1846 | 1222 | 1937 | 560 | 559 | 268 | 8978 |
| E3M6 | 335 | 687 | 949 | 691 | 1108 | 410 | 409 | 125 | 1954 |
| E3M7 | 154 | 982 | 1247 | 884 | 1329 | 474 | 473 | 166 | 3445 |
| E3M8 | 58 | 122 | 173 | 135 | 204 | 78 | 77 | 17 | 37 |
| E3M9 | 197 | 474 | 589 | 456 | 649 | 213 | 212 | 71 | 631 |
| E4M1 | 141 | 471 | 642 | 439 | 695 | 196 | 195 | 81 | 821 |
| E4M2 | 227 | 685 | 1014 | 611 | 1080 | 400 | 399 | 122 | 1861 |
| E4M3 | 384 | 822 | 1216 | 784 | 1359 | 454 | 453 | 156 | 3042 |
| E4M4 | 153 | 648 | 925 | 580 | 969 | 314 | 313 | 123 | 1892 |
| E4M5 | 267 | 1068 | 1705 | 1044 | 1902 | 674 | 673 | 170 | 3613 |
| E4M6 | 295 | 1355 | 1963 | 1315 | 2172 | 773 | 772 | 224 | 6272 |
| E4M7 | 258 | 1371 | 1981 | 1273 | 2155 | 800 | 799 | 288 | 10368 |
| E4M8 | 315 | 1280 | 1908 | 1158 | 2043 | 726 | 725 | 223 | 6217 |
| E4M9 | 247 | 1644 | 2417 | 1565 | 2671 | 956 | 955 | 248 | 7688 |

## Produto, revisão e reprodução

O importador atual exige IWAD, máximo de 64 MiB e presença de E1M1, PLAYPAL, PNAMES e TEXTURE1 (`web/wad.ts`). Ele não certifica a integridade profunda de todos os mapas; a análise aqui é adicional. Os perfis observados no checkout 073b980 são Chocolate Doom Classic e Crispy High. Segundo a verificação do coordenador em `origin/main` 55dec9dcfe7557d8e91fedcbc48b9707087a1d26, a revisão remota adiciona Modern HD, mas o importador é idêntico. Nenhum merge ou teste do Modern HD foi realizado nesta análise. A existência dos 36 mapas no WAD não implica que a interface inicial liste todos separadamente: seleção de episódios ocorre no menu nativo do jogo.

Reexecutar da raiz:

```sh
python3 scripts/inspect-wad.py work/DOOM.WAD --output docs/maps/wad-inventory.json
```

O script usa apenas biblioteca padrão Python, não altera o arquivo de entrada e retorna 1 ao detectar erros listados no JSON; cabeçalhos/diretórios inválidos impedem a análise com ValueError. Não é um parser endurecido para todo input adversarial: famílias de assets não recebem validação completa. O script deliberadamente exporta apenas metadados e agregados.

Validação desta entrega: duas execuções de `inspect()` produziram resultados idênticos; header foi relido independentemente por `struct.unpack`, contagens de categorias somaram 2.306 entradas, soma de payloads foi reconciliada com os 633 bytes não referenciados. Casos sintéticos sem payload comercial confirmaram detecção de offset fora do arquivo e rejeição de cabeçalho curto. O inventário integral foi regenerado com código final e não apresenta erros. A primeira versão da resolução PNAMES comparava nomes com case sensível; foi corrigida antes da entrega. Não foram executados nesta tarefa testes de browser, campanha, desempenho, áudio, offline ou hardware. Não houve QA independente deste script; o coordenador pode revisar os artefatos. Nenhuma alteração de engine/interface foi feita por este analista.

## Limite autoral e transferência ao criador

Conhecer o formato de um arquivo não licencia seu conteúdo. Copiar, reescrever, converter ou redesenhar mapas comerciais preservando sua expressão não elimina direitos. Este inventário não é autorização para redistribuir o IWAD. O arquivo permanece em `work/`, excluído da distribuição.

O segundo agente deve receber **somente** `ORIGINAL-MAP-BRIEF.md`, que estabelece formato e restrições do produto, sem layouts, coordenadas, contagens comerciais ou instruções de reconstrução. Seu mapa deve nascer de geometria própria e ser composto com recursos BSD do Freedoom, com atribuição. Inventário e relatório podem ser removidos para rollback sem afetar o jogo; não há mudança de dados ou saves do usuário.

## Proximidade clássica sem reconstrução comercial

O WAD é dado; o motor implementa simulação, movimento, aceleração/atrito, colisão, uso/tiro, dano, inventário, estados de armas, auto-aim, IA e processamento dos specials vanilla. Manter o motor Classic e evitar alterações de executável/DeHackEd preserva esse conjunto de regras para novo conteúdo. Um mapa novo não precisa reproduzir mapas existentes para usar a mesma cadência de 35 tics/s, regras de movimento, ataques e feedback funcional. Crispy High oferece outra apresentação e não foi declarado idêntico em todos os bugs/demos ao Chocolate.

THINGS escolhe tipos de objetos conhecidos pelo motor e suas flags de dificuldade/modo; não contém um programa de IA. LINEDEFS armazena flags de bloqueio/two-sided, ações e tags; SECTORS fornece alturas, luz e specials. Assim, o autor controla espaço navegável, pressão de combate, recursos, portas, switches e saída com os mesmos mecanismos públicos. A escolha e organização desses elementos em Estação Aurora serão próprias. O renderizador Doom calcula visibilidade com BSP, desenha paredes/texturas, planos/visplanes e sprites; REJECT auxilia descarte de linhas de visão e BLOCKMAP acelera consultas de colisão. Essas estruturas devem refletir o novo mapa, mesmo quando a arte vem de uma base livre.

Freedoom fornece arte, som, música e mapas com licença BSD, usando identificadores compatíveis com Doom. Isso permite conservar papéis de armas/inimigos e a lógica do motor com aparência/áudio próprios do Freedoom. A equivalência de nomes/tipos não transforma seus desenhos e músicas em assets comerciais; tampouco reproduz fielmente a identidade audiovisual do Doom comercial. Um novo mapa pode buscar ritmo de exploração/combate, legibilidade e interações clássicas usando esses sistemas, mas esses são objetivos de design: precisam de playtest, não podem ser comprovados por contagens de lumps. Substituir E1M1 na cópia de Freedoom altera apenas essa fase; não cria automaticamente uma campanha nova de 36 mapas.
