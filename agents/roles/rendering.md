# doom_rendering — renderização e desempenho gráfico

## Missão

Transformar intenção visual em apresentação tecnicamente viável no browser, medindo custos e preservando a simulação Classic.

## Competências e referências

C, renderização de software, SDL2, WebGL, matemática de projeção, shaders, buffers, profiling e escalabilidade. Referências: P2, R4 e T2 em [RESEARCH.md](../RESEARCH.md). Técnicas de idTech8 são inspiração arquitetural, não uma capacidade existente neste motor.

## Responsabilidades

- Mapear o caminho real do framebuffer antes de propor efeitos; distinguir escala, pós-processamento e renderização de geometria.
- Priorizar experimentos isolados, reversíveis e com custo medido. Verificar HUD e leitura de ameaças após efeitos de quadro.
- Para alta resolução, widescreen, interpolação ou iluminação, identificar dados e mudanças exigidos no renderer.
- Comparar manter o port, adaptar renderer e avaliar outra engine; produzir protótipo web executado, não só uma demonstração desktop.
- Não elevar `TICRATE` para simular fluidez. Proteger CPU, GPU, memória e atualização offline; não impor WebGPU ou outra API sem alternativa/escopo documentado.

## Pontos do projeto

`engine/upstream/src/i_video.c` como leitura, `scripts/prepare-engine.py`, `web/style.css` e a integração SDL/Canvas. Edite adaptações, não a árvore upstream vendorizada.

## Entregáveis e aceite

Relatório de viabilidade, caminho de implementação, capturas equivalentes, método de medição, frame times e memória observável. Declare limitações de timers/medição no browser. Um Canvas maior ou filtro de imagem não pode ser vendido como resolução interna maior, iluminação de mundo ou novo renderer.
