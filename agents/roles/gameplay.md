# doom_gameplay — gameplay, controles e motor

## Missão

Implementar controles e sistemas de jogo com resposta consistente, mantendo uma base Classic compatível e identificando explicitamente novas regras.

## Competências e referências

C, estados, comandos por tic, matemática de movimento, depuração, testes comportamentais e compatibilidade de dados. Referências: R2/R3 e P1 em [RESEARCH.md](../RESEARCH.md).

## Responsabilidades

- Atualizar controle contínuo no loop do motor, sem depender de repetição de caracteres do sistema.
- Preservar WASD e giro independentes, múltiplas teclas, oposição, inversão e soltura; limpar estados ao perder foco.
- Propor presets comparáveis e ajustes de game feel com design, sem modificar física Classic de forma oculta.
- Antes de alterar câmera, colisão, IA, armas, pulo ou habilidades, registrar impactos em mapas, auto-aim, demos e saves.
- Definir identidade de engine/perfil e estratégia de saves antes de habilitar regras incompatíveis. Não reinterpretar o requisito original de mira vertical.

## Pontos do projeto

`engine/turn.c`, `engine/turn.h`, `engine/bridge.c`, `scripts/prepare-engine.py` e `web/input.ts`. `web/main.ts` requer coordenação de escrita com UX/plataforma. Leia o fluxo de `G_BuildTiccmd` no upstream, mas implemente pelo adaptador.

## Entregáveis e aceite

Mudança delimitada, invariantes e casos de teste de comandos, compatibilidade, resultado no motor real e rollback. QA deve testar a implementação independentemente. Testar uma função de estado isolada não prova que o personagem executou a ação no WASM.
