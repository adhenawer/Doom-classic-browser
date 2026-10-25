# Moderno HD — versão 0.4.0

O objetivo desta entrega é design moderno e alta resolução real no browser, priorizando qualidade visual sem os orçamentos artificiais de download, CPU e memória propostos no discovery. A base Classic continua disponível com seus dados preservados. Chrome no iPad é um perfil de uso, e não uma implementação nativa ou uma validação física já realizada.

## O que muda

- **Geometria na GPU:** EDGE-Classic compilado de C/C++ para WASM/WebGL2, em uma thread, no lugar do rasterizador em software quando Moderno é selecionado. Não é um clone JavaScript nem apenas ampliação de Canvas.
- **1920×1440 por padrão:** opções 1280×960, 1920×1440, 2560×1920 e 3840×2880, mantendo 4:3 com pixels quadrados. O drawing buffer é independente da dimensão CSS da página.
- **1.115 imagens HD:** 877 texturas e 238 pisos/tetos compatíveis com Freedoom Phase 1 0.13.0. São 1.113 imagens reconstruídas em 4× e dois materiais fotográficos CC0 da Poly Haven em 4096×4096, destinados às superfícies BASE2 e FLAT1. Mipmaps/trilinear e suavização usam as texturas antes da projeção. [Procedência e exclusões](CONTENT.md).
- **HUD contemporâneo nativo:** vida e munição vêm do estado autoritativo do motor. Configurações permitem a barra clássica; HUD é apresentação, sem cálculo paralelo de dano/munição em JavaScript.
- **Launcher redesenhado:** carvão/aço/laranja, tipografia ampla, menu de teclado, foco explícito, layout responsivo e ilustração vetorial original. [Direção visual e inspeção](DESIGN.md).
- **Teclado e áudio:** WASD, giro contínuo por setas com a rampa C existente, tiro, interação, menus e saves; Enter retoma áudio/partida. O host controla foco/suspensão, sem Pointer Lock ou clique obrigatório durante o jogo.
- **Perfis e persistência:** Moderno tem saves próprios do EDGE. Backups v3 incluem os três perfis; importação v1/v2 é preservada. Os bancos/IDs antigos permanecem. Não copiamos `.dsg` para o motor novo.
- **Offline completo:** loaders, três WASMs, dados mínimos do EDGE, pacote HD, conteúdo livre e interface entram no cache versionado. Fontes correspondentes ficam disponíveis em download separado.

Uma instalação nova seleciona Moderno; preferências salvas anteriormente mantêm a escolha. O pacote HD só é aplicado ao hash exato do Freedoom compatível. Um WAD importado com outro hash usa suas próprias imagens locais, mesmo que tenha nomes de texturas coincidentes.

## Como jogar

Abra [DOOM Classic Browser](https://adhenawer.github.io/Doom-classic-browser/) com conexão e teclado. Em instalação existente: **Configurações → Resolução do motor → Moderno HD**, selecione a resolução e salve. Se houver uma partida ativa, salve no motor antes de **Aplicar nova resolução → Aplicar resolução e reiniciar**. Progresso não salvo não é convertido em save automaticamente.

Use Jogar e Enter para retomar. WASD move, setas giram, J atira, Espaço/E interage, P abre o menu, K salva, L carrega e H retorna ao launcher. Menus e configurações funcionam por teclado. A seleção inicial de IWAD e importação/exportação de backup podem abrir interfaces nativas do navegador.

Para offline, mantenha a página aberta até concluir **Preparado para offline neste contexto**. O pacote é grande; prepare o contexto exato de aba/PWA que pretende usar. Depois teste reabertura sem conexão, carregue uma partida e confirme áudio/teclado. O browser pode remover dados; exporte backups. Essa limitação física não é um orçamento de produto.

## Fontes, licenças e reprodutibilidade

EDGE-Classic: revisão `9e2b61677f215861e40b631429bf322935e8f87c`; archive de 23.559.129 bytes, SHA-256 `fd67f6a9da631c870ca8b1212d412a6f699e9508fb275754d3af116f5ff8a83c`, GPL-3.0-or-later. A adaptação acontece em uma cópia descartável; a fonte upstream permanece íntegra. Toolchain Emscripten 4.0.18 fixada por digest, CMake 3.31.6 fixado e dependências npm exatas com lock.

O build web upstream é adaptado para o contrato DOM/IDBFS do produto: sem mount/sync concorrente, sem Pointer Lock, eventos SDL de teclado duplicados ignorados, relógio de suspensão, configuração limitada de câmera/regras e notificações após salvar. Suporte pré-carregado contém somente definições necessárias a DOOM/Freedoom, arquivos do Freedoom e soundfont com seus avisos; não copia gráficos comerciais ou packs de outros jogos.

A combinação do backend Moderno observa GPLv3 e distribui `EDGE-COPYING.txt`, `EDGE-NOTICES.txt` e fontes correspondentes, preservando os avisos dos componentes e a licença dos backends anteriores. Imagens Freedoom derivadas têm termos BSD próprios; licença de engine não é licença de assets. [Inventário de conteúdo](CONTENT.md).

O gerador do EPK reproduziu duas vezes o mesmo checksum. Não se presume identidade byte a byte dos binários WASM entre executores sem comparação específica. O pacote lógico HD tem **398.681.345 bytes (~380,21 MiB)** e é entregue em **12 partes de até 32 MiB**, sem reduzir imagens ou alterar seus bytes. Cada parte tem tamanho, offset e SHA-256 fixados; o host verifica cada resposta antes de montar o EPK em MEMFS. O inventário final de medição registra o tamanho total dos 38 recursos de execução, separado da fonte correspondente.

## Validação

Status: testes de integração e publicação em andamento. Os resultados finais, artefatos, capturas e link do workflow serão registrados antes da release.

A [revisão independente](QA.md) registra evidências, problemas encontrados e retestes. Nenhum resultado de Chromium/WebKit Linux é apresentado como teste físico do Chrome no iPad. PCM não nulo demonstra geração de áudio, sem certificar percepção sonora/latência.

## Limites e rollback

Esta entrega não inclui PBR, ray tracing, novos modelos 3D, mira vertical livre ou física idêntica à do Chocolate. HQ2x trata a apresentação de sprites/UI originais; não transforma o conteúdo em arte 3D. Sprites com fundo magenta, superfícies mascaradas defeituosas e imagens HD de dimensões incompatíveis foram excluídos, preservando transparência e offsets corretos.

A renderização e o controlador usam a simulação nativa de 35 Hz; cadência de apresentação é outra medida. Não há promessa universal de FPS, energia ou memória total. O build Moderno configura 512 MiB iniciais e crescimento do heap WASM até 2 GiB, além de memória JS/GPU; esses parâmetros não medem memória residente total. Qualidades disponíveis podem exceder a capacidade de um browser/dispositivo concreto.

Para rollback do jogador, selecione Clássica ou Alta e aplique o reinício. Os saves Moderno permanecem no namespace próprio, assim como os anteriores. Faça backup v3 antes de qualquer rollback de código: versões anteriores não compreendem saves EDGE/v3. Uma atualização do Service Worker só é ativada após o conjunto completo e fechamento dos clientes antigos; a partida em andamento não recebe outro runtime silenciosamente.
