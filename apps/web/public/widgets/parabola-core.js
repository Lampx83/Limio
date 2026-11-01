/*
 * Lõi toán của widget parabol (parabola.html). Hàm thuần, không đụng DOM, để
 * widget và test dùng chung một bản. Chạy cả trong trình duyệt (window.Parabola)
 * lẫn Node (module.exports).
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.Parabola = factory();
})(typeof self !== "undefined" ? self : this, function () {
  var EPS = 1e-9;

  /** Đỉnh, trục đối xứng, Δ, nghiệm của y = ax² + bx + c. null nếu a = 0. */
  function analyze(a, b, c) {
    if (Math.abs(a) < EPS) return null;
    var delta = b * b - 4 * a * c;
    var xv = -b / (2 * a);
    var roots = [];
    if (delta > EPS) {
      var s = Math.sqrt(delta);
      roots = [(-b - s) / (2 * a), (-b + s) / (2 * a)].sort(function (p, q) { return p - q; });
    } else if (Math.abs(delta) <= EPS) {
      roots = [xv];
    }
    return { delta: delta, vertex: { x: xv, y: a * xv * xv + b * xv + c }, axis: xv, roots: roots, opensUp: a > 0 };
  }

  function evalAt(a, b, c, x) { return a * x * x + b * x + c; }

  /** Số nguyên ngẫu nhiên trong [lo, hi], bỏ giá trị `skip`. */
  function randInt(rnd, lo, hi, skip) {
    for (;;) {
      var v = lo + Math.floor(rnd() * (hi - lo + 1));
      if (v !== skip) return v;
    }
  }

  /**
   * Đề thử thách: "đỉnh (h;k) và đi qua (0;c)". Sinh từ chính a,b,c nguyên nhỏ
   * nên luôn có đáp án kéo được bằng thanh trượt bước 1.
   */
  function makeChallenge(rnd) {
    for (var tries = 0; tries < 200; tries++) {
      var a = randInt(rnd, -3, 3, 0);
      var b = randInt(rnd, -5, 5);
      var c = randInt(rnd, -5, 5);
      var an = analyze(a, b, c);
      // Đỉnh phải là điểm nguyên hoặc nửa nguyên nhìn được trên lưới, và nằm trong khung vẽ.
      var h = an.vertex.x, k = an.vertex.y;
      // h = 0: đỉnh trùng điểm cắt Oy, hai yêu cầu thành một — đề nghèo, bỏ.
      if (Math.abs(h) > 4 || Math.abs(k) > 8 || Math.abs(h) < EPS) continue;
      if (Math.abs(h * 2 - Math.round(h * 2)) > EPS) continue;
      return { a: a, b: b, c: c, vertex: { x: h, y: k }, through: { x: 0, y: c } };
    }
    return { a: 1, b: -2, c: -3, vertex: { x: 1, y: -4 }, through: { x: 0, y: -3 } };
  }

  /** Chấm: sai lệch đỉnh và điểm đi qua. Đúng khi cả hai lệch < tol. */
  function checkChallenge(ch, a, b, c, tol) {
    tol = tol == null ? 0.05 : tol;
    var an = analyze(a, b, c);
    if (!an) return { ok: false, reason: "a=0", vertexOff: Infinity, pointOff: Infinity };
    var vOff = Math.hypot(an.vertex.x - ch.vertex.x, an.vertex.y - ch.vertex.y);
    var pOff = Math.abs(evalAt(a, b, c, ch.through.x) - ch.through.y);
    return { ok: vOff < tol && pOff < tol, vertexOff: vOff, pointOff: pOff };
  }

  /** Số hiển thị gọn: 2 → "2", 0.5 → "0,5", -1.3333 → "−1,33". */
  function fmt(n) {
    if (!isFinite(n)) return "—";
    var r = Math.round(n * 100) / 100;
    if (Object.is(r, -0)) r = 0;
    return String(r).replace("-", "−").replace(".", ",");
  }

  /** Hệ số đứng trước x^n: 1 → "", −1 → "−", còn lại là số. */
  function coef(n) { return n === 1 ? "" : n === -1 ? "\u2212" : fmt(n); }

  return { coef: coef, analyze: analyze, evalAt: evalAt, makeChallenge: makeChallenge, checkChallenge: checkChallenge, fmt: fmt };
});
