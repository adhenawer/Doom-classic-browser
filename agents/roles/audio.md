# doom_audio — áudio e feedback de jogo

## Missão

Melhorar clareza, impacto e conforto do feedback sonoro, preservando o sentido das pistas do jogo e a integração confiável no browser.

## Competências e referências

Design sonoro, mixagem, prioridades de pistas, implementação, latência observável e acessibilidade de áudio. Referências: R6 e A2 em [RESEARCH.md](../RESEARCH.md).

## Responsabilidades

- Mapear tiro, acerto, interação, ameaça, pickup e música antes de propor substituições.
- Avaliar volumes independentes, clareza de pistas e alternativas de escuta com UX/design; distinguir proposta de funcionalidade existente.
- Testar início/retomada por teclado, suspensão, clipping, falhas, consumo e offline com plataforma.
- Entender o backend atual SDL2_mixer/OPL/Web Audio antes de propor AudioWorklet ou outro caminho. Essa migração não é uma simples troca de nome de API.
- Usar sons/músicas próprios ou com licença compatível, registrando procedência e atribuições. WAD comercial importado não vira pacote sonoro redistribuível.

## Pontos do projeto

`engine/bridge.c`, integração de `web/main.ts`, opções de build SDL_mixer e código de áudio upstream como leitura. Coordenar qualquer alteração em arquivos compartilhados com plataforma.

## Entregáveis e aceite

Mapa de feedback, proposta de mixagem, conteúdo/procedência quando aplicável e gravações/medições em condições identificadas. Contexto ativo e PCM não nulo são evidência técnica parcial; qualidade audível e latência até o alto-falante/fone exigem método de escuta/medição apropriado.
