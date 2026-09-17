# ReadyStaff — plataforma de serviços para eventos

Plataforma em português com abertura explicativa, navegação própria para celular, busca por categoria, cidade e orçamento, contas de contratantes e profissionais, perfis, portfólio e pedidos de orçamento.

## Páginas
- `index.html`: apresentação do serviço e escolha entre contratante e profissional; não carrega o catálogo nem a lista de perfis.
- `encontrar.html`: categorias sem fotos, filtros e resultados para contratantes conectados.
- `quem-somos.html`, `como-funciona.html`, `ajuda.html`: conteúdo institucional e orientações.
- `privacidade.html`, `termos.html`: uso de dados e regras da plataforma.
- `painel.html`, `perfil.html`: áreas existentes preservadas, com navegação e acabamento visual atualizados.
- `base.css`: estilos originais extraídos; `platform.css`: visual e adaptação ao celular; `site.js`: menu e links legados.

## Pendência institucional
O responsável deve fornecer a identificação jurídica do controlador e um canal oficial para solicitações de privacidade. A política descreve a operação observada, mas esses dados não foram inventados. O conteúdo jurídico deve ser validado pelo responsável antes de ser considerado uma política definitiva de conformidade.

## Baixar
No GitHub: Code > Download ZIP. Extraia o arquivo e mantenha `index.html`, `app.js`, `auth.js` e a pasta `assets` juntos.

## Abrir
Sirva a pasta por HTTP, por exemplo com `python -m http.server 8765`. Os módulos de autenticação precisam de um servidor; não use `file://`. Não exige instalação ou compilação para publicar.

## Cloudflare Pages
Para envio direto, selecione a pasta extraída que contém index.html e app.js.
Para integração Git, escolha este repositório e a branch main como produção, sem framework nem compilação; use a raiz como saída estática.
Confirme a prévia antes de associar readystaff.site pelo painel de domínios personalizados.

## Supabase
O frontend usa `@supabase/supabase-js` 2.116.0 com a chave pública do projeto. O banco mantém perfis privados de clientes, perfis profissionais publicados, preços por categoria, aceite de propostas, portfólio e mídias públicas. Todas as tabelas expostas usam RLS; cada profissional altera somente os próprios dados.

### Avisos de pedidos e conversas
Atualização autorizada: função ampliada implantada e disparadores de conversas reativados pela migration `activate_conversation_notifications`. Os avisos anteriores de orçamento permanecem ativos. A presença de parâmetros não comprova aprovação do modelo pela Meta nem entrega de mensagens: conferir o diagnóstico administrativo e testar com contas próprias.

As migrations em `supabase/migrations` criam preferências protegidas e uma fila transacional. A Edge Function `process-notifications` tenta o WhatsApp primeiro, quando o usuário deu consentimento, e usa o e-mail como alternativa. Nenhuma chave secreta fica no frontend ou no repositório.

Segredos esperados na Edge Function:

- `RESEND_API_KEY` e `READYSTAFF_EMAIL_FROM` para e-mail.
- `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_TEMPLATE_NEW_QUOTE` e `WHATSAPP_TEMPLATE_QUOTE_UPDATE` para WhatsApp.

Os modelos aprovados do WhatsApp devem usar três variáveis no aviso de novo orçamento (nome, categoria e URL do painel) e quatro no aviso de atualização (nome, categoria, situação e URL do painel), no idioma `pt_BR`.

Mensagens, propostas, respostas e confirmações de serviço geram avisos ao outro participante na mesma transação do cadastro. `WHATSAPP_TEMPLATE_CONVERSATION_UPDATE` pode definir um modelo próprio com as mesmas quatro variáveis; na ausência dele, usa-se o modelo de atualização. O conteúdo privado da mensagem não é enviado ao provedor: o aviso direciona ao painel.

O envio é iniciado após ações no site. Um painel visível verifica avisos elegíveis a cada minuto. Falhas têm espera progressiva e limite de cinco tentativas; um administrador pode repetir somente avisos com falha ou configuração pendente. Não há agendamento independente com o painel fechado. O diagnóstico administrativo mostra somente indicadores de configuração, nunca segredos. Status `sent` significa aceite pela API, não confirmação de entrega ou leitura.

## Escopo e limites
### SEO e tráfego orgânico
`robots.txt`, `sitemap.xml` e `llms.txt` são públicos. O sitemap contém somente páginas editoriais canônicas, sem contas, conversas ou perfis. Não bloquear páginas privadas em robots: buscadores precisam ler seu `noindex`; segurança continua dependendo da autenticação e das políticas existentes.

