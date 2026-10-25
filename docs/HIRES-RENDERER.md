# Alta resolução interna — investigação e contrato técnico

Data: 25/10/2026. Especialidade: `doom_rendering`. Esta seção registra inspeção de fontes e critérios de integração; os resultados do build e dos testes do porte devem ser acrescentados pelo integrador. Não é teste de hardware.

## Escolha do renderer

A referência é Crispy Doom **7.2.0**, revisão [`fdeabe4c23a833534b70aa84a22f1685aae7125d`](https://github.com/fabiangreffrath/crispy-doom/tree/fdeabe4c23a833534b70aa84a22f1685aae7125d). O arquivo de fontes consultado tem SHA-256 `1ae97a51e522006d35e6e333f4d3fb1edf377e7305f088775a9d968dd8ed66ea`. Licença GPL-2.0-or-later, com avisos dos autores preservados. O modo Chocolate Doom existente continua sendo o caminho Classic.

O [código de dimensões do Crispy](https://github.com/fabiangreffrath/crispy-doom/blob/fdeabe4c23a833534b70aa84a22f1685aae7125d/src/i_video.c) calcula `SCREENWIDTH = ORIGWIDTH << crispy->hires` e altura equivalente. Com `hires=1`, `widescreen=0` e `ORIGWIDTH=320`/`ORIGHEIGHT=200`, o framebuffer contém **640×400 pixels**, quatro vezes a quantidade de amostras da cena Classic. A correção de aspecto o apresenta em 4:3; 640×480 de saída não muda os 640×400 internos.

As tabelas do renderer usam `MAXWIDTH`, `MAXHEIGHT`, `NONWIDEWIDTH` e `crispy->hires`; o redimensionamento já trata projeção, colunas, planos, patches e HUD. Isso é uma base mais delimitada do que alterar apenas os `#define SCREENWIDTH/SCREENHEIGHT` do Chocolate: seus sprites, menus, limites, buffers e escalas assumem coordenadas originais. Substituir números ou aumentar o Canvas produziria um port incorreto ou apenas ampliação.

| Caminho | Decisão e limite |
|---|---|
| Chocolate 320×200 | Preservar como referência e fallback; não chamar upscale de alta resolução |
| Adaptação própria do renderer Chocolate | Não escolhida para esta fatia: exige revisar o pipeline inteiro e suas coordenadas, com maior risco de corrupção visual/memória |
| Crispy 640×400 | Usar como modo explicitamente identificado, com toolchain fixada e mesmo adaptador de teclado/áudio/suspensão; precisa provar execução web |
| 1280×800 ou mais | Não inferir suporte: `MAXHEIGHT` desta revisão é 400 e `hires` foi projetado para 0/1. Outra escala exige mudanças e orçamento próprios |

A resolução maior melhora a amostragem de geometria, perspectiva e posicionamento dos sprites. Não cria texturas de alta definição, novos modelos, materiais ou iluminação. O conteúdo continua sendo o IWAD autorizado.

## Configuração restrita a apresentação

Os nomes abaixo existem em `src/doom/d_main.c` e `src/m_config.c` da revisão fixada. O valor **9** de `crispy_gamma` é o nível sem correção, conforme `src/crispy.c`; zero não é o equivalente a gamma original.

```text
# default.cfg
detaillevel 0

# configuração extra do Crispy
crispy_hires 1
crispy_widescreen 0
crispy_uncapped 0
crispy_fpslimit 35
crispy_vsync 0
crispy_smoothscaling 0
crispy_gamma 9
crispy_automapoverlay 0
crispy_automaprotate 0
crispy_automapstats 0
crispy_bobfactor 0
crispy_btusetimer 0
crispy_brightmaps 0
crispy_centerweapon 0
crispy_coloredblood 0
crispy_coloredhud 0
crispy_crosshair 0
crispy_crosshairhealth 0
crispy_crosshairtarget 0
crispy_crosshairtype 0
crispy_defaultskill 0
crispy_demobar 0
crispy_demotimer 0
crispy_demotimerdir 0
crispy_extautomap 0
crispy_flipcorpses 0
crispy_freeaim 0
crispy_freelook 0
crispy_jump 0
crispy_leveltime 0
crispy_mouselook 0
crispy_neghealth 0
crispy_overunder 0
crispy_pitch 0
crispy_playercoords 0
crispy_secretmessage 0
crispy_smoothlight 0
crispy_smoothmap 0
crispy_soundfix 0
crispy_soundfull 0
crispy_soundmono 0
crispy_statsformat 0
crispy_translucency 0
```

`CRISPY_TRUECOLOR=OFF` no build mantém a paleta de 8 bits e evita ativar outra trilha gráfica experimental. Não configurar `crispy_truecolor` como se estivesse disponível nesse build. Os parâmetros normais de DOOM (áudio, volume, `screenblocks`, teclado, mouse desligado) continuam sendo responsabilidade do adaptador já existente.

O menu nativo **Crispness** pode habilitar mira vertical, pulo e over/under mesmo depois de ler um arquivo de configuração conservador. Portanto, a integração precisa impedir esse caminho, por exemplo restringindo `M_CrispnessCur` a uma mensagem que indique as configurações web. Alta resolução é uma preferência web, não autorização para ligar as demais regras. `M_ChangeDetail` deve manter `detailLevel=0` no modo alto, inclusive por atalhos, para evitar colunas duplicadas de low detail.

## Adaptação e dados

Os contextos usados pelo adaptador atual permanecem reconhecíveis: `G_BuildTiccmd` antes de `// low-res turning`, `D_RunFrame`, chamada de `D_RunFrame` no loop, rename final do save, ramo de voltar do menu, eventos SDL e apresentação após `// Draw!`. A ponte precisa ser compilada e testada; sem isso, semelhança textual não prova compatibilidade.

O Crispy tem um relógio adicional em microssegundos usado pelo limitador uncapped. Manter `crispy_uncapped=0` preserva a simulação de 35 Hz e permite reaproveitar o relógio lógico em milissegundos que desconta suspensão. Não prometer interpolação a 60 Hz por escolher alta resolução.

O [README upstream](https://github.com/fabiangreffrath/crispy-doom/blob/fdeabe4c23a833534b70aa84a22f1685aae7125d/README.md) declara compatibilidade de saves, mas os formatos não são idênticos: `g_game.c` grava dados estendidos depois do EOF vanilla, via `p_extsaveg.c`. O header base continua usando a versão vanilla. O integrador deve preservar os arquivos existentes, escolher compartilhamento somente após testes ou usar separação explícita com cópias controladas; não apagar dados nem assumir equivalência por causa do header.

O menu Crispy possui oito páginas de saves e nomes `doomsav<10*page+slot>.dsg`. A interface e os backups do port aceitam seis slots. A integração desta fatia deve manter uma página/seis slots ou atualizar validação, limites e backup de modo explícito; o usuário não pode criar saves invisíveis ao backup.

## Evidências de aceite

- Dimensões reportadas pelo renderer C em execução: 320×200 para Classic e 640×400 para Alta; não usar dimensões CSS como prova.
- Mesma cena livre (Freedoom E1M1), FOV/aspecto e direção, sem efeitos de pós-processamento na comparação principal. Inspecionar HUD, armas, menus, mapa, portas e sprites.
- WASD/setas/Shift simultâneos, aceleração, tiro/interação, menus, soltura, foco/suspensão, áudio e retomada.
- Save/load nos dois sentidos quando o compartilhamento for escolhido, preservação de estado/cópias, backup e importação antigos. Se não for comprovado, declarar separação e limitações.
- Offline com ambos os binários, novas preferências e save; cache completo em subdiretório sem servidor disponível.
- Custos relativos medidos na mesma máquina/cena. Quatro vezes mais pixels não prova quatro vezes a RAM total, nem compatibilidade de desempenho no iPad.
- Fontes correspondentes do Crispy, adaptações, licenças e toolchain incluídas no pacote de fonte da release; não depender apenas de uma URL externa mutável.

Chrome no iPad, latência Bluetooth, consumo, temperatura e conforto perceptivo dependem de teste em dispositivo real. Este documento não declara esses testes realizados.

## Inspeção visual da integração 640×400

As capturas [Classic](hires-evidence/classic.png) e [Alta](hires-evidence/high.png) foram inspecionadas por `doom_rendering`, separado do integrador da implementação. Ambas usam viewport 1180×820, Freedoom E1M1, apresentação Nítido e tic 35, conforme [resolution.json](hires-evidence/resolution.json). O registro do motor informa 320×200/view 320×168 no Classic e 640×400/view 640×336 em Alta, com opções de regras adicionais zeradas. O viewport idêntico e essas dimensões distinguem resolução interna de simples ampliação CSS.

Não foi observado bloqueador visual nessa cena. As colunas da porta, grades, divisões do teto, linhas do piso e superfícies distantes mostram amostragem mais fina em Alta. O quadro preserva a mesma proporção 4:3 e as barras laterais; arma e HUD permanecem completos, sem corte. Vida, munição, armadura, rosto e contadores do HUD continuam legíveis na captura. A imagem maior não introduz texturas ou sprites de alta definição: os assets continuam sendo os do IWAD, e o ganho observado está principalmente na rasterização e no posicionamento da geometria.

Essa inspeção é estática e limitada à cena de spawn. Não valida percepção em movimento, leitura de ameaças, outras fases, fadiga visual ou desempenho em dispositivo físico. O JSON contém duas amostras por modo em Chromium headless e não sustenta alegações de aumento de FPS, redução de energia ou compatibilidade universal. A certificação de funcionamento depende da suíte do integrador e da revisão independente de código/dados; esta revisão não executou novamente o browser durante essa suíte.

## Compatibilidade de chamadas indiretas no WASM

O build de Alta utiliza `-sEMULATE_FUNCTION_POINTER_CASTS=1`, restrito à configuração de link de `build/wasm-high` em `scripts/build-engine.sh`; a configuração de link Classic não recebe essa opção. Ela é uma adaptação da ABI de chamadas indiretas do Emscripten para casts de ponteiros de função do código C desse port. Não aumenta a resolução por si só, não substitui o motor por JavaScript e não autoriza novas regras de gameplay.

A revisão de QA identificou uma falha de assinatura indireta no protótipo sem essa compatibilidade; o integrador corrigiu o link e produziu as capturas e o registro de execução de Alta acima. O custo isolado dessa opção não foi medido. Manter a revisão de engine/toolchain fixadas e repetir jogo real, movimentação, áudio, saves e offline após alterações é necessário; uma compilação que termina não basta para provar que todas as chamadas indiretas funcionam durante a partida.
