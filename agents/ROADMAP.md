# Roadmap proposto de modernização

Status: **plano da equipe; funcionalidades abaixo não foram implementadas por esta entrega**. A base jogável continua sendo Chocolate Doom em browser. Os incrementos devem ser pequenos e orientados por tarefas autorizadas, com demonstração antes de expandir o escopo.

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

## Primeira tarefa recomendada

Executar M00 e M10 e produzir uma proposta M20: direção de arte do launcher e das configurações, fluxos de teclado e capturas de referência. Em paralelo, documentar dois experimentos pequenos de apresentação/controles para M30. Essa escolha entrega progresso visível antes de assumir custo de reconstruir o renderer ou produzir assets em grande escala.
