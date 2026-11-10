# Moon3D — Gestão financeira de impressão 3D

Aplicação web estática para registrar compras, vendas, orçamentos, produtos, itens adicionais e custos. Identidade visual baseada na logo enviada: verde-limão, preto, grafite e branco.

## Publicação

O workflow em `.github/workflows/deploy.yml` publica automaticamente a pasta raiz pelo GitHub Pages.

1. No repositório, abra **Settings → Pages**.
2. Em **Build and deployment → Source**, selecione **GitHub Actions**.
3. Faça um push em `main` ou execute o workflow manualmente em **Actions**.
4. O endereço do site será `https://moon3doficial-netizen.github.io/moon3d/`.

## Supabase já configurado

- Projeto: `moon3d`
- Região: São Paulo (`sa-east-1`)
- E-mail compartilhado: `moon3d.oficial@gmail.com`
- A URL e a chave pública já estão em `supabase-config.js`.
- A tabela `public.moon3d_state` já foi criada.
- RLS restringe leitura e gravação ao JWT cujo e-mail é `moon3d.oficial@gmail.com`.

**Não inclua neste repositório senhas, service_role keys, secret keys ou senha do banco.** A chave publishable é pública por definição e só deve ser usada junto das políticas RLS.

## Configuração final do Auth

No Supabase, abra **Authentication → Sign In / Providers** e desative o cadastro público de novos usuários. A conta autorizada já foi criada e confirmada.

Em **Authentication → URL Configuration**, configure:
- Site URL: `https://moon3doficial-netizen.github.io/moon3d/`
- Redirect URL permitida: `https://moon3doficial-netizen.github.io/moon3d/**`

A aplicação usa senha compartilhada e validação pelo Supabase Auth. A senha não fica neste repositório.

## Estrutura técnica

- `index.html`: estrutura da aplicação
- `loader.js`: carrega e descompacta assets no navegador
- `app.js.gz`: JavaScript da aplicação comprimido
- `styles.css.gz`: estilos comprimidos
- `supabase-config.js`: URL, chave pública e e-mail da conta compartilhada
- `supabase/schema.sql`: schema e políticas RLS

## Estado da implementação

Esta é uma versão inicial para teste. A base de autenticação e a sincronização inicial estão conectadas ao Supabase. Antes de usar com dados reais, é necessário concluir e validar funcionalidades ainda pendentes, incluindo filtros completos, seleção de produtos padrão e suas variações em vendas/orçamentos, composição e quantidade de itens adicionais, cálculo e apresentação completa do preço sugerido e exportação/recuperação de backup Excel.

O modelo atual sincroniza o estado em um único documento JSON. Não é recomendado que várias pessoas editem simultaneamente, pois uma gravação pode sobrescrever outra.

## Segurança

- Acesso anônimo à tabela bloqueado por RLS.
- Apenas o e-mail compartilhado é autorizado nas políticas da tabela.
- O cadastro público deve permanecer desativado.
- Nunca armazene credenciais privadas em arquivos do site.
