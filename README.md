# Sistema de Qualidade — Subcomponentes

Site estático compatível com GitHub Pages para controlar subcomponentes, empresas, estoque e inspeções sem depender de importação de Excel.

## Estrutura

```txt
index.html
css/style.css
js/app.js
assets/data/default-data.json
.nojekyll
```


## Base inicial incorporada

A base inicial está no arquivo `assets/data/default-data.json` e foi gerada a partir da planilha `Estoque Cavan Subcomponentes(2).xlsx`.

Resumo da carga:

- 254 registros de estoque.
- 133 registros de inspeções executadas.
- 7 empresas/fábricas/fornecedores cadastrados automaticamente.
- 18 subcomponentes consolidados após limpeza leve de nomes.
- Período do estoque: 04/02/2025 a 29/04/2026.
- Período das inspeções: 23/10/2025 a 06/05/2026.

Tratamentos aplicados:

- Datas de Excel foram convertidas para formato ISO (`YYYY-MM-DD`).
- Nomes com pequenas variações foram padronizados, como `Ombreira Fast-Clip HFOB08` para `Ombreira FAST-CLIP HFOB08`.
- Registros com `não existe mais em estoque` foram marcados como **Fora do estoque**.
- Registros com observação `Sem inspeção` foram marcados como **Pendente**.
- Códigos SAP foram preenchidos no estoque quando havia correspondência por subcomponente na aba de inspeções.

## Como publicar no GitHub Pages

1. Envie todos os arquivos desta pasta para um repositório no GitHub.
2. Vá em **Settings > Pages**.
3. Em **Build and deployment**, selecione **Deploy from a branch**.
4. Selecione a branch `main` e a pasta `/root`.
5. Abra a URL gerada pelo GitHub Pages.

## Como os dados são salvos

O sistema usa `localStorage`, então os dados ficam no navegador do usuário. A chave atual é `qualidadeSubcomponentes.v2`, para carregar a nova base inicial sem misturar com versões antigas. Isso mantém o site 100% estático e compatível com GitHub Pages.

Para segurança operacional, use a tela **Dados e backup** para baixar backups JSON regularmente. O JSON pode ser restaurado pelo próprio sistema.

## Funcionalidades incluídas

- Dashboard geral com KPIs e gráficos em HTML/CSS/JS puro.
- Cadastro, edição e exclusão de empresas.
- Cadastro, edição e exclusão de entradas/lotes de estoque.
- Cadastro, edição e exclusão de inspeções realizadas.
- Cards consolidados por subcomponente.
- Filtros por empresa, status, subcomponente, semana, lote e busca livre.
- Exportação de backup JSON.
- Exportação CSV de estoque e inspeções.
- Tema claro/escuro.

## Observação importante

Para uso multiusuário com sincronização entre computadores, será necessário evoluir para uma camada de backend, por exemplo Supabase. A versão atual foi feita para cumprir o requisito de funcionar diretamente no GitHub Pages.

## Correção desta versão

- Corrigido o carregamento das abas **Dashboard geral** e **Cards por subcomponente** com a base real da planilha.
- Ajustado o tratamento de listas únicas usadas nos filtros de empresa.
- Adicionado tratamento de erro na renderização para evitar tela presa em “Carregando”.
- Adicionado versionamento no `index.html` para forçar o navegador/GitHub Pages a buscar o JavaScript atualizado.
