/* =====================================================================
   STORE-SUPABASE.JS — Subcomponentes
   Camada de leitura/gravação no Supabase.
   ===================================================================== */

const StoreSubcomponentesSupabase = (() => {
  const TABLES = {
    empresas: 'empresas_subcomponentes',
    estoque: 'estoque_subcomponentes',
    inspecoes: 'inspecoes_subcomponentes',
    auditoria: 'auditoria_subcomponentes',
    usuarios: 'usuarios_app'
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
      observacao: r.observacao || '',
      criadoEm: r.criado_em || '',
      atualizadoEm: r.atualizado_em || '',
      criadoPor: r.criado_por || '',
      atualizadoPor: r.atualizado_por || ''
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
      obs: r.obs || '',
      criadoEm: r.criado_em || '',
      atualizadoEm: r.atualizado_em || '',
      criadoPor: r.criado_por || '',
      atualizadoPor: r.atualizado_por || ''
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
      observacao: r.observacao || '',
      criadoEm: r.criado_em || '',
      atualizadoEm: r.atualizado_em || '',
      criadoPor: r.criado_por || '',
      atualizadoPor: r.atualizado_por || ''
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

  function fromUsuario(r) {
    return {
      id: r.id,
      nome: r.nome || '',
      email: r.email || '',
      perfil: r.perfil || 'consulta',
      ativo: r.ativo === true,
      criado_em: r.criado_em || '',
      atualizado_em: r.atualizado_em || ''
    };
  }

  function toUsuario(r) {
    return {
      id: clean(r.id),
      nome: clean(r.nome),
      email: clean(r.email),
      perfil: clean(r.perfil) || 'consulta',
      ativo: r.ativo !== false
    };
  }

  function fromAuditoria(r) {
    return {
      id: r.id,
      data_hora: r.data_hora || r.criado_em || '',
      usuario_id: r.usuario_id || '',
      usuario_email: r.usuario_email || '',
      usuario_nome: r.usuario_nome || '',
      usuario_perfil: r.usuario_perfil || '',
      acao: r.acao || '',
      tabela: r.tabela || '',
      registro_id: r.registro_id || '',
      resumo: r.resumo || '',
      dados_antigos: r.dados_antigos || null,
      dados_novos: r.dados_novos || null
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

  async function salvarRegistro(type, record) {
    const config = {
      empresa: { table: TABLES.empresas, map: toEmpresa },
      estoque: { table: TABLES.estoque, map: toEstoque },
      inspecao: { table: TABLES.inspecoes, map: toInspecao }
    }[type];
    if (!config || !record) throw new Error('Tipo de registro inválido para salvar.');
    const { data, error } = await db()
      .from(config.table)
      .upsert(config.map(record), { onConflict: 'id' })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async function remover(type, id) {
    const table = { empresa: TABLES.empresas, estoque: TABLES.estoque, inspecao: TABLES.inspecoes }[type];
    if (!table || !id) return true;
    const { error } = await db().from(table).delete().eq('id', id);
    if (error) throw error;
    return true;
  }

  async function carregarAuditoria() {
    const { data, error } = await db()
      .from(TABLES.auditoria)
      .select('*')
      .order('data_hora', { ascending: false })
      .limit(1000);
    if (error) throw error;
    return (data || []).map(fromAuditoria);
  }

  async function carregarUsuarios() {
    const { data, error } = await db()
      .from(TABLES.usuarios)
      .select('id,nome,email,perfil,ativo,criado_em,atualizado_em')
      .order('email', { ascending: true, nullsFirst: false })
      .limit(1000);
    if (error) throw error;
    return (data || []).map(fromUsuario);
  }

  async function salvarUsuario(usuario) {
    const { data, error } = await db()
      .from(TABLES.usuarios)
      .upsert(toUsuario(usuario), { onConflict: 'id' })
      .select('id,nome,email,perfil,ativo,criado_em,atualizado_em')
      .single();
    if (error) throw error;
    return fromUsuario(data);
  }

  async function limparDb() {
    throw new Error('Limpeza total desativada neste sistema. Exclua registros individualmente pelo site.');
  }

  return { carregarDb, salvarDb, salvarRegistro, remover, carregarAuditoria, carregarUsuarios, salvarUsuario, limparDb };
})();

window.StoreSubcomponentesSupabase = StoreSubcomponentesSupabase;
