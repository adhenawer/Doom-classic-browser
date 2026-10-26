# Preparação da partida e conteúdo HD

O relato no iPhone chegou à parte 4/12: o toque iniciava o motor, mas o retorno no rodapé e a contagem por partes não explicavam a espera. O pacote tem 398.681.345 bytes. O carregamento agora aparece em painel sobre a página, com etapa, bytes/percentual real, tempo transcorrido e taxa média de leitura quando a resposta vem de fetch. Respostas do cache identificado são apresentadas como leitura local; fetch pode também ser atendido pelo Service Worker, portanto a taxa não é anunciada como velocidade da conexão.

A primeira instalação pode estar preparando o cache em paralelo. O jogo mantém a espera pelo instalador para evitar baixar o pacote duas vezes; nessa etapa o indicador é indeterminado, com tempo transcorrido. A inicialização dos gráficos também é indeterminada. Não há percentual ou previsão de término inventados.

Cada parte é lida por stream diretamente em sua faixa do buffer final. Tamanho e SHA-256 continuam obrigatórios antes de entregar o pacote ao motor. Isso elimina a cópia intermediária explícita de uma parte de até 32 MiB, sem reduzir qualidade ou tamanho do download. Não foi medida melhoria de tempo total ou pico de memória em iPhone físico.

Validação local: três testes de streaming (faixa do buffer, progresso, truncamento/excesso/corrupção e falha de rede), TypeScript e Vite aprovados. WebKit com perfil iPhone 13 aprovou partida Classic, partida Modern sem HD e feedback/recuperação de erro de download; um quarto cenário aprovou o painel em retrato e paisagem. Capturas de 120/398,7 MB usam uma amostra controlada do componente real, não um download HD medido. O pacote HD completo é validado no pipeline de publicação.

O overlay impede interação com a interface durante a preparação e apresenta retorno explícito em caso de erro. Não altera bancos, saves, conteúdo, simulação ou qualidade. Rollback: reverter o commit de loading; os arquivos de jogo e dados locais continuam compatíveis.
