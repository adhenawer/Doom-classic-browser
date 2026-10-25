# Discovery gráfico — plataforma, orçamento e validação

Data: 25/10/2026. Perfil aplicado: `doom_platform`, com análise independente do desenho de integração. Base inspecionada: commit `d73fac9537469c64ad7186cde456f58a9481b3ef`, versão 0.3.0. Este documento é investigação de código e fontes oficiais; **nenhum renderer novo foi compilado, implementado, medido ou testado em dispositivo** nesta atividade. Os números abaixo são cálculos teóricos, exceto quando identificados como resultados históricos.

## Parecer

O próximo protótipo deve manter a simulação real em C/WASM e experimentar renderização de geometria e materiais em **WebGL 2**, com uma thread, dimensões explicitamente limitadas e retorno aos perfis existentes. A análise paralela de renderer seleciona **EDGE-Classic como candidato à prova**, começando por albedo HD e filtragem; isso não significa PBR já disponível nem integração concluída. É uma recomendação condicionada à prova executável. Melhorar apenas o pós-processamento é um experimento menor, porém não acrescenta detalhe real às texturas.

WebGPU é uma alternativa atual e válida para investigação futura. Não há fundamento para dizer que esteja ausente de todo iPad: a WebKit anunciou sua entrega em Safari 26.0 para iOS/iPadOS em setembro de 2025. Isso não comprova disponibilidade, limites ou estabilidade no Chrome e no modelo/versão do iPad do usuário. A decisão exige detectar a API e obter um adapter/device no browser concreto. [Anúncio oficial da WebKit](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/#webgpu).

## O caminho gráfico que existe hoje

| Camada | Evidência no projeto | Consequência para a nitidez |
|---|---|---|
| Rasterizador C | Chocolate 320×200 e Crispy 640×400; dimensões expostas em `engine/bridge.c`, perfis em `web/engine-profile.ts` | Há melhoria real da amostragem geométrica no perfil Alta, mas não há substituição HD de materiais |
| Saída SDL | `web/main.ts` grava janela 640×480, `aspect_ratio_correct 1`; a SDL apresenta o framebuffer já corrigido | Canvas 640×480 não prova rasterização interna 640×480 |
| Compositor CSS | `web/style.css` dimensiona a imagem em 4:3, com `image-rendering: pixelated` no modo Nítido | Tela Retina maior não cria pixels adicionais no motor; CSS pode produzir blocos maiores |
| Pós-processamento CRT | `web/presentation.ts` cria outro contexto WebGL 1, copia o Canvas SDL com `texImage2D`, desenha um quad; a camada tem as dimensões do Canvas fonte | Shader recebe a imagem já composta e corrigida. Não recebe polígonos, UVs, normais, profundidade, mapas de material ou texels originais independentes |

Um filtro baseado nos vizinhos dos pixels deve declarar qual grade recebe. Operar depois da correção 640×400 → 640×480 pode interpretar amostras verticais interpoladas/repetidas como parte da arte. Um experimento de reconstrução deve comparar entrada direta do framebuffer original com o caminho atual, corrigir o aspecto uma única vez e proteger HUD, texto, sprites transparentes e a paleta. Copiar o Canvas e passar um filtro não implementa antialiasing da geometria nem materiais PBR.

Para um renderer novo, preferir a apresentação no mesmo contexto, evitando manter a cópia SDL → textura de outro contexto como requisito fixo. O resultado precisa ser medido: reduzir cópias é uma hipótese de melhoria, não uma promessa de FPS.

## APIs: o que pode ser usado e o que precisa ser portado

- **WebGL 2:** a WebKit anunciou suporte em Safari 15. Ainda é necessário verificar criação do contexto, limites de texturas/renderbuffers, shaders e extensões no browser real. [WebKit, Safari 15](https://webkit.org/blog/11989/new-webkit-features-in-safari-15/).
- **OpenGL desktop:** não é sinônimo de WebGL. Emscripten documenta um subconjunto de GLES 2/3 que mapeia diretamente para WebGL e emulações adicionais com restrições/custo. `-sMAX_WEBGL_VERSION=2` habilita o caminho WebGL 2; `-sMIN_WEBGL_VERSION=2` pode torná-lo obrigatório. Esses flags não convertem automaticamente um renderer GL 3/4, Vulkan ou shaders GLSL desktop. `FULL_ES2`, `FULL_ES3` e emulação legada não são garantias de compatibilidade integral. [Emscripten/OpenGL](https://emscripten.org/docs/porting/multimedia_and_graphics/OpenGL-support.html).
- **WebGPU:** exige pipeline e shaders compatíveis, tratamento de adapter/device indisponível e perda do device. Não é um flag que torne um renderer OpenGL existente moderno. A documentação atual de Emscripten referencia Emdawnwebgpu; nosso toolchain continua fixado em 4.0.18 e o port/API correspondente teria de ser fixado e validado para essa versão, ou atualizado como mudança independente. [Emscripten/WebGPU](https://emscripten.org/docs/porting/multimedia_and_graphics/WebGPU-support.html).
- **Threads:** WebGL 2 em uma thread não exige SharedArrayBuffer. Pthreads de Emscripten exigem memória compartilhada e ambiente com COOP/COEP; o binário com threads não vira automaticamente single-thread quando indisponível. Em 25/10/2026, um HEAD HTTPS da URL pública retornou 200 sem esses dois headers. Portanto, a hospedagem atual não deve ser presumida apta a pthreads. O primeiro protótipo deve continuar em uma thread; mudar a hospedagem ou adicionar isolamento por Service Worker é outro recorte e afeta primeira navegação, cache e recuperação. [Emscripten/pthreads](https://emscripten.org/docs/porting/pthreads.html), [pedido de suporte de headers no GitHub Pages](https://github.com/orgs/community/discussions/13309).

Essas verificações são de capacidade, sem selecionar renderer por user-agent. O teste real de WebGPU deve verificar `navigator.gpu`, sucesso de `requestAdapter()` e `requestDevice()` e os limites necessários; presença de uma propriedade não basta. O teste de WebGL 2 deve verificar `getContext('webgl2')`, limites e compilação de shaders reais. Continuam disponíveis Chocolate/Crispy se o protótipo não puder iniciar.

## Texturas comprimidas e filtragem

KTX2 é um contêiner; usar a extensão do arquivo não garante compressão GPU nem compatibilidade. ETC1S/UASTC são formatos de transmissão transcodáveis. A integração deve levar o transcoder WASM/JS fixado no pacote offline, detectar extensões e escolher um destino suportado, como ASTC, ETC ou BC, com fallback não comprimido e orçamento menor. Não assumir um único formato para todos os browsers/GPUs nem exigir alterações em flags do browser do jogador. [Guia WebGL da Khronos](https://github.com/KhronosGroup/3D-Formats-Guidelines/blob/main/KTXDeveloperGuideWebGL.md), [Basis Universal e exemplos web oficiais](https://github.com/BinomialLLC/basis_universal).

Preparar mipmaps em build evita trabalho inicial e ajuda a reduzir cintilação em materiais distantes. Filtragem bilinear/trilinear e anisotropia fazem sentido quando o renderer amostra as texturas do mundo com UVs; aplicá-las somente ao framebuffer não recupera a perspectiva nem o detalhe perdido. Anisotropia deve ser opcional, com valor limitado ao máximo consultado em `EXT_texture_filter_anisotropic`; a extensão não é requisito universal. [Especificação Khronos](https://registry.khronos.org/webgl/extensions/EXT_texture_filter_anisotropic/).

Pipeline proposto: albedo com interpretação de cor sRGB; normal e canais de roughness/metalness/AO tratados como dados lineares; mipmaps de normal com tratamento apropriado; máscaras alfa testadas em sprites e grades. Erros nesses pontos podem produzir superfícies brilhantes indevidamente, halos ou silhuetas apagadas mesmo com mais pixels. Esse pipeline não existe no renderer paletizado atual.

## Orçamento teórico de memória de texturas

Unidade: 1 MiB = 1.048.576 bytes. Para uma textura quadrada RGBA8 de lado potência de dois `N`, nível base = `4N²` bytes; cadeia completa até 1×1 = `4 × Σ(N / 2^i)²`, aproximadamente 4/3 do nível base. Os valores não incluem metadados/alinhamento do driver, cópias de upload, textura fonte decodificada, transcoder, geometria, áudio, IWAD, heap ou buffers de apresentação.

| Lado | RGBA8 base | RGBA8 com todos os mips | Material com albedo + normal + ORM, todos RGBA8 e com mips | Mais um mapa emissivo RGBA8 |
|---|---:|---:|---:|---:|
| 256 | 262.144 B | 349.524 B ≈ 0,333 MiB | 1.048.572 B ≈ 1 MiB | Total ≈ 1,333 MiB |
| 512 | 1.048.576 B | 1.398.100 B ≈ 1,333 MiB | 4.194.300 B ≈ 4 MiB | Total ≈ 5,333 MiB |
| 1024 | 4.194.304 B | 5.592.404 B ≈ 5,333 MiB | 16.777.212 B ≈ 16 MiB | Total ≈ 21,333 MiB |

ORM aqui significa um mapa com canais agrupados de occlusion, roughness e metalness; o armazenamento RGBA8 é uma hipótese conservadora para a conta, não uma exigência do formato. Oito materiais 512 custariam aproximadamente 32 MiB sem emissivo; dezesseis, 64 MiB. Os mesmos dezesseis a 1024 custariam aproximadamente 256 MiB somente nas três texturas GPU. Um pacote PNG/JPEG pequeno em disco pode expandir para esses tamanhos durante a execução.

Em formatos GPU de 8 bits por pixel, a ordem de grandeza seria 1/4 da alocação RGBA8 para a mesma cadeia; formatos de blocos arredondam dimensões de cada mip e têm tamanho mínimo por bloco. Formatos de 4 bpp mudam novamente a conta. É necessário contabilizar o **formato efetivamente transcodado**, em vez de usar o tamanho `.ktx2` baixado como memória GPU. A codificação pode introduzir artefatos diferentes em normal, albedo e transparência.

Proposta inicial: uma fatia com 8–12 materiais 512, variantes 256 e 512, emissivo apenas onde necessário; 1024 seletivo somente após provar benefício no enquadramento. É um orçamento de experimento, sem benchmark de sustentação no iPad. O teto WASM atual de 256 MiB não inclui memória de JS, DOM, driver ou GPU e não é teto de memória total do app.

## Resolução, DPR e antialiasing: custo que cresce rápido

Cálculo de attachments explícitos, sem assumir alocação física exata do driver: uma cor RGBA8 custa 4 bytes/pixel; depth/stencil D24S8 mais 4. O exemplo de MSAA 4× considera cor+depth com quatro amostras e uma cor resolvida sem MSAA: `pixels × ((4+4)×4 + 4) = pixels × 36`. Não inclui compositor, swapchain, ping-pong de filtros, sombras, G-buffer ou alinhamento/tile memory. [Formatos e renderbuffers na especificação WebGL 2](https://registry.khronos.org/webgl/specs/2.0/).

| Dimensão do target | Pixels | Cor RGBA8 | Cor + depth/stencil, sem AA | MSAA 4× + cor resolvida |
|---|---:|---:|---:|---:|
| 1280×800 | 1.024.000 | 4.096.000 B ≈ 3,906 MiB | 8.192.000 B ≈ 7,813 MiB | 36.864.000 B ≈ 35,156 MiB |
| 1920×1200 | 2.304.000 | 9.216.000 B ≈ 8,789 MiB | 18.432.000 B ≈ 17,578 MiB | 82.944.000 B ≈ 79,102 MiB |
| 1280×960 | 1.228.800 | 4.915.200 B ≈ 4,688 MiB | 9.830.400 B ≈ 9,375 MiB | 44.236.800 B ≈ 42,188 MiB |
| 1600×1200 | 1.920.000 | 7.680.000 B ≈ 7,324 MiB | 15.360.000 B ≈ 14,648 MiB | 69.120.000 B ≈ 65,918 MiB |

Se essas forem dimensões **CSS** e o código multiplicar largura e altura por DPR 2, o número de pixels e os attachments quadruplicam: o exemplo 1920×1200/MSAA chega a 331.776.000 B ≈ 316,406 MiB, antes das exclusões acima. Se já forem dimensões do buffer de desenho, não multiplicar novamente pelo DPR. O render scale precisa de limite explícito e independente do CSS/Retina.

1280×800 e 1920×1200 mantêm a proporção numérica 8:5 do framebuffer histórico, mas DOOM o apresenta em 4:3 com correção dos pixels. Um renderer GPU que projete com pixels quadrados em 4:3 usaria, por exemplo, 1280×960 ou 1600×1200. Precisamos definir projeção, HUD e correção antes de anunciar uma resolução; esticar um target sem essa decisão altera a aparência. O antialiasing do mundo também não deve borrar HUD e texto indiscriminadamente.

## Offline, imports e saves: trabalho que um pacote HD adiciona

Estado verificado no código atual:

- `web/wad.ts`: aceita apenas IWAD de DOOM 1/Freedoom Phase 1 com E1M1 e estruturas requeridas, no máximo 64 MiB. Não aceita PWAD/PK3/ZIP/KTX2. Não basta baixar um pacote de texturas de outro port e importá-lo nesta UI.
- `web/main.ts`: escreve `/game.wad` em MEMFS; inicia um único runtime por documento. Backups v2 validam exatamente os dois perfis conhecidos e os diretórios `saves`/`saves-hires`, com seis slots por IWAD. Importação de backup limita arquivo a 16 MiB, registros a 120 e cada string de dados a 2 MiB. Um terceiro motor exige rever metadados, validação e namespace antes de expor saves.
- `scripts/offline.mjs`: o precache atual é completo e versionado para os dois motores; uma instalação só conclui se `cache.addAll` concluir. A coleta de 0.3.0 registrou 19 recursos / 33.901.225 bytes de runtime, em `docs/hires-evidence/resolution.json`; não é medição nova. A fonte correspondente fica fora do cache de execução.
- IndexedDB legado `doom-ipad-v1`, IDBFS `/persist`, origem, manifesto e saves devem ser preservados. O reload que aplica perfil continua necessário para não manter dois runtimes montados.

Para o primeiro protótipo, empacotar apenas a fatia pequena, com inventário de hashes e licença. Para pacotes opcionais maiores, propor armazenamento separado do cache-base e um manifesto por versão/conteúdo: baixar, verificar limites/hash, persistir todos os arquivos e só então marcar aquele perfil como preparado. Falha ou quota insuficiente não pode invalidar a instalação-base, gerar estado parcialmente jogável nem exibir confirmação offline do pacote incompleto. A confirmação precisa nomear o conteúdo/perfil preparado; base offline não significa que uma variante HD ainda não baixada também esteja disponível.

Versão do pacote e associação ao hash do IWAD precisam impedir aplicar substituições Freedoom a nomes coincidentes de texturas comerciais. Um renderer diferente recebe perfil/saves próprios até haver prova de leitura/compatibilidade; não fazer conversão inversa presumida. O candidato EDGE requer namespace novo e contrato de backup ampliado, proposto como versão 3, preservando aceitação dos backups v1/v2; o esquema e a compatibilidade de slots precisam ser definidos antes da implementação. Se somente a apresentação mudar sobre o mesmo motor, provar que o hash/estado de saves permanece compatível em vez de inventar uma nova simulação.

WebKit documenta quotas e remoção por pressão de armazenamento e recomenda `estimate()`/`persist()`, com concessão baseada em heurísticas. As quotas publicadas são tetos, não espaço reservado. Tratar `QuotaExceededError`, preservar a base e oferecer remoção de pacotes opcionais e exportação de backups. Não usar “60% do disco” como garantia de que cabe um pacote naquele iPad. [Política oficial de armazenamento da WebKit](https://webkit.org/blog/14403/updates-to-storage-policy/).

GitHub Pages tem limite de 1 GB para o site publicado e limite suave de tráfego de 100 GB/mês; fontes correspondentes e packs também precisam caber no artefato publicado. A primeira fatia não exige mudar de hospedagem. [Limites oficiais de Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits).

## Gates do protótipo e validação independente

| Gate | Evidência necessária antes de integrar na publicação principal |
|---|---|
| G0 — capacidade e procedência | Engine/commit/toolchain fixados; inventário de APIs desktop a adaptar; licença de código e assets; capacidade WebGL 2 e extensões detectadas com fallback. Sem download de conteúdo comercial |
| G1 — cena real | Uma cena de Freedoom executando o motor real, comandos WASD+giro simultâneos, áudio e HUD; dimensões internas reais registradas. Não aceitar um viewer estático como prova de port completo |
| G2 — nitidez | Capturas no mesmo tic/câmera/IWAD/FOV/viewport antes/depois, com paredes próximas/distantes, piso oblíquo, sprite transparente, texto/HUD e luz baixa. Comparar nearest, mips/trilinear, anisotropia opcional e AA limitado. Documentar halos, seams, cintilação e perda de silhueta |
| G3 — custo | Inicialização fria/quente, p50/p95/p99 de intervalos de apresentação, long tasks, bytes de download/cache, heap observado, texturas/attachments contabilizados. Registrar browser/GPU quando disponível. Timer de submissão JS não é tempo GPU; timers GPU opcionais devem respeitar invalidade/disjoint. Sem métrica física de energia/latência, escrever não medido |
| G4 — dados e ciclo de vida | Salvar/carregar/reabrir em cada perfil; recusar incompatibilidades; voltar a Classic preservando hashes dos saves; blur/visibility, áudio por Enter, perda/recuperação de contexto e reinício controlado sem duas instâncias |
| G5 — offline | Preparar online; desligar servidor/rede antes do primeiro boot do novo perfil já preparado; reabrir; carregar material/transcoder/WASM/save; atualização interrompida e falta de quota preservam base; teste em subdiretório Pages |
| G6 — hardware | No iPad real do usuário: registrar modelo, iPadOS, versão Chrome, contexto aba/PWA, orientação, DPR e perfil. Jogo sustentado 15–30 min com teclado Bluetooth; registrar aquecimento percebido, quedas/cortes de áudio, teclas presas, retomada de apps e comportamento de armazenamento. Observação de bateria não vira medição de potência |

Metas propostas, ainda sem aceite/medição: começar sem MSAA ou com AA desligável; limitar target e render scale; buscar nitidez superior no enquadramento de referência antes de adicionar efeitos; reduzir resolução/texturas se a sustentação falhar. Não aumentar `TICRATE` para apresentar 60 Hz e não anunciar 60 FPS antes de medir. A passagem em Chromium/WebKit Linux continua sendo regressão automatizada, e não certificação do Chrome no iPad.

## Próximo recorte recomendado

1. Fechar a escolha do backend candidato com o estudo de renderer; preservar o Classic/Crispy já publicados.
2. Compilar uma prova single-thread para a cloud, com uma fase real e resolução limitada; identificar perfil e formato de save desde o começo.
3. Integrar 8–12 materiais livres e conhecidos na cena, primeiro albedo/mips, depois normal/roughness/emissivo se o backend suportar e houver benefício visível. Levar tudo no mesmo pacote offline da prova.
4. Comparar nitidez e custo com 0.3.0; só então expandir mapa, pacote, antialiasing e opções. WebGPU fica como estudo separado se trouxer benefício concreto sobre o port WebGL 2.

Rollback do protótipo: desativar sua seleção, reabrir Classic ou Alta e manter dados/pacote novos isolados. Nenhuma alteração de código, dependência, cache, save ou publicação foi aplicada por este discovery.
