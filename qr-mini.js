/* Mini générateur de QR code (mode octets, correction M, versions 1 à 4, jusqu'à 62 octets), sans dépendance.
   MTQR.matrix("texte") -> tableau de lignes de booléens ; MTQR.svg("texte", pixelParModule) -> balise <svg>. */
(function (root) {
  var EC = { 1: [10, 1], 2: [16, 1], 3: [26, 1], 4: [18, 2] };      // [octets de correction par bloc, nombre de blocs]
  var ALIGN = { 1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26] };
  var TOTAL = { 1: 26, 2: 44, 3: 70, 4: 100 };
  var exp = [], log = [];
  (function () { var x = 1; for (var i = 0; i < 255; i++) { exp[i] = x; log[x] = i; x <<= 1; if (x & 256) x ^= 0x11d; } for (i = 255; i < 512; i++) exp[i] = exp[i - 255]; })();
  function mul(a, b) { return (a && b) ? exp[log[a] + log[b]] : 0; }
  function rsGen(n) { var g = [1]; for (var i = 0; i < n; i++) { var ng = new Array(g.length + 1).fill(0); for (var j = 0; j < g.length; j++) { ng[j] ^= g[j]; ng[j + 1] ^= mul(g[j], exp[i]); } g = ng; } return g; }
  function rsEnc(data, n) { var g = rsGen(n), res = new Array(n).fill(0); data.forEach(function (d) { var f = d ^ res[0]; res.shift(); res.push(0); for (var i = 0; i < n; i++) res[i] ^= mul(g[i + 1], f); }); return res; }
  function utf8(s) { return Array.prototype.slice.call(new TextEncoder().encode(s)); }
  function build(text) {
    var bytes = utf8(text), v = 0, i;
    for (i = 1; i <= 4; i++) { var cap = TOTAL[i] - EC[i][0] * EC[i][1]; if (bytes.length + 2 <= cap) { v = i; break; } }
    if (!v) throw new Error("texte trop long");
    var dataCw = TOTAL[v] - EC[v][0] * EC[v][1], bits = [];
    function put(val, n) { for (var k = n - 1; k >= 0; k--) bits.push((val >>> k) & 1); }
    put(4, 4); put(bytes.length, 8); bytes.forEach(function (b) { put(b, 8); });
    for (i = 0; i < 4 && bits.length < dataCw * 8; i++) bits.push(0);
    while (bits.length % 8) bits.push(0);
    var cw = []; for (i = 0; i < bits.length; i += 8) { var b = 0; for (var k = 0; k < 8; k++) b = (b << 1) | bits[i + k]; cw.push(b); }
    for (var pad = 0; cw.length < dataCw; pad++) cw.push(pad % 2 ? 0x11 : 0xec);
    var nb = EC[v][1], per = dataCw / nb, blocks = [], ecs = [];
    for (i = 0; i < nb; i++) { var d = cw.slice(i * per, (i + 1) * per); blocks.push(d); ecs.push(rsEnc(d, EC[v][0])); }
    var out = [];
    for (i = 0; i < per; i++) blocks.forEach(function (d) { out.push(d[i]); });
    for (i = 0; i < EC[v][0]; i++) ecs.forEach(function (e) { out.push(e[i]); });
    return { v: v, cw: out };
  }
  function matrix(text) {
    var r = build(text), v = r.v, n = 17 + 4 * v, m = [], fn = [], y, x;
    for (y = 0; y < n; y++) { m.push(new Array(n).fill(false)); fn.push(new Array(n).fill(false)); }
    function set(x, y, val) { m[y][x] = !!val; fn[y][x] = true; }
    function finder(cx, cy) { for (var dy = -4; dy <= 4; dy++) for (var dx = -4; dx <= 4; dx++) { var xx = cx + dx, yy = cy + dy; if (xx < 0 || yy < 0 || xx >= n || yy >= n) continue; var d = Math.max(Math.abs(dx), Math.abs(dy)); set(xx, yy, d !== 2 && d !== 4); } }
    finder(3, 3); finder(n - 4, 3); finder(3, n - 4);
    for (x = 8; x < n - 8; x++) { set(x, 6, x % 2 === 0); set(6, x, x % 2 === 0); }
    var al = ALIGN[v];
    al.forEach(function (ay) { al.forEach(function (ax) {
      if ((ax === 6 && ay === 6) || (ax === 6 && ay === al[al.length - 1]) || (ay === 6 && ax === al[al.length - 1])) return;
      for (var dy = -2; dy <= 2; dy++) for (var dx = -2; dx <= 2; dx++) set(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }); });
    set(8, n - 8, true);
    // zones de format réservées (écrites ensuite)
    for (x = 0; x < 9; x++) { fn[8][x] = true; fn[x][8] = true; }
    for (x = 0; x < 8; x++) { fn[8][n - 1 - x] = true; fn[n - 1 - x][8] = true; }
    // données en zigzag
    var bitsAll = []; r.cw.forEach(function (c) { for (var k = 7; k >= 0; k--) bitsAll.push((c >> k) & 1); });
    var idx = 0, up = true;
    for (x = n - 1; x > 0; x -= 2) {
      if (x === 6) x--;
      for (var t = 0; t < n; t++) {
        y = up ? n - 1 - t : t;
        for (var c = 0; c < 2; c++) {
          var xx = x - c;
          if (fn[y][xx]) continue;
          var bit = idx < bitsAll.length ? bitsAll[idx++] : 0;
          m[y][xx] = !!bit;
        }
      }
      up = !up;
    }
    // masque 0 : (x + y) pair
    for (y = 0; y < n; y++) for (x = 0; x < n; x++) if (!fn[y][x] && (x + y) % 2 === 0) m[y][x] = !m[y][x];
    // format : correction M (00), masque 0 (000)
    var fd = 0, rem = fd << 10; for (var i = 14; i >= 10; i--) if ((rem >> i) & 1) rem ^= 0x537 << (i - 10);
    var fmt = ((fd << 10) | rem) ^ 0x5412;
    function fb(i) { return ((fmt >> i) & 1) === 1; }
    for (i = 0; i <= 5; i++) m[i][8] = fb(i);
    m[7][8] = fb(6); m[8][8] = fb(7); m[8][7] = fb(8);
    for (i = 9; i < 15; i++) m[8][14 - i] = fb(i);
    for (i = 0; i < 8; i++) m[8][n - 1 - i] = fb(i);
    for (i = 8; i < 15; i++) m[n - 15 + i][8] = fb(i);
    m[n - 8][8] = true;
    return m;
  }
  function svg(text, px, quiet) {
    px = px || 6; quiet = quiet == null ? 4 : quiet;
    var m = matrix(text), n = m.length, size = (n + quiet * 2) * px, d = "";
    for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) if (m[y][x]) d += "M" + ((x + quiet) * px) + " " + ((y + quiet) * px) + "h" + px + "v" + px + "h-" + px + "z";
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + size + " " + size + '" width="' + size + '" height="' + size + '" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="' + d + '" fill="#000"/></svg>';
  }
  root.MTQR = { matrix: matrix, svg: svg };
  if (typeof module !== "undefined") module.exports = root.MTQR;
})(typeof window !== "undefined" ? window : globalThis);
