# Revisão independente — conteúdo sob demanda

> **Atualização de publicação (coordenador, 27/10/2026):** a versão completa foi validada e publicada pelo [pipeline 40439413592](https://github.com/adhenawer/Doom-classic-browser/actions/runs/40439413592). Os limites de arquivos ausentes descritos na revisão local abaixo foram resolvidos no GitHub Actions, com os assets originais. Veja a validação final ao fim deste documento.

- Data: 27/10/2026.
- Entrega revisada: alterações locais de carregamento por mapa; sem publicação nesta revisão.
- Revisor: agente `lazy_qa`, independente dos implementadores de plataforma, inventário e motor.
- Critérios: PNGs originais, nenhuma geometria de mapa futuro antecipada, dependências HD apenas do mapa solicitado, transferências limitadas e reutilizadas, retomada após erro, saves e reabertura offline.
- Ambiente real: Debian 13, Chromium do sistema e Playwright WebKit 26.0/WPE 2215, ambos headless na nuvem. Não houve teste em iPad ou outro dispositivo físico.

## Fixtures e limites

A rede deste ambiente bloqueia `dl.polyhaven.org`. Os dois PNGs 4K originais não estavam disponíveis. Nenhum substituto foi criado, nenhum pixel foi reduzido e nenhuma configuração de qualidade de produção foi alterada para contornar isso.

Os testes nativos principais usaram os três motores realmente compilados e os IWADs livres reais, com catálogo explicitamente `testOnly` e HD vazio em `/workspace/scratch/lazy-classic-fixture`. Classic e Alta usaram seus caminhos normais; os testes Moderno dessa fixture selecionaram expressamente HD desativado. Isso verifica a transição, geometria, cache e saves, sem certificar os materiais HD.

Uma segunda fixture, `/workspace/scratch/lazy-hd-qa`, contém os metadados das 1.115 imagens e os **90 PNGs originais necessários a E1M8**, totalizando **18.254.982 bytes**. Esse mapa não utiliza os dois materiais 4K. Os demais PNGs ficaram indisponíveis; seu uso indevido produziria falha. Um wrapper exclusivamente no teste escolheu `-warp E1M8`; o host, a barreira nativa, o registro, a decodificação e o renderer continuaram sendo os da implementação revisada. Essas fixtures não são releases publicáveis.

O bootstrap contém os recursos globais do IWAD necessários à inicialização dos motores, incluindo arte-base, sons e definições. A implementação **não segmenta cada recurso global do IWAD por fase**. O isolamento observado e testado cobre a geometria dos mapas e os materiais HD, com base global compartilhada.

## Resultados executados pelo QA

| Cenário | Chromium | WebKit |
|---|---|---|
| Classic: E1M1 → E1M2, falha 503, tentativa posterior e retorno E1M1 sem transferência adicional | Passou | Passou |
| Moderno sem HD: mesma transição, XWA/AJBSP inicialmente somente E1M1 | Passou | Passou |
| Save E1M2, recarga, limpeza do cache de conteúdo e carga direta do slot sem baixar E1M1 | Passou nos dois motores acima | Passou nos dois motores acima |
| Classic: servidor HTTP desligado, reabertura e save persistido | Passou | Passou |
| Classic e Alta: preparação explícita dos dois perfis, servidor desligado, reabertura e saves preservados | Passou | Passou |
| Escape no seletor inicial de save: nenhuma preparação de mapa e nova página utilizável | Não repetido neste browser | Passou |
| E1M8 HD: 1.115 registros, uploads reais e SHA-256 dos 90 PNGs montados igual ao catálogo | Passou | Não executado |
| Feedback touch com download do bootstrap interrompido | Passou | Não repetido |
| Geometria Aurora corrompida impede entrada sem selecionar outro conteúdo | Passou | Não repetido |
| Presets Comfort, comandos, soltura e save/load Classic com retomada explícita | Passou | Não repetido |

Os testes de transição contam requisições reais: antes da entrada de E1M2, somente bootstrap e E1M1; depois, somente as partes necessárias adicionais. Verificam concorrência observada maior que uma e no máximo três, ausência de transferências exclusivas de E1M3 e ausência de redownload dos recursos iniciais. O seletor nativo `_web_state(34)` confirma o mapa efetivamente carregado.

O teste E1M8 verifica requests restritos àquele mapa, ausência dos bytes de BASE2/FLAT1, registro completo, uploads reais e hashes dos arquivos disponíveis no filesystem do motor. A captura é de gameplay real.

Também executei independentemente os **10 testes Python do inventário lazy** e o **teste C de rotação**, todos aprovados. A coleta dos testes Playwright passou. O coordenador registrou adicionalmente: **53 testes Node aprovados e uma falha por ausência das partes HD originais**, **17 testes Python aprovados**, **três verificações C aprovadas** e **compilação dos três motores aprovada**. Esses números adicionais são resultados do coordenador, não execuções independentes deste revisor.

## Comparação visual controlada

A comparação usou os mesmos 90 PNGs, posição, ângulo, resolução interna 1280×960 e browser em duas execuções:

1. Registro lazy de 1.115 metadados, com os 90 arquivos da fase no diretório.
2. EPK `STORED` de controle contendo exatamente os 90 PNGs originais, `Module.lazyImages={}` e caminho nativo de leitura/registro do EPK.

Os dois casos passaram. Ambos fizeram **83 uploads**, com maior largura de imagem **1024**. A cena acima da linha 611 da captura ficou **idêntica por pixel**. A diferença de 21.031 pixels em 897.080 ficou restrita à caixa `[465,611,647,820]`, na arma animada: as capturas ocorreram nos tics 18 e 19. Não se afirma identidade da captura inteira.

O fundo magenta da textura `BROVINE`, percebido na inspeção, também aparece no controle EPK nativo. Portanto não foi introduzido pelo registro lazy; é um comportamento herdado do conteúdo/caminho existente. Os assets foram preservados, sem correção visual incidental nesta entrega.

Evidências versionadas pelo coordenador: [comparação](evidence/hd-comparison.json), [lazy](evidence/e1m8-lazy.png) e [EPK de controle](evidence/e1m8-control.png). Os shaders e as configurações de renderização não foram alterados pela entrega; foram adaptados o acesso aos dados, o registro por metadados e a geração de nós por fase.

## Achados corrigidos durante a revisão

| Achado | Correção verificada |
|---|---|
| Fundos de finais de episódio não estavam no fechamento de dependências | Parser preserva chaves `PRE.*`/`END.*` e inclui recursos de final/intermissão da fase atual; regressões Python passam |
| O precache nativo usa pares SW1/SW2 mesmo fora das definições DDF | Fechamento inclui os pares existentes; regressão Python passa |
| Carregar um save na abertura preparava E1M1 antes do mapa salvo | Seletor HTML escolhe slot antes de `-loadgame`; testes cold load confirmam E1M2 sem E1M1 |
| Escape no seletor podia deixar inicialização pendente | Cancelamento reinicia o documento; teste WebKit passa |
| Tests antigos esperavam monolitos/precache completo e não retomavam após load | Contratos atualizados para partes por mapa, perfis explicitamente preparados e retomada; cenários afetados passam |

## Parecer da revisão local inicial

A evidência sustenta a entrega sob demanda para os caminhos exercitados: mapas Classic/Alta e Moderno, cache com retomada, saves, offline por mapa preparado e registro/decodificação HD com PNGs originais em E1M8. A qualidade de textura não foi reduzida.

**Não há aprovação da release completa nem de toda a campanha HD/4K**: faltam os dois materiais bloqueados e a execução do build/suíte completos com eles. Não foram medidos desempenho sustentado, RAM/GPU total, latência de rede real ou qualidade audível em dispositivo. O funcionamento em iPad físico permanece pendente.

Antes de publicar, executar o pipeline completo com todos os arquivos originais, incluindo os testes HD de E1M1, saves/backups Moderno e revisão das cenas 4K. As fontes e licenças continuam parte da distribuição. Nenhum deploy foi realizado por este QA.

## Validação final e publicação — 27/10/2026

Registro do coordenador, posterior à revisão local acima:

- Commit publicado: [2a3caeff5e35c504e0b5fc711c9a5c2096e75509](https://github.com/adhenawer/Doom-classic-browser/commit/2a3caeff5e35c504e0b5fc711c9a5c2096e75509).
- [Pipeline completo e deploy](https://github.com/adhenawer/Doom-classic-browser/actions/runs/40439413592): sucesso. Compilação dos três motores; **63 testes Node, 17 Python, três verificações C e 66 testes de navegador aprovados**, sem testes de navegador dispensados.
- Pacote real: dois IWADs e 1.115 PNGs HD originais, incluindo os dois materiais 4K. Catálogo SHA-256 `d969e861a6c18dd4557389739710383acbf142fb1caa6c181d1be03a8d73f6b0`; versão offline `4233d20b7868e523`. Nenhuma fixture local foi publicada.
- [Jogo publicado](https://adhenawer.github.io/Doom-classic-browser/), com deploy confirmado pelo GitHub Pages às 03:05 UTC. A rede do ambiente local bloqueou a abertura direta dessa URL; a confirmação de publicação vem do job de deploy.
- Artefato de validação de navegador: ID `12707465332`, SHA-256 `6c09b04274b352f73dd919250a6d649dfa1ef25b11dcb99acb1818fafcb78513`. A retenção configurada no Actions é de 14 dias.

A integração corrigiu a ordem dos testes que dependem da geração de Aurora e a retomada explícita após load antes de verificar áudio. As falhas simuladas de download passaram a ser injetadas no servidor HTTP, com contadores que comprovam a injeção, preservando o Service Worker real; a interceptação de página não aplicava essas falhas no WebKit.

Um timeout de controle offline observado no CI motivou a regressão determinística de navegação durante a instalação: worker ativo, mas documento sem controlador. O QA independente demonstrou falha antes da correção e sucesso depois em Chromium/WebKit, incluindo repetições do teste de áudio. A recuperação solicita controle ao worker ativo compatível, não promove atualizações em espera, mantém catálogo/runtime bloqueados até confirmar controle e informa falhas de instalação. O protocolo também rejeita recuperação com bundle de outra revisão.

Os testes completos incluem HD/4K, saves/backups, perda de contexto GPU, reabertura offline, trocas de mapa sem antecipação e recuperação de downloads. A revisão independente das capturas HD nas rodadas de integração não encontrou novo defeito visual concreto; não se afirma comparação por pixel entre poses diferentes. Os limites de dispositivo físico e o comportamento herdado de `BROVINE` permanecem os registrados acima.

Rollback: publicar novamente a revisão anterior completa `5b6c8db789d1e52f5fd6106e742c92b45d2c357a`, preservando bancos, namespaces e saves.
