# Validação manual em browsers

DOOM Classic Browser é um porte web de Chocolate Doom, com jogabilidade por teclado físico e preparação offline. Este checklist vale para computadores, notebooks e tablets com os recursos de navegador necessários. Registre resultados por combinação de browser, sistema, dispositivo e teclado.

## Identificação do teste

- Browser, versão e motor quando conhecido.
- Sistema operacional e versão; modelo do dispositivo.
- Teclado, layout e conexão (integrado, USB ou Bluetooth).
- Execução em aba ou PWA instalada; versão/commit do app e data.

Os resultados automatizados em Chromium e WebKit desktop Linux estão em [VALIDATION.md](VALIDATION.md). Outros browsers e dispositivos precisam de validação própria. O uso no Chrome do iPad tem um [perfil complementar](IPAD-CHECKLIST.md).

## Início e arquivos

- [ ] Abrir a URL HTTPS e verificar carregamento do motor real.
- [ ] Navegar na interface com setas, Enter e V/Backspace.
- [ ] Iniciar Freedoom E1M1 e retomar com Enter.
- [ ] Desbloquear áudio por teclado; confirmar música e efeitos.
- [ ] Importar IWAD autorizado pelo seletor de arquivos do browser.
- [ ] Reabrir e confirmar conteúdo selecionado e configurações persistidas.

## Jogabilidade e foco

- [ ] WASD individualmente e nas quatro diagonais.
- [ ] Movimento, giro por setas, tiro e corrida simultâneos.
- [ ] Aceleração, velocidade máxima, sensibilidade e soltura da rotação.
- [ ] Neutralização de setas opostas; inversão de direção.
- [ ] Interação, troca de armas e mapa pelo teclado.
- [ ] Menus originais, configurações, nomes de saves e confirmação pelo teclado.
- [ ] Remapeamento sem conflitos e persistente após reabrir.
- [ ] Nenhum scroll indesejado ao usar setas e Espaço durante a partida.
- [ ] Alternativas P, M, J e V funcionam quando atalhos reservados não chegam à página.
- [ ] Trocar de aba/aplicativo e voltar sem teclas presas.
- [ ] Quando aplicável, desconectar/reconectar teclado externo e verificar recuperação.
- [ ] Verificar combinações que o hardware do teclado consegue entregar.
- [ ] Redimensionar a janela ou girar a tela, preservando apresentação e foco.
- [ ] Jogar por pelo menos 15 minutos e registrar fluidez, áudio e latência percebida.

## Saves e offline

- [ ] Salvar com K e confirmar persistência na interface (H).
- [ ] Carregar com L e confirmar o estado da partida.
- [ ] Exportar, excluir e restaurar backup de save.
- [ ] Aguardar “Preparado para offline neste contexto”.
- [ ] Fechar, desligar a conexão e reabrir a mesma URL no mesmo browser/perfil.
- [ ] Iniciar o motor, carregar o save e jogar sem rede.
- [ ] Se houver instalação de PWA, repetir a preparação e validação nesse contexto.
- [ ] Atualizar online, fechar os clientes antigos e verificar a próxima abertura offline.

Cada browser controla quotas, persistência, instalação, atalhos e ativação de áudio. O resultado de um perfil não certifica os demais. Mantenha cópias de IWADs e backups de saves fora do armazenamento do browser.

## Modernização 0.2.0

- [ ] Launcher e opções sem overflow; fluxo completo por setas, Enter, Tab e alternativas de voltar.
- [ ] Presets e Correr continuamente com WASD/setas/Shift simultâneos; Classic continua reversível.
- [ ] Efeito CRT opt-in apresenta cena/HUD corretos; indisponibilidade/perda de contexto restitui Nítido sem parar o motor.
- [ ] Brilho, áudio independente e remapeamentos persistem e entram em backup.
- [ ] Suspensão interrompe tics e áudio; Enter retoma, inclusive em alternância rápida de foco.
- [ ] Atualização preserva dados existentes e ativa somente após fechar os clientes.
- [ ] Reabertura offline mantém as preferências modernas, IWAD e save; avaliar custo gráfico no hardware usado.

## Moderno HD 0.4.0 — validação por dispositivo

- [ ] Registrar browser/sistema, dispositivo, GPU quando conhecida, teclado e contexto (aba/PWA).
- [ ] Em instalação existente, selecionar Moderno HD, salvar e aplicar o reinício. Preferências anteriores não mudam automaticamente.
- [ ] Comparar as quatro resoluções, inclusive 3840×2880, mantendo proporção 4:3 e todos os cards do HUD visíveis.
- [ ] Conferir HD ligado/desligado no Freedoom compatível; o pacote não altera a arte de IWADs com outro hash.
- [ ] Conferir movimento/giro/tiro simultâneos, áudio por Enter e retorno do launcher às configurações após carregar um save.
- [ ] Trocar HUD, resolução e HD com partida salva; carregar novamente após cada reinício.
- [ ] Preparar todo o cache, encerrar o browser, desligar a conexão e iniciar Moderno pela primeira vez; salvar, encerrar e carregar offline.
- [ ] Exportar/restaurar backup v3 e conferir os perfis Moderno/Alta/Clássica separadamente.
- [ ] Observar uma sessão prolongada e vários reinícios; registrar travamentos, encerramentos de aba, atraso, áudio e aquecimento. Qualidade máxima não tem desempenho universal certificado.

Use uma única aba de jogo por contexto. O relatório automatizado distingue Chromium com perfil em disco de WebKit com contexto isolado; nenhum deles substitui os testes físicos acima.
