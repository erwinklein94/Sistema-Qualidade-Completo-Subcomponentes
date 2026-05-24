# Atualização — Auditoria e perfis de login

Esta atualização não apaga dados do Supabase.

## 1. Rode o SQL no Supabase

No Supabase, acesse **SQL Editor > New query** e rode:

```txt
supabase/2026-05-24-auditoria-perfis.sql
```

Esse SQL cria:

- tabela `auditoria_subcomponentes`;
- triggers de auditoria para empresas, estoque, inspeções e usuários;
- tela segura de leitura da auditoria apenas para `admin`;
- reforço das políticas de perfis:
  - `admin`: vê auditoria, gerencia usuários, cadastra, edita e exclui registros;
  - `qualidade`: cadastra, edita e exclui registros operacionais;
  - `consulta`: apenas visualiza e exporta.

## 2. Substitua os arquivos no GitHub

Substitua estes arquivos no repositório:

```txt
index.html
js/app.js
js/store-supabase.js
```

Não substitua `js/supabase-config.js`, porque esse arquivo já está apontando para o Supabase correto.

## 3. Depois do commit

Aguarde o GitHub Pages atualizar e abra o site com `Ctrl + F5`.

O menu do usuário `admin` vai exibir:

- **Auditoria**;
- **Usuários e perfis**.

Usuários `qualidade` e `consulta` não verão essas telas administrativas.

## 4. Como cadastrar um novo usuário corretamente

1. No Supabase, vá em **Authentication > Users**.
2. Crie o usuário com e-mail e senha.
3. Copie o UID do usuário.
4. No site, entre com um usuário `admin`.
5. Vá em **Usuários e perfis**.
6. Clique em **+ Perfil de usuário**.
7. Cole o UID, informe nome, e-mail, perfil e status ativo.

