# Sistema de Qualidade — Subcomponentes com Supabase

Esta versão foi adaptada para funcionar como o modelo do **Sistema de Qualidade de Dormentes**, usando Supabase como banco central e GitHub Pages como hospedagem estática.

## O que mudou nesta versão

- Inclusão de login com Supabase Auth.
- Leitura e gravação no Supabase em vez de somente `localStorage`.
- Tabelas próprias para subcomponentes:
  - `empresas_subcomponentes`
  - `estoque_subcomponentes`
  - `inspecoes_subcomponentes`
- Controle de perfis pela tabela `usuarios_app`.
- Backup JSON e exportações CSV continuam funcionando.
- Se o Supabase não carregar, o sistema informa o erro em vez de ficar preso em “Carregando”.

## Arquivos importantes

```txt
index.html
login.html
css/style.css
js/supabase-config.js
js/auth.js
js/store-supabase.js
js/app.js
assets/data/default-data.json
supabase/2026-05-24-subcomponentes.sql
```

## Configuração do Supabase

### 1. Rodar o SQL

No Supabase, abra **SQL Editor** e rode o arquivo:

```txt
supabase/2026-05-24-subcomponentes.sql
```

Esse arquivo cria as tabelas, políticas RLS e funções necessárias.

### 2. Criar o primeiro usuário

No Supabase:

1. Vá em **Authentication > Users**.
2. Clique em **Add user**.
3. Informe e-mail e senha.
4. Depois de criar, copie o **UID** do usuário.
5. Volte ao **SQL Editor** e rode um cadastro como este, trocando os dados:

```sql
insert into public.usuarios_app (id, nome, email, perfil, ativo)
values ('UUID_DO_USUARIO_AUTH', 'Nome do Usuário', 'email@empresa.com', 'admin', true)
on conflict (id) do update
set nome = excluded.nome,
    email = excluded.email,
    perfil = excluded.perfil,
    ativo = excluded.ativo,
    atualizado_em = now();
```

Perfis disponíveis:

- `admin`: lê, cadastra, edita e exclui.
- `qualidade`: lê, cadastra, edita e exclui registros operacionais.
- `consulta`: apenas lê.

### 3. Conferir `js/supabase-config.js`

O arquivo já está no mesmo padrão do sistema de dormentes. Se for usar outro projeto Supabase, troque:

```js
url: 'SUA_PROJECT_URL',
publishableKey: 'SUA_PUBLISHABLE_KEY'
```

Use somente a **Publishable key**. Nunca coloque `service_role`, senha do banco ou connection string no navegador.

## Como carregar a base inicial no Supabase

Depois de entrar no site com usuário `admin` ou `qualidade`:

1. Abra **Dados e backup**.
2. Clique em **Recarregar base inicial**.
3. Confirme a ação.

Com o Supabase ativo, esse botão limpa as tabelas de subcomponentes e envia a base inicial do arquivo `assets/data/default-data.json` para o banco.

## Como cadastrar corretamente

### 1. Cadastre ou confira a empresa

Abra **Empresas > Nova empresa**.

Preencha:

- **Nome da empresa**: use sempre o mesmo nome, sem variações.
- **Tipo**: Fornecedor, Fábrica ou Fornecedor e fábrica.
- **Status**: use `Ativa` para empresas em uso.

Evite cadastrar a mesma empresa com nomes diferentes, por exemplo `Cavan`, `CAVAN` e `Cavan Ltda.`. Escolha um padrão e mantenha.

### 2. Cadastre o estoque

Abra **Estoque > Novo lançamento de estoque**.

Campos principais:

- **Data de entrada**: data em que o material entrou no estoque.
- **Empresa/Fábrica**: selecione/digite exatamente o nome cadastrado em Empresas.
- **Subcomponente**: use um padrão fixo de nome. Exemplo: `Ombreira FAST-CLIP HFOB08`.
- **Código SAP**: informe quando existir.
- **Lote**: este é o campo mais importante para cruzar com inspeções.
- **Quantidade de entrada**: quantidade recebida.
- **Saldo atual**: quantidade que ainda está disponível.
- **Amostragem**: quantidade prevista para amostra, quando aplicável.
- **Status do estoque**: normalmente `Pendente`, `Em análise`, `Inspecionado` ou `Fora do estoque`.

Boa prática: para o mesmo lote e subcomponente, mantenha o lote escrito sempre igual. Exemplo: se usou `BAG-001`, não cadastre depois como `BAG 001`.

### 3. Cadastre a inspeção

Abra **Inspeções realizadas > Nova inspeção**.

Campos principais:

- **Dia da inspeção**: a semana é preenchida automaticamente.
- **Subcomponente/Material**: escreva igual ao cadastro de estoque.
- **Fornecedor/Empresa**: use a mesma empresa vinculada ao lote.
- **Lote/BAG**: escreva igual ao lote cadastrado no estoque.
- **QTD Estoque**: quantidade do lote no momento da inspeção.
- **QTD Amostra**: quantidade definida para amostra.
- **QTD Inspecionado**: quantidade efetivamente inspecionada.
- **QTD NC**: quantidade não conforme. Use `0` quando não houver NC.
- **Status**: escolha `Aprovado`, `Aprovado com ressalva`, `Reprovado`, `Pendente` ou `Em análise`.

A tela de Dashboard cruza estoque e inspeção principalmente por **Subcomponente + Lote**. Se esses dois campos forem escritos de formas diferentes, o sistema entende como registros separados.

## Publicar no GitHub Pages

1. Envie todos os arquivos desta pasta para o repositório.
2. Vá em **Settings > Pages**.
3. Escolha **Deploy from a branch**.
4. Selecione a branch `main` e a pasta `/root`.
5. Acesse a URL publicada.

## Teste rápido depois da publicação

1. Abra o site publicado.
2. Faça login.
3. Cadastre uma empresa teste.
4. Cadastre um estoque com lote teste.
5. Cadastre uma inspeção com o mesmo subcomponente e lote.
6. Confira se o Dashboard atualiza.
7. No Supabase, abra **Table Editor** e veja se os registros apareceram nas tabelas.

## Solução de problemas

- **Login feito, mas sem acesso**: o usuário existe em Auth, mas não foi cadastrado em `usuarios_app` ou está `ativo = false`.
- **Erro de RLS/permissão**: o perfil provavelmente é `consulta`; use `admin` ou `qualidade` para cadastrar.
- **Tabelas não encontradas**: rode o SQL `supabase/2026-05-24-subcomponentes.sql`.
- **Dados não aparecem para outro usuário**: confirme que ambos estão no mesmo projeto Supabase e que `js/supabase-config.js` foi publicado atualizado.
- **Dashboard separa lote que deveria ser igual**: padronize o campo lote e o nome do subcomponente em estoque e inspeção.
