# Materiais HD — conteúdo e procedência

Data: 25/10/2026. O usuário priorizou design contemporâneo e alta resolução e retirou os orçamentos artificiais de download, CPU e memória propostos no discovery. A distribuição passa a usar um conjunto completo de materiais HD compatíveis com o Freedoom Phase 1 fixado, em vez da proposta inicial de 8–12 materiais. Os limites técnicos do browser, GPU e armazenamento continuam existindo; tamanho de arquivo não prova consumo residente ou desempenho.

## Conteúdo distribuído

| Item | Valor verificado na geração |
|---|---|
| Identidade | `freedoom-phase1-hd-v1` |
| IWAD-alvo | Freedoom Phase 1 0.13.0, 28.795.076 bytes |
| SHA-256 do IWAD | `7323bcc168c5a45ff10749b339960e98314740a734c30d4b9f3337001f9e703d` |
| Pacote gerado | `modern-hd.epk`, 398.681.345 bytes, aproximadamente 380,21 MiB |
| SHA-256 do pacote | `f9a2cc0ea9f290af2b04a9b0227aef1fdad7596649e52101842ae6bbf8dc0562` |
| Transporte publicado | **12 partes** `modern-hd.000.bin` a `modern-hd.011.bin`: 11 de 32 MiB e a última de 29.582.593 bytes; não há resposta HTTP monolítica do EPK |
| Imagens | **1.115: 877 texturas de parede + 238 flats de piso/teto** |
| Definição | **1.113 imagens Freedoom-HD** com largura/altura 4× a original; **2 albedos Poly Haven CC0 em 4096×4096** para `BASE2` e `FLAT1` |
| Pixels de todas as imagens | 230.341.120; não significa que todas estejam residentes simultaneamente |
| Formato | PNG original do pacote consultado, bytes preservados; ZIP/EPK com método STORED e metadados normalizados |
| Arte preservada do IWAD | Sprites, armas, HUD e texturas com transparência, além das imagens sem substituição elegível |

O pacote só deve ser associado ao SHA-256 de IWAD indicado. Compartilhar nomes com texturas de outro IWAD não autoriza aplicá-lo automaticamente. `modern-hd.json` expõe o identificador, associação, contagens, tamanho e checksum ao aplicativo; o manifesto dentro do EPK lista cada arquivo, dimensões físicas/lógicas, namespace e SHA-256.

## Origem e licenças

