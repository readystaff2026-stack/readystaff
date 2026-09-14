# ReadyStaff — vitrine inicial

Plataforma responsiva, em português, com oito categorias ilustradas, filtro por categoria/palavra, cadastro de clientes e profissionais, autenticação e área inicial da conta.

## Baixar
No GitHub: Code > Download ZIP. Extraia o arquivo e mantenha `index.html`, `app.js`, `auth.js` e a pasta `assets` juntos.

## Abrir
Abra index.html no navegador. Não exige instalação ou compilação.

## Cloudflare Pages
Para envio direto, selecione a pasta extraída que contém index.html e app.js.
Para integração Git, escolha este repositório e a branch main como produção, sem framework nem compilação; use a raiz como saída estática.
Confirme a prévia antes de associar readystaff.site pelo painel de domínios personalizados.

## Supabase
O frontend usa `@supabase/supabase-js` 2.116.0 com a chave pública do projeto. O banco mantém perfis privados de clientes, perfis profissionais com aprovação, categorias e vínculos entre profissionais e categorias. Todas as tabelas expostas usam RLS.

## Escopo e limites
- O cadastro e o login estão disponíveis para clientes e profissionais.
- Perfis profissionais começam com status `pending` e dependem de aprovação administrativa.
- Busca pública de profissionais, portfólio, pedidos de orçamento, recuperação de senha e painel administrativo serão adicionados nas próximas etapas.
- Não processa pagamentos.
- O logotipo oficial e as imagens ilustrativas das categorias ficam na pasta `assets`.
- Nenhum telefone, e-mail comercial, avaliação ou profissional fictício foi publicado.

## Verificações manuais antes da publicação
1. Abrir index.html em desktop e celular.
2. Testar as oito categorias e filtro de palavra (incluindo ausência de resultados).
3. Testar Limpar filtros.
4. Abrir detalhes, fechar pelo botão e por Escape.
5. Abrir cadastro como cliente e como profissional.
6. Confirmar e-mail, entrar, conferir a área da conta e sair.
7. Navegar por teclado e conferir menu, perguntas e links internos.
8. Confirmar ausência de erros no console.
