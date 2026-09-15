# ReadyStaff — vitrine inicial

Plataforma responsiva, em português, com 21 categorias profissionais ilustradas, busca por categoria e orçamento, entrada guiada, autenticação, perfis públicos e editor de perfil com portfólio.

## Baixar
No GitHub: Code > Download ZIP. Extraia o arquivo e mantenha `index.html`, `app.js`, `auth.js` e a pasta `assets` juntos.

## Abrir
Abra index.html no navegador. Não exige instalação ou compilação.

## Cloudflare Pages
Para envio direto, selecione a pasta extraída que contém index.html e app.js.
Para integração Git, escolha este repositório e a branch main como produção, sem framework nem compilação; use a raiz como saída estática.
Confirme a prévia antes de associar readystaff.site pelo painel de domínios personalizados.

## Supabase
O frontend usa `@supabase/supabase-js` 2.116.0 com a chave pública do projeto. O banco mantém perfis privados de clientes, perfis profissionais publicados, preços por categoria, aceite de propostas, portfólio e mídias públicas. Todas as tabelas expostas usam RLS; cada profissional altera somente os próprios dados.

## Escopo e limites
- O cadastro e o login estão disponíveis para clientes e profissionais.
- A abertura do site separa o caminho de contratante e profissional, conduzindo cada público ao formulário adequado.
- Perfis profissionais são publicados imediatamente, sem confirmação obrigatória de e-mail e sem fila de aprovação manual.
- Profissionais aparecem na página inicial e possuem página pública individual.
- O profissional pode editar foto, apresentação, categorias, localização, disponibilidade, Instagram, valor por categoria, aceite de propostas e até três fotos opcionais no portfólio.
- O contratante pode adicionar, trocar ou remover uma foto opcional na própria conta.
- O contratante pode filtrar por profissão e orçamento máximo; o menor valor cadastrado orienta o filtro.
- Pedidos de orçamento, recuperação de senha, avaliações e painel administrativo serão adicionados nas próximas etapas.
- Não processa pagamentos.
- O logotipo oficial e as imagens ilustrativas das categorias ficam na pasta `assets`.
- Nenhum telefone, e-mail comercial, avaliação ou profissional fictício foi publicado.

## Verificações manuais antes da publicação
1. Abrir index.html em desktop e celular.
2. Testar as 21 categorias, filtro de palavra e filtro de orçamento (incluindo ausência de resultados).
3. Testar Limpar filtros.
4. Abrir detalhes, fechar pelo botão e por Escape.
5. Abrir cadastro como cliente e como profissional.
6. Criar uma conta com acesso imediato, entrar, conferir a área da conta e sair.
7. Testar fotos horizontais e verticais no portfólio e a foto opcional do contratante.
8. Navegar por teclado e conferir menu, perguntas e links internos.
9. Confirmar ausência de erros no console.
