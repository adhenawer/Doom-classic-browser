# Roadmap de modernização — execução 0.2.0

Status: **primeira execução autorizada pelo usuário, versão 0.2.0**. As entregas e os limites estão no [relatório da release](../docs/modernization/RELEASE.md). A base continua Chocolate Doom; o estudo de renderer e a proposta de novas regras não significam que todas as ideias abaixo foram habilitadas.

## Visão

Uma apresentação contemporânea, legível e coerente com DOOM, com controles confortáveis e funcionamento offline. A modernização deve melhorar a experiência do jogador, preservar o acesso à base Classic e manter clara a diferença entre apresentação e novas regras.

## Etapas

| Ordem / tarefa | Responsáveis | Entrega concreta | Critério de avanço |
|---|---|---|---|
| M00 — Baseline | QA + plataforma + rendering | Commit, IWAD livre/hash, cena, browser/viewport, capturas e medições frias/quentes | Evidência reproduzível; métricas ausentes identificadas como não medidas |
| M10 — Direção de experiência | Diretor + design + arte + UX | Brief visual e de gameplay, prioridades e primeira fatia | Objetivo perceptível e escopo realizável no renderer atual |
| M20 — Interface e onboarding | UX + arte + plataforma | Proposta de launcher, conteúdo, configurações e estados de erro/carregamento | Todos os fluxos continuam pelo teclado, incluindo foco e retorno à partida |
| M30 — Apresentação e game feel | Rendering + gameplay + design | Experimentos opcionais de escala/legibilidade e presets de giro | Comparação antes/depois; física Classic e tics preservados; opções reversíveis |
| M40 — Áudio e feedback | Áudio + UX + design | Proposta de clareza sonora, volumes e acessibilidade | Pistas de combate legíveis; medição/escuta e ativação por teclado diferenciadas |
| M50 — Fatia visual | Arte + rendering + plataforma | Uma cena/mapa livre com guia de arte, conteúdo com procedência e custo medido | Validar qualidade e desempenho antes de produzir um pacote inteiro de assets |
| M60 — Renderer moderno | Rendering + plataforma + gameplay | Estudo comparativo e protótipo web de uma capacidade específica | Build próprio, limites explícitos e avaliação de saves, licenças e fallback |
| M70 — Gameplay Modern | Design + gameplay + QA | Proposta de regras distintas e protótipo delimitado quando autorizado | Identidade de engine/perfil e compatibilidade de saves definidas antes de habilitar |
| M80 — Release | Plataforma + QA + diretor | Revisão, regressão, fonte correspondente, notas e rollback | Critérios da mudança atendidos; riscos de hardware explicitados |

## O que cabe na base atual

| Proposta | Classificação técnica |
|---|---|
| Hierarquia visual, tipografia, estados de foco, ajuda e configurações | Camada HTML/CSS/TypeScript; preservar operação por teclado |
| Presets de giro e ajustes de sensibilidade | Controlador existente em C; testar aceleração, limite, simultaneidade e soltura |
| Escala por pixels versus suavização | Opção de apresentação; não aumenta a resolução interna |
| Ajuste de contraste/gamma ou efeito de quadro | Investigar paleta versus pós-processamento; custo, HUD e leitura de ameaças precisam de avaliação |
| HUD redesenhado | Requer estado autoritativo do motor e decisão sobre o HUD original; não calcular uma cópia divergente de vida/munição |
| Apresentação interpolada a 60 Hz | Requer separar apresentação de simulação; não aumentar `TICRATE` para alegar equivalência |
| Alta resolução interna | Alteração no renderizador, constantes, buffers e orçamento de memória |
| Widescreen real | Projeção/FOV, geometria e HUD; esticar o Canvas não implementa isso |
| Iluminação dinâmica, materiais ou modelos 3D | Renderer adaptado/novo e pipeline de conteúdo; avaliar outro port se necessário, sem troca automática |
| Mira vertical livre | Câmera/renderização e decisão sobre auto-aim; respeitar a decisão explícita do usuário, sem chamá-la de nativa |
| Pulo, habilidades, IA ou física novas | Variante de regras: mapas, colisões, demos e saves podem ser afetados |

Trocar o motor não é uma etapa já decidida. O estudo deve comparar a viabilidade do renderer atual e de alternativas no browser, incluindo compilação em nuvem, GPL/licenças, memória, teclado e offline. Uma demonstração desktop não basta.

## Métricas e orçamentos

Conhecido na base: simulação de 35 Hz; framebuffer clássico 320×200/4:3; heap WASM configurado com 32 MiB iniciais e teto de 256 MiB; execução offline com conteúdo livre após preparação. Isso não mede desempenho sustentado nem memória total.

