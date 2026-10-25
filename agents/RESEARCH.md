# Pesquisa de competências e referências

Consulta: **25/10/2026**, America/Sao_Paulo. Foram usadas páginas oficiais de estúdios, seus sistemas de recrutamento, diretrizes técnicas e publicações dos próprios especialistas. A seleção não é um ranking objetivo de “melhores desenvolvedores”. Anúncios podem mudar ou ser encerrados; registre a data ao reutilizar a pesquisa.

Anos de experiência, senioridade e jogos publicados são critérios de contratação de pessoas. Aqui são traduzidos em responsabilidades, conhecimento esperado e provas de entrega — não em currículos fictícios ou alegações de experiência humana dos agentes.

## Requisitos observados em estúdios

| ID | Fonte primária consultada | Competência observada | Aplicação ao time |
|---|---|---|---|
| R1 | [Riot — Senior Game Designer, Combat, 8302320](https://www.riotgames.com/cs/work-with-us/job/8302320/senior-game-designer-combat-unpublished-r-d-product-shanghai-china) | Prototipação, playtests, documentação implementável, feedback e comparação de riscos | `doom_design`: hipótese de experiência, protótipo delimitado e roteiro de playtest; `doom_director`: priorização e coordenação |
| R2 | [Larian — Gameplay Programmer](https://jobs.lever.co/larian/bce7861d-77eb-469e-a905-d4473fe64af7) | Arquitetura, C++, depuração, código testável, estados, IA e colaboração com criadores | `doom_gameplay`: aplicar essas disciplinas ao C do projeto, seus tics, estados, armas e saves; não introduzir C++/outra engine apenas por aparecer na vaga |
| R3 | [Naughty Dog — Senior Technical Designer, 5980216004](https://job-boards.greenhouse.io/naughtydog/jobs/5980216004) | Protótipos de cenários e sistemas, comunicação entre arte/programação/animação, matemática 3D e ferramentas | `doom_design` + `doom_gameplay`: converter intenção criativa em dependências e tarefas executáveis |
| R4 | [Naughty Dog — Senior Environment Lighting Artist, 6190399004](https://job-boards.greenhouse.io/naughtydog/jobs/6190399004) | Cor, luminância, atmosfera, iluminação, pós-processamento e otimização em colaboração com shaders/modelagem | `doom_art` + `doom_rendering`: direção visual legível, capturas comparáveis e custo de cada efeito |
| R5 | [Naughty Dog — SDET Programmer, 5790604004](https://job-boards.greenhouse.io/naughtydog/jobs/5790604004) | CI de código/assets, ferramentas, testes, empacotamento e integração multidisciplinar | `doom_qa` + `doom_platform`: regressão de jogo e conteúdo, evidência de build, offline e dados persistidos |
| R6 | [Riot — Sr. Manager, Audio Direction, 7404513](https://www.riotgames.com/en/work-with-us/job/7404513/sr-manager-audio-direction-unpublished-r-d-product-los-angeles-usa) | Processo integrado de áudio, implementação, pipelines, tecnologia e experiência do jogador | `doom_audio`: feedback sonoro com função no combate, integração e avaliação, sem inventar experiência de liderança humana |

R1–R6 descrevem requisitos de seus contextos profissionais. Não constituem uma recomendação de adotar Unreal, ferramentas proprietárias ou uma estrutura de estúdio AAA neste port pequeno.

## Especialistas como referências públicas de método

### P1 — Hugo Martin: intenção de combate

O [Developer_Direct oficial de DOOM: The Dark Ages, janeiro de 2025](https://slayersclub.bethesda.net/en-US/news/doom-the-dark-ages-developer-direct) apresenta decisões de combate e identidade do jogo associadas a Hugo Martin. A referência serve para formular uma experiência consistente e avaliar a relação entre movimento, projéteis, armas e arenas. Não é licença para copiar mecânicas, recursos artísticos ou trechos do jogo.

### P2 — Tiago Sousa: arquitetura gráfica e desempenho

A programação oficial de [Advances in Real-Time Rendering / SIGGRAPH 2025](https://www.advances.realtimerendering.com/s2025/index.html) registra a apresentação “Fast as Hell: idTech8 Global Illumination”, de Tiago Sousa, com vínculo à id Software naquela apresentação. O método relevante é discutir qualidade visual junto de arquitetura, reutilização e custo. Isso não demonstra que idTech8, ray tracing ou iluminação global caibam neste WASM. Não inferimos um cargo atual em 2026 a partir da apresentação de 2025.

### P3 — Celia Hodent: estratégia de UX e pesquisa com jogadores

Seu [site de consultoria](https://celiahodent.com/consulting/) descreve estratégia de UX e pesquisa, envolvendo percepção, atenção, memória e motivação. A aplicação é distinguir dificuldade intencional de atrito, formular perguntas de playtest e avaliar entendimento do jogador. Não a apresentamos como autora da interface deste projeto nem reduzimos UX a estética de telas.

Os agentes têm nomes de função, não os nomes dessas pessoas. Não há afiliação, participação ou endosso desses especialistas ou estúdios ao projeto.

## Diretrizes e integração técnica

- **A1 — [Xbox Accessibility Guideline 107: Input](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/107):** avaliar velocidade, complexidade e duração dos comandos, remapeamento e navegação. A restrição atual é teclado; não remover esse caminho ao modernizar.
- **A2 — [Xbox Accessibility Guideline 105: Audio accessibility](https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/105):** considerar volumes independentes, pistas importantes, alternativas mono e ajustes. São referências para propostas, não recursos que este arquivo declara já implementados.
- **T1 — [OpenAI: Subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents):** agentes personalizados em `.codex/agents/*.toml`, com `name`, `description` e `developer_instructions`; permissões seguem a sessão e o modelo segue a resolução do cliente, incluindo defaults globais e herança. O suporte depende do cliente/versão. Os perfis Markdown são o contrato compartilhado para outros ambientes.
- **T2 — [Chocolate Doom: filosofia](../engine/upstream/PHILOSOPHY.md) e [arquitetura local](../docs/ARCHITECTURE.md):** fidelidade e portabilidade da base. O renderizador atual precisa ser examinado antes de propor gráficos incompatíveis com seus dados e limites.

## Síntese aplicada

A equipe combina design e pesquisa com jogadores, arte legível, engenharia de gameplay, gráficos medidos, integração web, áudio e QA independente. A regra prática é **benefício percebido + evidência + custo + regressão verificada + procedência de conteúdo**.

As referências pessoais de 2025 são materiais técnicos recentes consultados em 2026, não uma lista de cargos atuais. Vagas verificadas são amostras de requisitos, não prova de que seus estúdios apoiam esta arquitetura. Links antigos que redirecionaram para listas de vagas ou não retornaram conteúdo suficiente foram excluídos da base central.
