# Ajuste do dashboard - Saldo em estoque

Correção aplicada para evitar corte em números grandes no card **Saldo em estoque**.

## O que mudou

- O bloco de KPIs do dashboard ganhou uma grade dedicada (`dashboard-kpis`).
- O card **Saldo em estoque** agora tem mais largura visual e destaque, mantendo o padrão Rumo.
- Os números usam `clamp()`, espaçamento ajustado e `white-space: nowrap` para não quebrar nem cortar.
- Foram adicionadas regras responsivas para desktop, tablet e celular.
- O tema escuro também foi ajustado para esse card.

A lógica, banco de dados e regras de negócio não foram alterados.
