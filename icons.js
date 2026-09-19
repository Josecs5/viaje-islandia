/* Iconos SVG (trazo, 24×24) y conversión automática de emojis a iconos.
 * Los emojis se ven distinto en cada sistema y desentonan con el diseño; aquí
 * se sustituyen por SVG que heredan el color del texto (currentColor).
 * app.js escribe emojis en el texto como siempre; un MutationObserver los
 * convierte en cuanto aparecen en el DOM.
 */
'use strict';
(function () {
  const P = {
    plane: '<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>',
    euro: '<path d="M4 10h12M4 14h9M19 6a7.7 7.7 0 0 0-5.2-2A7.9 7.9 0 0 0 6 12c0 4.4 3.5 8 7.8 8 2 0 3.8-.8 5.2-2"/>',
    bulb: '<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5M9 18h6M10 22h4"/>',
    car: '<path d="M5 17H3v-4l2-5.5h11L19 13v4h-2M9 17h6M4.5 13h15"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/>',
    bed: '<path d="M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8M2 17h20M6 10V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v4"/>',
    mountain: '<path d="m8 3 4 8 5-5 5 15H2L8 3z"/>',
    utensils: '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2M7 2v20M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>',
    pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/>',
    check: '<path d="M22 11.1V12a10 10 0 1 1-5.9-9.1M22 4 12 14l-3-3"/>',
    backpack: '<path d="M4 10a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2ZM9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M8 21v-5h8v5M8 10h8"/>',
    pencil: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    swap: '<path d="M7 4v16M3 8l4-4 4 4M17 20V4M13 16l4 4 4-4"/>',
    briefcase: '<path d="M4 7h16a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1ZM9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M3 13h18"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
    bag: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4ZM3 6h18M16 10a4 4 0 0 1-8 0"/>',
    wind: '<path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2M9.6 4.6A2 2 0 1 1 11 8H2M12.6 19.4A2 2 0 1 0 14 16H2"/>',
    rain: '<path d="M4 14.9A7 7 0 1 1 15.7 8h1.8a4.5 4.5 0 0 1 2.5 8.2M16 14v6M8 14v6M12 16v6"/>',
    cloudsun: '<path d="M12 2v2M4.9 4.9l1.4 1.4M2 12h2M19.1 4.9l-1.4 1.4M20 12h2"/><path d="M16 12a4 4 0 0 0-7.7-1.3"/><path d="M8 21h9a4 4 0 0 0 .4-8 5.5 5.5 0 0 0-10.4 1.5A3.3 3.3 0 0 0 8 21Z"/>',
    aurora: '<path d="M2 17c3 0 3-9 6-9s3 9 6 9 3-9 8-9"/><path d="M2 21c3 0 3-5 6-5s3 5 6 5 3-5 8-5" opacity=".6"/><path d="M19 3v3M17.5 4.5h3"/>',
    fuel: '<path d="M3 22h12M4 9h10M14 22V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v18M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 4 0V9.8a2 2 0 0 0-.6-1.4L18 5"/>',
    map: '<path d="M14.1 4.6 9 3 3 5v16l6-2 6 2 6-2V3l-6 2ZM9 3v16M15 5v16"/>',
    note: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9ZM14 3v6h6M8 13h8M8 17h5"/>',
    cart: '<path d="M2 3h3l2.7 12.4a2 2 0 0 0 2 1.6h8.6a2 2 0 0 0 2-1.6L22 7H6"/><circle cx="10" cy="21" r="1"/><circle cx="18" cy="21" r="1"/>',
    camera: '<path d="M14.5 4h-5L8 6H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-3Z"/><circle cx="12" cy="13" r="3.5"/>',
    compass: '<circle cx="12" cy="12" r="10"/><path d="m16 8-2 6-6 2 2-6Z"/>',
    siren: '<path d="M7 18v-6a5 5 0 0 1 10 0v6M5 21h14M12 3V2M4.6 6.1l-.8-.8M19.4 6.1l.8-.8M2 12H1M23 12h-1"/>',
    heartpulse: '<path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7Z"/><path d="M3.2 12h4l2-3 3 6 2-3h2.8"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/>',
    phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z"/>',
    road: '<path d="M4 21 8 3M20 21 16 3M12 4v3M12 11v3M12 18v3"/>',
    spa: '<path d="M4 12h16a1 1 0 0 1 1 1v2a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4v-2a1 1 0 0 1 1-1ZM6 12V5a2 2 0 0 1 3.5-1.3M7 19l-1 2M17 19l1 2"/>',
    leaf: '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.5 19 2c1 2 2 4.2 2 8 0 5.5-4.8 10-10 10ZM2 21c0-3 1.9-5.4 5.5-6.5 3-.9 5.5-1 8.5-4"/>',
    eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
    chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z"/>',
    bookmark: '<path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2Z"/>',
    dot: '<circle cx="12" cy="12" r="5" fill="currentColor" stroke="none"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
    newmoon: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="9" fill="currentColor" opacity=".3" stroke="none"/>',
    timer: '<path d="M10 2h4M12 14l3-3M12 22a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z"/>',
    chevron: '<path d="m6 9 6 6 6-6"/>',
    arrowright: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    route: '<circle cx="6" cy="19" r="2.5"/><circle cx="18" cy="5" r="2.5"/><path d="M8.5 19H16a3.5 3.5 0 0 0 0-7H8a3.5 3.5 0 0 1 0-7h7.5"/>',
    gauge: '<path d="M12 14l4-4M3.3 17a10 10 0 1 1 17.4 0"/>',
    sunrise: '<path d="M12 2v6M4.2 10.2l1.4 1.4M1 18h2M21 18h2M18.4 11.6l1.4-1.4M23 22H1M16 18a4 4 0 0 0-8 0M8 6l4-4 4 4"/>'
  };

  // emoji → nombre de icono
  const MAP = {
    '✈': 'plane', '💶': 'euro', '💡': 'bulb', '🚗': 'car', '🛏': 'bed', '🥾': 'mountain',
    '🍴': 'utensils', '🍽': 'utensils', '📍': 'pin', '🗑': 'trash', '✅': 'check', '🎒': 'backpack',
    '✎': 'pencil', '✍': 'pencil', '↕': 'swap', '🧳': 'briefcase', 'ℹ': 'info', '🛍': 'bag',
    '💨': 'wind', '🌧': 'rain', '⛅': 'cloudsun', '🌌': 'aurora', '⛽': 'fuel', '🗺': 'map',
    '📝': 'note', '🛒': 'cart', '📸': 'camera', '🧭': 'compass', '🚨': 'siren', '🩺': 'heartpulse',
    '👮': 'shield', '📞': 'phone', '🛣': 'road', '🛁': 'spa', '🍂': 'leaf', '👁': 'eye',
    '🎯': 'target', '💬': 'chat', '📌': 'bookmark', '🟢': 'dot', '☀': 'sun', '🌑': 'newmoon',
    '🌙': 'moon', '⏱': 'timer'
  };

  function svg(name, cls) {
    const body = P[name];
    if (!body) return '';
    return '<svg class="ico' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" width="1em" height="1em" fill="none" ' +
      'stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + body + '</svg>';
  }

  const keys = Object.keys(MAP).sort((a, b) => b.length - a.length);
  const SRC = '(' + keys.join('|') + ')\\uFE0F?';
  const HAS = new RegExp(SRC, 'u');   // sin flag g: test() no arrastra lastIndex
  const SKIP = /^(SCRIPT|STYLE|TEXTAREA|INPUT|OPTION|SELECT|TITLE)$/;

  function iconifyNode(root) {
    if (!root) return;
    if (root.nodeType === 3) { replaceText(root); return; }
    if (root.nodeType !== 1 || SKIP.test(root.tagName)) return;
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: n => (n.parentNode && !SKIP.test(n.parentNode.tagName) && HAS.test(n.nodeValue))
        ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
    });
    const hits = [];
    let n;
    while ((n = w.nextNode())) hits.push(n);
    hits.forEach(replaceText);
  }

  function replaceText(node) {
    const txt = node.nodeValue;
    if (!txt || !HAS.test(txt) || !node.parentNode || SKIP.test(node.parentNode.tagName)) return;
    const RE = new RegExp(SRC, 'gu');
    const frag = document.createDocumentFragment();
    let last = 0, m;
    while ((m = RE.exec(txt))) {
      if (m.index > last) frag.appendChild(document.createTextNode(txt.slice(last, m.index)));
      const tpl = document.createElement('span');
      tpl.className = 'ico-wrap';
      tpl.innerHTML = svg(MAP[m[1]]);
      frag.appendChild(tpl);
      last = m.index + m[0].length;
    }
    if (last < txt.length) frag.appendChild(document.createTextNode(txt.slice(last)));
    node.parentNode.replaceChild(frag, node);
  }

  let scheduled = false;
  const queue = new Set();
  function flush() {
    scheduled = false;
    queue.forEach(n => { if (n.isConnected) iconifyNode(n); });
    queue.clear();
  }

  function start() {
    iconifyNode(document.body);
    new MutationObserver(list => {
      list.forEach(m => {
        m.addedNodes.forEach(n => queue.add(n));
        if (m.type === 'characterData') queue.add(m.target);
      });
      if (!scheduled && queue.size) { scheduled = true; requestAnimationFrame(flush); }
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  window.ICONS = { svg, iconify: iconifyNode };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
