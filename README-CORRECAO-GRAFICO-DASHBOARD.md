# Correção do gráfico de evolução semanal

Atualização visual e funcional para o gráfico do Dashboard geral.

## Arquivos alterados

- `js/app.js`
- `css/style.css`

## O que mudou

- O gráfico deixou de ser uma barra pequena simples.
- Agora mostra um painel de evolução semanal com:
  - total inspecionado no período filtrado;
  - quantidade da semana atual;
  - tendência em relação à semana anterior;
  - quantidade total de NC e taxa de NC;
  - barras maiores e legíveis;
  - destaque para a semana com maior volume;
  - marcador visual de NC por semana;
  - respeito aos filtros do dashboard.

## Como aplicar

Substitua os arquivos acima no GitHub, faça commit e depois abra o site com `Ctrl + F5`.

Esta atualização não mexe no Supabase e não altera dados cadastrados.
