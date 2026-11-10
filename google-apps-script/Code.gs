/**
 * Servidor do Controle de Alimentos (Google Apps Script).
 * Fica preso a uma Planilha Google: guarda os dados nas abas Produtos, Meses, Itens e Cesta
 * e confere a senha de acesso aqui no servidor.
 * Publicar: Implantar > Nova implantação > App da Web > Executar como: Eu > Acesso: Qualquer pessoa.
 */
var ABAS = {
  Produtos: ['id', 'nome', 'ativo', 'ordem', 'kgPorUnidade', 'criadoEm', 'atualizadoEm'],
  Meses: ['id', 'ano', 'mes', 'unidade', 'cestas', 'saidaTotalKg', 'obs', 'origem', 'criadoEm', 'atualizadoEm', 'historico'],
  Itens: ['lancamento', 'ano', 'mes', 'unidade', 'produto', 'nomeProduto', 'arrecadacaoKg', 'arrecadacaoUn', 'compraKg', 'compraUn', 'saidaKg', 'saidaUn', 'obs'],
  Cesta: ['qtd', 'produto', 'pesoKg', 'atualizadoEm']
};
var CAMPOS_ITEM = { arrecadacaoKg: 'aKg', arrecadacaoUn: 'aUn', compraKg: 'cKg', compraUn: 'cUn', saidaKg: 'sKg', saidaUn: 'sUn', obs: 'obs' };
var HORAS_SESSAO = 12, MAX_FALHAS = 5, ESPERA_SEG = 60, RODADAS = 300;

function doGet() { return ContentService.createTextOutput('Servidor do Controle de Alimentos no ar.'); }
function doPost(e) {
  var saida;
  try { saida = rotear(JSON.parse(e.postData.contents)); }
  catch (err) { saida = { erro: 'falha', mensagem: String(err && err.message || err) }; }
  return ContentService.createTextOutput(JSON.stringify(saida)).setMimeType(ContentService.MimeType.JSON);
}

function rotear(req) {
  var props = PropertiesService.getScriptProperties();
  var temSenha = !!props.getProperty('senhaHash');
  var logado = passeValido(req.passe, props);
  switch (req.acao) {
    case 'status': return { temSenha: temSenha, logado: logado };
    case 'definirSenha':
      if (temSenha) throw new Error('A senha já foi definida.');
      validarNova(req.senha); salvarSenha(props, req.senha);
      return { ok: true, passe: novoPasse(props) };
    case 'entrar': return entrar(req.senha, props);
    case 'trocarSenha':
      if (!logado) return { erro: 'sessao' };
      if (!confere(req.atual, props)) return { ok: false };
      validarNova(req.nova); salvarSenha(props, req.nova);
      return { ok: true, passe: novoPasse(props) };
  }
  if (!logado) return { erro: 'sessao' };
  if (req.acao === 'tudo') return { dados: lerTudo() };
  var trava = LockService.getScriptLock(); trava.waitLock(25000);
  try {
    if (req.acao === 'gravar') { gravar(req.col, String(req.id), req.doc); return { ok: true }; }
    if (req.acao === 'apagar') { apagar(req.col, String(req.id)); return { ok: true }; }
  } finally { trava.releaseLock(); }
  throw new Error('Ação desconhecida: ' + req.acao);
}

/* ---------- senha e sessão ---------- */
function b64(bytes) { return Utilities.base64Encode(bytes); }
function embaralhar(senha, sal) { var h = String(senha); for (var i = 0; i < RODADAS; i++) h = b64(Utilities.computeHmacSha256Signature(h + String(senha), sal)); return h; }
function validarNova(s) { if (typeof s !== 'string' || s.length < 4 || s.length > 100) throw new Error('A senha precisa ter pelo menos 4 caracteres.'); }
function salvarSenha(props, senha) {
  var sal = Utilities.getUuid() + Utilities.getUuid();
  props.setProperty('senhaSal', sal); props.setProperty('senhaHash', embaralhar(senha, sal));
  props.setProperty('segredo', Utilities.getUuid() + Utilities.getUuid());   // encerra as sessões antigas
}
function confere(senha, props) { return typeof senha === 'string' && embaralhar(senha, props.getProperty('senhaSal')) === props.getProperty('senhaHash'); }
function entrar(senha, props) {
  var cache = CacheService.getScriptCache();
  if (cache.get('bloqueio')) return { ok: false, espera: ESPERA_SEG };
  if (confere(senha, props)) { cache.remove('falhas'); return { ok: true, passe: novoPasse(props) }; }
  var n = Number(cache.get('falhas') || 0) + 1;
  if (n >= MAX_FALHAS) { cache.put('bloqueio', '1', ESPERA_SEG); cache.remove('falhas'); return { ok: false, espera: ESPERA_SEG }; }
  cache.put('falhas', String(n), 600);
  return { ok: false };
}
function assinar(texto, props) { return b64(Utilities.computeHmacSha256Signature(texto, props.getProperty('segredo'))); }
function novoPasse(props) { var fim = String(Date.now() + HORAS_SESSAO * 3600000); return fim + '.' + assinar(fim, props); }
function passeValido(passe, props) {
  if (typeof passe !== 'string' || !props.getProperty('segredo')) return false;
  var p = passe.split('.'); if (p.length !== 2) return false;
  return Number(p[0]) > Date.now() && assinar(p[0], props) === p[1];
}

