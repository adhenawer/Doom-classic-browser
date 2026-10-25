# DOOM Classic Browser — instruções para agentes

O produto é um porte real de DOOM para browsers. O iPad é um perfil de uso, não o escopo do produto. A equipe de modernização está em [agents/README.md](agents/README.md).

## Como trabalhar

1. Leia `README.md`, `docs/ARCHITECTURE.md`, `agents/TEAM.md` e o perfil da especialidade necessária antes de propor uma mudança.
2. Para tarefas de modernização que cruzem design, arte e engenharia, use o coordenador `doom_director` e delegue análises independentes às especialidades de `agents/README.md`. Use apenas os agentes necessários; tarefas pequenas podem ser resolvidas por um agente.
3. Se o cliente oferecer subagentes, delegue explicitamente escopo, arquivos, critérios de aceite e formato de retorno. Se não oferecer, aplique os mesmos perfis sequencialmente e informe essa limitação: trocar de perfil no mesmo agente é auto-revisão, não QA independente. Registre quando a revisão independente estiver pendente. Arquivos de configuração não significam que agentes estejam rodando permanentemente.
4. Limite a concorrência à capacidade disponível. Prefira até três análises independentes por rodada. Não dê escrita simultânea no mesmo arquivo: `web/main.ts` concentra UX, entrada, áudio e persistência. O coordenador integra mudanças compartilhadas.
5. Separe fatos verificados, hipóteses, metas e resultados. Cargos/requisitos de profissionais humanos não viram currículos fictícios de agentes. Referências públicas não significam afiliação ou endosso.
6. Respeite as autorizações da conversa e as permissões do ambiente. Não crie novas etapas de aprovação para trabalho já autorizado. A criação desta equipe não é uma ordem para implementar agora todo o roadmap.
7. Mantenha um coordenador por tarefa: o diretor não cria outro diretor para o mesmo escopo. Especialistas devolvem o resultado ao coordenador; delegação adicional precisa de um recorte explícito e deve respeitar o limite global de agentes.

## Base técnica e limites

- Preserve um caminho Classic jogável com mapas reais, simulação de 35 Hz, auto-aim vertical e controle completo por teclado. Novas regras devem ser identificadas como variante e ter compatibilidade de dados documentada.
- Nos perfis Clássica/Alta, Canvas/WebGL apresenta o framebuffer rasterizado em software. Moderno HD usa EDGE-Classic para renderizar geometria na GPU/WebGL2, com buffer interno próprio. Escalonamento ou pós-processamento, isoladamente, não equivalem a aumentar resolução interna ou adicionar iluminação dinâmica.
- Não substitua o motor por um clone JavaScript nem troque de port silenciosamente. Mudança de renderer/motor exige comparação técnica e protótipo dentro do escopo autorizado. A mira vertical segue a decisão explícita do usuário; não a atribua ao DOOM original.
- Mantenha funcionamento offline após preparação, sem CDN/backend durante o jogo, e sem dependência de mouse, Pointer Lock, gamepad ou controles de toque.
- Não renomeie/apague bancos, IWADs, saves, IDs de PWA ou namespaces para organizar a marca. Mudanças de simulação precisam de identificação de engine/perfil e estratégia de saves antes de serem habilitadas.
- Não edite `engine/upstream` diretamente. Faça adaptações nos arquivos do port ou em `scripts/prepare-engine.py`; preserve a revisão upstream, licenças e fontes correspondentes.
- Distribua apenas conteúdo próprio ou autorizado. Importar um WAD comercial não autoriza redistribuir seus assets. Leia `agents/RESEARCH.md` para os critérios de procedência.

## Verificação e entrega

- Faça mudanças pequenas, com arquivos definidos. Use `agents/templates/proposal.md` e `agents/templates/review.md` quando a complexidade justificar.
- Execute verificações relevantes: `npm test`, suíte C de `tests/turn_test.c`, `npm run build` e `npm run test:e2e`, conforme o impacto. Não adicione testes que só repitam uma alteração textual.
- Mudanças no motor/entrada precisam de QA independente. Mudanças visuais precisam de capturas comparáveis e revisão de legibilidade. Novos efeitos precisam de custo medido e opção de desativação.
- Verifique teclado, foco, suspensão, áudio, saves, conteúdo importado, atualização e reabertura offline quando afetados. O pipeline de `main` faz o gate de publicação.
- Não declare FPS, latência, consumo, acessibilidade integral ou compatibilidade universal sem evidência. Chromium/WebKit desktop não certificam Chrome no iPad nem outros dispositivos.
- Entregue resultado, evidências, riscos restantes e rollback. O repositório é `adhenawer/Doom-classic-browser`; preserve a URL e os dados existentes durante evolução.
