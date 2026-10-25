# Revisão independente — alta resolução 0.3.0

Data: 25/10/2026. Revisor: `doom_qa`, separado dos autores e do integrador. Escopo: adaptações Crispy/Chocolate, carregamento/persistência, saves/backups, fonte correspondente e prova de resolução interna. Esta revisão não é um teste físico no iPad nem um playtest humano.

## Achados iniciais

| ID / severidade | Local e evidência | Impacto | Recomendação / estado |
|---|---|---|---|
| H1 — Alto | Crispy `p_mobj.c` chama ações por `acp3(mobj,NULL,NULL)`, enquanto funções como `A_Look`/`A_Fall` em `p_enemy.c` têm um argumento; o adaptador ainda usa as assinaturas nativas. O integrador observou `null function or function signature mismatch` após iniciar E1M1. Uma execução independente Chromium também não chegou ao cartão de retomar em 60 segundos | Alta resolução não inicia uma fase jogável; bloqueia a entrega dessa opção | Compatibilizar os ponteiros no WASM (trampolins ou emulação explícita de casts somente no backend Alta), recompilar e testar fase, armas, monstros e saves. O integrador adicionou `-sEMULATE_FUNCTION_POINTER_CASTS=1` somente ao link Alta e um guard que exige documento novo após runtime falhado. Correção e reteste dinâmico aprovados: fase, ações, save/load, controle e troca entre motores |
| H2 — Baixo | Botões Excluir mostram somente hash/slot; Classic e Alta podem ter o mesmo hash/slot. A confirmação também não identifica o perfil | O gerenciamento diferencia perfis nos parágrafos, mas o nome acessível/confirmador pode induzir exclusão do save errado | O integrador incluiu Clássica/Alta, hash e slot no nome e confirmação. Correção verificada por inspeção e no cenário com os dois perfis/slots presentes |

Nenhum achado crítico foi identificado. H1 e H2 foram corrigidos e retestados, sem crítico/alto aberto nesta revisão. A execução completa do pipeline e a publicação continuam sendo gates separados do integrador. O histórico preserva a falha inicial.

## Inspeção técnica

- `engineProfiles` fixa dois motores/loaders/factories/WASMs; resolução desconhecida/ausente preserva Classic. A página instancia um motor por carregamento.
- Alterar a preferência em partida em uso agenda outra resolução. A UI mantém a resolução ativa e o diálogo oferece retomar o motor atual ou reiniciar após `syncfs` e persistência. Reinício avisa sobre progresso ainda não salvo.
- Saves Classic mantêm o caminho legado. Alta usa `saves-hires`; o bootstrap só copia arquivos Classic para um perfil Alta vazio e grava um marcador após sincronização, sem sobrescrever o original.
- Backups v1 só aceitam paths Classic; v2 exige dois perfis/pins conhecidos e aceita os dois namespaces. Todos os arquivos são validados antes das escritas. Isso não torna bytes arbitrários confiáveis.
- A cópia de build Crispy limita `load_end` a seis entradas e `savepage_max` a zero. A entrada Crispness é removida e o detalhe fica alto. Campos de freeaim/freelook/pulo/overunder e outros extras são desativados na configuração explícita.
- A leitura C dos seletores 17/18 usa `SCREENWIDTH`/`SCREENHEIGHT`; 20/21 observam a área do mundo e 19 distingue o backend. A prova deve usar esses estados reais e capturas, sem inferir resolução a partir do tamanho CSS/Canvas.
- Os dois loaders/WASMs e a licença Crispy são exigidos no inventário e entram no precache. Não há fetch de um backend externo em runtime.
- O arquivo de fonte Crispy distribuído dentro de `dist/source.tar.gz` foi extraído e verificado independentemente: 2.657.694 bytes, SHA-256 `1ae97a51e522006d35e6e333f4d3fb1edf377e7305f088775a9d968dd8ed66ea`, igual ao pin. O pacote também contém metadata e script de obtenção/adaptação.

## Resultados e limites

A primeira tentativa independente de boot Alta no Chromium falhou em chegar ao estado jogável, confirmando o impedimento de integração registrado. Não foram medidos FPS, latência física, memória total ou consumo, nem testados teclados Bluetooth/dispositivo iPad. Compatibilidade de saves não pode ser presumida apenas pelo header vanilla ou pela inspeção: exige execução real antes de aprovar cópia/migração.

A suíte específica de fronteiras `node --test tests/engine-profile.test.mjs` foi executada independentemente e passou em quatro cenários: seleção conservadora, namespaces/hash, paths v1/v2 e metadata de pins.

A correção de casts está restrita ao CMake de `build/wasm-high`; o comando Classic permanece sem a flag. A emulação preserva o comportamento nativo esperado de ações com argumentos extras ignorados, mas seu custo e os outros caminhos de ação exigem execução real. O guard de startup evita montar outro motor quando um objeto de runtime já existe após falha, e esse reinício não tenta sincronizar um runtime incompleto.

## Reteste independente após correção

Build de produção observado: `22070d72332b0f49`, Chromium headless Linux 141, viewport 1180×820, Freedoom 0.13.0 E1M1. Foram usados somente teclado e controles de formulário; não houve teste físico.

1. Classic iniciou com framebuffer 320×200. Foi efetuado um disparo e gravado o save `QA19`; hash do arquivo e munição foram capturados.
2. Selecionar Alta durante a partida manteve Classic ativo e exibiu “mudança agendada”. O diálogo permitiu retomar a resolução atual sem trocar o motor. Aplicar/reiniciar foi verificado aguardando o evento real de navegação, não o estado do botão da página antiga.
3. Alta iniciou e carregou o save copiado de Classic. Os estados C 17/18/19/20/21/22 foram **640 / 400 / 1 / 640 / 336 / 0**: buffer 640×400, backend Alta, área do mundo 640×336 com HUD e extensões de câmera/pulo desativadas. A munição coincidiu com o save de origem.
4. O hash da cópia Alta inicial foi idêntico ao de Classic; o original continuou idêntico. WASD+seta produziu comandos avanço/lateral/giro **25 / 24 / 180**, e a soltura zerou avanço/giro. Disparar reduziu a munição.
5. Perda de foco mostrou suspensão e deixou Web Audio `suspended`; Enter retomou `running`. Não foi avaliada a qualidade de escuta.
6. Gravar o progresso em Alta mudou o arquivo Alta e preservou o hash Classic. A interface mostrou dois botões distintos, “Excluir Clássica…” e “Excluir Alta…”, e a confirmação identificou o perfil Alta, hash e slot.
7. Restaurar a resolução Classic com reinício carregou o save original, em 320×200 e com a munição de origem. O arquivo/progresso Alta continuou preservado no outro namespace.

Resultado: **aprovado**, sem erros JavaScript observados. O cenário prova a cópia Classic→Alta e preservação ao retornar à Classic nessa cena; não demonstra compatibilidade universal de saves de todos os mapas/WADs, conversão inversa ou identidade da simulação em todos os casos. Fallback/erro e atualização precisam ser considerados com os demais testes do integrador.

Scripts de teste que acionam uma opção logo após salvar devem aguardar a confirmação de persistência; scripts de reinício devem aguardar a navegação. A simples existência de um botão habilitado da página anterior não demonstra que o novo documento ou motor está pronto.
