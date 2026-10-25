# Discovery de renderizadores — nitidez e resolução além de 640×400

Data: 25/10/2026. Responsável: especialidade `doom_rendering`. Base do produto: commit `d73fac9537469c64ad7186cde456f58a9481b3ef`, release 0.3.0. **Esta entrega é pesquisa e inspeção de fontes; nenhum novo motor foi compilado, executado ou integrado neste discovery.** Não constitui validação no iPad.

## Parecer

O melhor primeiro candidato a protótipo de **geometria acelerada por GPU + texturas HD no browser** é **EDGE-Classic**, porque o próprio upstream mantém código Emscripten/WebGL2, configuração sem threads e substituição de imagens em alta resolução. Isso reduz o trabalho de portar APIs desktop; ainda exige integrar teclado, controle de rotação, áudio, suspensão, saves e offline próprios deste produto.

Se o objetivo for somente uma imagem geométrica mais fina, **Woof!** é uma alternativa de rasterização em software com resolução arbitrária e DRS. Sua revisão atual usa SDL3 e outra infraestrutura de áudio; não foi encontrado um alvo web mantido na árvore examinada. Seria outro port Emscripten e não resolve, por si só, texturas e sprites originalmente pequenos.

Para materiais PBR complexos, a família **GZDoom/UZDoom** é referência de capacidade desktop, mas os caminhos web encontrados têm limitações de backend, memória e hospedagem. Não é correto prometer que um pacote PBR desktop funcionará no renderer GLES usado no browser.

## Por que aumentar o Canvas já não basta

No produto, Classic rasteriza 320×200 e Alta rasteriza 640×400 em C. SDL e o browser apresentam a imagem depois. O shader CRT atual processa apenas essa imagem pronta. Mais pixels na saída ou um filtro não permitem acessar as texturas antes da projeção nem adicionar normais, geometria, profundidade ou novos detalhes autorais.

