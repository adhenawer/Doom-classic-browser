# Missão e funcionamento da equipe

## Missão

Modernizar a experiência de DOOM Classic Browser com direção visual coerente, controles responsivos e melhorias perceptíveis para o jogador. A qualidade será demonstrada com jogo real, capturas, playtests e medições, preservando uma base Classic verificável e o uso offline por teclado.

O produto é web. Computadores, notebooks e tablets são contextos de uso; cada combinação de browser, sistema e teclado tem sua própria validação. O Chrome no iPad é um perfil importante para o usuário e permanece no [checklist específico](../docs/IPAD-CHECKLIST.md).

## Responsáveis e consultas

| Mudança | Responsável principal | Consultar | Revisão |
|---|---|---|---|
| Visão, prioridades e escopo | Diretor | Design, arte, engenharia | QA verifica critérios observáveis |
| Combate, ritmo, arenas e progressão | Design | Gameplay, arte e áudio | QA + diretor |
| Identidade visual e conteúdo artístico | Arte | UX, rendering e áudio | QA + procedência de assets |
| Resolução, escalonamento, renderer e shaders | Rendering | Plataforma, arte e gameplay | QA + plataforma |
| Entrada, comandos, regras e motor | Gameplay | Design, UX e plataforma | QA independente |
| Menus, foco, remapeamento e acessibilidade | UX | Gameplay, arte e áudio | QA |
| WASM, persistência, cache, builds e deploy | Plataforma | Rendering e gameplay | QA |
| Mixagem, pistas sonoras e feedback | Áudio | Design, UX e plataforma | QA + procedência de assets |

O diretor é responsável por resolver prioridades e registrar decisões, não por substituir a revisão técnica. Licenciamento é transversal: arte e áudio registram procedência; plataforma confere distribuição e fontes; diretor consolida pendências; QA não declara aceite de um pacote sem esses registros.

## Trabalho paralelo

- Uma rodada começa com problema, resultado pretendido, responsável, arquivos e evidências esperadas.
- Divida análises independentes, não a mesma edição entre vários agentes. Até três especialistas por rodada costuma ser suficiente; respeite o limite real do ambiente.
- `web/main.ts` é um ponto compartilhado. Escolha um integrador ou tarefas sequenciais quando UX, gameplay, áudio e plataforma precisarem alterá-lo.
- Não crie uma refatoração grande apenas para acomodar a organização dos agentes. Extraia módulos quando a mudança concreta e os testes justificarem.
- Cada especialista retorna fatos, proposta, dependências, arquivos, riscos e próximo passo. Ao implementar, informe patch, verificações realizadas e resultado.
- O QA revisa a entrega do implementador. Se encontrar um defeito, descreve evidência e correção; o responsável corrige e as verificações afetadas são repetidas.
- Um coordenador não cria outro coordenador para a mesma tarefa. Especialistas não criam cadeias de coordenação sem uma delegação adicional delimitada.
- Trocar de perfil no mesmo agente é auto-revisão. Quando não houver outro agente/revisor, registrar a limitação e a revisão independente pendente, sem alegar que ocorreu.

## Classic e evolução

Classic é a base atual: motor real, simulação de 35 Hz, auto-aim vertical, física e mapas compatíveis, WASD e giro independente por setas. A release 0.2.0 entrega apresentação opcional e o perfil de entrada `comfort-v1`; regras Modern que alterem a simulação continuam propostas.

Mudanças de apresentação podem preservar a simulação. Mudanças de câmera, colisão, armas, IA, pulo ou habilidades precisam ser identificadas como novas regras. Antes de introduzir incompatibilidade, defina versão de engine/perfil e separação ou migração de saves; preserve o acesso aos saves Classic. Não habilite mira vertical como suposto recurso original.

Um novo renderer ou motor deve ser comparado em um protótipo web com conteúdo livre, ferramentas fixadas e build reproduzível. Reputação de um port desktop não prova que ele cabe neste browser, neste teclado ou no orçamento offline.

## Evidências e critérios de conclusão

Uma entrega relevante apresenta:

1. Problema do jogador e hipótese de melhoria.
2. Antes/depois em condições comparáveis, usando IWAD livre e estado de cena identificado.
3. Implementação delimitada e alternativa considerada.
4. Impactos em controles, conteúdo, saves e offline.
5. Medições de custo e limites da medição; quando não disponíveis, escrever “não medido”.
6. Resultado de testes apropriados e revisão independente quando houver mudança de motor/entrada.
7. Licenças e atribuições de qualquer asset/dependência novo.
8. Riscos, opção de desativar efeitos quando cabível e procedimento de rollback.

Não declare acessibilidade integral, melhoria de FPS ou compatibilidade em hardware sem teste correspondente. PCM não nulo prova geração de áudio, não que o usuário ouviu com qualidade ou baixa latência. Captura maior não prova resolução interna maior.

## Métricas

Registre separadamente inicialização fria/quente, tempo de frame mediano/p95/p99, travamentos longos, memória observável, tamanho de download/cache e resposta evento→comando. A latência Bluetooth/OS→tela e o consumo de energia exigem validação apropriada em dispositivo.

A simulação de 35 Hz, o framebuffer clássico e o heap configurado em 32–256 MiB são propriedades verificáveis da base. O teto do heap não é a memória total do browser. Não há baseline de desempenho sustentado de todos os dispositivos. Metas e orçamentos novos devem ser marcados como propostas até haver medições.

## Conteúdo e privacidade

Use conteúdo próprio ou com licença compatível. Para cada asset novo, registre autor, URL/origem, versão/hash, licença, modificações e localização da atribuição. Não copie texturas, modelos, músicas ou mapas de DOOM comercial, DOOM moderno ou outro jogo por terem sido usados como referência visual.

IWADs e saves continuam locais. Não introduza telemetria, CDN ou backend durante a partida como efeito colateral da modernização. Fontes correspondentes e obrigações GPL continuam fazendo parte da release.
