/* Liga o site à Planilha Google por meio do Google Apps Script (google-apps-script/Code.gs).
   A senha é conferida no servidor; o navegador só guarda um passe temporário da sessão. */
(function () {
  'use strict';
  if (window.claude) return;
  var URL_API = ((window.ALIMENTOS_CONFIG || {}).apiUrl || '').trim();
  var CHAVE = 'alimentos-passe';
  var passe = null;
  try { passe = sessionStorage.getItem(CHAVE); } catch (e) {}
  function guardar(p) { passe = p || null; try { p ? sessionStorage.setItem(CHAVE, p) : sessionStorage.removeItem(CHAVE); } catch (e) {} }

  async function api(acao, dados) {
    var corpo = Object.assign({ acao: acao, passe: passe }, dados || {});
    var r = await fetch(URL_API, { method: 'POST', redirect: 'follow', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(corpo) });
    var j = await r.json();
    if (j.erro === 'sessao') { guardar(null); location.reload(); throw { code: 'unavailable', message: 'Sessão encerrada.' }; }
    if (j.erro) throw { code: 'unavailable', message: j.mensagem || j.erro };
    return j;
  }

  var cache = { produtos: {}, lancamentos: {}, cesta: {} }, carregado = false, carregando = null, ouvintes = [];
  function fotoDoc(col, id) { var d = cache[col] && cache[col][id]; return { id: id, exists: !!d, data: function () { return d; } }; }
  function fotoCol(col) { var ids = Object.keys(cache[col] || {}).sort(); return { docs: ids.map(function (id) { return fotoDoc(col, id); }), size: ids.length, empty: !ids.length }; }
  function avisar() { ouvintes.forEach(function (o) { try { o.fn(o.id ? fotoDoc(o.col, o.id) : fotoCol(o.col)); } catch (e) { console.error(e); } }); }
  function carregar() {
    if (carregando) return carregando;
    carregando = api('tudo').then(function (j) { cache = j.dados; carregado = true; avisar(); })
      .catch(function (e) { ouvintes.forEach(function (o) { if (!carregado && o.erro) o.erro(e); }); })
      .then(function () { carregando = null; });
    return carregando;
  }
  function ouvir(col, id, fn, erro) { var o = { col: col, id: id, fn: fn, erro: erro }; ouvintes.push(o); if (carregado) setTimeout(function () { fn(id ? fotoDoc(col, id) : fotoCol(col)); }); else carregar(); return function () { ouvintes = ouvintes.filter(function (x) { return x !== o; }); }; }
  // traz o que outras pessoas lançaram: a cada 2 minutos e quando a aba volta a ficar visível
  setInterval(function () { if (carregado && !document.hidden) carregar(); }, 120000);
  document.addEventListener('visibilitychange', function () { if (carregado && !document.hidden) carregar(); });

  var db = {
    doc: function (caminho) {
      var p = caminho.split('/'), col = p[0], id = p[1];
      return {
        id: id, path: caminho,
        get: async function () { if (!carregado && col !== 'config') await carregar(); return fotoDoc(col, id); },
        set: async function (doc) { await api('gravar', { col: col, id: id, doc: doc }); (cache[col] = cache[col] || {})[id] = doc; avisar(); },
        update: async function (parte) { var novo = Object.assign({}, cache[col] && cache[col][id], parte); await api('gravar', { col: col, id: id, doc: novo }); (cache[col] = cache[col] || {})[id] = novo; avisar(); },
        delete: async function () { await api('apagar', { col: col, id: id }); if (cache[col]) delete cache[col][id]; avisar(); },
        onSnapshot: function (fn, erro) { return ouvir(col, id, fn, erro); }
      };
    },
    collection: function (col) { return { path: col, onSnapshot: function (fn, erro) { return ouvir(col, null, fn, erro); } }; }
  };
  var auth = {
    status: function () { return api('status'); },
    entrar: async function (senha) { var j = await api('entrar', { senha: senha }); if (j.ok) guardar(j.passe); return j; },
    definir: async function (senha) { var j = await api('definirSenha', { senha: senha }); guardar(j.passe); return j; },
    trocar: async function (atual, nova) { var j = await api('trocarSenha', { atual: atual, nova: nova }); if (j.ok) guardar(j.passe); return j; }
  };
  var user = { canEdit: async function () { return true; }, can: async function () { return true; }, isOwner: async function () { return true; } };
  var downloads = { save: async function (o) {
    var blob = o.data instanceof Blob ? o.data : new Blob([o.data]);
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = o.filename; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 2000); return { status: 'saved' };
  } };
  var partes = { db: URL_API ? db : null, user: user, downloads: downloads };
  window.claude = { auth: URL_API ? auth : null, use: async function (nome) { return partes[nome] || null; } };
})();
