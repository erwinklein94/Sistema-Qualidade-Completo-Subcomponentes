'use strict';

const STORAGE_KEY = 'qualidadeSubcomponentes.v2';
const THEME_KEY = 'temaControleDormentesSubcomponentes';
const DEFAULT_DATA_URL = 'assets/data/default-data.json';

const NAV = [
  { sec: 'Painel' },
  { key: 'dashboard', title: 'Dashboard geral', icon: '▦' },
  { key: 'cards', title: 'Cards por subcomponente', icon: '◇' },
  { sec: 'Cadastros' },
  { key: 'empresas', title: 'Empresas', icon: '⌂' },
  { key: 'estoque', title: 'Estoque', icon: '⇄' },
  { key: 'inspecoes', title: 'Inspeções realizadas', icon: '✓' },
  { sec: 'Sistema' },
  { key: 'dados', title: 'Dados e backup', icon: '⚙' }
];

const PAGE_COPY = {
  dashboard: ['Dashboard geral', 'Visão consolidada de saldo, inspeções, NC e pendências por subcomponente.'],
  cards: ['Cards por subcomponente', 'Resumo visual por material com saldo, lotes, inspeções e não conformidades.'],
  empresas: ['Empresas', 'Cadastro de fábricas e fornecedores vinculados aos subcomponentes.'],
  estoque: ['Estoque de subcomponentes', 'Lançamento e controle dos lotes em estoque, sem importação de planilha.'],
  inspecoes: ['Inspeções realizadas', 'Registro de inspeções por lote/BAG, fornecedor e status de aprovação.'],
  dados: ['Dados e backup', 'Exportação, restauração e limpeza dos dados salvos neste navegador.']
};

const STATUS_ESTOQUE = ['Pendente', 'Em análise', 'Inspecionado', 'Fora do estoque'];
const STATUS_INSPECAO = ['Aprovado', 'Aprovado com ressalva', 'Reprovado', 'Pendente', 'Em análise'];
const STATUS_EMPRESA = ['Ativa', 'Em avaliação', 'Bloqueada', 'Inativa'];
const TIPOS_EMPRESA = ['Fornecedor', 'Fábrica', 'Fornecedor e fábrica', 'Cliente', 'Outro'];

let state = {
  active: 'dashboard',
  db: emptyDb(),
  filters: {
    dashboard: { component: '', status: '', hasNc: '', empresa: '', search: '' },
    empresas: { status: '', tipo: '', search: '' },
    estoque: { component: '', empresa: '', status: '', search: '' },
    inspecoes: { material: '', empresa: '', status: '', semana: '', search: '' },
    cards: { query: '', hasNc: '', hasStock: '', empresa: '' }
  },
  modal: null
};