/* ---------- planilha ---------- */
function aba(nome) {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), sh = ss.getSheetByName(nome);
  if (!sh) { sh = ss.insertSheet(nome); sh.getRange(1, 1, 1, ABAS[nome].length).setValues([ABAS[nome]]); }
  return sh;
}
function limpo(v) { if (v === '' || v === null || v === undefined) return null; if (v instanceof Date) return v.toISOString(); return v; }
function lerAba(nome) {
  var v = aba(nome).getDataRange().getValues(), cab = ABAS[nome], out = [];
  for (var i = 1; i < v.length; i++) { var o = {}, vazio = true; for (var c = 0; c < cab.length; c++) { o[cab[c]] = limpo(v[i][c]); if (o[cab[c]] !== null) vazio = false; } if (!vazio) out.push(o); }
  return out;
}
function celula(v) { if (v === null || v === undefined) return ''; if (typeof v === 'string' && /^[=+\-@]/.test(v)) return "'" + v; return v; }
function gravarAba(nome, linhas) {
  var sh = aba(nome), cab = ABAS[nome];
  var m = [cab].concat(linhas.map(function (o) { return cab.map(function (k) { return celula(o[k]); }); }));
  sh.clearContents(); sh.getRange(1, 1, m.length, cab.length).setValues(m);
}
function num(v) { return v === null ? null : Number(v); }

function lerTudo() {
  var produtos = {}, lanc = {}, cesta = {};
  lerAba('Produtos').forEach(function (p) { produtos[String(p.id)] = { nome: String(p.nome), ativo: p.ativo !== false && p.ativo !== 'FALSE', ordem: num(p.ordem), kgPorUnidade: num(p.kgPorUnidade), criadoEm: p.criadoEm, atualizadoEm: p.atualizadoEm }; });
  lerAba('Meses').forEach(function (m) {
    var hist = []; try { hist = m.historico ? JSON.parse(m.historico) : []; } catch (e) {}
    lanc[String(m.id)] = { ano: num(m.ano), mes: num(m.mes), unidade: String(m.unidade), itens: {}, cestas: num(m.cestas), saidaTotalKg: num(m.saidaTotalKg), obs: m.obs === null ? '' : String(m.obs), origem: m.origem || 'site', criadoEm: m.criadoEm, atualizadoEm: m.atualizadoEm, historico: hist };
  });
  lerAba('Itens').forEach(function (r) {
    var l = lanc[String(r.lancamento)]; if (!l) return; var it = {};
    for (var k in CAMPOS_ITEM) if (r[k] !== null) it[CAMPOS_ITEM[k]] = k === 'obs' ? String(r[k]) : Number(r[k]);
    l.itens[String(r.produto)] = it;
  });
  var itensCesta = lerAba('Cesta');
  if (itensCesta.length) cesta.padrao = { itens: itensCesta.map(function (c) { return { qtd: num(c.qtd), produto: String(c.produto), pesoKg: num(c.pesoKg) }; }), atualizadoEm: itensCesta[0].atualizadoEm };
  return { produtos: produtos, lancamentos: lanc, cesta: cesta };
}

function gravar(col, id, doc) {
  if (!doc || typeof doc !== 'object') throw new Error('Documento inválido.');
  if (col === 'produtos') {
    var ps = lerAba('Produtos').filter(function (p) { return String(p.id) !== id; });
    ps.push({ id: id, nome: doc.nome, ativo: doc.ativo !== false, ordem: doc.ordem, kgPorUnidade: doc.kgPorUnidade, criadoEm: doc.criadoEm, atualizadoEm: doc.atualizadoEm });
    ps.sort(function (a, b) { return (a.ordem || 999) - (b.ordem || 999); });
    gravarAba('Produtos', ps);
  } else if (col === 'lancamentos') {
    if (id !== doc.ano + '-' + ('0' + doc.mes).slice(-2) + '-' + doc.unidade) throw new Error('Lançamento com identificação inválida.');
    var nomes = {}; lerAba('Produtos').forEach(function (p) { nomes[String(p.id)] = p.nome; });
    var ms = lerAba('Meses').filter(function (m) { return String(m.id) !== id; });
    ms.push({ id: id, ano: doc.ano, mes: doc.mes, unidade: doc.unidade, cestas: doc.cestas, saidaTotalKg: doc.saidaTotalKg, obs: doc.obs, origem: doc.origem, criadoEm: doc.criadoEm, atualizadoEm: doc.atualizadoEm, historico: JSON.stringify(doc.historico || []) });
    ms.sort(function (a, b) { return String(a.id) < String(b.id) ? -1 : 1; });
    var its = lerAba('Itens').filter(function (r) { return String(r.lancamento) !== id; });
    Object.keys(doc.itens || {}).forEach(function (pid) {
      var it = doc.itens[pid], linha = { lancamento: id, ano: doc.ano, mes: doc.mes, unidade: doc.unidade, produto: pid, nomeProduto: nomes[pid] || pid };
      for (var k in CAMPOS_ITEM) linha[k] = it[CAMPOS_ITEM[k]];
      its.push(linha);
    });
    its.sort(function (a, b) { return String(a.lancamento) < String(b.lancamento) ? -1 : String(a.lancamento) > String(b.lancamento) ? 1 : 0; });
    gravarAba('Meses', ms); gravarAba('Itens', its);
  } else if (col === 'cesta') {
    gravarAba('Cesta', (doc.itens || []).map(function (c) { return { qtd: c.qtd, produto: c.produto, pesoKg: c.pesoKg, atualizadoEm: doc.atualizadoEm }; }));
  } else throw new Error('Coleção desconhecida: ' + col);
}
function apagar(col, id) {
  if (col !== 'lancamentos') throw new Error('Só lançamentos podem ser excluídos.');
  gravarAba('Meses', lerAba('Meses').filter(function (m) { return String(m.id) !== id; }));
  gravarAba('Itens', lerAba('Itens').filter(function (r) { return String(r.lancamento) !== id; }));
}