No Crispy fixado, `SCREENWIDTH = ORIGWIDTH << crispy->hires`, a altura segue a mesma regra e `MAXHEIGHT` é 400. Há decisões específicas para `hires` 0/1 em projeção, HUD e tabelas. Trocar `hires` para 2 ou apenas elevar `MAXHEIGHT` não é uma adaptação completa e pode extrapolar arrays. Referências: [i_video.h](https://github.com/fabiangreffrath/crispy-doom/blob/fdeabe4c23a833534b70aa84a22f1685aae7125d/src/i_video.h), [i_video.c](https://github.com/fabiangreffrath/crispy-doom/blob/fdeabe4c23a833534b70aa84a22f1685aae7125d/src/i_video.c), [validação do produto](../HIRES.md).

## Comparação técnica

| Candidato | Ganho possível | Evidência web encontrada | Trabalho/risco para este produto | Parecer |
|---|---|---|---|---|
| Chocolate atual | Referência fiel e leve | Build e jogo validados na 0.3.0 | 320×200 e conteúdo clássico | Preservar como fallback |
| Crispy atual | 640×400 real | Build e jogo validados na 0.3.0 | Limites explícitos dessa escala; não há pipeline de materiais HD | Preservar Alta; não forçar 1080p por constantes |
| Woof! | Resolução arbitrária, DRS, interpolação de apresentação | Fonte desktop, SDL3; nenhum alvo Emscripten identificado na árvore consultada | Portar plataforma/loop, áudio, entrada e persistência; software continua consumindo CPU por pixel | Candidato se priorizarmos geometria clássica sem materiais modernos |
| DSDA-Doom | Resolução escalável, software e OpenGL, modos conservadores de compatibilidade | Fonte desktop; nenhuma compilação web própria nesta análise | Renderer contém `glBegin` e APIs/extensões desktop, ausentes de WebGL2 direto; precisa adaptação ou camada de emulação, além da plataforma | Não é substituição imediata do loader atual |
| EDGE-Classic | Geometria GPU, saída de resolução configurável, substituições HD, mipmaps e suavização por textura | Alvo Emscripten upstream, CI web e player público | 512 MiB de heap inicial upstream; controles/IDBFS/HUD/physics/save próprios; não oferece PBR comprovado no shader inspecionado | **Primeiro protótipo recomendado** |
| GZDoom/UZDoom desktop | HD, mods e materiais avançados | Upstream documenta desktop; existem forks web separados | GL/Vulkan nativos não equivalem a WebGL2; revisar VM/JIT, áudio, loop, memória e licenças de componentes | Referência para segunda fase |
| `abootnet/uzdoom-wasm` | Geometria WebGL2 e HD via família UZDoom | Fonte Emscripten, alvo próprio, IndexedDB; autor descreve como port inicial | Pthreads obrigatórias na configuração examinada, SAB/COOP/COEP; heap inicial 256 MiB/teto 2 GiB; backend GLES restringe materiais | Estudo secundário; não integrar tal como está |
| `mungus43/tomb-engine` | GZDoom 4.11.3 por WebGL2 | Fonte do port e demo fornecidas pelo autor | Worker/OffscreenCanvas/JSPI; build Windows não fixado; suporte Safari não testado pelo autor; dados de FPS são de outra máquina | Referência de patches, sem endosso de compatibilidade |
| “Doom Legacy Web” | Potencial renderer GL do Doom Legacy | Não foi identificado um projeto primário autônomo com esse nome e build browser mantido | O site do Doom Legacy declara plataformas nativas; “Web Site” não é “web renderer” | Não usar como evidência de um port web existente |

[Woof! README](https://github.com/fabiangreffrath/woof/blob/8cfa82248b682126800c769315295a35962fb50c/README.md), [DSDA GL](https://github.com/dsda-org/dsda-doom/blob/687a5a32e0a8013b03b8dbfc8f49555ffce67470/prboom2/src/gl_main.c), [EDGE README](https://github.com/edge-classic/EDGE-classic/blob/9e2b61677f215861e40b631429bf322935e8f87c/README.md), [UZDoom](https://github.com/UZDoom/UZDoom/blob/62afe5f0a914610bd70ea9302da992ede38a36ad/README.md), [Doom Legacy, página do projeto](https://sourceforge.net/projects/doomlegacy/).

Licenciamento preliminar: DSDA traz GPL-2.0-or-later nos headers examinados; GZDoom declara GPLv3 e UZDoom GPL-3.0-or-later. O README atual do Woof lista GPL-2.0+ como regra geral, **mas `src/v_video.*` e `src/v_flextran.*` são GPL-3.0+**, além de componentes e arte com outras licenças. A etiqueta “GPL-2.0” do GitHub não resolve a licença da combinação compilada. Para qualquer candidato, mapear os arquivos realmente distribuídos, respectivos avisos e fonte correspondente; não basta copiar o arquivo LICENSE da raiz.

## Auditoria do candidato EDGE-Classic

### Manutenção e build

Na consulta, última release publicada **1.53**, de 11/07/2026; revisão de desenvolvimento examinada **`9e2b61677f215861e40b631429bf322935e8f87c`**, commit de 19/10/2026. O produto não deve herdar uma dependência `master`: um protótipo deve fixar revisão, archive, tamanho e SHA-256 próprios. A release está em [1.53](https://github.com/edge-classic/EDGE-classic/releases/tag/1.53).

O [CMake principal](https://github.com/edge-classic/EDGE-classic/blob/9e2b61677f215861e40b631429bf322935e8f87c/CMakeLists.txt) define `EDGE_WEB_MULTITHREADED=OFF` e `EDGE_WEB_SIMD=OFF` por padrão. O [módulo Emscripten](https://github.com/edge-classic/EDGE-classic/blob/9e2b61677f215861e40b631429bf322935e8f87c/cmake/Emscripten.cmake) ativa Sokol/GLES3, SDL2, WebGL2 e Asyncify; o caminho sem threads não usa SharedArrayBuffer. Portanto **não há necessidade arquitetural de COOP/COEP por pthreads nessa configuração**. Isso é inspeção do build, não teste de publicação no nosso GitHub Pages.

Há [job web no CI upstream](https://github.com/edge-classic/EDGE-classic/blob/9e2b61677f215861e40b631429bf322935e8f87c/.github/workflows/cmake.yml). Ele usa Emscripten `latest` e baixa conteúdo de outro repositório sem commit/hash fixado. Esses passos não atendem à política de entradas fixadas deste produto; o protótipo deve usar a toolchain e conteúdo verificados, ou registrar uma nova toolchain fixada caso a atual não compile. Não foi feita essa compilação aqui.

### Capacidades HD realmente localizadas

O carregador [r_image.cc](https://github.com/edge-classic/EDGE-classic/blob/9e2b61677f215861e40b631429bf322935e8f87c/source_files/edge/r_image.cc) contém `ImageAddTxHx`: no namespace HIRES encontra o original de parede, piso/teto, sprite ou gráfico e cria sua substituição. O código calcula `scale_x_`/`scale_y_` a partir das dimensões originais, preservando o tamanho no mundo. Isso é uma base concreta para usar, por exemplo, uma parede 256×256 no lugar de uma original 64×64 sem quadruplicar seu tamanho físico. A compatibilidade de um pacote externo específico ainda precisa ser provada.

[r_texgl.cc](https://github.com/edge-classic/EDGE-classic/blob/9e2b61677f215861e40b631429bf322935e8f87c/source_files/edge/r_texgl.cc) seleciona nearest/linear e combinações de mipmaps, incluindo trilinear. Em `r_image.cc`, pisos e paredes podem usar mipmaps, enquanto gráficos/HUD não recebem essa política por padrão. O produto deve preservar controle separado de nitidez do HUD e da filtragem do mundo. Anisotropia não foi localizada nos pontos examinados; se adotada, precisa de detecção de extensão, integração e medição próprias.

O [shader do mundo](https://github.com/edge-classic/EDGE-classic/blob/9e2b61677f215861e40b631429bf322935e8f87c/source_files/edge/render/sokol/shaders/world.glsl) amostra duas texturas, combina cor de vértice e névoa. A inspeção não encontrou, nesse caminho, material normal/roughness/metalness com BRDF PBR. Não anunciar “PBR de jogos modernos” a partir de suporte a PNG HD, luz dinâmica ou nomes genéricos de shader. A própria release 1.53 registra correções de luzes dinâmicas, mas isso não implica um pipeline PBR.

### O que impede uma troca direta

- **Memória:** o build web examinado usa `INITIAL_MEMORY=512Mb`, inclusive sem threads. É 16 vezes o heap inicial configurado do produto atual (32 MiB), e excede o teto atual de 256 MiB. Isso descreve configuração, não memória residente medida. Reduzir o valor exige medir alocações e inicialização; texturas decodificadas/cópias/GPU acrescentam memória fora do heap.
- **Entrada:** o [HTML upstream](https://github.com/edge-classic/EDGE-classic/blob/9e2b61677f215861e40b631429bf322935e8f87c/web/site/index.html) solicita Pointer Lock por clique. [i_web.cc](https://github.com/edge-classic/EDGE-classic/blob/9e2b61677f215861e40b631429bf322935e8f87c/source_files/edge/i_web.cc) já oferece loop/eventos web, mas não nossa ponte de comandos. [i_ctrl.cc](https://github.com/edge-classic/EDGE-classic/blob/9e2b61677f215861e40b631429bf322935e8f87c/source_files/edge/i_ctrl.cc) recebe SDL keydown/keyup; isso não prova captura sem foco, prevenção de atalhos ou navegação sem mouse no novo shell. É necessário retirar a dependência de clique/Pointer Lock e ligar o controlador de rotação ao construtor de comandos em 35 Hz.
- **Saves:** EDGE possui [formato próprio em chunks](https://github.com/edge-classic/EDGE-classic/blob/9e2b61677f215861e40b631429bf322935e8f87c/docs/specifications/original_edge_specifications/save_sys.txt) e [rotinas próprias](https://github.com/edge-classic/EDGE-classic/blob/9e2b61677f215861e40b631429bf322935e8f87c/source_files/edge/sv_main.cc). Não copiar `.dsg` Classic/Alta para EDGE nem prometer conversão. Criar perfil novo, por exemplo `/persist/saves-modern/<iwadHash>/<engineProfile>/`, e manter os dois motores antigos disponíveis. Confirmar versão e compatibilidade com o código atual; a especificação histórica não prova compatibilidade externa.
- **Regras:** outro port não garante simulação/bugs/demos idênticos ao Chocolate. Identificar como perfil Modern; manter mira vertical, pulo e novas regras desligados no primeiro experimento e verificar auto-aim e limites da câmera. Mudança de renderer não autoriza ligá-los.
- **Persistência/offline:** o `-home` do upstream monta IDBFS próprio. Não montar duas vezes o mesmo volume nem substituir bancos existentes. Integrar sync serializado antes do reload; precache do runtime separado de instalação opcional de HD, com progresso e hashes. O player upstream não foi auditado como nossa PWA offline.

### Licenças e distribuição

Os headers do motor declaram **GPL-3.0-or-later**; preservar [LICENSE](https://github.com/edge-classic/EDGE-classic/blob/9e2b61677f215861e40b631429bf322935e8f87c/LICENSE) e fontes correspondentes. O port atual é GPL-2.0-or-later; integração deve registrar a licença aplicável à combinação, sem apagar a licença dos componentes existentes.

O [inventário de atribuições](https://github.com/edge-classic/EDGE-classic/blob/9e2b61677f215861e40b631429bf322935e8f87c/docs/licenses/License%20Attribution.txt) inclui vários regimes: Freedoom/BSD, fontes OFL, bibliotecas permissivas, conteúdo REKKR CC-BY-NC e WidePix sob seus próprios termos. **GPL do motor não é licença de todos os assets do pacote.** Fazer inventário e recortar a distribuição ao necessário para Freedoom antes de empacotar; não trazer o diretório completo de suporte a todos os jogos por conveniência.

## Auditoria dos caminhos UZDoom/GZDoom web

### `abootnet/uzdoom-wasm`

Revisão examinada **`97a3d5c5d69f5d4b7b044ae07badd624815a6fe6`**, commit de 24/05/2026. [README](https://github.com/abootnet/uzdoom-wasm/blob/97a3d5c5d69f5d4b7b044ae07badd624815a6fe6/README.md) caracteriza o projeto como port inicial. Não há release publicada retornada pela consulta a `releases/latest`.

O [build real](https://github.com/abootnet/uzdoom-wasm/blob/97a3d5c5d69f5d4b7b044ae07badd624815a6fe6/cmake/Emscripten.overrides.cmake) usa `-pthread`, pool baseado em `navigator.hardwareConcurrency`, heap inicial 256 MiB, teto 2 GiB, SDL2/OpenAL, loop reestruturado e WebGL2. O renderer GLES é selecionado e Vulkan não é compilado. A configuração requer isolamento de origem; publicação na infraestrutura atual precisa de uma solução de headers ou alteração fundamentada do backend sem threads. Não herdar o Caddy/backend do projeto como dependência de execução offline.

Há uma limitação importante na [seleção do shader GLES](https://github.com/abootnet/uzdoom-wasm/blob/97a3d5c5d69f5d4b7b044ae07badd624815a6fe6/src/common/rendering/gles/gles_shader.cpp#L254): quando um fragmento de iluminação foi especificado, ele é substituído por `material_normal.fp`. O comentário registra uso desse material e descarte dos demais. Há arquivos `func_pbr.fp`, mas a existência deles não prova ativação de PBR no caminho utilizado. Um protótipo de materiais precisaria provar seleção, bindings, iluminação e resultado de normal/metal/roughness no browser, em vez de apenas carregar o pacote.

O README também descreve áudio de forma mais abrangente que alguns comentários de build, que mencionam um ZMusic stub. Tratar áudio/MIDI como item a validar dinamicamente. Não transportar listas de features do README para critérios marcados como aprovados.

### `mungus43/tomb-engine`

Revisão examinada **`6c735315b8ac1b1dd6646ac78c46bbbdbb775a5c`**, commit de 19/05/2026; sem release publicada retornada. O [README](https://github.com/mungus43/tomb-engine/blob/6c735315b8ac1b1dd6646ac78c46bbbdbb775a5c/README.md) fixa a origem em GZDoom `g4.11.3` e descreve worker, OffscreenCanvas, JSPI e patches de atributos inteiros, formatos de textura e shaders WebGL2. É útil como inventário de problemas de portabilidade reais relatados pelo autor.

A documentação reconhece Safari como não testado e o build foi preparado em Windows com SDK `latest`; suas versões mínimas de browsers e números de FPS não foram reproduzidos. Não usar a alegação de “4K sem custo” para planejar iPad: desempenho é dependente da cena/dispositivo e o aumento de resolução pode passar a limitar GPU/banda. Uma alternativa baseada em JSPI exige verificação por capacidade em runtime e plano para browsers sem a API.

## Por que desktop OpenGL não é WebGL2

WebGL2 corresponde a um conjunto de APIs ES3 com validação e restrições próprias. Código legado com `glBegin`, estado fixo ou extensões ARB/EXT não recebe equivalência automática; formato de textura, shader, atributos inteiros, buffers e chamadas disponíveis precisam ser auditados. Emscripten oferece emulação parcial, com limitações e custo. A [documentação oficial](https://emscripten.org/docs/porting/multimedia_and_graphics/OpenGL-support.html) recomenda o subconjunto compatível com WebGL em novos ports. O [renderer DSDA examinado](https://github.com/dsda-org/dsda-doom/blob/687a5a32e0a8013b03b8dbfc8f49555ffce67470/prboom2/src/gl_main.c) ainda contém chamadas do pipeline fixo; portanto sua reputação nativa não elimina esse trabalho.

## Próximo experimento recomendado, sem migração da produção

1. Fixar o EDGE selecionado e fazer um **build próprio de uma thread** na nuvem, com IWAD Freedoom conhecido e arte mínima auditada. Registrar ajustes exigidos pela toolchain e tamanho dos binários, dados e fontes.
2. Renderizar a mesma cena livre com posições/ângulos e FOV comparáveis em **960×720, 1280×960 e, opcionalmente, 1600×1200 de saída 4:3**, conforme o plano consolidado, como metas de experimento, não suporte já confirmado. Em geometria GPU os pixels de saída podem ser quadrados; reproduzir corretamente o aspecto de sprites/HUD do conteúdo original, sem simplesmente esticar 1280×800 nem abrir FOV silenciosamente.
3. Integrar WASD, setas com a rampa existente, J/E, menus, foco e pausa sem mouse. Identificar a variante e salvar exclusivamente no seu namespace.
4. Substituir apenas um conjunto pequeno de paredes e pisos com HD livre/autoral e a mesma escala no mundo; verificar animações, transparência, portas, switches e alinhamento. Comparar nearest, linear e mipmaps; proteger a leitura do HUD.
5. Medir CPU/API, frame times, tamanho de conteúdo, heap observado e memória estimada das texturas. Não inferir tempo GPU por duração de chamadas JS. Só ampliar conteúdo/resolução após medir custo e estabilidade em uma sessão longa.
6. Validar restart/updates e retorno ao Classic offline, perda/restauração de contexto WebGL2, persistência e exportação de backups. O teste automatizado de WebKit desktop fica separado da validação física Chrome/iPad.

Aceite do experimento: ganho visível em capturas comparáveis e em movimento; resolução real documentada; HUD legível; todas as ações pelo teclado; fontes/licenças completas; dados antigos preservados; reabertura offline após preparação; nenhuma regressão crítica/alta. Sem essas provas, o resultado continua **candidato pesquisado**, não nova versão pronta.

## Registro das revisões consultadas

| Projeto | Release encontrada | Revisão de fonte examinada | Último commit da revisão |
|---|---|---|---|
| Woof! | `woof_16.0.0`, 08/09/2026 | `8cfa82248b682126800c769315295a35962fb50c` | 19/10/2026 |
| DSDA-Doom | `v0.30.1`, 09/10/2026 | `687a5a32e0a8013b03b8dbfc8f49555ffce67470` | 15/10/2026 |
| EDGE-Classic | `1.53`, 11/07/2026 | `9e2b61677f215861e40b631429bf322935e8f87c` | 19/10/2026 |
| UZDoom | `5.0.3`, 23/09/2026 | `62afe5f0a914610bd70ea9302da992ede38a36ad` | 24/10/2026 |
| GZDoom | `g4.14.2`, 03/05/2025 | `c26ce2e6ca2a0c770f140cb25dde0d30073ca8f7` | 10/08/2026 |
| abootnet/uzdoom-wasm | Sem release retornada | `97a3d5c5d69f5d4b7b044ae07badd624815a6fe6` | 24/05/2026 |
| mungus43/tomb-engine | Sem release retornada | `6c735315b8ac1b1dd6646ac78c46bbbdbb775a5c` | 19/05/2026 |

Releases e heads são registros distintos: esta tabela não diz que o código do head já pertence à última release. Metadata GitHub e arquivos upstream foram consultados em 25/10/2026; atividade recente não é garantia de manutenção futura.
