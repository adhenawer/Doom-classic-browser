# Validação do porte para browsers

Data: 2026-10-25. Executor Linux de nuvem, com Chromium e WebKit desktop. A validação é organizada por browser, sistema, dispositivo e teclado; o Chrome no iPad é um perfil de uso pendente de teste físico.

## Build

- Chocolate Doom real compilado em C para WASM com Emscripten 4.0.18, SDL2 2.32.8 e SDL2_mixer 2.8.0.
- Toolchain fixada por digest em `engine/UPSTREAM.json`.
- Segunda compilação com as mesmas fontes no mesmo executor produziu hashes idênticos de loader e WASM. Isso não certifica identidade entre sistemas/toolchains diferentes.
- SHA-256 WASM: `12484847765cb033af433e960d500a69eda9349e5be40c0be1bac68ca071d272`.
- SHA-256 loader: `e9ea5671572cffd2755109ae3371a3037d6f222b0aa90602e85e0d35bdaa2d8e`.
- TypeScript estrito e frontend de produção construídos com Vite 7.3.7.
- `npm audit`: zero vulnerabilidades conhecidas na consulta realizada após a atualização. Isso não é garantia de ausência de vulnerabilidades no motor ou em todo o ecossistema C.

## Testes automatizados

Os testes são executados por `npm test`, compilação/execução de `tests/turn_test.c` e `npm run test:e2e`. Resultados da última rodada ficam em `docs/test-results.json`.

| Grupo | Cobertura |
|---|---|
| 4 testes Node | WASD individual/diagonal, combinação com giro/tiro, aliases, soltura, reset, remapeamento, conflitos, teclas protegidas e WADs inválidos |
| 1 executável C | Rampa real do controlador: velocidade inicial, aceleração, limite, oposição, inversão, soltura, suavização, reset e sensibilidade |
| 4 cenários Chromium | Navegação/configuração/remapeamento; motor e backup; importação IWAD; reabertura offline/save em subdiretório |
| 4 cenários WebKit | Mesmos cenários em WebKit desktop Linux via Playwright 1.56.1 |

O cenário do motor usa o **WASM real e Freedoom Phase 1 E1M1**, sem mock de engine. Verifica mudança de posição/ângulo, comandos diagonal/giro simultâneos, teto de rotação, soltura/oposição, munição consumida, menus por teclado, suspensão com relógio parado, save/load, contexto de áudio ativo e PCM não nulo. Também verifica volta à interface, exportação de backup, exclusão/restauração de save e rejeição de caminho inválido sem apagar o save existente.

O cenário de importação armazena um IWAD livre real, reabre a página, confere seleção e inicializa o motor com o blob persistido. Arquivo inválido não substitui a seleção válida.

O cenário offline serve o app em um subdiretório de teste (atualmente `/doom-browser-check/`), prepara o Service Worker e saves, **desliga o servidor HTTP**, recarrega e carrega a partida pelo botão Carregar jogo. Chromium também é colocado em modo offline pela automação. Em WebKit, usamos a indisponibilidade real do servidor porque a emulação offline do Playwright produziu erro interno de navegação. Não há resposta de rede de fallback que possa mascarar cache incompleto.

Atalhos reservados: testes verificam a suspensão defensiva ao receber modificadores e o funcionamento das teclas alternativas. Não simulam nem certificam os atalhos reservados de todos os sistemas; isso inclui o iPadOS.

## Evidência visual

`preview.png` registra a fase real apresentada pelo motor no executor. Sprites, mapas e HUD da captura são de Freedoom. As capturas automáticas dos cenários também são geradas em `test-results` durante a execução.

## Entrega externa

- Repositório de destino: https://github.com/adhenawer/Doom-classic-browser
- GitHub Pages confirmado com fonte `workflow`.
- A autorização de escrita da integração foi confirmada por um envio simulado sem erro 403.
- Builds e publicação são executados no [GitHub Actions](https://github.com/adhenawer/Doom-classic-browser/actions). O resultado da execução associada ao commit é a evidência de compilação/teste no GitHub.
- URL de produção: https://adhenawer.github.io/Doom-classic-browser/
- Os resultados detalhados acima foram medidos no executor desta sessão; a execução do Actions repete a suíte antes da publicação.

## Compatibilidade e validação manual

O porte usa WebAssembly, Canvas/WebGL, Web Audio, IndexedDB e Service Worker, com teclado físico. Os testes publicados cobrem Chromium e WebKit desktop Linux. Isso não certifica automaticamente cada produto que usa esses motores, nem outros motores de browser. Firefox e outras combinações não foram validados nesta sessão.

Siga [BROWSER-CHECKLIST.md](BROWSER-CHECKLIST.md) em cada browser e dispositivo. Para o uso do usuário no Chrome de um iPad, há o perfil complementar [IPAD-CHECKLIST.md](IPAD-CHECKLIST.md). Ele descreve teclado Bluetooth, atalhos do iPadOS e instalação pela tela inicial; não define o escopo geral do projeto.

DOOM.WAD/DOOM1.WAD comerciais devem ser testados com arquivos autorizados; nenhum foi distribuído ou testado nesta sessão. Registre resultados de hardware separadamente dos automatizados.

## Modernização 0.2.0

A release adiciona cobertura de preferências, conforto, áudio e apresentação. Veja [resultados, medições e limites](modernization/RELEASE.md) e [revisão independente](modernization/QA.md). Os registros anteriores deste arquivo permanecem como histórico do MVP.

## Alta resolução 0.3.0

Veja [provas de buffer interno, saves e offline](HIRES.md) e [revisão independente](HIRES-QA.md). Os relatórios 0.1/0.2 permanecem como histórico; alta resolução usa outro backend explicitamente selecionado.