As 1.113 imagens reconstruídas vêm de [Freedoom-HD v1.0, publicado por Macdara O'Murchu](https://github.com/m4cd4r4/freedoom-hd/releases/tag/v1.0), revisão documental [`ea02b826a758a5105dfd9b635ee44711154f53aa`](https://github.com/m4cd4r4/freedoom-hd/tree/ea02b826a758a5105dfd9b635ee44711154f53aa). O [README fixado](https://github.com/m4cd4r4/freedoom-hd/blob/ea02b826a758a5105dfd9b635ee44711154f53aa/README.md) declara os assets derivados de Freedoom sob BSD-3-Clause; o código do pipeline upstream usa MIT. Duas superfícies usam albedos Poly Haven CC0 descritos abaixo. A licença de um código de geração não substitui a licença dos assets.

Archive de origem: `freedoom-hd-textures.pk3`, **402.969.291 bytes**, SHA-256 **`8a0d4c1abe86a1582200289db38c8562a9eaa58e5725d7a182984931c5cc6ae9`**. O arquivo contém 2.553 entradas PNG, duas delas duplicadas por nome, e um comentário `GAMEINFO.txt`. A distribuição atual não executa nem incorpora esse comentário como configuração de jogo.

O upstream reconstruiu as imagens com Real-ESRGAN; seu [`config.py`](https://github.com/m4cd4r4/freedoom-hd/blob/ea02b826a758a5105dfd9b635ee44711154f53aa/pipeline/config.py) identifica Freedoom 0.13.0 e o modelo `RealESRGAN_x4plus_anime_6B`. O projeto atual utiliza os PNGs já gerados, sem treinar ou executar o modelo. Reconstrução por IA cria detalhe plausível e pode alterar o caráter da pixel art; não recupera informação original perdida e não é uma textura PBR.

O EPK inclui:

- A licença BSD completa e a lista de créditos da distribuição Freedoom 0.13.0, verificadas por hash.
- A licença MIT e o README de origem do Freedoom-HD, também verificados por hash e revisão.
- A identificação CC0, autoria, páginas de origem, URLs e hashes de ambos os materiais Poly Haven, em `POLY-HAVEN-CREDITS.txt` e no manifesto.
- Um manifesto de seleção com procedência, hash do archive, limites de associação e todos os arquivos elegíveis.

O aviso `MODERN-CONTENT-COPYING.txt` fica disponível fora do EPK na publicação para leitura sem carregar todo o pacote. Não há conteúdo extraído de DOOM comercial ou de jogos modernos proprietários.

## Duas superfícies contemporâneas em 4K

A inspeção de uma captura real da nova cena identificou `BASE2` como uma parede grande em que o upscale de pixel art continua visualmente suave. Para obter detalhe de material de outra origem, duas imagens 4K originais foram selecionadas em [Poly Haven](https://polyhaven.com/license), cuja licença oficial permite uso e redistribuição sob CC0-1.0. Os materiais são de **Rob Tuytel**; autoria e licença também são identificadas nas páginas individuais.

| Alvo e encaixe | Fonte | Arquivo original, bytes e SHA-256 |
|---|---|---|
| `BASE2`, parede lógica 128×128 unidades | [Blue Metal Plate](https://polyhaven.com/a/blue_metal_plate), chapa industrial azul desgastada | [PNG 4K](https://dl.polyhaven.org/file/ph-assets/Textures/png/4k/blue_metal_plate/blue_metal_plate_diff_4k.png), **88.602.011 bytes**, SHA-256 `cd7dfc69866c6b67af3e1fe8a17b700fdf24954cebd9fa46d52877ae8af05d64` |
| `FLAT1`, flat lógico 64×64 unidades | [Concrete Floor 02](https://polyhaven.com/a/concrete_floor_02), concreto cinza/marrom desgastado | [PNG 4K](https://dl.polyhaven.org/file/ph-assets/Textures/png/4k/concrete_floor_02/concrete_floor_02_diff_4k.png), **37.734.515 bytes**, SHA-256 `50e483cf04c62c758cc3e5ba35998c53be4a5cc2b499352a3c0757b64470bdff` |

Ambos os arquivos são **4096×4096**, sem recorte, recoloração ou reamostragem por este port. A chapa é PNG RGBA de 16 bits por canal e o concreto, PNG RGB de 8 bits; o decodificador STBI do renderer entrega a imagem ao seu pipeline RGBA8. Isso não é apresentação HDR nem PBR. Somente o albedo é utilizado; mapas de normal, roughness, metalness ou luz não foram acrescentados.

O tamanho físico/lógico do tile permanece o do WAD: o loader HIRES calcula a escala `128/4096` em ambos os eixos para `BASE2` e `64/4096` para `FLAT1`. A substituição não amplia o mapa ou a colisão. A família visual de `BASE2` muda intencionalmente de cinza com friso bronze para azul industrial; a superfície lisa `FLAT1` ganha grão de concreto. O mesmo flat pode aparecer em piso e teto. A decisão não promete reproduzir a medida física em metros indicada pelo catálogo de materiais.

Contagens em E1M1 identificam 54 referências a `BASE2` em SIDEDEFS e 24 a `FLAT1` nos campos de flat de SECTORS; elas não medem cobertura de tela. `MC17` verde orgânico e o piso estriado `AQF024` foram preservados por terem outra função artística. `METAL2` é retangular 64×128 e também foi preservado para evitar esticar uma chapa quadrada. Portas, switches, sinalizações, líquidos e transparências não receberam esses dois albedos.

O manifesto identifica a origem de cada imagem; somente essas duas entradas têm exceção explícita à regra de dimensões 4×. Outros **1.113 arquivos PNG permanecem byte a byte iguais ao primeiro pacote auditado**. Os arquivos só são baixados no build, verificados por tamanho/hash e hospedados com o aplicativo: não há dependência de Poly Haven/CDN durante a partida preparada offline.

## Correções de integração descobertas na auditoria

**Fundos magenta opacos:** a inspeção de `PISGA0.png` do archive revelou uma imagem RGBA cujo alpha é 255 em todos os pixels. O fundo magenta permanece visível e contamina as bordas; uma simples chave de cor não reconstitui fielmente a transparência. A inspeção de texturas originalmente mascaradas, como `BRNBIGC`, revelou o mesmo problema. Portanto, **todos os sprites e as 75 texturas com transparência detectada no IWAD foram excluídos**, preservando os originais durante a renderização. Nenhuma imagem foi “reparada” silenciosamente.

**Diferenças entre Phase 1 e Phase 2:** o extrator upstream processa Phase 2 antes de Phase 1 e reaproveita nomes. O gerador local exige dimensões físicas exatamente iguais a 4× as dimensões do material no IWAD Phase 1. Onze nomes não passam nesse critério: `BRNPOIS`, `NUKEPOIS`, `STEP1`, `STEP2`, `STEP3`, `SW1BRN1`, `SW1STON2`, `SW1STONE`, `SW2BRN1`, `SW2STON2` e `SW2STONE`. Eles continuam com a arte original.

**Nomes duplicados:** `STEP1.png` e `STEP2.png` aparecem duas vezes na origem com dimensões distintas. Ambas as variantes desses nomes falham na correspondência Phase 1 e são excluídas. O gerador rejeita uma segunda entrada elegível para um mesmo material, em vez de escolher arbitrariamente a última.

**Escala e namespaces:** o [carregador HIRES do EDGE fixado](https://github.com/edge-classic/EDGE-classic/blob/9e2b61677f215861e40b631429bf322935e8f87c/source_files/edge/w_epk.cc) reconhece `hires/*.png`; a [criação de imagens](https://github.com/edge-classic/EDGE-classic/blob/9e2b61677f215861e40b631429bf322935e8f87c/source_files/edge/r_image.cc) deriva a escala da imagem substituída. O pacote conserva nomes lógicos e requer essa substituição; não multiplica o tamanho físico de paredes ou pisos. A ordem de resolução de namespace privilegia parede antes de flat e é refletida na seleção. Testes de imagem no jogo ainda são responsabilidade da integração/QA do renderer.

## Geração reproduzível na nuvem

```sh
python3 scripts/fetch-content.py
python3 scripts/fetch-modern-content.py
```

O script usa apenas a biblioteca padrão Python. Verifica tamanho/SHA-256 do IWAD, do archive e dos avisos; faz download para um temporário e só o promove depois da verificação. O cache do archive fica em `build/modern-content/`, sem ser incluído novamente na fonte correspondente ou enviado para Git. O código, metadados fixados, política e nomes dos archives fazem parte da fonte correspondente.

A seleção lê `TEXTURE1`/`TEXTURE2`, `PNAMES`, colunas/posts de patches e a cobertura alfa das texturas no IWAD. Inclui somente paredes totalmente opacas e flats, preservando a precedência de nomes do motor. Verifica assinatura/dimensões PNG e CRC por arquivo, sem extrair caminhos do archive no filesystem. Em seguida aplica os dois overrides 4K fixados, somente se o nome, namespace e tamanho lógico coincidirem com uma superfície opaca elegível. Só imagens elegíveis e avisos explícitos são escritos; arquivos de script/configuração externos não entram no pacote. As imagens permanecem byte a byte iguais às suas respectivas origens.

O ZIP de saída tem timestamp fixo, ordem por nome, permissões normalizadas e armazenamento sem recompressão. Seu tamanho e SHA-256 esperados são fixados em `engine/MODERN-CONTENT.json`; a geração falha se o resultado diferir. A política foi verificada com o IWAD e archive indicados. Ela não é um importador genérico de packs arbitrários do usuário.

## Entrega em partes sem perda de qualidade

O EPK completo permanece em **`build/modern-content/modern-hd.epk`** para reprodução e auditoria. A publicação contém apenas suas partes `.bin`, metadados e avisos. Um monólito antigo presente em `web/generated/modern-hd.epk` é movido para o cache de build pelo gerador, preservando a evidência sem manter a resposta antiga entre os recursos publicados.

Esta adaptação trata o transporte de uma resposta de aproximadamente 399 MB e sua verificação/cache no browser. **Não reduz tamanho de textura, quantidade de imagens, qualidade, pacote lógico ou sua alocação final no filesystem do motor.** Nenhum PNG ou byte do EPK muda: a concatenação das partes, em ordem e offsets fixados, é exatamente o arquivo de SHA-256 `f9a2cc0…` acima. O runtime continua recebendo um EPK completo para o carregador ZIP nativo.

Cada parte possui tamanho, offset e SHA-256 fixados tanto nos metadados de origem quanto no `modern-hd.json` publicado. O gerador lê e grava em blocos, verifica cada hash e a concatenação inteira antes de promover as partes. O host pode verificar respostas limitadas a 32 MiB e copiá-las para o buffer final, em vez de materializar uma resposta HTTP de 399 MB para cada operação de fetch, digest e Cache Storage. A implementação do host ainda deve validar os índices/offsets, recusar falta ou corrupção de qualquer parte e só marcar o pacote como preparado quando todas estiverem disponíveis. Esse desenho não é prova de compatibilidade de hardware.

| Arquivo | Offset | Bytes | SHA-256 |
|---|---:|---:|---|
| `modern-hd.000.bin` | 0 | 33.554.432 | `6f7b22662d4471172a779ab3d534f71e4b13add369ca45aef99d57d14b389e95` |
| `modern-hd.001.bin` | 33.554.432 | 33.554.432 | `fd1643e5aa9e65c252826c6b80e80e6b7aec77034d3abdba59d2eb693f428590` |
| `modern-hd.002.bin` | 67.108.864 | 33.554.432 | `9994ffac732cfa27478e43b643a0b11fcbc9df093dfc357d0d45f184a4a7364b` |
| `modern-hd.003.bin` | 100.663.296 | 33.554.432 | `046942454ec63a0fd86b0de299159c80b3c291a38dbf25d9560d13ec15b7c311` |
| `modern-hd.004.bin` | 134.217.728 | 33.554.432 | `e3dcb4dfd1508c80098f7434eee2898ba3c4b901816b6f2d0f59925a779f2e8b` |
| `modern-hd.005.bin` | 167.772.160 | 33.554.432 | `6e2784472bb44ad22ef7da2c95f3a0986a360864dd9cd9ae0997c221e8d794f3` |
| `modern-hd.006.bin` | 201.326.592 | 33.554.432 | `1cbd6599cece4b6184deaa9eac20e9b56c6972d5ca284223b663e95c361e0666` |
| `modern-hd.007.bin` | 234.881.024 | 33.554.432 | `1858b3fb137b91c32945b9bb7b742c10d50ae99cde83c7436053d7bba4d12f1e` |
| `modern-hd.008.bin` | 268.435.456 | 33.554.432 | `97b867e4bb5efd004b696b1de55faab039135a0ac2a3e359e0960099d7c8b9ba` |
| `modern-hd.009.bin` | 301.989.888 | 33.554.432 | `c5242bd526be812fb787bf2b4ce87d82971ea48e61d20ec942fa81688d23ba38` |
| `modern-hd.010.bin` | 335.544.320 | 33.554.432 | `4e4a271a6952e3eadd4f8a3150d2ceffb6f980d56883841be2289f91a2cdf984` |
| `modern-hd.011.bin` | 369.098.752 | 29.582.593 | `88d1952cc46c261dc6d15efd9e8488e4dd9e170ca7cc773b047d2f34965e96a1` |

## Validação desta tarefa e limites

Foram conferidos a origem/hash completo, nomes e duplicatas, dimensões 4× e exceções 4K, cobertura das texturas originais, amostras visuais de parede/arma, a opacidade defeituosa de amostras upstream e os avisos de licença. A geração resultou nas contagens e checksum acima. A segunda geração e auditoria do manifesto/PNG documentam estabilidade e integridade de empacotamento; não são benchmark do motor. Duas gerações adicionais do transporte em partes mantiveram os 12 hashes e o hash concatenado do EPK completo; o monólito não permanece na saída publicada.

O pacote oferece HD do cenário com duas superfícies 4K de biblioteca de materiais; **não oferece sprites HD, modelos 3D, normal maps, roughness, PBR, iluminação global ou geometria nova**. Não foi declarado teste em iPad ou ganho de FPS por esta tarefa de conteúdo. A validação final deve conferir alinhamento, repetição do tile, mudança de cor, texturas animadas, transparências nativas, legibilidade, reabertura offline e o custo de manter PNGs e texturas GPU, separadamente do tamanho de download.
