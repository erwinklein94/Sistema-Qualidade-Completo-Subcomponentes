# Atualização — Cadastro de Materiais

Esta atualização adiciona a tela **Materiais** no menu **Cadastros**.

## Ordem correta para aplicar

1. No Supabase, abra **SQL Editor > New query**.
2. Cole e rode o conteúdo do arquivo:

   `supabase/2026-05-24-materiais-subcomponentes.sql`

3. Depois substitua no GitHub os arquivos:

   - `index.html`
   - `js/app.js`
   - `js/store-supabase.js`
   - `css/style.css`

4. Faça **Commit changes**.
5. Aguarde o GitHub Pages atualizar.
6. Abra o site e pressione **Ctrl + F5**.

## O que muda

A tela **Materiais** permite cadastrar:

- Fornecedor
- Sub-componente
- Código SAP
- Tipo de material
- Criticidade
- Norma
- Plano de amostragem
- Nível de inspeção
- ETM

## Segurança

A tabela nova respeita os mesmos perfis:

- `admin`: cadastra, edita, exclui, vê auditoria e gerencia usuários.
- `qualidade`: cadastra, edita e exclui materiais.
- `consulta`: apenas visualiza.

A auditoria registra INSERT, UPDATE e DELETE na tabela `materiais_subcomponentes`.

## Importante

Esta atualização não apaga nenhum dado existente do Supabase. Ela apenas cria uma nova tabela e atualiza o site para usá-la.
