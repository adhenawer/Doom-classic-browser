# Discovery de texturas, materiais e nitidez

Consulta: **25/10/2026 (UTC)**. Especialidade: `doom_art` / technical art. Base local: release 0.3.0, commit `d73fac9537469c64ad7186cde456f58a9481b3ef`. Esta é uma análise de fontes e do conteúdo local; não implementa um renderer, não integra um pack e não comprova qualidade ou desempenho desses candidatos no browser/iPad.

## Parecer

Para reduzir a aparência de blocos sem transformar a imagem em um borrão, combinar **renderização interna maior, assets com mais detalhe e filtragem por textura**. Um filtro no Canvas inteiro não sabe distinguir uma letra do HUD de uma parede e não recupera detalhe ausente. Materiais modernos são viáveis como uma fatia artística pequena, mas precisam de um renderer que leia os canais de material e de um carregador de assets inexistente na versão atual.

A primeira fatia recomendada é um trecho de E1M1 do Freedoom com **12 materiais, albedo de 512 px como referência e versões de 256 px**, um conjunto pequeno de sprites revistos e HUD preservado. Normais, roughness e emissivo devem ser uma segunda comparação sobre esse trecho. 1024 px fica reservado para uma superfície próxima que demonstre benefício. Esses tamanhos e a contagem são propostas, não um orçamento já aceito ou medido.

## O que limita o port atual — verificado no código

