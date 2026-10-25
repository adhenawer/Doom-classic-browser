# Apresentação e protótipo gráfico — M30 / M50 / M60

Data: 25/10/2026. Responsável: `doom_rendering`, integração de `doom_platform`. O motor continua sendo o Chocolate Doom fixado em `engine/UPSTREAM.json`. Nada neste incremento altera geometria, física, FOV, resolução interna 320×200, auto-aim, HUD autoritativo ou simulação de 35 Hz.

## Fatia visual e modos entregues

A cena de referência é Freedoom Phase 1 0.13.0, E1M1, início da partida, skill 3, aspecto 4:3. O IWAD tem SHA-256 `7323bcc168c5a45ff10749b339960e98314740a734c30d4b9f3337001f9e703d`. Arte, sprites, mapa e música são os já distribuídos com licença BSD e créditos; nenhum asset de DOOM comercial foi copiado. O novo shader e o módulo são código original deste projeto, GPL-2.0-or-later, incluído na fonte correspondente.

- **Nítido:** mantém escala por pixels do Canvas; não cria outro contexto nem loop de apresentação.
- **Suave:** permite interpolação do compositor ao escalar o Canvas; não revela detalhe adicional da cena.
- **CRT experimental:** um passe WebGL 1 opcional, shader próprio com scanlines estáticas leves e vinheta de baixa intensidade. Não há piscar, curvatura, bloom, distorção ou simulação de nova iluminação. O HUD continua na imagem original. O usuário pode voltar a Nítido imediatamente.
- **Brilho de apresentação:** exposição CSS limitada a 0,75–1,35, aplicada à imagem inteira. Não é ajuste da paleta ou gamma do mundo e também afeta HUD/menus.

O CRT é uma capacidade executável no próprio jogo, não uma imagem promocional. Usa a imagem já produzida pelo SDL. `Presentation.frame()` é chamado sincronamente após `SDL_RenderPresent`, antes de o browser descartar um drawing buffer WebGL sem preservação. A captura por um `requestAnimationFrame` independente poderia obter uma imagem vazia; não foi adotada. Não há loop extra em segundo plano. O upload/custo só acontece com CRT ativo e jogo em primeiro plano; suspensão/interface desativam a apresentação adicional.

O passe de saída tem as dimensões do Canvas SDL e é escalado para o mesmo retângulo 4:3. É **pós-processamento do framebuffer**, não um novo renderer da geometria, alta resolução interna, widescreen real ou interpolação da simulação.

## Segurança de integração e fallback

O Canvas fonte mantém foco e teclado. A camada de saída tem `aria-hidden`, `tabIndex=-1` e `pointer-events:none`; a pausa fica acima dela. A fonte só fica transparente depois do primeiro frame copiado com sucesso. WebGL ausente, erro de shader, alocação/transferência ou perda de contexto removem a camada e restauram o modo Nítido com mensagem de diagnóstico. Nenhuma exceção gráfica deve atravessar o callback e abortar o motor WASM. Não há mudança em caminhos de saves, schema de IWADs, IDs de PWA ou memória do motor.

Trocar de modo libera textura, buffer, programa e contexto extra. `dispose()` restaura estilos. A configuração opt-in persiste como preferência; se o browser não puder executar o shader, o fallback efetivo é reportado sem apagar a preferência ou os dados do usuário.

## Comparação técnica

| Caminho | Evidência / capacidade | Custo, compatibilidade e decisão |
|---|---|---|
| Chocolate Doom atual | Código vendorizado mostra framebuffer paletizado 320×200, conversão RGBA e SDL; simulação e saves já testados no browser | Mantido como base e fallback. Escala/filtro não fornece polígonos, materiais ou detalhe ausente |
| Chocolate + passe WebGL deste incremento | Protótipo executável integrado, um upload de Canvas e um quad; shader autoral sem dependência nova | Opt-in, contexto/texture/frame adicionais. Custo é medido, não presumido; mantém todos os dados de jogo Classic |
| Adaptação de alta resolução do renderer atual | Exigiria revisar constantes/buffers/projeção, HUD, limites vanilla e consumo; não basta CSS | Não foi habilitada nesta fatia. Precisa de protótipo e comparação próprios antes de substituir base |
| Crispy Doom | [README primário fixado na consulta](https://github.com/fabiangreffrath/crispy-doom/blob/fdeabe4c23a833534b70aa84a22f1685aae7125d/README.md): fork de Chocolate com resolução interna 640×400, widescreen e renderização interpolada; [licença GPL v2](https://github.com/fabiangreffrath/crispy-doom/blob/fdeabe4c23a833534b70aa84a22f1685aae7125d/COPYING.md) | Candidato plausível para outro estudo, não adotado nem compilado aqui. Recursos e compatibilidade declarados pelo upstream não demonstram suporte neste porte Emscripten. Requer build fixado, readaptação da ponte, teste de saves/demos/teclado/offline e orçamento medido. Não habilitar pulo/mira vertical por existirem no fork |

Fontes upstream consultadas em 25/10/2026. A revisão Crispy registrada identifica a pesquisa; não adiciona dependência de runtime. A decisão desta fatia é apresentar melhor o framebuffer existente sem trocar silenciosamente o motor. Recursos de geometria moderna continuam um estudo futuro, não uma promessa entregue por um filtro.

## Medição e validação

`window.doomPresentation.diagnostics()` informa modo solicitado/efetivo, frames processados e média/p95 de até 180 últimas amostras de `performance.now()` em torno do upload e submissão do draw. Essa duração é CPU/API, pode incluir sincronizações, **não** é tempo isolado da GPU, latência Bluetooth→tela, memória total ou energia. O primeiro frame inclui aquecimento. Sharp/Smooth não possuem samples do passe; zero significa não medido/não executado, não custo total zero.

O protótipo isolado foi executado em Chromium headless com Canvas fonte WebGL e `preserveDrawingBuffer:false`. Bandas azul/vermelho mantiveram orientação correta (leituras RGBA de referência `[0,0,234,255]` embaixo e `[234,0,0,255]` em cima, após efeito). A extensão de perda de contexto restaurou fonte visível, removeu a camada e reportou Nítido. A primeira submissão isolada levou 10,4 ms no executor; é uma única amostra fria sintética e não representa desempenho do DOOM ou de dispositivo físico.

Há quatro testes Node para validação de preferências, ausência de camada extra nos modos normais, fallback sem WebGL e limpeza de alocação parcial. `tests/browser/presentation.spec.ts` exercita preferência persistida, frames reais, teclado, pausa/foco e perda real de contexto. A execução integrada desse teste passou em Chromium: mais de 20 frames pós-processados e mais de 100 pixels de cor na leitura síncrona, preferência reaberta, comando WASD, pausa/foco/retorno e perda real do contexto do efeito com continuação dos tics. A captura da cena/HUD foi inspecionada sem distorção ou corte. Os resultados completos da release e as métricas comparáveis ficam no relatório de validação do coordenador; este teste de regressão não é um benchmark sustentado. WebKit local inicialmente não iniciou por bibliotecas de sistema ausentes; a suíte da release usa ambiente com as dependências instaladas. Chrome/iPad e avaliação subjetiva de conforto visual continuam exigindo hardware/usuário.

## Rollback

Selecione Nítido e brilho 1 nas configurações para voltar à apresentação Classic sem alterar saves ou IWADs. Para rollback de código, use o commit anterior à modernização e reconstrua/publice pelo workflow; preserve IndexedDB/IDBFS. Um rollback deve manter a regra de atualização segura do Service Worker, aguardando fechamento dos clientes para ativar a versão completa.