function emptyDb() {
  return {
    meta: {
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      source: 'Sistema iniciado no navegador'
    },
    empresas: [],
    estoque: [],
    inspecoes: []
  };
}

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const norm = (v) => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toUpperCase();
const text = (v, fallback = '—') => {
  const s = String(v ?? '').trim();
  return s || fallback;
};
const num = (v) => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (v == null || v === '') return 0;
  const s = String(v).replace(/[^0-9,.-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};
const fmt = (v) => Math.round(num(v)).toLocaleString('pt-BR');
const pct = (v) => `${(Number.isFinite(v) ? v : 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
const uid = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const todayIso = () => new Date().toISOString().slice(0, 10);
const matches = (haystack, query) => !query || norm(haystack).includes(norm(query));

function dataBR(iso) {
  if (!iso) return '—';
  const s = String(iso).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return text(iso);
  const [y, m, d] = s.split('-');
  return `${d}/${m}/${y}`;
}

function isoWeek(dateIso) {
  if (!dateIso) return '';
  const date = new Date(`${String(dateIso).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-S${String(week).padStart(2, '0')}`;
}

function weekSortValue(label) {
  const s = String(label || '');
  const m = s.match(/(\d{4}).*?(\d{1,2})/);
  if (!m) return 0;
  return Number(m[1]) * 100 + Number(m[2]);
}

function optionList(options, selected, all = 'Todos') {
  return `<option value="">${esc(all)}</option>${options.map((o) => `<option value="${esc(o)}" ${o === selected ? 'selected' : ''}>${esc(o)}</option>`).join('')}`;
}
function unique(records, getter = (value) => value) {
  return [...new Set((records || []).flatMap((record) => {
    const value = getter(record);
    return Array.isArray(value) ? value : [value];
  }).filter(Boolean).map((v) => String(v).trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}
function groupSum(records, keyGetter, valueGetter) {
  const m = new Map();
  records.forEach((r) => {
    const k = text(keyGetter(r), 'Sem informação');
    m.set(k, (m.get(k) || 0) + num(valueGetter(r)));
  });
  return [...m].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}
function groupCount(records, keyGetter) {
  const m = new Map();
  records.forEach((r) => {
    const k = text(keyGetter(r), 'Sem informação');
    m.set(k, (m.get(k) || 0) + 1);
  });
  return [...m].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}

const App = {
  init() {
    this.bindShell();
    this.applyTheme(localStorage.getItem(THEME_KEY) || 'claro', false);
    this.renderNav();
  },
  bindShell() {
    $('#botaoMenu').addEventListener('click', () => this.toggleMenu());
    $('#backdrop').addEventListener('click', () => this.closeMenu());
    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape') {
        this.closeMenu();
        closeModal();
      }
    });
  },
  renderNav() {
    $('#nav').innerHTML = NAV.map((item) => {
      if (item.sec) return `<div class="nav-section-label">${esc(item.sec)}</div>`;
      return `<a href="#${item.key}" data-nav="${item.key}" class="${item.key === state.active ? 'ativo' : ''}"><span>${item.icon}</span><span>${esc(item.title)}</span></a>`;
    }).join('');
    $$('[data-nav]').forEach((a) => a.addEventListener('click', (ev) => {
      ev.preventDefault();
      state.active = a.dataset.nav;
      this.closeMenu();
      render();
    }));
  },
  setHeader() {
    const [title, subtitle] = PAGE_COPY[state.active] || PAGE_COPY.dashboard;
    $('#pageTitle').textContent = title;
    $('#pageSubtitle').textContent = subtitle;
    $('#topActions').innerHTML = topActions();
    $('#themeBtn')?.addEventListener('click', () => this.toggleTheme());
    $('#quickStock')?.addEventListener('click', () => openModal('estoque'));
    $('#quickInspection')?.addEventListener('click', () => openModal('inspecao'));
    $('#quickCompany')?.addEventListener('click', () => openModal('empresa'));
  },
  toggleMenu() {
    const open = $('#sidebar').classList.toggle('aberta');
    $('#backdrop').classList.toggle('ativo', open);
    $('#botaoMenu').setAttribute('aria-expanded', String(open));
  },
  closeMenu() {
    $('#sidebar').classList.remove('aberta');
    $('#backdrop').classList.remove('ativo');
    $('#botaoMenu').setAttribute('aria-expanded', 'false');
  },
  toggleTheme() {
    const current = document.body.getAttribute('data-tema') === 'escuro' ? 'escuro' : 'claro';
    this.applyTheme(current === 'escuro' ? 'claro' : 'escuro', true);
  },
  applyTheme(theme, persist = true) {
    const escuro = theme === 'escuro';
    document.body.setAttribute('data-tema', escuro ? 'escuro' : 'claro');
    if (persist) localStorage.setItem(THEME_KEY, escuro ? 'escuro' : 'claro');
    const btn = $('#themeBtn');
    if (btn) btn.innerHTML = `${escuro ? '☀' : '◐'}<span>${escuro ? 'Tema claro' : 'Tema escuro'}</span>`;
  },
  toast(message, type = 'sucesso') {
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    const icon = type === 'erro' ? '✕' : type === 'info' ? 'i' : '✓';
    el.innerHTML = `<span>${icon}</span><span>${esc(message)}</span>`;
    $('#toastWrap').appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transition = 'opacity .25s';
      setTimeout(() => el.remove(), 260);
    }, 3300);
  }
};

const DB = {
  async init() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        state.db = normalizeDb(JSON.parse(saved));
        return;
      } catch (error) {
        console.warn('Dados salvos inválidos. Tentando base inicial.', error);
      }
    }
    state.db = await loadSeed();
    this.save('Base inicial carregada');
  },
  save(action = 'Dados alterados no sistema') {
    const currentMeta = state.db.meta || {};
    state.db.meta = {
      ...currentMeta,
      version: currentMeta.version || 2,
      updatedAt: new Date().toISOString(),
      source: currentMeta.source || action,
      lastAction: action
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.db));
  },
  replace(nextDb, source = 'Dados restaurados') {
    state.db = normalizeDb(nextDb);
    this.save(source);
    render();
  }
};

async function loadSeed() {
  try {
    const res = await fetch(DEFAULT_DATA_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error('Base inicial não encontrada.');
    const seed = await res.json();
    const looksLikeDb = Array.isArray(seed.empresas) || Array.isArray(seed.inspecoes) || seed?.meta?.version >= 2;
    return normalizeDb(looksLikeDb ? seed : legacyToDb(seed));
  } catch (error) {
    console.warn(error);
    return emptyDb();
  }
}

function legacyToDb(legacy) {
  const db = emptyDb();
  const companyMap = new Map();
  const ensureCompany = (name, tipo = 'Fornecedor') => {
    const clean = text(name, '').trim();
    if (!clean) return '';
    const k = norm(clean);
    if (!companyMap.has(k)) {
      const item = { id: uid('EMP'), nome: clean, tipo, cidade: '', contato: '', status: 'Ativa', observacao: 'Criada automaticamente a partir da base inicial.' };
      companyMap.set(k, item);
      db.empresas.push(item);
    }
    return companyMap.get(k).id;
  };

  (legacy.estoque || []).forEach((r) => {
    const empresaId = ensureCompany(r.fabrica, 'Fábrica');
    db.estoque.push({
      id: r.id || uid('EST'),
      data: normalizeDate(r.data),
      empresaId,
      empresaNome: text(r.fabrica, ''),
      subcomponente: text(r.subcomponente, ''),
      codSap: text(r.codSap, ''),
      lote: text(r.lote, ''),
      quantidadeEntrada: num(r.quantidadeEntrada),
      saldoAtual: legacySaldoEstoque(r),
      amostragem: num(r.amostragem),
      statusEstoque: legacyStockStatus(r),
      dataInspecao: normalizeDate(r.dataInspecao),
      obs: text(r.obs || r.observacao, '')
    });
  });

  (legacy.executados || []).forEach((r) => {
    const empresaId = ensureCompany(r.fornecedor, 'Fornecedor');
    db.inspecoes.push({
      id: r.id || uid('INSP'),
      diaInspecao: normalizeDate(r.diaInspecao),
      semana: text(r.semana, '') || isoWeek(r.diaInspecao),
      local: text(r.local, ''),
      subcomponente: text(r.material, ''),
      codSap: text(r.codSap, ''),
      empresaId,
      empresaNome: text(r.fornecedor, ''),
      lote: text(r.lote, ''),
      qtdEstoque: num(r.qtdEstoque),
      qtdAmostra: num(r.qtdAmostra),
      qtdInspecionado: num(r.qtdInspecionado),
      qtdNc: num(r.qtdNc),
      status: text(r.status, 'Pendente'),
      observacao: ''
    });
  });
  db.meta.source = 'Base inicial do antigo painel de subcomponentes';
  return db;
}

function normalizeDb(input) {
  const db = emptyDb();
  if (input && Array.isArray(input.empresas)) db.empresas = input.empresas.map((r) => ({
    id: r.id || uid('EMP'),
    nome: text(r.nome || r.name, ''),
    tipo: text(r.tipo, 'Fornecedor'),
    cidade: text(r.cidade, ''),
    contato: text(r.contato, ''),
    status: text(r.status, 'Ativa'),
    observacao: text(r.observacao || r.obs, '')
  })).filter((r) => r.nome);

  if (input && Array.isArray(input.estoque)) db.estoque = input.estoque.map((r) => ({
    id: r.id || uid('EST'),
    data: normalizeDate(r.data),
    empresaId: text(r.empresaId, ''),
    empresaNome: text(r.empresaNome || r.fabrica || r.fornecedor, ''),
    subcomponente: text(r.subcomponente || r.material, ''),
    codSap: text(r.codSap, ''),
    lote: text(r.lote, ''),
    quantidadeEntrada: num(r.quantidadeEntrada || r.quantidade || r.qtdEstoque),
    saldoAtual: r.saldoAtual === undefined ? legacySaldoEstoque(r) : num(r.saldoAtual),
    amostragem: num(r.amostragem || r.qtdAmostra),
    statusEstoque: text(r.statusEstoque || r.status || legacyStockStatus(r), 'Pendente'),
    dataInspecao: normalizeDate(r.dataInspecao),
    obs: text(r.obs || r.observacao, '')
  })).filter((r) => r.subcomponente);

  if (input && Array.isArray(input.inspecoes)) db.inspecoes = input.inspecoes.map((r) => ({
    id: r.id || uid('INSP'),
    diaInspecao: normalizeDate(r.diaInspecao || r.data),
    semana: text(r.semana, '') || isoWeek(r.diaInspecao || r.data),
    local: text(r.local, ''),
    subcomponente: text(r.subcomponente || r.material, ''),
    codSap: text(r.codSap, ''),
    empresaId: text(r.empresaId, ''),
    empresaNome: text(r.empresaNome || r.fornecedor || r.fabrica, ''),
    lote: text(r.lote, ''),
    qtdEstoque: num(r.qtdEstoque),
    qtdAmostra: num(r.qtdAmostra),
    qtdInspecionado: num(r.qtdInspecionado),
    qtdNc: num(r.qtdNc),
    status: text(r.status, 'Pendente'),
    observacao: text(r.observacao || r.obs, '')
  })).filter((r) => r.subcomponente);

  ensureCompaniesForRecords(db);
  db.meta = { ...emptyDb().meta, ...(input?.meta || {}), updatedAt: input?.meta?.updatedAt || new Date().toISOString() };
  return db;
}

function ensureCompaniesForRecords(db) {
  const byName = new Map(db.empresas.map((e) => [norm(e.nome), e]));
  const ensure = (name, tipo) => {
    const clean = text(name, '').trim();
    if (!clean) return '';
    const k = norm(clean);
    if (!byName.has(k)) {
      const item = { id: uid('EMP'), nome: clean, tipo, cidade: '', contato: '', status: 'Ativa', observacao: 'Criada automaticamente.' };
      db.empresas.push(item);
      byName.set(k, item);
    }
    return byName.get(k).id;
  };
  db.estoque.forEach((r) => {
    if (!r.empresaId) r.empresaId = ensure(r.empresaNome, 'Fábrica');
    r.empresaNome = empresaNomeById(db, r.empresaId) || r.empresaNome;
  });
  db.inspecoes.forEach((r) => {
    if (!r.empresaId) r.empresaId = ensure(r.empresaNome, 'Fornecedor');
    r.empresaNome = empresaNomeById(db, r.empresaId) || r.empresaNome;
  });
}

function normalizeDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  if (typeof value === 'number' && value > 1 && value < 70000) return new Date(Date.UTC(1899, 11, 30) + value * 86400000).toISOString().slice(0, 10);
  const s = String(value ?? '').trim();
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const br = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (br) {
    const y = br[3].length === 2 ? `20${br[3]}` : br[3];
    return `${y}-${String(br[2]).padStart(2, '0')}-${String(br[1]).padStart(2, '0')}`;
  }
  return '';
}

function legacyStockStatus(r) {
  const raw = norm(r.statusEstoque || r.dataInspecao || r.obs || '');
  if (raw.includes('NAO EXISTE') || raw.includes('SEM ESTOQUE') || raw.includes('ZERADO') || raw.includes('FORA')) return 'Fora do estoque';
  if (normalizeDate(r.dataInspecao)) return 'Inspecionado';
  if (raw.includes('ANALISE')) return 'Em análise';
  return 'Pendente';
}
function legacySaldoEstoque(r) {
  const explicit = r.saldoAtual;
  if (explicit !== undefined && explicit !== null && explicit !== '') return num(explicit);
  return legacyStockStatus(r) === 'Fora do estoque' ? 0 : num(r.quantidadeEntrada || r.quantidade || r.qtdEstoque);
}

function empresaNomeById(db, id) {
  return db.empresas.find((e) => e.id === id)?.nome || '';
}
function empresaOptions(selected = '', all = 'Todas') {
  return optionList(state.db.empresas.map((e) => e.nome).sort((a, b) => a.localeCompare(b, 'pt-BR')), empresaNomeById(state.db, selected) || selected, all);
}
function companyIdFromName(name) {
  const clean = text(name, '').trim();
  if (!clean) return '';
  let item = state.db.empresas.find((e) => norm(e.nome) === norm(clean));
  if (!item) {
    item = { id: uid('EMP'), nome: clean, tipo: 'Fornecedor', cidade: '', contato: '', status: 'Ativa', observacao: 'Criada durante lançamento.' };
    state.db.empresas.push(item);
  }
  return item.id;
}

function componentKey(v) { return norm(v).replace(/[^A-Z0-9]+/g, ' ').replace(/\s+/g, ' ').trim() || 'SEM COMPONENTE'; }
function lotKey(v) { return norm(v).replace(/[.\-]/g, '/').replace(/\s+/g, '').replace(/^0+(?=\d)/, '').replace(/\/0+(?=\d)/g, '/') || 'SEM LOTE'; }
function comparisonKey(component, lote) { return `${componentKey(component)}||${lotKey(lote)}`; }

function buildComparisonRows() {
  const stockMap = new Map();
  const inspectionMap = new Map();

  state.db.estoque.forEach((r) => {
    const key = comparisonKey(r.subcomponente, r.lote);
    const empresa = empresaNomeById(state.db, r.empresaId) || r.empresaNome;
    const item = stockMap.get(key) || {
      key,
      component: text(r.subcomponente),
      lote: text(r.lote),
      loteKey: lotKey(r.lote),
      totalEntrada: 0,
      saldoEstoque: 0,
      amostragem: 0,
      registrosEstoque: 0,
      empresas: new Set(),
      stockStatuses: new Set(),
      obs: new Set()
    };
    item.totalEntrada += num(r.quantidadeEntrada);
    item.saldoEstoque += num(r.saldoAtual);
    item.amostragem += num(r.amostragem);
    item.registrosEstoque += 1;
    if (empresa) item.empresas.add(empresa);
    if (r.statusEstoque) item.stockStatuses.add(r.statusEstoque);
    if (r.obs) item.obs.add(r.obs);
    stockMap.set(key, item);
  });

  state.db.inspecoes.forEach((r) => {
    const key = comparisonKey(r.subcomponente, r.lote);
    const empresa = empresaNomeById(state.db, r.empresaId) || r.empresaNome;
    const item = inspectionMap.get(key) || {
      key,
      component: text(r.subcomponente),
      lote: text(r.lote),
      loteKey: lotKey(r.lote),
      qtdEstoqueInspecao: 0,
      qtdAmostra: 0,
      qtdInspecionado: 0,
      qtdNc: 0,
      registrosInspecao: 0,
      empresas: new Set(),
      inspectionStatuses: new Set(),
      codSap: new Set(),
      lastDate: ''
    };
    item.qtdEstoqueInspecao += num(r.qtdEstoque);
    item.qtdAmostra += num(r.qtdAmostra);
    item.qtdInspecionado += num(r.qtdInspecionado);
    item.qtdNc += num(r.qtdNc);
    item.registrosInspecao += 1;
    if (empresa) item.empresas.add(empresa);
    if (r.status) item.inspectionStatuses.add(r.status);
    if (r.codSap) item.codSap.add(r.codSap);
    if (r.diaInspecao && r.diaInspecao > item.lastDate) item.lastDate = r.diaInspecao;
    inspectionMap.set(key, item);
  });

  return [...new Set([...stockMap.keys(), ...inspectionMap.keys()])].map((key) => {
    const stock = stockMap.get(key);
    const inspection = inspectionMap.get(key);
    const component = stock?.component || inspection?.component || 'Sem componente';
    const lote = stock?.lote || inspection?.lote || 'Sem lote';
    const saldoEstoque = stock?.saldoEstoque || 0;
    const qtdEstoqueInspecao = inspection?.qtdEstoqueInspecao || 0;
    const qtdInspecionado = inspection?.qtdInspecionado || 0;
    const qtdNc = inspection?.qtdNc || 0;
    const hasStockRecord = Boolean(stock);
    const hasActiveStock = saldoEstoque > 0;
    const hasInspection = Boolean(inspection);
    let status = 'Fora do estoque';
    if (hasActiveStock && hasInspection) status = qtdNc > 0 ? 'Inspeção realizada com NC' : 'Inspeção realizada';
    if (hasActiveStock && !hasInspection) status = 'Pendente de inspeção';
    if (!hasActiveStock && hasInspection) status = 'Inspecionado sem saldo atual';
    if (hasStockRecord && !hasActiveStock && !hasInspection) status = 'Fora do estoque';
    return {
      key,
      component,
      lote,
      loteKey: stock?.loteKey || inspection?.loteKey || lotKey(lote),
      status,
      totalEntrada: stock?.totalEntrada || 0,
      saldoEstoque,
      qtdEstoqueInspecao,
      qtdAmostra: inspection?.qtdAmostra || 0,
      amostragem: stock?.amostragem || 0,
      qtdInspecionado,
      qtdNc,
      ncRate: qtdInspecionado ? qtdNc / qtdInspecionado * 100 : 0,
      diffEstoqueInspecao: saldoEstoque - qtdEstoqueInspecao,
      registrosEstoque: stock?.registrosEstoque || 0,
      registrosInspecao: inspection?.registrosInspecao || 0,
      empresas: [...new Set([...(stock?.empresas || []), ...(inspection?.empresas || [])])].sort(),
      stockStatuses: [...(stock?.stockStatuses || [])],
      inspectionStatuses: [...(inspection?.inspectionStatuses || [])],
      codSap: [...(inspection?.codSap || [])],
      lastDate: inspection?.lastDate || '',
      obs: [...(stock?.obs || [])]
    };
  }).sort((a, b) => b.saldoEstoque - a.saldoEstoque || b.qtdInspecionado - a.qtdInspecionado || a.component.localeCompare(b.component, 'pt-BR'));
}

function badge(status) {
  const n = norm(status);
  let cls = 'badge-cinza';
  if (n.includes('APROV') || n.includes('INSPECAO REALIZADA') || n.includes('INSPECIONADO')) cls = 'badge-ok';
  if (n.includes('PEND') || n.includes('ANALISE')) cls = 'badge-amarelo';
  if (n.includes('NC') || n.includes('REPROV')) cls = 'badge-reprovado';
  if (n.includes('SALDO') || n.includes('ESTOQUE')) cls = 'badge-azul';
  if (n.includes('BLOQUE')) cls = 'badge-reprovado';
  return `<span class="badge ${cls}">${esc(text(status))}</span>`;
}

function topActions() {
  return `
    <button class="btn btn-verde btn-sm" id="quickStock" type="button">＋ Estoque</button>
    <button class="btn btn-primario btn-sm" id="quickInspection" type="button">＋ Inspeção</button>
    <button class="btn btn-secundario btn-sm" id="quickCompany" type="button">＋ Empresa</button>
    <button class="btn btn-secundario btn-sm" id="themeBtn" type="button">◐<span>Tema escuro</span></button>
  `;
}

function hero() {
  const updated = state.db.meta?.updatedAt ? new Date(state.db.meta.updatedAt).toLocaleString('pt-BR') : '—';
  const source = state.db.meta?.source || 'Dados locais';
  const stats = state.db.meta?.stats || {};
  const period = Array.isArray(stats.periodoInspecoes) ? `${dataBR(stats.periodoInspecoes[0])} a ${dataBR(stats.periodoInspecoes[1])}` : '';
  return `<div class="hero">
    <h2>Controle de qualidade de subcomponentes</h2>
    <p>Cadastre empresas, registre entradas de estoque, acompanhe inspeções e visualize a situação por lote/subcomponente sem depender de importação de Excel.</p>
    <div class="hero-meta">
      <span class="hero-chip">Base: ${esc(source)}</span>
      <span class="hero-chip">Atualizado: ${esc(updated)}</span>
      ${period ? `<span class="hero-chip">Inspeções: ${esc(period)}</span>` : ''}
      <span class="hero-chip">GitHub Pages + localStorage</span>
    </div>
  </div>`;
}

function kpi(title, value, sub, color = 'var(--azul-claro)') {
  return `<div class="kpi" style="--kpi-cor:${color}"><div class="rotulo">${esc(title)}</div><div class="valor">${esc(value)}</div><div class="sub">${esc(sub)}</div></div>`;
}
function panel(title, sub, body, extra = '') {
  return `<div class="card ${extra}"><div class="card-titulo"><span class="acento">${esc(title)}</span>${sub ? `<span class="card-sub">${esc(sub)}</span>` : ''}</div>${body}</div>`;
}
function empty(title, sub = '') {
  return `<div class="vazio"><h3>${esc(title)}</h3>${sub ? `<p>${esc(sub)}</p>` : ''}</div>`;
}

function render() {
  App.renderNav();
  App.setHeader();
  const views = {
    dashboard: renderDashboard,
    empresas: renderEmpresas,
    estoque: renderEstoque,
    inspecoes: renderInspecoes,
    cards: renderCards,
    dados: renderDados
  };
  try {
    $('#page').innerHTML = (views[state.active] || renderDashboard)();
    bindPage();
  } catch (error) {
    console.error('Erro ao renderizar a tela:', error);
    $('#page').innerHTML = `${hero()}${panel('Não foi possível abrir esta tela', 'O sistema encontrou um erro inesperado ao montar os dados.', `<div class="aviso-info erro"><span>!</span><div><strong>Detalhe técnico:</strong> ${esc(error?.message || error)}<br>Atualize a página. Se continuar, exporte um backup em JSON e revise os dados importados.</div></div>`)}`;
  }
  App.applyTheme(document.body.getAttribute('data-tema') || 'claro', false);
}

function renderDashboard() {
  const rows = filteredComparisonRows();
  const allRows = buildComparisonRows();
  const totalSaldo = rows.reduce((s, r) => s + r.saldoEstoque, 0);
  const totalInspecionado = rows.reduce((s, r) => s + r.qtdInspecionado, 0);
  const totalNc = rows.reduce((s, r) => s + r.qtdNc, 0);
  const pendentes = rows.filter((r) => r.status === 'Pendente de inspeção').length;
  const componentes = unique(rows, (r) => r.component).length;
  const lotes = unique(rows, (r) => r.key).length;
  const status = groupCount(rows, (r) => r.status);
  const estoquePorComp = groupSum(rows, (r) => r.component, (r) => r.saldoEstoque).slice(0, 10);
  const ncPorComp = groupSum(rows, (r) => r.component, (r) => r.qtdNc).filter((d) => d.value > 0).slice(0, 10);
  const inspPorEmpresa = groupSum(state.db.inspecoes, (r) => empresaNomeById(state.db, r.empresaId) || r.empresaNome, (r) => r.qtdInspecionado).slice(0, 10);
  const semana = groupSum(state.db.inspecoes, (r) => r.semana || isoWeek(r.diaInspecao), (r) => r.qtdInspecionado)
    .sort((a, b) => weekSortValue(a.name) - weekSortValue(b.name))
    .slice(-14);

  return `${hero()}
    <div class="barra-filtros">${dashboardFilters(allRows)}</div>
    <div class="grid-kpi">
      ${kpi('Subcomponentes', fmt(componentes), `${fmt(lotes)} lotes filtrados`, 'var(--azul-claro)')}
      ${kpi('Saldo em estoque', fmt(totalSaldo), 'saldo atual consolidado', 'var(--verde)')}
      ${kpi('Inspecionado', fmt(totalInspecionado), `${fmt(state.db.inspecoes.length)} registros`, 'var(--verde-claro)')}
      ${kpi('Não conformidades', fmt(totalNc), `taxa ${pct(totalInspecionado ? totalNc / totalInspecionado * 100 : 0)}`, 'var(--amarelo)')}
      ${kpi('Pendentes', fmt(pendentes), 'lotes com saldo sem inspeção', 'var(--erro)')}
      ${kpi('Empresas', fmt(state.db.empresas.length), 'fornecedores e fábricas', 'var(--azul-escuro)')}
    </div>
    <div class="grid-graficos">
      ${panel('Estoque por subcomponente', 'Top 10 por saldo atual', barList(estoquePorComp, 'un.'))}
      ${panel('Status dos lotes', 'Comparativo estoque × inspeção', donut(status))}
      ${panel('Inspecionado por empresa', 'Top fornecedores/fábricas', barList(inspPorEmpresa, 'un.'))}
      ${panel('Materiais com NC', 'Subcomponentes com não conformidade', ncPorComp.length ? barList(ncPorComp, 'NC') : empty('Nenhuma NC nos filtros', 'Ajuste os filtros ou registre uma nova inspeção.'))}
      ${panel('Evolução por semana', 'Quantidade inspecionada nos últimos períodos', lineChart(semana), 'span2')}
      ${panel('Tabela comparativa por lote', `${fmt(rows.length)} linhas encontradas`, comparisonTable(rows), 'span2')}
    </div>`;
}

function dashboardFilters(rows) {
  const f = state.filters.dashboard;
  return `
    <div class="campo"><label>Subcomponente</label><select data-filter="dashboard.component">${optionList(unique(rows, (r) => r.component), f.component, 'Todos')}</select></div>
    <div class="campo"><label>Empresa</label><select data-filter="dashboard.empresa">${optionList(unique(rows.flatMap((r) => r.empresas)), f.empresa, 'Todas')}</select></div>
    <div class="campo"><label>Status</label><select data-filter="dashboard.status">${optionList(unique(rows, (r) => r.status), f.status, 'Todos')}</select></div>
    <div class="campo"><label>Com NC?</label><select data-filter="dashboard.hasNc">${optionList(['Sim', 'Não'], f.hasNc, 'Todos')}</select></div>
    <div class="campo"><label>Busca</label><input type="search" value="${esc(f.search)}" data-filter="dashboard.search" placeholder="Lote, SAP, observação..."></div>
    <button class="btn btn-secundario" data-clear-filters="dashboard" type="button">Limpar filtros</button>`;
}

function filteredComparisonRows() {
  const f = state.filters.dashboard;
  return buildComparisonRows().filter((r) =>
    (!f.component || r.component === f.component) &&
    (!f.empresa || r.empresas.includes(f.empresa)) &&
    (!f.status || r.status === f.status) &&
    (f.hasNc !== 'Sim' || r.qtdNc > 0) &&
    (f.hasNc !== 'Não' || r.qtdNc <= 0) &&
    matches(`${r.component} ${r.lote} ${r.status} ${r.empresas.join(' ')} ${r.codSap.join(' ')} ${r.obs.join(' ')}`, f.search)
  );
}

function comparisonTable(rows) {
  if (!rows.length) return empty('Nenhum lote encontrado', 'Ajuste os filtros ou cadastre um novo registro.');
  return `<div class="tabela-wrap"><table class="tabela"><thead><tr>
    <th>Subcomponente</th><th>Lote</th><th>Empresas</th><th>Status</th><th class="right">Entrada</th><th class="right">Saldo</th><th class="right">Amostra</th><th class="right">Inspecionado</th><th class="right">NC</th><th class="right">Taxa NC</th><th>Última inspeção</th>
  </tr></thead><tbody>${rows.slice(0, 350).map((r) => `<tr>
    <td><strong>${esc(r.component)}</strong></td><td>${esc(r.lote)}</td><td>${esc(r.empresas.join(', ') || '—')}</td><td>${badge(r.status)}</td>
    <td class="right">${fmt(r.totalEntrada)}</td><td class="right"><strong>${fmt(r.saldoEstoque)}</strong></td><td class="right">${fmt(r.qtdAmostra || r.amostragem)}</td><td class="right">${fmt(r.qtdInspecionado)}</td><td class="right"><strong>${fmt(r.qtdNc)}</strong></td><td class="right">${pct(r.ncRate)}</td><td>${dataBR(r.lastDate)}</td>
  </tr>`).join('')}</tbody></table></div>`;
}

function renderEmpresas() {
  const f = state.filters.empresas;
  const records = state.db.empresas.filter((e) =>
    (!f.status || e.status === f.status) &&
    (!f.tipo || e.tipo === f.tipo) &&
    matches(`${e.nome} ${e.tipo} ${e.cidade} ${e.contato} ${e.status} ${e.observacao}`, f.search)
  ).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  const active = records.filter((e) => e.status === 'Ativa').length;
  return `${hero()}
    <div class="toolbar"><div class="contador">${fmt(records.length)} de ${fmt(state.db.empresas.length)} empresa(s)</div><button class="btn btn-primario" type="button" data-modal="empresa">＋ Nova empresa</button></div>
    <div class="grid-kpi">
      ${kpi('Empresas filtradas', fmt(records.length), `${fmt(active)} ativas`, 'var(--azul-claro)')}
      ${kpi('Fornecedores', fmt(records.filter((e) => norm(e.tipo).includes('FORNECEDOR')).length), 'empresas fornecedoras', 'var(--verde)')}
      ${kpi('Fábricas', fmt(records.filter((e) => norm(e.tipo).includes('FABRICA')).length), 'empresas/fábricas', 'var(--verde-claro)')}
      ${kpi('Bloqueadas/Inativas', fmt(records.filter((e) => ['Bloqueada', 'Inativa'].includes(e.status)).length), 'atenção para novos lotes', 'var(--erro)')}
    </div>
    <div class="barra-filtros">${empresaFilters(f)}</div>
    ${panel('Cadastro de empresas', 'Use para padronizar fornecedores e fábricas', empresaTable(records))}`;
}
function empresaFilters(f) {
  return `
    <div class="campo"><label>Status</label><select data-filter="empresas.status">${optionList(STATUS_EMPRESA, f.status, 'Todos')}</select></div>
    <div class="campo"><label>Tipo</label><select data-filter="empresas.tipo">${optionList(TIPOS_EMPRESA, f.tipo, 'Todos')}</select></div>
    <div class="campo"><label>Busca</label><input type="search" value="${esc(f.search)}" data-filter="empresas.search" placeholder="Nome, cidade, contato..."></div>
    <button class="btn btn-secundario" data-clear-filters="empresas" type="button">Limpar filtros</button>`;
}
function empresaTable(records) {
  if (!records.length) return empty('Nenhuma empresa encontrada', 'Cadastre uma nova empresa ou ajuste os filtros.');
  return `<div class="tabela-wrap"><table class="tabela"><thead><tr><th>Empresa</th><th>Tipo</th><th>Cidade</th><th>Contato</th><th>Status</th><th class="right">Lotes estoque</th><th class="right">Inspeções</th><th>Observação</th><th>Ações</th></tr></thead><tbody>${records.map((e) => {
    const lotes = state.db.estoque.filter((r) => r.empresaId === e.id).length;
    const insps = state.db.inspecoes.filter((r) => r.empresaId === e.id).length;
    return `<tr><td><strong>${esc(e.nome)}</strong></td><td>${esc(e.tipo)}</td><td>${esc(e.cidade)}</td><td>${esc(e.contato)}</td><td>${badge(e.status)}</td><td class="right">${fmt(lotes)}</td><td class="right">${fmt(insps)}</td><td>${esc(e.observacao)}</td><td class="acoes-cel"><button class="icone-btn" title="Editar" data-edit="empresa" data-id="${e.id}">✎</button><button class="icone-btn del" title="Excluir" data-delete="empresa" data-id="${e.id}">🗑</button></td></tr>`;
  }).join('')}</tbody></table></div>`;
}

function renderEstoque() {
  const f = state.filters.estoque;
  const records = state.db.estoque.filter((r) => {
    const empresa = empresaNomeById(state.db, r.empresaId) || r.empresaNome;
    return (!f.component || r.subcomponente === f.component) &&
      (!f.empresa || empresa === f.empresa) &&
      (!f.status || r.statusEstoque === f.status) &&
      matches(`${r.subcomponente} ${r.lote} ${empresa} ${r.codSap} ${r.obs} ${r.statusEstoque}`, f.search);
  }).sort((a, b) => (b.data || '').localeCompare(a.data || ''));
  const saldo = records.reduce((s, r) => s + num(r.saldoAtual), 0);
  return `${hero()}
    <div class="toolbar"><div class="contador">${fmt(records.length)} de ${fmt(state.db.estoque.length)} registro(s) de estoque</div><button class="btn btn-primario" type="button" data-modal="estoque">＋ Novo lançamento de estoque</button></div>
    <div class="grid-kpi">
      ${kpi('Registros', fmt(records.length), 'entradas/lotes filtrados', 'var(--azul-claro)')}
      ${kpi('Entrada total', fmt(records.reduce((s, r) => s + num(r.quantidadeEntrada), 0)), 'quantidade recebida', 'var(--verde-claro)')}
      ${kpi('Saldo atual', fmt(saldo), 'quantidade disponível', 'var(--verde)')}
      ${kpi('Pendentes', fmt(records.filter((r) => r.statusEstoque === 'Pendente').length), 'aguardando inspeção', 'var(--amarelo)')}
    </div>
    <div class="barra-filtros">${estoqueFilters(f)}</div>
    ${panel('Tabela de estoque', 'Controle manual dos lotes e saldos', estoqueTable(records))}`;
}
function estoqueFilters(f) {
  const all = state.db.estoque;
  return `
    <div class="campo"><label>Subcomponente</label><select data-filter="estoque.component">${optionList(unique(all, (r) => r.subcomponente), f.component, 'Todos')}</select></div>
    <div class="campo"><label>Empresa</label><select data-filter="estoque.empresa">${optionList(unique(all, (r) => empresaNomeById(state.db, r.empresaId) || r.empresaNome), f.empresa, 'Todas')}</select></div>
    <div class="campo"><label>Status</label><select data-filter="estoque.status">${optionList(STATUS_ESTOQUE, f.status, 'Todos')}</select></div>
    <div class="campo"><label>Busca</label><input type="search" value="${esc(f.search)}" data-filter="estoque.search" placeholder="Lote, SAP, observação..."></div>
    <button class="btn btn-secundario" data-clear-filters="estoque" type="button">Limpar filtros</button>`;
}
function estoqueTable(records) {
  if (!records.length) return empty('Nenhum registro de estoque', 'Cadastre uma entrada ou ajuste os filtros.');
  return `<div class="tabela-wrap"><table class="tabela"><thead><tr><th>Data</th><th>Empresa</th><th>Subcomponente</th><th>SAP</th><th>Lote</th><th class="right">Entrada</th><th class="right">Saldo</th><th class="right">Amostra</th><th>Status</th><th>Obs.</th><th>Ações</th></tr></thead><tbody>${records.slice(0, 500).map((r) => {
    const empresa = empresaNomeById(state.db, r.empresaId) || r.empresaNome;
    return `<tr><td>${dataBR(r.data)}</td><td>${esc(empresa)}</td><td><strong>${esc(r.subcomponente)}</strong></td><td>${esc(r.codSap)}</td><td>${esc(r.lote)}</td><td class="right">${fmt(r.quantidadeEntrada)}</td><td class="right"><strong>${fmt(r.saldoAtual)}</strong></td><td class="right">${fmt(r.amostragem)}</td><td>${badge(r.statusEstoque)}</td><td>${esc(r.obs)}</td><td class="acoes-cel"><button class="icone-btn" title="Editar" data-edit="estoque" data-id="${r.id}">✎</button><button class="icone-btn del" title="Excluir" data-delete="estoque" data-id="${r.id}">🗑</button></td></tr>`;
  }).join('')}</tbody></table></div>`;
}

function renderInspecoes() {
  const f = state.filters.inspecoes;
  const records = state.db.inspecoes.filter((r) => {
    const empresa = empresaNomeById(state.db, r.empresaId) || r.empresaNome;
    return (!f.material || r.subcomponente === f.material) &&
      (!f.empresa || empresa === f.empresa) &&
      (!f.status || r.status === f.status) &&
      (!f.semana || r.semana === f.semana) &&
      matches(`${r.subcomponente} ${r.lote} ${empresa} ${r.codSap} ${r.status} ${r.local} ${r.observacao}`, f.search);
  }).sort((a, b) => (b.diaInspecao || '').localeCompare(a.diaInspecao || ''));
  const ins = records.reduce((s, r) => s + num(r.qtdInspecionado), 0);
  const nc = records.reduce((s, r) => s + num(r.qtdNc), 0);
  return `${hero()}
    <div class="toolbar"><div class="contador">${fmt(records.length)} de ${fmt(state.db.inspecoes.length)} inspeção(ões)</div><button class="btn btn-primario" type="button" data-modal="inspecao">＋ Nova inspeção</button></div>
    <div class="grid-kpi">
      ${kpi('Inspeções', fmt(records.length), 'registros filtrados', 'var(--azul-claro)')}
      ${kpi('Qtd. inspecionada', fmt(ins), `amostra: ${fmt(records.reduce((s, r) => s + num(r.qtdAmostra), 0))}`, 'var(--verde)')}
      ${kpi('Não conformidades', fmt(nc), 'soma de QTD NC', 'var(--amarelo)')}
      ${kpi('Taxa NC', pct(ins ? nc / ins * 100 : 0), 'NC / qtd. inspecionada', 'var(--erro)')}
    </div>
    <div class="barra-filtros">${inspecaoFilters(f)}</div>
    ${panel('Tabela de inspeções realizadas', 'Registros manuais de inspeção por lote/BAG', inspecaoTable(records))}`;
}
function inspecaoFilters(f) {
  const all = state.db.inspecoes;
  return `
    <div class="campo"><label>Subcomponente</label><select data-filter="inspecoes.material">${optionList(unique(all, (r) => r.subcomponente), f.material, 'Todos')}</select></div>
    <div class="campo"><label>Empresa</label><select data-filter="inspecoes.empresa">${optionList(unique(all, (r) => empresaNomeById(state.db, r.empresaId) || r.empresaNome), f.empresa, 'Todas')}</select></div>
    <div class="campo"><label>Status</label><select data-filter="inspecoes.status">${optionList(STATUS_INSPECAO, f.status, 'Todos')}</select></div>
    <div class="campo"><label>Semana</label><select data-filter="inspecoes.semana">${optionList(unique(all, (r) => r.semana).sort((a,b) => weekSortValue(a) - weekSortValue(b)), f.semana, 'Todas')}</select></div>
    <div class="campo"><label>Busca</label><input type="search" value="${esc(f.search)}" data-filter="inspecoes.search" placeholder="Lote, SAP, local..."></div>
    <button class="btn btn-secundario" data-clear-filters="inspecoes" type="button">Limpar filtros</button>`;
}
function inspecaoTable(records) {
  if (!records.length) return empty('Nenhuma inspeção encontrada', 'Registre uma nova inspeção ou ajuste os filtros.');
  return `<div class="tabela-wrap"><table class="tabela"><thead><tr><th>Data</th><th>Semana</th><th>Local</th><th>Subcomponente</th><th>SAP</th><th>Empresa</th><th>Lote</th><th class="right">Qtd estoque</th><th class="right">Amostra</th><th class="right">Inspecionado</th><th class="right">NC</th><th>Status</th><th>Ações</th></tr></thead><tbody>${records.slice(0, 500).map((r) => {
    const empresa = empresaNomeById(state.db, r.empresaId) || r.empresaNome;
    return `<tr><td>${dataBR(r.diaInspecao)}</td><td>${esc(r.semana)}</td><td>${esc(r.local)}</td><td><strong>${esc(r.subcomponente)}</strong></td><td>${esc(r.codSap)}</td><td>${esc(empresa)}</td><td>${esc(r.lote)}</td><td class="right">${fmt(r.qtdEstoque)}</td><td class="right">${fmt(r.qtdAmostra)}</td><td class="right"><strong>${fmt(r.qtdInspecionado)}</strong></td><td class="right"><strong>${fmt(r.qtdNc)}</strong></td><td>${badge(r.status)}</td><td class="acoes-cel"><button class="icone-btn" title="Editar" data-edit="inspecao" data-id="${r.id}">✎</button><button class="icone-btn del" title="Excluir" data-delete="inspecao" data-id="${r.id}">🗑</button></td></tr>`;
  }).join('')}</tbody></table></div>`;
}

function combineCards() {
  const map = new Map();
  const ensure = (name) => {
    const key = componentKey(name);
    if (!map.has(key)) map.set(key, { key, name: text(name), totalEntrada: 0, saldoEstimado: 0, lotes: new Set(), empresas: new Set(), pendentes: 0, foraEstoque: 0, inspecoes: 0, qtdInspecionado: 0, qtdNc: 0, status: new Set() });
    return map.get(key);
  };
  state.db.estoque.forEach((r) => {
    const c = ensure(r.subcomponente);
    const empresa = empresaNomeById(state.db, r.empresaId) || r.empresaNome;
    c.totalEntrada += num(r.quantidadeEntrada);
    c.saldoEstimado += num(r.saldoAtual);
    if (r.lote) c.lotes.add(r.lote);
    if (empresa) c.empresas.add(empresa);
    if (r.statusEstoque === 'Pendente') c.pendentes += 1;
    if (r.statusEstoque === 'Fora do estoque') c.foraEstoque += 1;
  });
  state.db.inspecoes.forEach((r) => {
    const c = ensure(r.subcomponente);
    const empresa = empresaNomeById(state.db, r.empresaId) || r.empresaNome;
    c.inspecoes += 1;
    c.qtdInspecionado += num(r.qtdInspecionado);
    c.qtdNc += num(r.qtdNc);
    if (empresa) c.empresas.add(empresa);
    if (r.status) c.status.add(r.status);
  });
  return [...map.values()].map((c) => ({
    ...c,
    lotes: [...c.lotes],
    empresas: [...c.empresas],
    status: [...c.status],
    ncRate: c.qtdInspecionado ? c.qtdNc / c.qtdInspecionado * 100 : 0
  })).sort((a, b) => b.saldoEstimado - a.saldoEstimado || b.qtdInspecionado - a.qtdInspecionado || a.name.localeCompare(b.name, 'pt-BR'));
}
function renderCards() {
  const f = state.filters.cards;
  const cards = combineCards().filter((c) =>
    (f.hasNc !== 'Sim' || c.qtdNc > 0) &&
    (f.hasNc !== 'Não' || c.qtdNc <= 0) &&
    (f.hasStock !== 'Sim' || c.saldoEstimado > 0) &&
    (f.hasStock !== 'Não' || c.saldoEstimado <= 0) &&
    (!f.empresa || c.empresas.includes(f.empresa)) &&
    matches(`${c.name} ${c.empresas.join(' ')} ${c.status.join(' ')}`, f.query)
  );
  return `${hero()}
    <div class="barra-filtros">
      <div class="campo"><label>Busca</label><input type="search" value="${esc(f.query)}" data-filter="cards.query" placeholder="Buscar subcomponente, empresa ou status..."></div>
      <div class="campo"><label>Empresa</label><select data-filter="cards.empresa">${optionList(unique(combineCards().flatMap((c) => c.empresas)), f.empresa, 'Todas')}</select></div>
      <div class="campo"><label>Com NC?</label><select data-filter="cards.hasNc">${optionList(['Sim', 'Não'], f.hasNc, 'Todos')}</select></div>
      <div class="campo"><label>Com saldo?</label><select data-filter="cards.hasStock">${optionList(['Sim', 'Não'], f.hasStock, 'Todos')}</select></div>
      <button class="btn btn-secundario" data-clear-filters="cards" type="button">Limpar filtros</button>
    </div>
    <div class="toolbar"><div class="contador">${fmt(cards.length)} card(s) encontrado(s)</div><button class="btn btn-primario" type="button" data-modal="estoque">＋ Novo lote</button></div>
    ${cards.length ? `<div class="subcards">${cards.map(cardHtml).join('')}</div>` : empty('Nenhum card encontrado', 'Ajuste os filtros ou cadastre estoque/inspeções.')}`;
}
function cardHtml(c) {
  const cls = c.qtdNc > 0 ? 'nc' : c.pendentes > 0 ? 'pendente' : '';
  return `<article class="subcard ${cls}">
    <div class="toolbar" style="margin-bottom:6px"><h3>${esc(c.name)}</h3>${c.qtdNc > 0 ? badge('Com NC') : c.pendentes > 0 ? badge('Pendente') : badge('OK')}</div>
    <div class="card-grid">
      <div class="mini"><div class="rot">Saldo estimado</div><div class="num">${fmt(c.saldoEstimado)}</div></div>
      <div class="mini"><div class="rot">QTD NC</div><div class="num">${fmt(c.qtdNc)}</div></div>
      <div class="mini"><div class="rot">Inspecionado</div><div class="num">${fmt(c.qtdInspecionado)}</div></div>
      <div class="mini"><div class="rot">Lotes estoque</div><div class="num">${fmt(c.lotes.length)}</div></div>
    </div>
    <div class="meta"><strong>Entrada total:</strong> ${fmt(c.totalEntrada)}<br><strong>Pendências:</strong> ${fmt(c.pendentes)} registro(s)<br><strong>Taxa NC:</strong> ${pct(c.ncRate)}<br><strong>Empresas:</strong> ${esc(c.empresas.slice(0, 4).join(', ') || '—')}</div>
    <div style="margin-top:12px;display:flex;gap:7px;flex-wrap:wrap">${c.status.length ? c.status.slice(0, 5).map(badge).join('') : badge('Sem inspeção')}</div>
  </article>`;
}

function renderDados() {
  const bytes = new Blob([JSON.stringify(state.db)]).size;
  return `${hero()}
    <div class="aviso-info"><span>ℹ</span><div><strong>Importante:</strong> este sistema é 100% compatível com GitHub Pages. Os dados ficam salvos no navegador de quem usa. A base inicial foi montada a partir da planilha de subcomponentes; para uso multiusuário com sincronização entre pessoas, será necessário conectar um backend depois, como Supabase ou API própria.</div></div>
    <div class="grid-kpi">
      ${kpi('Empresas', fmt(state.db.empresas.length), 'cadastros salvos', 'var(--azul-claro)')}
      ${kpi('Estoque', fmt(state.db.estoque.length), 'lotes/entradas', 'var(--verde)')}
      ${kpi('Inspeções', fmt(state.db.inspecoes.length), 'registros executados', 'var(--verde-claro)')}
      ${kpi('Tamanho da base', `${(bytes / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} KB`, 'localStorage', 'var(--amarelo)')}
    </div>
    <div class="grid-graficos">
      ${panel('Backup dos dados', 'Baixe um JSON para guardar ou versionar no repositório', `<div class="form-acoes" style="justify-content:flex-start;margin-top:0"><button class="btn btn-primario" type="button" id="downloadJson">Baixar backup JSON</button><button class="btn btn-secundario" type="button" id="downloadCsvEstoque">CSV estoque</button><button class="btn btn-secundario" type="button" id="downloadCsvInspecoes">CSV inspeções</button></div>`)}
      ${panel('Restaurar backup', 'Aceita apenas JSON exportado por este sistema', `<div class="import-box"><input class="file-input" type="file" id="restoreFile" accept="application/json,.json"><button class="btn btn-verde" type="button" id="restoreBtn">Restaurar JSON selecionado</button></div>`)}
      ${panel('Manutenção', 'Ações administrativas locais', `<div class="form-acoes" style="justify-content:flex-start;margin-top:0"><button class="btn btn-secundario" type="button" id="reloadSeed">Recarregar base inicial</button><button class="btn btn-perigo" type="button" id="clearAll">Limpar todos os dados</button></div>`, 'span2')}
    </div>`;
}

function barList(data, suffix = '') {
  if (!data.length) return empty('Sem dados para exibir');
  const max = Math.max(...data.map((d) => num(d.value)), 1);
  return `<div class="chart-list">${data.map((d, i) => {
    const width = Math.max(2, (num(d.value) / max) * 100);
    const colors = ['var(--azul-claro)', 'var(--verde)', 'var(--verde-claro)', 'var(--amarelo)', 'var(--roxo)'];
    return `<div class="chart-row"><div class="chart-label" title="${esc(d.name)}">${esc(d.name)}</div><div class="chart-track"><div class="chart-fill" style="width:${width}%;background:${colors[i % colors.length]}"></div></div><div class="chart-value">${fmt(d.value)} ${esc(suffix)}</div></div>`;
  }).join('')}</div>`;
}
function donut(data) {
  if (!data.length) return empty('Sem dados para exibir');
  const total = data.reduce((s, d) => s + num(d.value), 0) || 1;
  let deg = 0;
  const colors = ['var(--azul-claro)', 'var(--verde)', 'var(--amarelo)', 'var(--erro)', 'var(--verde-claro)', 'var(--roxo)'];
  const stops = data.map((d, i) => {
    const start = deg;
    deg += (num(d.value) / total) * 360;
    return `${colors[i % colors.length]} ${start}deg ${deg}deg`;
  }).join(', ');
  return `<div class="donut-wrap"><div class="donut" style="background:conic-gradient(${stops})"></div><div class="legend">${data.map((d, i) => `<div class="legend-item"><span class="legend-left"><span class="legend-dot" style="background:${colors[i % colors.length]}"></span><span>${esc(d.name)}</span></span><strong>${fmt(d.value)}</strong></div>`).join('')}</div></div>`;
}
function lineChart(data) {
  if (!data.length) return empty('Sem dados semanais');
  const max = Math.max(...data.map((d) => num(d.value)), 1);
  return `<div class="line-chart">${data.map((d, i) => {
    const height = Math.max(3, (num(d.value) / max) * 165);
    return `<div class="line-bar" title="${esc(d.name)}: ${fmt(d.value)}"><div class="bar" style="height:${height}px;background:${i % 2 ? 'var(--azul-claro)' : 'var(--verde)'}"></div><small>${esc(d.name)}</small></div>`;
  }).join('')}</div>`;
}

function bindPage() {
  $$('[data-filter]').forEach((el) => {
    el.addEventListener('input', () => {
      const [scope, key] = el.dataset.filter.split('.');
      if (state.filters[scope]) state.filters[scope][key] = el.value;
      render();
    });
  });
  $$('[data-clear-filters]').forEach((btn) => btn.addEventListener('click', () => {
    const key = btn.dataset.clearFilters;
    Object.keys(state.filters[key]).forEach((k) => { state.filters[key][k] = ''; });
    render();
  }));
  $$('[data-modal]').forEach((btn) => btn.addEventListener('click', () => openModal(btn.dataset.modal)));
  $$('[data-edit]').forEach((btn) => btn.addEventListener('click', () => openModal(btn.dataset.edit, btn.dataset.id)));
  $$('[data-delete]').forEach((btn) => btn.addEventListener('click', () => deleteRecord(btn.dataset.delete, btn.dataset.id)));
  $('#downloadJson')?.addEventListener('click', downloadJson);
  $('#downloadCsvEstoque')?.addEventListener('click', () => downloadCsv('estoque'));
  $('#downloadCsvInspecoes')?.addEventListener('click', () => downloadCsv('inspecoes'));
  $('#restoreBtn')?.addEventListener('click', restoreJson);
  $('#reloadSeed')?.addEventListener('click', reloadSeed);
  $('#clearAll')?.addEventListener('click', clearAll);
}

function openModal(type, id = '') {
  state.modal = { type, id };
  const overlay = $('#modalOverlay');
  overlay.classList.add('ativo');
  overlay.setAttribute('aria-hidden', 'false');
  overlay.innerHTML = modalHtml(type, id);
  overlay.addEventListener('click', (ev) => { if (ev.target === overlay) closeModal(); });
  $('#closeModal')?.addEventListener('click', closeModal);
  $('#cancelModal')?.addEventListener('click', closeModal);
  $('#modalForm')?.addEventListener('submit', saveModal);
  $('#modalData')?.addEventListener('input', (ev) => {
    if (type === 'inspecao' && ev.target.name === 'diaInspecao') {
      const semana = $('#modalSemana');
      if (semana && !semana.dataset.manual) semana.value = isoWeek(ev.target.value);
    }
  });
  $('#modalSemana')?.addEventListener('input', () => { $('#modalSemana').dataset.manual = '1'; });
}
function closeModal() {
  const overlay = $('#modalOverlay');
  overlay.classList.remove('ativo');
  overlay.setAttribute('aria-hidden', 'true');
  overlay.innerHTML = '';
  state.modal = null;
}

function modalHtml(type, id) {
  const config = {
    empresa: { title: id ? 'Editar empresa' : 'Nova empresa', body: empresaForm(id) },
    estoque: { title: id ? 'Editar lançamento de estoque' : 'Novo lançamento de estoque', body: estoqueForm(id) },
    inspecao: { title: id ? 'Editar inspeção' : 'Nova inspeção', body: inspecaoForm(id) }
  }[type];
  return `<div class="modal" role="dialog" aria-modal="true"><div class="modal-cab"><h2>${esc(config.title)}</h2><button class="fechar-modal" id="closeModal" type="button" aria-label="Fechar">×</button></div><div class="modal-corpo"><form id="modalForm"><div id="modalData">${config.body}</div><div class="form-acoes"><button class="btn btn-secundario" type="button" id="cancelModal">Cancelar</button><button class="btn btn-primario" type="submit">Salvar</button></div></form></div></div>`;
}
function field(label, name, value = '', type = 'text', extra = '') {
  return `<div class="campo"><label>${esc(label)}</label><input type="${type}" name="${esc(name)}" value="${esc(value)}" ${extra}></div>`;
}
function selectField(label, name, options, value = '', all = '') {
  const opts = `${all ? `<option value="">${esc(all)}</option>` : ''}${options.map((o) => `<option value="${esc(o)}" ${o === value ? 'selected' : ''}>${esc(o)}</option>`).join('')}`;
  return `<div class="campo"><label>${esc(label)}</label><select name="${esc(name)}">${opts}</select></div>`;
}
function textareaField(label, name, value = '') {
  return `<div class="campo full"><label>${esc(label)}</label><textarea name="${esc(name)}">${esc(value)}</textarea></div>`;
}
function datalistEmpresas() {
  return `<datalist id="empresasList">${state.db.empresas.map((e) => `<option value="${esc(e.nome)}"></option>`).join('')}</datalist>`;
}
function empresaForm(id) {
  const r = state.db.empresas.find((e) => e.id === id) || { nome: '', tipo: 'Fornecedor', cidade: '', contato: '', status: 'Ativa', observacao: '' };
  return `<div class="form-grid">
    ${field('Nome da empresa *', 'nome', r.nome, 'text', 'required')}
    ${selectField('Tipo', 'tipo', TIPOS_EMPRESA, r.tipo)}
    ${field('Cidade/UF', 'cidade', r.cidade)}
    ${field('Contato', 'contato', r.contato)}
    ${selectField('Status', 'status', STATUS_EMPRESA, r.status)}
    ${textareaField('Observação', 'observacao', r.observacao)}
  </div>`;
}
function estoqueForm(id) {
  const r = state.db.estoque.find((e) => e.id === id) || { data: todayIso(), empresaId: '', empresaNome: '', subcomponente: '', codSap: '', lote: '', quantidadeEntrada: '', saldoAtual: '', amostragem: '', statusEstoque: 'Pendente', dataInspecao: '', obs: '' };
  const empresa = empresaNomeById(state.db, r.empresaId) || r.empresaNome;
  return `${datalistEmpresas()}<div class="form-grid">
    ${field('Data de entrada', 'data', r.data, 'date')}
    ${field('Empresa/Fábrica *', 'empresaNome', empresa, 'text', 'list="empresasList" required')}
    ${field('Subcomponente *', 'subcomponente', r.subcomponente, 'text', 'required')}
    ${field('Código SAP', 'codSap', r.codSap)}
    ${field('Lote *', 'lote', r.lote, 'text', 'required')}
    ${field('Quantidade de entrada', 'quantidadeEntrada', r.quantidadeEntrada, 'number', 'min="0" step="1"')}
    ${field('Saldo atual', 'saldoAtual', r.saldoAtual, 'number', 'min="0" step="1"')}
    ${field('Amostragem', 'amostragem', r.amostragem, 'number', 'min="0" step="1"')}
    ${selectField('Status do estoque', 'statusEstoque', STATUS_ESTOQUE, r.statusEstoque)}
    ${field('Data da inspeção', 'dataInspecao', r.dataInspecao, 'date')}
    ${textareaField('Observação', 'obs', r.obs)}
  </div>`;
}
function inspecaoForm(id) {
  const r = state.db.inspecoes.find((e) => e.id === id) || { diaInspecao: todayIso(), semana: isoWeek(todayIso()), local: '', subcomponente: '', codSap: '', empresaId: '', empresaNome: '', lote: '', qtdEstoque: '', qtdAmostra: '', qtdInspecionado: '', qtdNc: 0, status: 'Aprovado', observacao: '' };
  const empresa = empresaNomeById(state.db, r.empresaId) || r.empresaNome;
  return `${datalistEmpresas()}<div class="form-grid">
    ${field('Dia da inspeção', 'diaInspecao', r.diaInspecao, 'date')}
    <div class="campo"><label>Semana</label><input id="modalSemana" type="text" name="semana" value="${esc(r.semana)}" placeholder="2026-S21"></div>
    ${field('Local', 'local', r.local)}
    ${field('Subcomponente/Material *', 'subcomponente', r.subcomponente, 'text', 'required')}
    ${field('Código SAP', 'codSap', r.codSap)}
    ${field('Fornecedor/Empresa *', 'empresaNome', empresa, 'text', 'list="empresasList" required')}
    ${field('Lote/BAG *', 'lote', r.lote, 'text', 'required')}
    ${field('QTD Estoque', 'qtdEstoque', r.qtdEstoque, 'number', 'min="0" step="1"')}
    ${field('QTD Amostra', 'qtdAmostra', r.qtdAmostra, 'number', 'min="0" step="1"')}
    ${field('QTD Inspecionado', 'qtdInspecionado', r.qtdInspecionado, 'number', 'min="0" step="1"')}
    ${field('QTD NC', 'qtdNc', r.qtdNc, 'number', 'min="0" step="1"')}
    ${selectField('Status', 'status', STATUS_INSPECAO, r.status)}
    ${textareaField('Observação', 'observacao', r.observacao)}
  </div>`;
}

function formDataObject(form) {
  return Object.fromEntries(new FormData(form).entries());
}
function saveModal(ev) {
  ev.preventDefault();
  const { type, id } = state.modal || {};
  const data = formDataObject(ev.currentTarget);
  if (type === 'empresa') saveEmpresa(data, id);
  if (type === 'estoque') saveEstoque(data, id);
  if (type === 'inspecao') saveInspecao(data, id);
  DB.save(id ? 'Registro editado' : 'Novo registro cadastrado');
  closeModal();
  render();
  App.toast(id ? 'Registro atualizado com sucesso.' : 'Registro cadastrado com sucesso.');
}
function saveEmpresa(data, id) {
  const target = state.db.empresas.find((e) => e.id === id) || { id: uid('EMP') };
  Object.assign(target, {
    nome: text(data.nome, ''),
    tipo: text(data.tipo, 'Fornecedor'),
    cidade: text(data.cidade, ''),
    contato: text(data.contato, ''),
    status: text(data.status, 'Ativa'),
    observacao: text(data.observacao, '')
  });
  if (!id) state.db.empresas.push(target);
  syncCompanyNames();
}
function saveEstoque(data, id) {
  const empresaId = companyIdFromName(data.empresaNome);
  const target = state.db.estoque.find((e) => e.id === id) || { id: uid('EST') };
  Object.assign(target, {
    data: data.data || '',
    empresaId,
    empresaNome: text(data.empresaNome, ''),
    subcomponente: text(data.subcomponente, ''),
    codSap: text(data.codSap, ''),
    lote: text(data.lote, ''),
    quantidadeEntrada: num(data.quantidadeEntrada),
    saldoAtual: data.saldoAtual === '' ? num(data.quantidadeEntrada) : num(data.saldoAtual),
    amostragem: num(data.amostragem),
    statusEstoque: text(data.statusEstoque, 'Pendente'),
    dataInspecao: data.dataInspecao || '',
    obs: text(data.obs, '')
  });
  if (!id) state.db.estoque.push(target);
}
function saveInspecao(data, id) {
  const empresaId = companyIdFromName(data.empresaNome);
  const target = state.db.inspecoes.find((e) => e.id === id) || { id: uid('INSP') };
  Object.assign(target, {
    diaInspecao: data.diaInspecao || '',
    semana: text(data.semana, '') || isoWeek(data.diaInspecao),
    local: text(data.local, ''),
    subcomponente: text(data.subcomponente, ''),
    codSap: text(data.codSap, ''),
    empresaId,
    empresaNome: text(data.empresaNome, ''),
    lote: text(data.lote, ''),
    qtdEstoque: num(data.qtdEstoque),
    qtdAmostra: num(data.qtdAmostra),
    qtdInspecionado: num(data.qtdInspecionado),
    qtdNc: num(data.qtdNc),
    status: text(data.status, 'Pendente'),
    observacao: text(data.observacao, '')
  });
  if (!id) state.db.inspecoes.push(target);
}
function syncCompanyNames() {
  state.db.estoque.forEach((r) => { r.empresaNome = empresaNomeById(state.db, r.empresaId) || r.empresaNome; });
  state.db.inspecoes.forEach((r) => { r.empresaNome = empresaNomeById(state.db, r.empresaId) || r.empresaNome; });
}

function deleteRecord(type, id) {
  const labels = { empresa: 'empresa', estoque: 'registro de estoque', inspecao: 'inspeção' };
  if (!confirm(`Excluir este ${labels[type]}? Esta ação não pode ser desfeita.`)) return;
  if (type === 'empresa') {
    const used = state.db.estoque.some((r) => r.empresaId === id) || state.db.inspecoes.some((r) => r.empresaId === id);
    if (used && !confirm('Esta empresa está vinculada a estoque/inspeções. Excluir mesmo assim? Os registros manterão apenas o nome salvo.')) return;
    state.db.empresas = state.db.empresas.filter((e) => e.id !== id);
  }
  if (type === 'estoque') state.db.estoque = state.db.estoque.filter((r) => r.id !== id);
  if (type === 'inspecao') state.db.inspecoes = state.db.inspecoes.filter((r) => r.id !== id);
  DB.save('Registro excluído');
  render();
  App.toast('Registro excluído.');
}

function download(filename, content, mime = 'application/octet-stream') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
function downloadJson() {
  download(`backup-subcomponentes-${todayIso()}.json`, JSON.stringify(state.db, null, 2), 'application/json;charset=utf-8');
}
function csvEscape(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}
function toCsv(rows, headers) {
  return [headers.map((h) => csvEscape(h.label)).join(';'), ...rows.map((r) => headers.map((h) => csvEscape(h.get(r))).join(';'))].join('\n');
}
function downloadCsv(type) {
  if (type === 'estoque') {
    const csv = toCsv(state.db.estoque, [
      { label: 'Data', get: (r) => r.data }, { label: 'Empresa', get: (r) => empresaNomeById(state.db, r.empresaId) || r.empresaNome }, { label: 'Subcomponente', get: (r) => r.subcomponente }, { label: 'SAP', get: (r) => r.codSap }, { label: 'Lote', get: (r) => r.lote }, { label: 'Entrada', get: (r) => r.quantidadeEntrada }, { label: 'Saldo', get: (r) => r.saldoAtual }, { label: 'Amostragem', get: (r) => r.amostragem }, { label: 'Status', get: (r) => r.statusEstoque }, { label: 'Obs', get: (r) => r.obs }
    ]);
    download(`estoque-subcomponentes-${todayIso()}.csv`, csv, 'text/csv;charset=utf-8');
  }
  if (type === 'inspecoes') {
    const csv = toCsv(state.db.inspecoes, [
      { label: 'Data', get: (r) => r.diaInspecao }, { label: 'Semana', get: (r) => r.semana }, { label: 'Local', get: (r) => r.local }, { label: 'Subcomponente', get: (r) => r.subcomponente }, { label: 'SAP', get: (r) => r.codSap }, { label: 'Empresa', get: (r) => empresaNomeById(state.db, r.empresaId) || r.empresaNome }, { label: 'Lote', get: (r) => r.lote }, { label: 'Qtd estoque', get: (r) => r.qtdEstoque }, { label: 'Qtd amostra', get: (r) => r.qtdAmostra }, { label: 'Qtd inspecionado', get: (r) => r.qtdInspecionado }, { label: 'Qtd NC', get: (r) => r.qtdNc }, { label: 'Status', get: (r) => r.status }, { label: 'Observação', get: (r) => r.observacao }
    ]);
    download(`inspecoes-subcomponentes-${todayIso()}.csv`, csv, 'text/csv;charset=utf-8');
  }
}
async function restoreJson() {
  const file = $('#restoreFile')?.files?.[0];
  if (!file) return App.toast('Selecione um arquivo JSON para restaurar.', 'erro');
  try {
    const content = await file.text();
    const parsed = JSON.parse(content);
    if (!confirm('Restaurar este backup e substituir os dados atuais?')) return;
    DB.replace(parsed, `Backup restaurado: ${file.name}`);
    App.toast('Backup restaurado com sucesso.');
  } catch (error) {
    App.toast('Não consegui restaurar o JSON. Confira o arquivo.', 'erro');
  }
}
async function reloadSeed() {
  if (!confirm('Recarregar a base inicial e substituir os dados atuais?')) return;
  state.db = await loadSeed();
  DB.save('Base inicial recarregada');
  render();
  App.toast('Base inicial recarregada.');
}
function clearAll() {
  if (!confirm('Limpar todos os dados salvos neste navegador?')) return;
  state.db = emptyDb();
  DB.save('Base limpa pelo usuário');
  render();
  App.toast('Dados limpos.');
}

App.init();
DB.init().then(render);
