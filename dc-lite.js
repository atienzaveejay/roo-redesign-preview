// Minimal renderer for the canvas's .dc.html pages: {{holes}}, sc-for, sc-if, onClick, setState.
(function () {
  class DCLogic {
    constructor(props) { this.props = props || {}; this.state = {}; }
    setState(patch) { Object.assign(this.state, typeof patch === 'function' ? patch(this.state) : patch); render(); }
    forceUpdate() { render(); }
  }
  window.DCLogic = DCLogic;

  const tpl = document.getElementById('dc-template');
  const root = document.getElementById('dc-root');
  const src = document.getElementById('dc-logic');
  let props = {};
  try {
    const decl = JSON.parse(src.getAttribute('data-props') || '{}');
    for (const k in decl) if (k[0] !== '$' && decl[k] && 'default' in decl[k]) props[k] = decl[k].default;
  } catch (e) {}
  const Component = new Function('DCLogic', src.textContent + '\n;return Component;')(DCLogic);
  const comp = new Component(props);
  if (!comp.state) comp.state = {};

  const WHOLE = /^\{\{\s*([^{}]+?)\s*\}\}$/;
  const ANY = /\{\{\s*([^{}]+?)\s*\}\}/g;
  function look(path, scope) {
    if (path === 'true') return true;
    if (path === 'false') return false;
    if (/^-?\d+(\.\d+)?$/.test(path)) return Number(path);
    let v = scope;
    for (const part of path.split('.')) { if (v == null) return undefined; v = v[part]; }
    return v;
  }
  function fill(str, scope) { return str.replace(ANY, (_, p) => { const v = look(p, scope); return v == null ? '' : String(v); }); }

  function walk(node, scope) {
    if (node.nodeType === 3) { if (node.nodeValue.includes('{{')) node.nodeValue = fill(node.nodeValue, scope); return; }
    if (node.nodeType !== 1) return;
    const tag = node.tagName.toLowerCase();
    if (tag === 'sc-for') {
      const m = (node.getAttribute('list') || '').match(WHOLE);
      const list = (m && look(m[1], scope)) || [];
      const as = node.getAttribute('as') || 'item';
      const frag = document.createDocumentFragment();
      list.forEach((item, i) => {
        const s = Object.assign({}, scope, { [as]: item, $index: i });
        for (const child of Array.from(node.childNodes)) { const c = child.cloneNode(true); frag.appendChild(c); walk(c, s); }
      });
      node.replaceWith(frag);
      return;
    }
    if (tag === 'sc-if') {
      const m = (node.getAttribute('value') || '').match(WHOLE);
      const ok = m ? look(m[1], scope) : false;
      if (ok) { const kids = Array.from(node.childNodes); node.replaceWith(...kids); kids.forEach(k => walk(k, scope)); }
      else node.remove();
      return;
    }
    for (const attr of Array.from(node.attributes)) {
      if (!attr.value.includes('{{')) continue;
      const m = attr.value.match(WHOLE);
      if (attr.name.startsWith('on')) {
        const fn = m ? look(m[1], scope) : null;
        node.removeAttribute(attr.name);
        if (typeof fn === 'function') node.addEventListener(attr.name.slice(2), fn);
        continue;
      }
      const v = m ? look(m[1], scope) : fill(attr.value, scope);
      if (v === false || v == null) node.removeAttribute(attr.name);
      else node.setAttribute(attr.name, v === true ? 'true' : String(v));
    }
    for (const child of Array.from(node.childNodes)) walk(child, scope);
  }

  function render() {
    const vals = comp.renderVals ? comp.renderVals() : {};
    const frag = tpl.content.cloneNode(true);
    for (const child of Array.from(frag.childNodes)) walk(child, vals);
    root.replaceChildren(frag);
    root.querySelectorAll('video[autoplay]').forEach(v => { v.muted = true; v.play && v.play().catch(() => {}); });
  }
  render();
  if (comp.componentDidMount) comp.componentDidMount();
})();
