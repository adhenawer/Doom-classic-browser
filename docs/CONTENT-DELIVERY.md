# Conteúdo sob demanda por mapa

A entrega mantém os PNGs, resoluções, materiais e parâmetros gráficos originais. Não há redução de qualidade, texturas temporárias nem antecipação da próxima fase. A implementação separa o catálogo, os objetos de transporte e os recursos que o motor precisa para a fase solicitada.

## Fluxo

1. O Service Worker prepara a interface e os manifestos. Loaders, WASM e dados de suporte são armazenados quando o perfil correspondente é usado.
2. O host fixa o catálogo para a sessão. Para Freedoom e Aurora, monta um IWAD esparso com os offsets e o diretório originais. Seu identificador continua sendo o SHA do IWAD integral; os namespaces de saves não mudam.
3. O bootstrap contém recursos globais exigidos pelos registros nativos, como sprites, sons e definições de texturas. Não contém geometria das demais fases. **Isso não significa que cada recurso global seja exclusivo da fase atual.**
4. Uma barreira nativa solicita a fase antes de consumir seus dados, incluindo nova partida, progressão, saída secreta e carregamento de save. A simulação, o relógio lógico e a entrada aguardam a preparação. O host não reentra no WASM enquanto Asyncify está esperando.
5. São baixados somente os objetos faltantes do conjunto solicitado, com até três transferências por página. Imagens grandes são divididas em blocos de até 4 MiB; SHA-256 e tamanho são verificados antes do armazenamento. O arquivo reconstruído também é verificado.
6. No Moderno, as imagens são registradas inicialmente por metadados. O mapa recebe os PNGs originais antes de renderizar. Uma dependência ausente gera erro explícito, nunca substituição silenciosa por baixa resolução. Os nós BSP do EDGE também são gerados somente para o mapa solicitado.
7. A conclusão do frame nativo libera a interface. Após uma transição, o jogador retoma a partida para ativar o áudio. A próxima fase não é preparada durante o jogo nem durante períodos ociosos.

IWADs importados continuam inteiramente locais e mantêm o fluxo existente. O pacote HD continua exclusivo do hash Freedoom compatível; Aurora não adquire compatibilidade HD implicitamente.

## Inventário e cache

`scripts/build-lazy-content.py` verifica o WAD, EPK e definições do EDGE fixados. Produz `content-index.json` e objetos imutáveis `content/<sha>.bin`. O manifesto relaciona cada mapa aos intervalos de geometria e aos materiais necessários. Inclui animações completas, estados de switches, céus, surround e recursos de intermissão/final. Regras não modeladas são rejeitadas no build.

Os objetos compartilhados são armazenados uma vez por hash. Interrupções preservam blocos já verificados; a tentativa seguinte requisita apenas os faltantes. Web Locks coordenam abas quando disponíveis. A concorrência é limitada por página; browsers sem Web Locks ainda podem repetir uma transferência entre abas, sem comprometer a integridade.

O cache da interface, o dos binários e o do conteúdo usam namespaces separados. Uma atualização apenas de documentação não altera a versão de execução. Alterações na interface reaproveitam os objetos de conteúdo e binários idênticos. A ativação não apaga caches usados por documentos anteriores. A coleta de versões antigas fica para uma evolução específica; não há remoção automática de saves ou conteúdo durante esta migração.

`source.tar.gz`, licenças e créditos continuam publicados. O pacote de fontes não entra no precache nem no identificador da execução. Os WADs integrais e o EPK continuam como artefatos de build para verificação, mas suas cópias redundantes não são publicadas junto da entrega segmentada. O pacote independente de Aurora permanece disponível pelo workflow próprio.

## Offline e erros

A confirmação é por mapa preparado, não pela campanha inteira. Sem conexão, uma fase já preparada pode abrir; uma fase ausente permanece na barreira e oferece **Tentar novamente**, preservando a preparação concluída. Não há download de assets durante a simulação de uma fase preparada. Alterações do catálogo só passam a valer em uma nova sessão.

O cache pode ser removido pelo navegador. A indicação de disponibilidade no momento da preparação não garante retenção permanente. Os backups e a persistência existentes continuam importantes.

## Verificação

Os testes de unidade cobrem hashes, limites de concorrência, deduplicação, corrupção, interrupção/retomada, catálogo fixado, intervalos originais e ausência de prefetch. Os testes Python reconstituem bytes de WAD/EPK e verificam o fechamento das dependências. Os testes de navegador observam requisições reais e transições no motor, além de offline e saves. A validação em iPad físico continua necessária.

Os resultados desta implementação, incluindo comparação visual com PNGs originais de E1M8, estão na [revisão independente](content-delivery/QA.md). O fundo magenta de `BROVINE` apareceu tanto no caminho nativo EPK de controle quanto no novo caminho e foi registrado como defeito herdado. Não foi corrigido alterando ou substituindo imagens nesta entrega.

O build de release exige os materiais originais completos e falha se estiverem ausentes ou divergentes. Uma fixture sem HD, identificada como teste e construída fora da distribuição, pode validar os caminhos Classic/Alta e Moderno sem HD; ela não valida fidelidade visual do pacote HD nem substitui um build de release.

### Estimativa de transferência

O [inventário estimado](content-delivery/evidence/size-estimate.json) reproduz a seleção das 1.115 imagens usando o archive upstream verificado. Os tamanhos das duas imagens 4K vêm dos pins, pois seus arquivos não estavam disponíveis nesta execução. Não é uma medição de rede.

| Conteúdo | Estimativa de PNGs distintos |
|---|---:|
| HD de E1M1, mantendo os dois materiais 4K | 148,77 MiB |
| HD de E1M2 em cache frio | 73,64 MiB |
| HD adicional de E1M2 depois de E1M1 | 27,72 MiB |

O pacote anterior inteiro tinha 380,21 MiB. Essas estimativas excluem motor, manifestos e HTTP; o bootstrap global do IWAD tem 17,39 MiB e a geometria de E1M1 tem 141.905 bytes. Elas não implicam remoção de recursos da campanha nem redução da qualidade.

Para rollback, publique a revisão anterior completa e seus respectivos manifestos/motores, sem modificar os bancos ou namespaces de saves. Os caches de objetos novos têm namespace separado do Service Worker legado.
