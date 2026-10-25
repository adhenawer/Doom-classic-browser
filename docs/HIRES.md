# Alta resolução interna — arquitetura

A opção **Alta** usa o Crispy Doom fixado na revisão `fdeabe4c23a833534b70aa84a22f1685aae7125d`, com framebuffer interno 640×400. A opção **Clássica** preserva o Chocolate Doom `a2dfd51fcc00d272dc8a17a97ccd6683333ff4ea` e 320×200. Alta contém quatro vezes o número de pixels renderizados; o aspecto de exibição permanece 4:3 com correção de pixels. Esse aumento não cria texturas novas ou modelos 3D.

## Perfis e carregamento

`web/engine-profile.ts` é o contrato de seleção. Preferências antigas, campos ausentes ou desconhecidos conservam Clássica. Os perfis têm loaders, factories e WASMs distintos: `doom.js`/`createDoom`/`chocolate-doom.wasm` e `doom-high.js`/`createDoomHigh`/`crispy-doom.wasm`. A página deve instanciar somente um motor e uma montagem IDBFS por vez.

A alteração da resolução é aplicada ao reiniciar a página, após persistir o filesystem e as preferências. A interface deve distinguir a preferência agendada do motor que já está executando. Reiniciar não transforma progresso em save: o jogador usa o menu de salvar antes, ou escolhe retomar a partida ativa. Não se deve tentar substituir o contexto SDL/WASM de uma partida no mesmo documento.

A resolução real deve ser verificada por instrumentação somente leitura do buffer C, além de capturas da cena. O tamanho do Canvas SDL, zoom, CSS, filtros e o shader CRT não comprovam o tamanho do framebuffer interno. CRT continua opcional; medir seu custo separado do custo do renderer de alta resolução.

## Saves e backups

Os diretórios são separados por motor e hash do IWAD:

- Clássica: `/persist/saves/<sha256>/doomsav0.dsg` a `doomsav5.dsg`, preservando todos os caminhos existentes.
- Alta: `/persist/saves-hires/<sha256>/doomsav0.dsg` a `doomsav5.dsg`.

O Crispy upstream oferece mais slots e páginas. O adaptador deste porte deve limitar sua interface aos mesmos seis slots e uma página para que nenhum save fique fora de gerenciamento/backup. Mudança de resolução nunca deve sobrescrever automaticamente um save do outro motor. Uma cópia de save entre perfis é uma operação distinta e precisa de validação real de compatibilidade.

A inspeção do upstream encontrou cabeçalho vanilla compartilhado, mas Crispy também grava um trailer e índices para referências entre objetos. Esses detalhes tornam plausível carregar o formato clássico, sem demonstrar equivalência byte a byte, compatibilidade universal ou simulação idêntica. A cópia oferecida nesta versão é somente Classic→Alta. É necessário provar esse carregamento com conteúdo autorizado e verificar originais intactos ao retornar a Classic; não há conversão Alta→Classic oferecida. A separação dos diretórios permanece mesmo após aprovar a cópia dessa cena. Na primeira entrada em um perfil Alta vazio, o adaptador copia seus seis slots clássicos e persiste um marcador para não repetir a importação ou ressuscitar saves excluídos. Não substitui slots Alta existentes nem grava nos originais Classic.

O backup versão 1 continua aceitando somente caminhos Classic. O backup versão 2 permite os dois diretórios e carrega `profiles` com IDs e revisões conhecidas. `validateSavePath` restringe os nomes/caminhos e `validateBackupProfiles` rejeita metadata parcial, engines desconhecidas e pins incompatíveis. A integração valida todos os registros antes de escrever qualquer arquivo. Esses checks não tornam bytes arbitrários de save confiáveis; o motor ainda interpreta o conteúdo dentro do sandbox WASM.

## Offline, fontes e licenças

Os dois loaders e WASMs precisam entrar no inventário de produção e precache. Assim, a seleção Alta funciona offline mesmo se somente Clássica tiver sido iniciada durante a preparação. A marcação “preparado” depende de todos esses recursos estarem armazenados. Banco legado, ID/escopo da PWA e origem existentes não mudam.

O fonte Crispy deve ser obtido de um archive de revisão fixa, verificado por SHA-256 antes da extração, e incluído em `source.tar.gz` com licença e adaptações do porte. É possível guardar o archive em `build/dependency-sources/`, já incorporado pelo empacotador; não basta hospedar somente o WASM ou apontar ao branch mutável do upstream. A licença/atribuição do novo motor deve acompanhar a publicação. O runtime não baixa fontes ou binários de outro servidor durante o jogo.