Medir em M00: inicialização fria/quente, frame times mediano/p95/p99, long tasks, memória observável, tamanho de recursos, resposta evento→comando e estabilidade de áudio. Preservar o mesmo commit/cena/viewport para comparar alterações. Latência física e consumo exigem dispositivo e método adequados.

Não há orçamento novo aceito ou medido nesta entrega. O time deve propor limites relativos à baseline e registrar qualquer trade-off. Não anunciar “60 fps”, “baixo consumo” ou “latência zero” a partir de screenshots, heap configurado ou reputação de outro motor.

## Execução registrada

| Etapa | Entrega 0.2.0 |
|---|---|
| M00 | Baseline antes das alterações, IWAD/hash e medições reproduzíveis em `scripts/measure-browser.mjs`; evidências em `docs/modernization/evidence/` |
| M10 | Brief industrial, hierarquia, prioridades e procedência em `DESIGN.md` |
| M20 | Launcher e cartão suspenso redesenhados, conteúdo/perfil visíveis e configurações pelo teclado |
| M30 | Presets Clássico/Precisão/Ágil, apresentação Nítido/Suave/CRT e brilho reversível |
| M40 | Volumes independentes, mute efetivo da contribuição OPL e suspensão/retomada de Web Audio; avaliação acústica humana pendente |
| M50 | E1M1 livre como fatia visual real, shader próprio, capturas e custo CPU/API registrado |
| M60 | Comparação com a base e Crispy; protótipo WebGL de pós-processamento integrado e fallback. Outro renderer de geometria não foi adotado |
| M70 | Recorte executável de conforto `comfort-v1`, Shift invertido e saves compatíveis; proposta de regras futuras no relatório, sem pulo ou nova física habilitados |
| M80 | Regressão, revisão independente, fonte correspondente, notas e rollback da release |

Novas regras ou alta resolução interna exigem o protótipo específico identificado no estudo, em vez de serem atribuídas aos filtros desta versão. A liberação de outro motor não foi decidida.

## Continuação 0.3.0 — alta resolução

O usuário autorizou alta resolução. A opção Alta integra Crispy Doom fixado e compilado na mesma toolchain, com rasterização real 640×400; Clássica mantém Chocolate 320×200. Saves são separados e os slots legados copiados no primeiro perfil Alta vazio. A troca usa novo documento e ambos os binários entram no cache offline. [Provas, medidas e limites](../docs/HIRES.md) e [revisão](../docs/HIRES-QA.md) registram a entrega. As notas anteriores permanecem como histórico da 0.2.0; alta resolução não é atribuída ao shader.

## Discovery posterior à 0.3.0 — nitidez e materiais

Registro histórico anterior à 0.4.0: **investigação concluída em 25/10/2026; naquele ponto, o renderer ainda não estava implementado**. A continuação abaixo registra o backend integrado e suas provas. O [relatório consolidado](../docs/discovery/README.md) reúne análises independentes de rendering, arte e plataforma. Define o recorte D1–D4: build próprio EDGE-Classic/WebGL2 singlethread, ponte de teclado, metas de saída 4:3 960×720/1280×960/1600×1200 e uma cena com 8–12 texturas livres HD. O heap inicial upstream de 512 MiB é condição de viabilidade, não consumo medido; revisar e medir antes de adotar.

O estudo cobre Woof, DSDA, GZDoom/UZDoom e forks web, filtros, mipmaps, texturas CC0, upscale offline por IA e obrigações por asset. PBR efetivo no caminho web não foi comprovado e exige outro gate. Preservar Classic/Alta e seus saves; um backend novo terá dados próprios. D5–D8 descrevem filtros, persistência/offline, QA/hardware e investigação de material avançado. Não há novo binário, pack HD integrado, benchmark de candidato ou teste físico declarado por esta pesquisa.


## Continuação 0.4.0 — Moderno HD

O usuário priorizou design moderno e alta resolução, retirando orçamentos artificiais de tamanho, CPU e memória. A entrega integra EDGE-Classic/WebGL2 com perfil/saves próprios, resolução de 1920×1440 por padrão e opções até 3840×2880, HUD contemporâneo nativo e launcher novo. Um pacote auditado inclui 1.113 imagens Freedoom HD 4× e dois materiais CC0 4K; transparências defeituosas e imagens incompatíveis são excluídas. Os dados Classic/Alta permanecem disponíveis. [Entrega e provas](../docs/modern-hd/RELEASE.md), [conteúdo](../docs/modern-hd/CONTENT.md), [design](../docs/modern-hd/DESIGN.md) e [revisão](../docs/modern-hd/QA.md) registram resultados e limites; fontes/código fixados são compilados na nuvem. PBR e modelos 3D não são atribuídos a esta entrega.
