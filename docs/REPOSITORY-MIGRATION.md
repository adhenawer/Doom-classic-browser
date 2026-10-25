# Mudança do nome do repositório e do endereço publicado

Destino do repositório: `adhenawer/Doom-classic-browser`.

Destino do jogo: https://adhenawer.github.io/Doom-classic-browser/

## Publicação

1. Renomear o repositório em Settings → General → Repository name.
2. Confirmar que Settings → Pages continua usando GitHub Actions.
3. Atualizar o remote Git para `https://github.com/adhenawer/Doom-classic-browser.git` e os links da documentação.
4. Executar o workflow de build, testes e publicação e verificar a nova URL.
5. Atualizar os links das releases e a homepage do repositório, conforme as permissões administrativas disponíveis.

O GitHub pode redirecionar links do repositório antigo. O endereço do site no Pages deve ser verificado separadamente: use o novo caminho publicado, sem depender de redirecionamento do endereço anterior.

## Para quem já jogava no endereço antigo

1. Exporte um backup de saves e configurações pela interface e mantenha cópia local do IWAD.
2. Feche as abas do jogo antigo.
3. Abra a nova URL online no mesmo browser e perfil.
4. Confirme conteúdo, preferências e saves; importe seu backup se o contexto do browser for diferente.
5. Aguarde “Preparado para offline neste contexto” e teste a reabertura sem conexão na nova URL.
6. Se usar PWA instalada, adicione a nova URL e valide esse contexto antes de remover o atalho antigo.

Os nomes de armazenamento existentes são preservados. Como a origem `https://adhenawer.github.io` continua igual, o mesmo contexto do browser pode acessar os dados existentes. A política de armazenamento e o isolamento entre aba e PWA dependem do browser. Caches e escopos de Service Worker são específicos do caminho: preparar o endereço antigo não prepara automaticamente o novo.

O perfil Chrome no iPad continua documentado como um dos ambientes de uso do porte para browsers.
