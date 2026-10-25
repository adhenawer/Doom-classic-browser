# Revisão independente — Estação Aurora

Revisão realizada em 25/10/2026, por agente diferente do autor do gerador, em modo somente leitura dos arquivos de implementação. Este documento registra apenas os resultados desta revisão; execução no motor e capturas devem ser consultadas nas evidências complementares do coordenador.

## Resultado

Sem bloqueios encontrados para a geometria atual. O gerador lê `maps/aurora/layout.json` e uma base Freedoom Phase 1 0.13.0 com SHA-256 fixado. Não lê `work/DOOM.WAD`, inventário comercial ou análise comercial. A geometria nova é descrita explicitamente no JSON; não há payload comercial no gerador. Os identificadores de texturas compatíveis com Doom resolvem para assets do Freedoom pinado. A revisão do código não pode provar por si só toda a história de criação ou aquisição de conteúdo.

## Verificações executadas

- Duas gerações independentes em `work/qa-aurora-a` e `work/qa-aurora-b`: IWADs e PWADs idênticos por comparação de bytes. PWAD de 8.080 bytes, SHA-256 `c5e354a3147892d0dd843d4165e183eee9df1584ce6b357d6f2820d45d628f94`; IWAD de 28.656.004 bytes, SHA-256 `84f2991325ba3d48cac8ef7ebe06538e814810c01c29d9cec970e7a569b0e14e`.
- `inspect-wad.py` sobre o IWAD composto: 36 mapas e zero erros nas verificações implementadas de diretório, referências, strides, REJECT, BLOCKMAP e dependências de texturas.
- `python3 -m unittest discover -s scripts/tests -v`: sete testes aprovados, cobrindo referências, folhas fechadas, winding horário, BSP, conectividade, recursos, saída, título e preservação dos demais lumps da base, exceto WILV00 deliberadamente substituído.
- Checagem independente dos nomes usados pelo mapa: BROWN1, COMPTALL, STARTAN3, SW1COMP e TEKWALL4 existem nas definições de texturas da base; CEIL3_5 e FLOOR4_8 existem como lumps da base.

O título WILV00 foi composto com o texto novo `ESTACAO AURORA`, usando apenas glyphs STCFN da base Freedoom BSD em escala 2. Checagem independente de offsets/posts: patch de 246×14 pixels, colunas terminadas e limites válidos. Há uma única ocorrência de WILV00 em cada saída; os dez lumps do mapa seguem contíguos após E1M1. O decoder é destinado aos glyphs da base pinada e ao título curto atual, não a patches externos arbitrários ou tall-patches de extensões. O PWAD agora inclui arte derivada da fonte Freedoom, além da geometria original, e requer preservar também sua atribuição BSD.

## Geometria, flags e BSP

A versão revisada tem 15 things, 24 vértices, 34 linedefs, 44 sidedefs/segs, 11 subsectors/setores e 10 nodes. Cada folha é um retângulo convexo fechado com quatro segs. O BSP próprio particiona por eixos e coloca filhos antes dos pais; a raiz é o último node. Os testes localizam pontos interiores de cada célula na folha esperada. Este algoritmo serve à geometria retangular atual, não constitui um node builder geral para mapas arbitrários.

Paredes externas têm flag de bloqueio; arestas compartilhadas passam a two-sided sem bloqueio. As conexões entre setores oferecem pelo menos 96 unidades de altura livre na fonte atual, acima da altura de 56 do jogador. Há um início P1 e objetos com flags 7 para dificuldades single-player. A saída usa especial vanilla 11 em uma parede de lado único a leste, com sidedef orientado para o interior. O setor especial 9 é uma área de segredo; não é uma saída secreta nem implica percurso oculto.

O BLOCKMAP conservador referencia todas as linhas em todas as células. Para apenas 34 linhas é uma escolha simples e correta, mas não deve ser generalizada como otimização de desempenho. REJECT preenchido com zeros evita descartar visibilidade indevidamente.

## Integração e publicação

A seleção Aurora obtém `aurora.wad` e verifica tamanho e SHA-256 contra o manifesto antes de chamar o importador normal. O importador valida estrutura, armazena bytes/metadados no IndexedDB e persiste a seleção. O manifesto é da mesma origem: o hash detecta divergência entre manifesto e WAD, não substitui autenticação de toda a distribuição. O manifesto opcional ausente ou inválido não remove conteúdos existentes. A ressalva de inicialização por requisição pendente foi corrigida com AbortController e timer de três segundos, limpo em finally; a descoberta pode retardar brevemente, mas não bloquear indefinidamente, a inicialização normal.

`work/` está ignorado pelo Git e excluído de `source.tar.gz`; o Vite publica `web/generated`, não `work`. O WAD comercial local não é entrada da geração Aurora. Somente a geometria de E1M1 e seu título WILV00 foram substituídos: E1M2 e todos os demais mapas e assets continuam sendo Freedoom; o título novo usa glyphs da própria base livre. A distribuição precisa conservar os avisos BSD e créditos Freedoom, além de AURORA-CREDITS.txt.

## Evidência funcional complementar do coordenador

O coordenador informou execução de percurso entre áreas, aquisição de shotgun e saída com jogador vivo, sem cheats, em Chromium e WebKit, além de três testes Aurora por browser e quatro regressões combinadas de importação/offline com servidor desligado. Essas execuções são evidência complementar atribuída ao coordenador; não foram realizadas por este revisor. A verificação visual do título e a progressão/save E1M2 estavam em validação pelo coordenador no momento desta revisão incremental.

## Limites

Esta revisão não jogou a campanha, não acionou a saída no motor e não certifica iPad, Modern HD, ausência de todos os erros gráficos ou balanceamento. Testes de bounds não provam toda a semântica de mapas arbitrários; em particular o inspetor não valida ciclos/topologia BSP de entradas externas. As evidências funcionais do coordenador complementam a revisão estrutural; não certificam todos os motores, perfis ou dispositivos. Confirmar separadamente qualquer alegação de Crispy/Modern HD, campanha completa ou balanceamento. A abertura inicial do mapa sozinha não comprova esses pontos.

## Evidência posterior do coordenador

Após esta revisão, o coordenador confirmou visualmente o título próprio e a progressão para E1M2 no cabeçalho de um save real. Os resultados finais e seus limites estão em [VALIDATION.md](VALIDATION.md), com capturas/telemetria em `evidence/`. Essas execuções são do coordenador, não deste revisor.
