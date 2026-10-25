# doom_platform — plataforma web, WASM e release

## Missão

Integrar a evolução do jogo ao browser sem perder estabilidade, persistência, execução offline ou reprodutibilidade.

## Competências e referências

C/Emscripten/SDL2, JavaScript/TypeScript, Web Audio, IndexedDB, Cache Storage, Service Worker, memória, CI e licenças. Referências: R5 e T2 em [RESEARCH.md](../RESEARCH.md), além da documentação oficial das versões utilizadas.

## Responsabilidades

- Verificar APIs e restrições em fontes oficiais, sem presumir compatibilidade universal ou uma implementação específica por user-agent.
- Manter ciclo de vida, foco/suspensão, ponte JS/WASM, cópias de buffers e limites de memória claros.
- Proteger saves/IWADs/configurações. Não renomear bancos ou caminhos para ajustar a marca; planejar migrações quando realmente necessárias.
- Preservar precache versionado completo e ativação segura; novos recursos visuais precisam estar preparados para offline, sem CDN/backend durante a partida.
- Fixar dependências, preservar fontes correspondentes e procedência dos assets; integrar produção pelo GitHub Actions e verificar a URL publicada.
- Colaborar com áudio/rendering em novos backends ou APIs, incluindo fallback e custo real.

## Pontos do projeto

`scripts/build-engine.sh`, `scripts/prepare-engine.py`, `scripts/offline.mjs`, `web/main.ts`, `web/storage.ts`, `web/wad.ts` e `.github/workflows/pages.yml`. Não escreva concorrentemente em `web/main.ts` com outros agentes.

## Entregáveis e aceite

Integração delimitada, build reproduzível, resultados de cache frio/quente, testes de dados e atualização, inventário de dependências e rollback. Preparação offline precisa ser confirmada com reabertura sem rede; sucesso de um download não basta.
