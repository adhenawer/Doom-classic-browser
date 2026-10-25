# Controles, conforto e mixagem — M30/M40/M70

## Resultado implementado

O controlador de giro continua no motor C, em comandos a 35 Hz. Três presets escolhem parâmetros do mesmo controlador; não dependem da repetição de teclas do sistema:

| Preset | Inicial °/s | Aceleração °/s² | Máxima °/s | Sensibilidade | Soltura |
|---|---:|---:|---:|---:|---|
| Clássico | 60 | 360 | 180 | 1 | Imediata |
| Precisão | 35 | 240 | 150 | 1 | Imediata |
| Ágil | 95 | 540 | 240 | 1 | Imediata |

Os valores são decisões de design para comparação pelo jogador, não resultados de uma pesquisa em hardware. Todos podem ser substituídos pelos controles numéricos existentes. WASD e giro por setas permanecem independentes. Setas opostas e reset mantêm as regras anteriores.

## Fatia Modern de conforto

O perfil `classic-v1` é o padrão: Shift seleciona a velocidade de corrida. O perfil `comfort-v1` é opt-in por **Sempre correr**: Shift seleciona a caminhada. `_web_comfort` inverte somente a ação lógica Shift antes de o motor construir o comando. As velocidades vanilla (avanço 25/50; deslocamento lateral 24/40), colisões, armas, monstros e relógio lógico permanecem os mesmos.

O reset limpa o Shift físico e restaura apenas o valor padrão da ação de corrida do perfil. Nenhuma direção, tiro ou interação fica pressionada. Alterar o perfil não cria deslocamento sozinho. O autorun tradicional por `joybspeed` não foi usado porque impediria Shift de escolher caminhada.

Os dois perfis produzem comandos vanilla e compartilham o mesmo formato de save e o diretório existente `/persist/saves/<hash>/`. Isso permite retomar um save Classic e desativar conforto sem migração de dados. Uma futura mudança de regras (pulo, colisão, dano, IA ou câmera) exigirá outro identificador e estratégia de dados antes de ser habilitada. Não há mira vertical livre nesta entrega.

## Áudio e feedback

Música e efeitos têm volumes independentes de 0 a 15, incluindo mute. `_web_mix(sfx,music)` limita os valores e usa `S_SetSfxVolume` e `S_SetMusicVolume` com a mesma escala `valor × 8` dos menus nativos do DOOM. Os valores `sfxVolume`/`musicVolume` do motor são atualizados juntos para manter os sliders nativos coerentes. As preferências web são persistidas e reaplicadas ao iniciar ou salvar as configurações; ajustes feitos no menu nativo permanecem ativos ao suspender/retomar e são copiados às preferências quando o jogador volta à interface com H.

A atenuação OPL original em volume zero mantém um pequeno resíduo. O build web faz um gate somente da contribuição musical nesse caso, preservando a síntese/tempo e os efeitos no mixer. Ao suspender a partida, Web Audio também é suspenso. Pedidos assíncronos de áudio reconciliam a última intenção de suspensão/retomada; uma interrupção do sistema sem mudança de intenção não inicia tentativas em loop.

O conteúdo sonoro continua o do IWAD ativo. Freedoom conserva seus créditos e licença; nenhum som de DOOM comercial ou de jogos modernos foi copiado. Não foi introduzida compressão, equalização, novos sons, audio-worklet ou telemetria. Entrar/retomar por Enter continua tentando desbloquear Web Audio quando permitido pelo browser.

Pistas existentes: disparos e impacto informam ação/combate; monstros informam ameaças; portas e pickups confirmam interação; música estabelece atmosfera. A opção de reduzir música sem reduzir efeitos busca facilitar a identificação dessas pistas. Qualidade de escuta, clipping acústico e latência Bluetooth→alto-falante precisam de validação humana em dispositivo; PCM não nulo não comprova esses critérios.

## Persistência e validação

`web/preferences.ts` migra configurações antigas em memória, preservando remapeamentos válidos e parâmetros de giro. Campos novos ausentes recebem `alwaysRun=false`, efeitos 8 e música 6. Importações e backups limitam valores finitos, volumes inteiros e coerência entre velocidade inicial e máxima. O banco existente não muda. O arquivo de backup versão 1 admite esses campos adicionais em `settings`; backups antigos recebem os defaults.

Testes unitários verificam migração, dados inválidos e reversibilidade dos presets. A validação no motor real deve comparar comandos de caminhada/corrida com e sem Shift, reset/foco, menu, volumes, saves, retorno e offline. A instrumentação somente leitura adiciona seletores `_web_state(14)` perfil autorun, `(15)` efeitos e `(16)` música. Resultados de integração e revisão independente ficam no relatório de release do coordenador.

## Rollback

Desative **Sempre correr**, escolha **Clássico** e restaure os volumes desejados. Nenhuma conversão de WAD ou save é necessária. Reverter os arquivos do port e reconstruir o WASM remove as extensões; configurações adicionais não são executáveis e podem ser ignoradas por uma versão anterior.

## Proposta de regras Modern posteriores — M70

O protótipo entregue é `comfort-v1`: conforto de entrada, sem novas regras. Para uma futura variante de combate, a hipótese é **Assistência**: reduzir dano recebido para 75% do valor vanilla, mantendo monstros, mapas, armas e velocidade. Isso exige playtest; não é uma melhoria comprovada nem está habilitado nesta release. Pulo, mira vertical e alterações de colisão ficam fora dessa hipótese.

Antes de implementar a variante, identificar `assist-v2` e a revisão do motor em um manifesto de perfil, separar seus saves por perfil e atualizar backup/validação explicitamente — o formato atual de caminhos não deve ser ampliado silenciosamente. Nunca carregar um save de outra regra por coincidência de nome. Um protótipo deve usar somente Freedoom, comparar dano/cena/dificuldade fixos, provar retorno ao Classic sem alterar seus dados e validar cache/fontes da variante. Essa é uma decisão de evolução, não uma promessa de que o preset de giro já oferece novas mecânicas.
