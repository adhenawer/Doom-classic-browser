# Equipe de agentes — modernização do DOOM Classic Browser

Equipe de nove especialidades para evoluir **design, gráficos e jogabilidade** de um DOOM real no browser. Os perfis traduzem competências publicadas por estúdios e métodos de especialistas em entregáveis verificáveis. A pesquisa e suas limitações estão em [RESEARCH.md](RESEARCH.md).

| Agente | Especialidade | Perfil |
|---|---|---|
| `doom_director` | Direção de jogo, produção e integração | [Direção](roles/director.md) |
| `doom_design` | Design de combate, ritmo e experiência | [Game design](roles/design.md) |
| `doom_art` | Direção de arte e technical art | [Arte](roles/art.md) |
| `doom_rendering` | Renderização e desempenho gráfico | [Gráficos](roles/rendering.md) |
| `doom_gameplay` | Gameplay, controles e motor C | [Gameplay](roles/gameplay.md) |
| `doom_ux` | UX/UI e acessibilidade | [Experiência](roles/ux.md) |
| `doom_platform` | WASM, plataforma web, offline e release | [Plataforma](roles/platform.md) |
| `doom_audio` | Áudio, feedback e mixagem | [Áudio](roles/audio.md) |
| `doom_qa` | QA independente, automação e compatibilidade | [Qualidade](roles/qa.md) |

## Como usar pelo Codex

O ponto de entrada é o [AGENTS.md da raiz](../AGENTS.md). Os perfis funcionam como instruções de trabalho e ficam versionados no projeto. Em clientes Codex locais compatíveis, os arquivos [`.codex/agents/`](../.codex/agents/) usam o formato nativo de agentes personalizados documentado pela OpenAI: `name`, `description` e `developer_instructions`. Não fixam modelo: o cliente segue sua resolução de configurações, incluindo defaults globais de subagentes e sessão pai. Permissões, provedor e MCP seguem a sessão; os arquivos não configuram credenciais, sandbox ou aprovação próprios.

No Cloud/chat, o orquestrador pode ler os mesmos perfis e delegar pelas ferramentas disponíveis. A descoberta automática de arquivos TOML depende do cliente/versão e da confiança no projeto. Não é necessário compilar ou abrir terminal no iPad para pedir tarefas à equipe. Não há daemon, automação recorrente ou agentes permanentemente ativos criados por esses arquivos.

Sem ferramentas de subagentes, a aplicação sequencial dos perfis é auto-revisão e deve ser declarada dessa forma. Não equivale a um segundo agente ou revisor independente.

Exemplos de tarefas:

> Use `doom_director` para coordenar um diagnóstico de modernização. Delegue arte, UX e renderização, compare os resultados e entregue uma proposta de primeira fatia com screenshots de referência e critérios de aceite.

> Peça a `doom_design` e `doom_gameplay` que proponham presets de rotação. Use `doom_qa` para revisar como testar a resposta e a independência entre WASD e setas. Não altere a física Classic.

> Use `doom_art`, `doom_rendering` e `doom_platform` para avaliar uma melhoria visual opcional. Identifique o que cabe no framebuffer atual e o que exige outro renderer, incluindo custo, conteúdo e licenças.

> Execute a tarefa de implementação já autorizada com os responsáveis indicados no plano e peça revisão independente de `doom_qa` antes da publicação.

## Arquivos de trabalho

- [TEAM.md](TEAM.md): missão, responsabilidades, coordenação e evidências.
- [RESEARCH.md](RESEARCH.md): fontes primárias, requisitos observados e referências pessoais.
- [ROADMAP.md](ROADMAP.md): planejamento, execução da primeira release e limites técnicos.
- [REVIEW.md](REVIEW.md): revisão da configuração e limites do que foi validado nesta entrega.
- [Proposta](templates/proposal.md) e [revisão](templates/review.md): contratos de entrega.

A equipe já executou a primeira release do roadmap, documentada em [RELEASE.md](../docs/modernization/RELEASE.md). Os perfis seguem disponíveis para novas tarefas; não significam agentes permanentemente em execução.

A evolução **0.4.0 Moderno HD** acrescenta EDGE-Classic/WebGL2, resolução até 3840×2880, materiais HD/4K e HUD nativo, coordenados entre rendering, plataforma, arte/UX e QA. A preferência por qualidade visual sem orçamento artificial substitui os limites propostos no discovery. Veja [entrega e evidências](../docs/modern-hd/RELEASE.md) e [revisão independente](../docs/modern-hd/QA.md). As limitações do hardware/browser continuam sendo registradas com evidência.
