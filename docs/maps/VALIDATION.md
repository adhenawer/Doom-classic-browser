# Validação de Estação Aurora

25/10/2026. Checkout `073b980` com alterações locais desta entrega; `origin/main` `55dec9d` foi consultado, sem merge. O perfil testado é Classic/Chocolate Doom WASM, não Modern HD. Revisão independente de formatos e procedência em [QA.md](QA.md).

## Evidência executada

| Verificação | Resultado |
|---|---|
| Build TypeScript/Vite e pacote offline | Aprovado; 23 recursos de execução |
| Testes unitários existentes | 16 aprovados |
| Testes Python do gerador | 7 aprovados |
| Testes Aurora no Chromium e WebKit desktop Linux | 6 aprovados: seleção/persistência/travessia/combate/saída; corrupção; timeout opcional |
| Regressões importação e offline em ambos os browsers | 4 aprovadas; reabertura offline com servidor HTTP realmente desligado |
| Inspeção do IWAD Aurora | 36 mapas; zero erros nas verificações estruturais implementadas |
| Reconstrução do PWAD/IWAD | Bytes idênticos em duas execuções, conferidos pelo revisor independente |
| Título próprio e continuação E1M2 | Título inspecionado visualmente; episódio 1/mapa 2 confirmados nos bytes do cabeçalho de um save real após sair de Aurora |
| Conteúdo do pacote de fontes | Fonte da geometria incluída; `work/` e WAD comercial excluídos |

Comandos principais:

```sh
npm run build
npm test
python3 -m unittest discover -s scripts/tests -p 'test_original_map.py'
npx playwright test tests/browser/original-map.spec.ts
npx playwright test tests/browser/game.spec.ts -g 'complete offline cache|IWAD import persists'
python3 scripts/inspect-wad.py web/generated/aurora.wad --output work/aurora-inspection.json
```

Neste executor sem instalação administrativa, bibliotecas oficiais Debian foram baixadas/extradas em `work/webkit-deps/root`. A cópia local de WebKit em `work/browsers` preserva `LD_LIBRARY_PATH` no wrapper, para carregar essas bibliotecas. Os testes WebKit usam `PLAYWRIGHT_BROWSERS_PATH`, `LD_LIBRARY_PATH` e `PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1`: o último evita um falso negativo do verificador que consulta o cache global de bibliotecas, enquanto o navegador real encontra as bibliotecas locais e executa os testes. Nada disso altera o runtime publicado ou demonstra compatibilidade com iPad.

As capturas em `evidence/` são da execução real de conteúdo Freedoom/Aurora, sem assets comerciais. `aurora-playthrough.json` registra posições em unidades de mapa, tics, saúde, munição, arma e estado. A rodada usa somente teclado e não ativa cheats. A rota principal segue leste, atravessando os três ambientes, coletando shotgun e recursos e acionando a saída com E mantido por mais de um tic. Uma tecla pressionada/solta entre dois tics pode não gerar a ação; o teste mantém Use por 150 ms.

A rodada final terminou viva (34 de saúde), com shotgun equipada. Após avançar a intermission, foi criado um save pelo menu nativo: bytes 40–42 do cabeçalho registraram skill 2 (Hurt Me Plenty, índice base zero), episódio 1 e mapa 2. Isso confirma continuação efetiva em E1M2 Freedoom. A captura `aurora-intermission.png` foi feita após terminar a transição visual e mostra o título ESTACAO AURORA composto dos glyphs BSD.

Uma primeira execução do botão encontrou `ERR_CACHE_WRITE_FAILURE` em uma requisição HTTP condicional concorrente com a preparação do Service Worker. O fetch do IWAD Aurora passou a usar `cache: 'no-store'`, como o Freedoom já fazia. Os testes seguintes passaram. A descoberta opcional do manifesto aborta após três segundos; uma resposta pendente não bloqueia os conteúdos existentes indefinidamente.

## Limites

Somente E1M1 é geometria nova. Os outros 35 mapas e os assets são Freedoom BSD; a análise comercial não é input do gerador. O teste de saída não exige visitar a alcova secreta e não certifica equilíbrio de todas as dificuldades, todas as rotas, ausência de qualquer artefato visual, Crispy High, Modern HD ou hardware móvel. Não houve deploy, push ou substituição de dados do usuário. A compatibilidade com o importador do commit Modern HD foi conferida no código; o pacote HD remoto está associado ao hash exato de sua base, portanto não se declara automaticamente compatível com o IWAD composto.

## Integração para envio ao GitHub

As alterações foram reaplicadas sobre Modern HD `55dec9d`, preservando `graphicsLost`, a configuração de Modern HD e seus recursos obrigatórios do cache. TypeScript foi verificado após a integração. O teste unitário de entrega HD requer os chunks não existentes neste executor; essa dependência passa à CI completa, não à build independente do mapa. `npm run build:map` executa os sete testes e gera o ZIP distribuível sem compilar os motores nem usar assets comerciais. O workflow `map.yml` executa preparação de base pinada, geração, testes e upload do pacote.

## Seleção permanente junto de Freedoom

Freedoom Phase 1 e Estação Aurora permanecem opções fixas mesmo após armazenar o mapa no navegador; Aurora não passa a aparecer como arquivo importado `.wad`. A revisão independente aprovou o ajuste. Seis testes passaram novamente no Chromium/WebKit: troca de Freedoom para Aurora depois de uma recarga, com o download do WAD bloqueado, comprovou reaproveitamento do conteúdo local; integridade, timeout e percurso/saída seguem aprovados. Captura em `evidence/content-selection.png`.