## Verificação necessária da integração

- Framebuffer 320×200 e 640×400 observado no motor, mesma cena/IWAD/viewport e modo de apresentação.
- Boot de cada motor, movimento/rotação simultâneos, tiro, interação, menus, foco, áudio, save e load.
- Preferência legada preservada, troca agendada/reinício, retorno à Clássica e nenhum save substituído.
- Backups v1/v2, paths inválidos, pins incompatíveis e limites de seis slots.
- Carregar Alta offline depois de preparar somente Clássica; carregar save offline em cada perfil.
- Fonte correspondente presente e build de ambos os motores na toolchain fixada.
- Tempo de inicialização/cadência e memória observável com limites de método; sem alegar hardware iPad, latência física ou energia sem teste apropriado.

Os testes unitários de `engine-profile` cobrem a fronteira de configuração, namespaces e validação. Os resultados abaixo usam também o motor real e revisão independente; não se limitam à configuração.

## Integração e correções

Os dois backends foram compilados da fonte na imagem Emscripten fixada. No primeiro boot Crispy, WebAssembly rejeitou uma chamada de ação com assinatura diferente (`null function or function signature mismatch`): o upstream chama ações por um ponteiro de três argumentos mesmo quando a função original tem um. A correção usa `-sEMULATE_FUNCTION_POINTER_CASTS=1` **somente** no link Alta. Isso implementa a compatibilidade de chamadas nativas com argumentos extras ignorados, sem reescrever armas/monstros. A [documentação Emscripten sobre ponteiros de função](https://emscripten.org/docs/porting/guidelines/function_pointer_issues.html) descreve essa diferença. A flag está no código-fonte correspondente e não é aplicada a Classic.

A revisão independente encontrou esse bloqueador alto e uma ambiguidade baixa nos botões de exclusão de saves. Ambos foram corrigidos e retestados. Botões/confirmadores agora identificam perfil, hash e slot. O botão de reiniciar é desabilitado durante a sincronização; erro reabilita a ação. Um runtime que falhou exige documento novo em vez de montar outro engine no mesmo Canvas. Veja [HIRES-QA.md](HIRES-QA.md).

## Prova e capturas comparáveis

| Modo | Buffer interno observado | Área de mundo com HUD | Captura |
|---|---|---|---|
| Clássica | 320×200 | 320×168 | [Clássica](hires-evidence/classic.png) |
| Alta | 640×400 | 640×336 | [Alta](hires-evidence/high.png) |

As duas capturas usam Freedoom 0.13.0 E1M1, início da fase, skill 3, apresentação Nítido, mesmo viewport 1180×820 e frame de `gametic=35`. O Canvas SDL/exibição têm o mesmo tamanho nas duas condições. O aumento vem dos buffers e do renderer C, não de aumentar o PNG. O HUD e os sprites continuam vindo do IWAD, sem assets comerciais ou texturas novas. A observação visual mostra mais amostras em bordas/perspectiva do mundo; não constitui playtest ou validação de todas as cenas.

## Medições no executor

[Dados brutos, hashes e limites](hires-evidence/resolution.json), reproduzíveis por `node scripts/measure-resolution.mjs URL DIRETORIO` com preview de produção e sem outros testes simultâneos.

| Backend / cache | Inicialização | rAF p95 | Intervalo SDL p95 | Long tasks |
|---|---:|---:|---:|---:|
| classic / cold | 4.13 s | 33.4 ms | 60.6 ms | 1 |
| classic / warm | 2.10 s | 33.3 ms | 57.8 ms | 0 |
| high / cold | 4.07 s | 33.4 ms | 70.1 ms | 5 |
| high / warm | 2.07 s | 16.7 ms | 38.1 ms | 0 |

Os números são duas amostras por backend em Chromium 141 headless Linux. Intervalo SDL mede callbacks de apresentação/submissão; rAF mede agendamento do browser. Nenhum dos dois é latência física ou tempo da GPU. Não extrapolar para FPS sustentado no iPad. Houve travamentos longos na amostra fria de Alta, incluindo um de 236 ms; a opção permanece explícita e Classic continua disponível. Na amostra quente não houve long tasks. Não se conclui ganho de desempenho a partir dessas poucas amostras; a métrica de qualidade entregue é o aumento real do framebuffer.

Memória total, energia, temperatura, latência Bluetooth e avaliação acústica são **não medidas**. O runtime usa somente um WASM por documento; cachear os dois não instancia os dois heaps. O cache completo medido contém 19 recursos e cerca de 32,33 MiB de execução, incluindo ambos os motores. Fontes correspondentes são download separado.

## Resultado dos testes desta release

- Build Classic e Alta na toolchain Emscripten fixada: aprovado.
- TypeScript/Vite/build offline: aprovado, 19 recursos de execução.
- Testes Node: **16/16 aprovados**, incluindo identidade do runtime versus pins usados pelo build.
- Suíte C de giro com `-Wall -Wextra -Werror`: aprovada.
- Playwright completo: **20/20 aprovados**, dez cenários por browser Chromium/WebKit desktop Linux.
- Cenários Alta dedicados: **4/4 aprovados** nos dois motores, com servidor desligado no teste offline.
- Áudio PCM real em Alta: saída não nula confirmada separadamente em Chromium, além de suspensão/retomada e cobertura de áudio do projeto.
- Revisão independente de código/dados e inspeção visual: aprovadas, sem crítico/alto aberto.

O cenário multiperfil faz três/quatro boots e round-trips de filesystem; tem limite total de 180 s, mantendo o limite de inicialização do motor e os polls de comando. Hashes dos saves são calculados no browser para comparar integridade sem transportar arrays grandes. Um primeiro script de medição não esperava a conclusão da gravação de configurações e acionou o próximo comando no painel anterior; foi corrigido para esperar confirmação/navegação. Essa corrida do harness não foi tratada como falha do renderer.

O workflow de `main` repete build, testes e auditoria antes de publicar. Resultados da URL pública após deploy são registrados nas notas da release.

A suíte Alta verificou duas engines em cada browser desktop: carga real, 640×400/640×336, extensões desativadas, WASD/setas/Shift simultâneos, disparo, suspensão/retomada, cópia Classic→Alta, saves separados, backup v2 com metadata, rejeição de perfil incompatível, restauração v1 e retorno a Classic. O cenário offline prepara apenas Classic, desliga o servidor HTTP, troca para Alta, carrega a cópia, salva, reabre e volta a Classic sem rede. O teste ampliado também verifica munição salva para distinguir um load real de simplesmente reiniciar a mesma fase.

A revisão independente confirmou a cópia nessa cena e o SHA dos originais intacto após salvar em Alta. Isso não promete migração universal de saves, novos formatos, PWADs ou conversão inversa. Conteúdo comercial autorizado continua sendo validação do usuário; só Freedoom foi distribuído/testado aqui.

## Usar e voltar

1. Abra a publicação com conexão, mantenha a aba aberta para baixar a atualização e depois feche todas as instâncias antigas antes de reabrir. Não apague os dados do site.
2. Entre em **Configurações → Resolução do motor → Alta · 640×400 · Crispy Doom** e **Salvar configurações**. Nítido é a opção recomendada para comparar detalhe sem filtros.
3. Se uma partida já estiver ativa, salve antes no menu do DOOM e use **Aplicar nova resolução → Aplicar resolução e reiniciar**. A opção **Retomar resolução atual** mantém a partida anterior sem trocar o runtime.
4. Entre em Jogar ou Carregar jogo e pressione Enter no cartão suspenso. A primeira entrada no perfil Alta vazio copia os saves Classic, preservando os originais.
5. Aguarde preparação offline completa antes de desconectar. Teste reabertura no mesmo browser/perfil/contexto.
6. Para voltar, escolha Clássica, salve a preferência e reinicie pelo mesmo fluxo. Os saves Alta continuam guardados no outro perfil. Exporte backup v2 para conservar ambos.

Rollback de código: reconstruir/publicar a revisão 0.2.0 (`52ba907`) pelo workflow. Não apague os bancos; saves Alta permanecem armazenados, mas a versão antiga não identifica corretamente os perfis e seu importador v1 não aceita os caminhos Alta. Preserve um backup v2 antes do rollback e use 0.3.0 para gerenciar/restaurar esses dados; evite exclusão/exportação dos novos perfis pela interface antiga. Validação física permanece no [checklist iPad](IPAD-CHECKLIST.md).