`servicos.html` apresenta as 22 categorias únicas sem exigir login, com orientações para contratação. Bar de Drinks para Eventos representa o serviço com estrutura, separado de Bartender e Barman; os itens incluídos são combinados no orçamento. A atualização aditiva do catálogo está em `supabase/seeds/bar-drinks.sql`, sem mudanças de estrutura, permissões ou ofertas existentes. Os links do rodapé permitem sua descoberta. JSON-LD identifica a organização, o site e páginas públicas, sem avaliações, endereços, contatos ou preços inventados. `llms.txt` é opcional e não é um fator de ranking do Google.

Pendências externas: adicionar propriedade de domínio `readystaff.site` no Google Search Console, gerar o TXT de verificação, adicioná-lo ao DNS e enviar `sitemap.xml`. Não inventar o código de verificação. Analytics ainda não foi instalado: requer propriedade/ID reais e definição de controles de privacidade. Nenhuma promessa de ranking, indexação ou volume de palavras-chave. Páginas individuais por categoria/cidade e calendário editorial são a próxima etapa, após dados de demanda e atuação reais.

Verificar com `node tests/seo-check.mjs` e `node tests/navigation-check.mjs`.

- O cadastro e o login estão disponíveis para clientes e profissionais.
- A abertura explica o serviço e termina nos dois caminhos de cadastro, sem abrir um modal automaticamente.
- Perfis profissionais são publicados imediatamente, sem confirmação obrigatória de e-mail e sem fila de aprovação manual.
- Os resultados ficam em `encontrar.html`; a interface da busca exige uma conta de contratante. A separação visual não altera as regras de acesso do banco: perfis e mídias que já eram públicos continuam sujeitos às políticas existentes.
- O profissional pode editar foto, apresentação, categorias, localização, disponibilidade, Instagram, valor por categoria, aceite de propostas e até três fotos opcionais no portfólio.
- O contratante pode adicionar, trocar ou remover uma foto opcional na própria conta.
- O contratante pode filtrar por profissão e orçamento máximo; o menor valor cadastrado orienta o filtro.
- Pedidos de orçamento, painéis por tipo de conta, recuperação de senha e exclusão da própria conta estão implementados, sem alterar os uploads opcionais.
- Novas avaliações recíprocas exigem pedido aceito, data anterior ao dia atual em Brasília e confirmação de conclusão pelas duas partes. Avaliações anteriores são preservadas.
- Cada pedido oferece conversa privada, propostas com resposta do destinatário e relatos de problemas. Propostas não alteram o pedido original nem processam pagamento. Conversas abertas atualizam a cada 30 segundos; avisos externos respeitam as preferências e a configuração dos provedores.
- Contratantes podem salvar favoritos e filtrar por data (bloqueios informados, não garantia de disponibilidade), avaliação, categoria, cidade e valor, ordenando por preço ou nota.
- Profissionais podem bloquear períodos na agenda e consultar orientações de preenchimento do perfil. Fotos continuam opcionais.
- O painel administrativo em `admin.html` monitora contas, avaliações, relatos e a fila de notificações. Exige `app_metadata.readystaff_admin = true`, definido exclusivamente por administração confiável. Nenhuma conta recebe essa permissão automaticamente; não use `user_metadata` nem campos de cadastro para concedê-la.
- Não processa pagamentos.
- O logotipo oficial e duas imagens editoriais otimizadas ficam na pasta `assets`.
- Nenhum telefone, e-mail comercial, avaliação ou profissional fictício foi publicado.

## Verificações manuais antes da publicação
Verificação local: `node tests/navigation-check.mjs` confere links, âncoras, elementos usados pelo cadastro, filtros e a regressão do envio direto de fotos até 5 MB. Não cria contas nem altera dados.
1. Abrir index.html em desktop e celular.
2. Testar as 22 categorias, filtro de palavra e filtro de orçamento (incluindo ausência de resultados).
3. Testar Limpar filtros.
4. Abrir detalhes, fechar pelo botão e por Escape.
5. Abrir cadastro como cliente e como profissional.
6. Criar uma conta com acesso imediato, entrar, conferir a área da conta e sair.
7. Testar fotos horizontais e verticais no portfólio e a foto opcional do contratante.
8. Navegar por teclado e conferir menu, perguntas e links internos.
9. Confirmar ausência de erros no console.
