/* =====================================================================
   STORE-SUPABASE.JS — Subcomponentes
   Camada de leitura/gravação no Supabase.
   ===================================================================== */

const StoreSubcomponentesSupabase = (() => {
  const TABLES = {
    empresas: 'empresas_subcomponentes',
    estoque: 'estoque_subcomponentes',
    inspecoes: 'inspecoes_subcomponentes'
  };

  function db() {
    const c = window.Auth?.cliente?.() || window.SUPABASE_CLIENTE;
    if (!c) throw new Error('Supabase não configurado.');
    return c;
  }

  function clean(value) {
    const s = String(value ?? '').trim();
    return s || null;
  }

  function n(value) {
    const num = Number(value ?? 0);
    return Number.isFinite(num) ? num : 0;
  }

  function fromEmpresa(r) {
    return {
      id: r.id,
      nome: r.nome || '',
      tipo: r.tipo || 'Fornecedor',
      cidade: r.cidade || '',
      contato: r.contato || '',
      status: r.status || 'Ativa',
      observacao: r.observacao || ''
    };
  }

  function toEmpresa(r) {
    return {
      id: r.id,
      nome: clean(r.nome),
      tipo: clean(r.tipo) || 'Fornecedor',
      cidade: clean(r.cidade),
      contato: clean(r.contato),
      status: clean(r.status) || 'Ativa',
      observacao: clean(r.observacao)
    };
  }

  function fromEstoque(r) {
    return {
      id: r.id,
      data: r.data || '',
      empresaId: r.empresa_id || '',
      empresaNome: r.empresa_nome || '',
      subcomponente: r.subcomponente || '',
      codSap: r.cod_sap || '',
      lote: r.lote || '',
      quantidadeEntrada: n(r.quantidade_entrada),
      saldoAtual: n(r.saldo_atual),
      amostragem: n(r.amostragem),
      statusEstoque: r.status_estoque || 'Pendente',
      dataInspecao: r.data_inspecao || '',
      obs: r.obs || ''
    };
  }

  function toEstoque(r) {
    return {
      id: r.id,
      data: clean(r.data),
      empresa_id: clean(r.empresaId),
      empresa_nome: clean(r.empresaNome),
      subcomponente: clean(r.subcomponente),
      cod_sap: clean(r.codSap),
      lote: clean(r.lote),
      quantidade_entrada: n(r.quantidadeEntrada),
      saldo_atual: n(r.saldoAtual),
      amostragem: n(r.amostragem),
      status_estoque: clean(r.statusEstoque) || 'Pendente',
      data_inspecao: clean(r.dataInspecao),
      obs: clean(r.obs)
    };
  }

  function fromInspecao(r) {
    return {
      id: r.id,
      diaInspecao: r.dia_inspecao || '',
      semana: r.semana || '',
      local: r.local || '',
      subcomponente: r.subcomponente || '',
      codSap: r.cod_sap || '',
      empresaId: r.empresa_id || '',
      empresaNome: r.empresa_nome || '',
      lote: r.lote || '',
      qtdEstoque: n(r.qtd_estoque),
      qtdAmostra: n(r.qtd_amostra),
      qtdInspecionado: n(r.qtd_inspecionado),
      qtdNc: n(r.qtd_nc),
      status: r.status || 'Pendente',
      observacao: r.observacao || ''
    };
  }

  function toInspecao(r) {
    return {
      id: r.id,
      dia_inspecao: clean(r.diaInspecao),
      semana: clean(r.semana),
      local: clean(r.local),
      subcomponente: clean(r.subcomponente),
      cod_sap: clean(r.codSap),
      empresa_id: clean(r.empresaId),
      empresa_nome: clean(r.empresaNome),
      lote: clean(r.lote),
      qtd_estoque: n(r.qtdEstoque),
      qtd_amostra: n(r.qtdAmostra),
      qtd_inspecionado: n(r.qtdInspecionado),
      qtd_nc: n(r.qtdNc),
      status: clean(r.status) || 'Pendente',
      observacao: clean(r.observacao)
    };
  }

  async function selectAll(table, orderColumn, ascending = true) {
    const { data, error } = await db()
      .from(table)
      .select('*')
      .order(orderColumn, { ascending, nullsFirst: false })
      .limit(10000);
    if (error) throw error;
    return data || [];
  }

  async function carregarDb() {
    const [empresas, estoque, inspecoes] = await Promise.all([
      selectAll(TABLES.empresas, 'nome', true),
      selectAll(TABLES.estoque, 'data', false),
      selectAll(TABLES.inspecoes, 'dia_inspecao', false)
    ]);

    return normalizeDb({
      meta: {
        version: 2,
        source: 'Supabase',
        storage: 'supabase',
        updatedAt: new Date().toISOString()
      },
      empresas: empresas.map(fromEmpresa),
      estoque: estoque.map(fromEstoque),
      inspecoes: inspecoes.map(fromInspecao)
    });
  }

  async function upsertMany(table, rows) {
    if (!rows.length) return [];
    const { data, error } = await db()
      .from(table)
      .upsert(rows, { onConflict: 'id' })
      .select();
    if (error) throw error;
    return data || [];
  }

  async function salvarDb(stateDb) {
    const normalized = normalizeDb(stateDb);
    await upsertMany(TABLES.empresas, normalized.empresas.map(toEmpresa));
    await upsertMany(TABLES.estoque, normalized.estoque.map(toEstoque));
    await upsertMany(TABLES.inspecoes, normalized.inspecoes.map(toInspecao));
    return true;
  }

  async function remover(type, id) {
    const table = { empresa: TABLES.empresas, estoque: TABLES.estoque, inspecao: TABLES.inspecoes }[type];
    if (!table || !id) return true;
    const { error } = await db().from(table).delete().eq('id', id);
    if (error) throw error;
    return true;
  }

  async function limparDb() {
    throw new Error('Limpeza total desativada neste sistema. Exclua registros individualmente pelo site.');
  }

  return { carregarDb, salvarDb, remover };
})();

window.StoreSubcomponentesSupabase = StoreSubcomponentesSupabase;
