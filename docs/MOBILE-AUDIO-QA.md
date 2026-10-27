# Correção de áudio e botão de tiro no mobile

Data: 27/10/2026. Pedido: colocar Atirar à esquerda e corrigir o som no mobile, preservando a qualidade e a entrega por mapa.

## Problemas e alteração

O botão Atirar saiu da grade direita e passou a ficar acima do joystick esquerdo, com alvo separado e respeito às áreas seguras da tela. Ações simultâneas, teclado e as regras nativas de tiro permanecem no mesmo controlador de entrada.

O teclado e os comandos por clique tentavam retomar áudio, mas os joysticks e os botões de ação mantidos pressionados não faziam essa tentativa. A revisão independente reproduziu no Chromium: após suspender o AudioContext real durante a partida, tocar em Atirar deixava o contexto suspenso. Isso comprova uma falha de recuperação; não identifica sozinho a causa de todo silêncio observado em um aparelho físico.

Agora, terminar um toque confiável nos controles chama a retomada de áudio sincronamente, desde que o jogo esteja ativo, visível e fora da preparação de mapas. Touchend mantém a ativação do usuário no Safari. Eventos de movimento e cancelamento não tentam desbloquear áudio. A interface suspensa continua silenciosa.

O Moderno também podia bloquear novas tentativas enquanto uma promessa anterior de resume permanecesse pendente. O host sinaliza somente a duração da chamada realizada no gesto; o controlador pode fazer uma nova tentativa síncrona, sem depender de navigator.userActivation. A deduplicação fora de gestos e a reconciliação de pausas concorrentes permanecem ativas.

Quando disponível, Audio Session recebe a categoria playback dentro do gesto. A API é opcional; ausência ou recusa não impede a chamada de retomada. Essa categoria pode ajudar a reprodução no iOS com o toque de chamadas silenciado, mas seu efeito no aparelho do usuário ainda não foi medido. Não foram adicionados sons silenciosos artificiais ou novas fontes de áudio.

## Verificação

- TypeScript e verificações de diferenças: aprovados.
- Áudio: 17 testes unitários aprovados, incluindo promessa pendente, estados suspended/interrupted, retomadas tardias, pausa concorrente, sessão opcional recusada e limpeza do sinal de gesto após erro.
- Rotação nativa e filas de eventos Classic/High: três verificações aprovadas.
- Suíte Node local: 69 de 70 aprovados; o único erro é ausência do arquivo original modern-hd.000.bin no executor. O gate remoto deve verificar o pacote completo antes de publicar.

### QA independente de navegadores

O agente `lazy_qa`, separado da implementação, executou os oito cenários de `mobile-audio.spec.ts`, `mobile.spec.ts` e `audio-policy.spec.ts`: **8/8 aprovados em Chromium (59,5 s)** e **8/8 em WebKit/WPE (103,7 s)**, sem skips ou retries. Foram usados motores reais, toque emulado com eventos confiáveis e a fixture explicitamente sem HD.

Nos três perfis — Classic, Alta e Moderno — o toque em Retomar iniciou o contexto real; música gerou PCM não nulo. Após suspender diretamente esse AudioContext durante a partida, tocar em Atirar, Mover, Girar ou Usar recuperou `running` e PCM. Esse procedimento reproduz uma suspensão real da API, sem simular ou certificar uma interrupção telefônica do iOS. Também passaram a retomada por toque após entrar em E1M2, a suspensão por orientação vertical e a retomada em paisagem. Tocar nas configurações da interface suspensa não chamou resume nem reativou áudio.

As regressões existentes de comandos simultâneos, cancelamento de ponteiro, nomes de saves, menus, entrada híbrida e política de áudio também passaram. Chromium exercitou múltiplos toques simultâneos pelo protocolo do navegador; isso não representa teste físico.

O botão Atirar ficou inteiramente na metade esquerda, acima do joystick sem sobreposição, com alvo de pelo menos 44 px e centro atingível, nos tamanhos **844×390, 667×375, 568×320 e 1024×768**. A comparação visual de E1M1 em 844×390 confirma a mudança de posição e legibilidade. A evidência visual utilizada é a captura inicial em 844×390; os demais tamanhos têm verificação geométrica dos controles.

Capturas após redimensionar uma partida Classic já aberta apresentaram fundo preto tanto antes quanto depois desta alteração. Sua aparência após resize não está validada visualmente nesta revisão, e não foi atribuída à mudança de controles/áudio. Os estados nativos e a retomada de áudio após rotação passaram; a investigação de captura/renderização após resize não foi ampliada nesta correção. Uma tentativa adicional de produzir quatro capturas com boots consecutivos passou no Chromium, mas atingiu timeout no terceiro boot WebKit; sem diagnóstico conclusivo, esse experimento não integra a aprovação visual nem a suíte de regressão desta mudança.

Os testes locais usam os motores reais e os bytes originais dos mapas, em um pacote de teste explicitamente sem HD. Nenhum pacote reduzido é destinado à publicação. O pipeline de main recompila e verifica todos os assets originais.

### Gate completo de publicação

A execução [40494129828](https://github.com/adhenawer/Doom-classic-browser/actions/runs/40494129828), revisão `926a90a79ca09f216bd2544166f3eb48c9854ebf`, compilou os três motores com o pacote HD integral. Passaram 70 testes Node, 17 Python e as três verificações C. No navegador, passaram **73 de 74**, incluindo todos os cenários mobile dos dois browsers; o deploy ficou bloqueado.

A única falha foi a exigência de zero pageerrors no teste geral Classic/WebKit: três mensagens de access-control em consultas a offline-index.json. A captura mostrava a cena e o menu nativo; o fluxo já havia salvo e carregado a partida. O mesmo cenário passou três vezes localmente sem alteração. O teste fazia um goto redundante imediatamente depois de beforeEach já abrir e configurar o launcher; cancelamento de consultas do documento anterior é uma hipótese, não uma causa confirmada pela evidência do CI.

O helper de teste passou a navegar somente quando recebe uma URL explícita, reaproveitando o launcher preparado no cenário de entrada. A exigência de zero erros e todas as verificações de jogo foram mantidas. Os testes específicos de navegação, reload durante instalação e reabertura offline continuam ativos. Esse ajuste não altera o produto nem filtra mensagens de erro; uma nova execução integral é necessária antes da publicação.

Após o ajuste, a revisão independente aprovou o cenário de entrada três vezes no WebKit (41,0 s), uma no Chromium (7,4 s) e a reabertura Classic offline no WebKit com URL explícita e servidor desligado (9,9 s).

## Limites e reversão

Contexto running e PCM não nulo comprovam reprodução técnica no navegador; não comprovam som audível, volume do sistema, rota Bluetooth ou qualidade no alto-falante. Chromium/WebKit em Linux com toque emulado não certificam um iPhone/iPad físico. Não houve redução de resolução, textura, áudio ou conteúdo.

Para reverter esta correção, restaure o código da revisão fcb1b8cd0fd2020270436d62ba1015bd94a419b7 e execute o pipeline normal de publicação. Preserve os bancos, caches de conteúdo e saves; a alteração não exige migração dos dados.