- O modo Alta rasteriza 640×400 com Crispy Doom; a imagem de saída e a escala CSS não são a resolução das texturas. `scripts/build-engine.sh` usa `CRISPY_TRUECOLOR=OFF`; ativar truecolor sozinho não acrescentaria materiais, sombras nem um carregador de texturas HD.
- `web/wad.ts` exige assinatura `IWAD`, E1M1 e os lumps de DOOM 1. Rejeita PWAD. A UI atual não oferece importação PK3, associação de pacotes de materiais ou seleção de seu nível de detalhe.
- O renderizador em software lê patches/colunas, texturas compostas por `TEXTURE1/PNAMES` e flats do WAD. Não possui a cadeia PBR proposta abaixo. Veja a base [Crispy fixada, `r_data.c`](https://github.com/fabiangreffrath/crispy-doom/blob/fdeabe4c23a833534b70aa84a22f1685aae7125d/src/doom/r_data.c).
- A camada `web/presentation.ts` recebe o framebuffer já composto. O efeito WebGL existente é uma apresentação do quadro; não tem geometria, UVs, normais, material por superfície ou profundidade do mundo. Aplicar anisotropia nesse único quadro não equivale a aplicá-la nos pisos do mapa.

Uma substituição HD precisa conservar **tamanho lógico do tile, offsets, animação e alinhamento**, amostrando uma imagem física maior. Trocar simplesmente um flat 64×64 por pixels 256×256 no formato vanilla não implementa isso e pode produzir dados inválidos ou alterar a escala visual.

## Técnicas de jogos modernos que fazem sentido investigar

Os nomes dos canais abaixo seguem como referência a [especificação de materiais glTF 2.0](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#materials). Usar essa convenção não obriga importar modelos glTF nem implica que o motor já a suporte.

| Técnica | Benefício pretendido | Dependência / limite |
|---|---|---|
| Albedo de maior definição | Detalhes de chapa, concreto e recortes mais legíveis de perto | Loader de substituição por nome + escala lógica preservada; não cria geometria |
| Normal map | Relevo aparente em parafusos, rachaduras e chapas | Shader de iluminação, normais/tangentes e UVs; não altera silhueta ou colisão |
| Roughness / metalness | Separação entre tinta, metal exposto e concreto | Modelo de iluminação coerente e resposta especular; aumentar brilho global não substitui esses canais |
| AO | Modulação de luz indireta em pequenas cavidades | Evitar multiplicar sombras já pintadas e escurecer pistas essenciais |
| Emissivo | Painéis e fontes luminosas mais legíveis | Emissão visível não ilumina o cenário automaticamente; luzes exigem outro mecanismo |
| Height / parallax | Profundidade aparente adicional | Custo e artefatos em ângulos rasantes; adiar, sem prometer deslocamento real |

Na convenção proposta, albedo/emissivo usam sRGB; normal e canais de dados são lineares. Empacotar AO/Roughness/Metalness em R/G/B é uma escolha explícita do pipeline. A normal deve ser renormalizada ao amostrar. Importar normal DirectX como OpenGL sem tratar o eixo Y inverte relevos. Esses detalhes precisam de testes de referência, não de ajustes visuais aleatórios.

A apresentação oficial [“The devil is in the details: idTech 666”, SIGGRAPH 2016](https://www.advances.realtimerendering.com/s2016/index.html) mostra que qualidade e custo são decisões do renderer. É uma referência de método; não torna o DOOM de 1993 equivalente ao renderer dos jogos modernos e não autoriza copiar seus assets.

## Filtragem e compressão

**Mipmaps + trilinear** são o primeiro candidato para reduzir cintilação ao afastar ou girar a câmera. Não fazem surgir detalhes novos. **Anisotropia opcional**, começando em 2×/4× como proposta, é relevante para pisos e paredes vistos em ângulo; depende de consultar suporte e limite em runtime. A [documentação da extensão WebGL](https://developer.mozilla.org/en-US/docs/Web/API/EXT_texture_filter_anisotropic) descreve a capacidade, não certifica um iPad específico.

Filtrar o mundo separadamente do HUD permite manter letras e números claros. Testar sprites com alpha dilatado nas bordas, geração de mips consciente de cobertura e UVs/atlas com margens: mips ruins produzem halos e vazamentos de outras imagens. Tiles precisam de bordas contínuas também nas normais e nos mips, não apenas no albedo.

**KTX2/Basis Universal** é um candidato de distribuição e redução de memória de texturas num backend GPU. O [formato KTX2](https://github.khronos.org/KTX-Specification/ktxspec.v2.html) pode armazenar mips e dados transcodificáveis. Não é uma extensão PNG que `new Image()` resolve. Exige parser/transcoder, formato GPU detectado em runtime e fallback quando necessário. UASTC é candidato a comparar para normais/detalhes; ETC1S para albedos quando a perda for aceitável. Não se declara taxa de compressão ou tempo sem encodar/amostrar a fatia.

O [projeto de transcoders Khronos separado](https://github.com/KhronosGroupArchives/Basis-Universal-Transcoders) foi arquivado em julho de 2026 e opera sobre payloads, não sobre o contêiner inteiro. Não adotá-lo por uma menção antiga. Avaliar as ferramentas atuais de [Basis Universal](https://github.com/BinomialLLC/basis_universal) / [KTX-Software](https://github.com/KhronosGroup/KTX-Software), fixando revisão e verificando licenças das partes efetivamente usadas antes de integrar. A licença de uma biblioteca não se torna a licença das imagens.

## Bibliotecas e packs consultados

| Candidato | Evidência e licença | Recomendação para este projeto |
|---|---|---|
| **Poly Haven** | A [licença oficial](https://polyhaven.com/license) identifica assets como CC0. [Blue Metal Plate](https://polyhaven.com/a/blue_metal_plate) e [Concrete Floor 02](https://polyhaven.com/a/concrete_floor_02), de Rob Tuytel, têm mapas de material e páginas acessíveis na consulta | Bons candidatos para matéria-prima; ajustar escala, cor e desgaste à cena. Páginas/preview renders não são automaticamente o asset CC0. Selecionar arquivos próprios de distribuição e guardar procedência |
| **ambientCG** | [Documentação oficial de licença](https://docs.ambientcg.com/license/) confirma CC0 e redistribuição dos arquivos. A página individual `MetalPlates006` não pôde ser inspecionada pela ferramenta nesta consulta | Boa biblioteca candidata. A licença geral foi conferida; composição/canais de um asset específico continuam pendentes de inspeção |
| **DHTP** | [README](https://github.com/KuriKai/DHTP/blob/b0bee743a2554df3fce5d71e3da0eaed393d6d8d/README.md): regras por autor, créditos diferentes e permissão exigida para os demais assets. Último commit master observado: `b0bee743a2554df3fce5d71e3da0eaed393d6d8d`, 22/02/2022 | Não distribuir o pack inteiro como se fosse CC0 ou uniformemente livre. Usar apenas uma seleção cujo autor/arquivo/permissão seja rastreável. Conferir adequação ao Freedoom |
| **Freedoom-HD, m4cd4r4** | [README fixado](https://github.com/m4cd4r4/freedoom-hd/blob/ea02b826a758a5105dfd9b635ee44711154f53aa/README.md): pipeline MIT e assets derivados de Freedoom BSD. [Release v1.0](https://github.com/m4cd4r4/freedoom-hd/releases/tag/v1.0), 08/03/2026. API informa **402.969.291 bytes** e digest `8a0d4c1abe86a1582200289db38c8562a9eaa58e5725d7a182984931c5cc6ae9` | Referência de pipeline/candidato a amostra, não dependência pronta. Não foi baixado ou executado. Tem cerca de 384,3 MiB, superior ao cache atual; alvo declarado é GZDoom, incompatível com o importador atual |
| **Real-ESRGAN / ESRGAN** | O [LICENSE do Real-ESRGAN](https://github.com/xinntao/Real-ESRGAN/blob/master/LICENSE) é BSD-3-Clause; o [LICENSE do ESRGAN original](https://github.com/xinntao/ESRGAN/blob/master/LICENSE) é Apache-2.0. Não são licenças intercambiáveis | Processar somente assets autorizados na nuvem, nunca toda partida em tempo real. Fixar código, checkpoint, hashes e avisos; revalidar os termos do checkpoint escolhido |

No Freedoom-HD, a inspeção do [config](https://github.com/m4cd4r4/freedoom-hd/blob/ea02b826a758a5105dfd9b635ee44711154f53aa/pipeline/config.py) revelou caminho absoluto de Windows e modelo `anime_6B`; os [requirements](https://github.com/m4cd4r4/freedoom-hd/blob/ea02b826a758a5105dfd9b635ee44711154f53aa/pipeline/requirements.txt) não fixam todas as versões. A reprodução em Linux/GitHub Actions exige adaptação e lock, não executar cegamente o README. O [empacotador](https://github.com/m4cd4r4/freedoom-hd/blob/ea02b826a758a5105dfd9b635ee44711154f53aa/pipeline/04_package_pk3.py) inspecionado escreve comentário `GAMEINFO.txt` e PNGs; a nova distribuição deve incluir a licença BSD completa e os créditos, não apenas esse comentário. O conteúdo do PK3 da release não foi auditado.

A alegação de compatibilidade de um autor é evidência documental, não resultado de teste deste projeto. HD de Freedoom substitui imagens por nome, mas não recupera a arte original de DOOM comercial. Nunca redistribuir texturas de DOOM 2016/Eternal/Dark Ages ou um upscale de WAD comercial por o usuário ter importado o arquivo.

## IA offline: benefício e limites

Um upscale pode produzir detalhe plausível; **não recupera informação original perdida**. A preferência artística entre resultado fiel, suavizado ou reconstruído só pode ser decidida com amostras comparáveis. Há risco de ruído, parafusos falsos, lettering deformado, silhuetas alteradas e inconsistência entre quadros/ângulos de um monstro.

Para paredes repetíveis, testar entrada com wrap/padding e recorte antes de aceitar uma imagem; processamento independente nas bordas pode criar costura. Para sprites, processar uma sequência completa do mesmo personagem, preservar offsets/espelhamentos/alpha e verificar em movimento. Animações de água, fogo, painéis e armas exigem coerência temporal. Evitar tratar cada quadro como uma fotografia sem relação com os demais.

Gerar os arquivos antes da release permite execução offline sem modelo, GPU de treinamento ou API de IA no aparelho. A disponibilidade de GPU no executor desta tarefa **não foi verificada**. GPU CUDA não é pressuposta em um runner padrão; definir executor apropriado ou medir a alternativa CPU. Tempo de geração, memória de inferência e qualidade do modelo nesta fatia permanecem não medidos.

## Fatia concreta proposta

Leitura local do `web/generated/freedoom1.wad`, Freedoom 0.13.0, SHA-256 `7323bcc168c5a45ff10749b339960e98314740a734c30d4b9f3337001f9e703d`, identificou referências de E1M1:

| Grupo | Referências mais frequentes |
|---|---|
| Texturas em SIDEDEFS | `MC17` 131; `STEPTOP` 55; `METAL2` e `BASE2` 54 cada; `AQTRIM05` 46; `DOORSTOP` 42 |
| Flats em SECTORS | `AQF024` 34; `SLIME14` 32; `FLAT1` 24; `RROCK18` 23; `FWATER1` 20; `RROCK17`, `CEIL5_2` e `F_SKY1` 19 cada |

Método: ler diretório WAD, localizar E1M1 e contar os nomes dos três campos de textura de cada SIDEDEF e dos dois campos de flat de cada SECTOR; excluir `-`. **Contagens são referências, não cobertura de tela nem classificação artística.** Inspecionar a imagem real antes de associar concreto/metal pelo nome. Não substituir `F_SKY1` como se fosse um piso: é marcador especial. Preservar a família inteira de animações ao selecionar `FWATER1` ou outra superfície animada.

1. Capturar a cena inicial, corredor com piso em perspectiva, porta abrindo e encontro com inimigo; registrar posição/ângulo/tic, iluminação, viewport e versão do IWAD.
2. Selecionar 12 materiais realmente presentes: paredes, piso/teto, trim, porta e painel. Produzir primeiro apenas albedos; tratar líquidos/céu como casos próprios. Usar os dois assets CC0 conferidos como matéria-prima candidata, não substituição automática.
3. Comparar reconstrução manual/CC0 e upscale 2×/4× de conteúdo Freedoom autorizado. Manter o tamanho lógico, contraste de sinais/portas e escala do desgaste. Mais resolução não significa ruído fino em todas as superfícies.
4. Quando o backend aceitar, comparar albedo+normal+ORM e emissivo seletivo, com controle de intensidade e iluminação identificada. Não chamar de PBR um shader que só exibe albedo ou aumenta brilho.
5. Separar HUD de filtragem do mundo. Conservar números/ícones originais inicialmente; revisar sprites com uma sequência completa antes de habilitar um pack de milhares de imagens.
6. Disponibilizar pacote opcional completo e validado para offline, com versão/hash do IWAD-alvo e manifest de assets. Não atrelar rede externa à partida; não marcar offline pronto se faltar a qualidade escolhida.

### Orçamento de memória calculado, não medido

Hipótese conservadora simples: **12 materiais quadrados, RGBA8, cadeia completa de mips**; 3 mapas por material significam albedo, normal e ORM. O fator de mipmaps é aproximadamente 4/3. Não inclui emissivo, sprites, cópias CPU, decodificação, buffers, render targets ou o heap WASM.

| Lado da textura | 12 albedos | 12 materiais × 3 mapas |
|---|---:|---:|
| 256 px | ~4 MiB | ~12 MiB |
| 512 px | ~16 MiB | ~48 MiB |
| 1024 px | ~64 MiB | ~192 MiB |

Esses valores são memória RGBA8 residente aproximada, **não tamanho de download PNG/KTX2**. Formatos comprimidos podem mudar a conta se suportados; fallback RGBA pode consumi-la integralmente. Para a fatia inicial, a proposta é limitar mapas residentes, carregar só os usados e medir pico de inicialização; não assumir que o teto do heap atual contém a memória da GPU/browser.

### Manifest e aceite antes de distribuir

Cada arquivo precisa de: ID de material, nome/namespace-alvo, dimensões físicas e lógicas, offsets, tipo de canal/espaço de cor, política de alpha, wrap/mips, autor, URL do asset, versão/revisão, licença, SHA-256 de entrada/saída, modificações e ferramenta/checkpoint usados. Salvar fontes editáveis e avisos na distribuição correspondente. Identificar pack por hash e associá-lo ao IWAD/perfil; não reaproveitar cegamente nomes entre IWADs diferentes.

O aceite exige mesma cena antes/depois, inspeção de bordas/costuras/HUD/silhuetas, câmera em movimento e portas/líquidos animados; medição fria/quente de frame times e memória observável; ausência de regressão de save/teclado/foco; reabertura offline com o pacote selecionado e fallback reversível. A qualidade do pack, desempenho sustentado e compatibilidade física no iPad **continuam pendentes**. Nenhum asset novo foi adicionado à partida por este discovery.
