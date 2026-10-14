// lib/reports/proposal/paginate.ts
//
// Lays the rendered ProposalDocument onto fixed A4-proportion pages before
// the PDF is printed (run in the browser via renderPDF's prepareScript).
// The document is a continuous 1440px column of <section>s; left to Chrome's
// own print fragmentation, sections split anywhere, kept-whole sections leave
// holes, and tinted backgrounds stop short of the page edge. Here instead:
//
//   - each page is a fixed box; sections stack on it with their own padding
//     and background, exactly as in the preview
//   - a section that fits on a page is never split: if it doesn't fit in
//     the space left, it starts the next page. Long sections that aren't
//     marked keep (findings, scope, pricing…) may continue onto the next
//     page, split only between cards/rows, never through one, and never
//     leaving a heading stranded at the foot of a page
//   - the last section on each page stretches to the bottom, so its
//     background runs to the page edge instead of stopping in white
//   - every page after the cover gets a footer with its page number, and
//     the Contents rows get the page each section starts on
//
// Written as a plain script string (not a serialised TS function) so no
// compiler helpers can leak into the browser.

export interface PaginateOptions {
  width: number;
  height: number;
  footerLeft: string;
}

export function paginateScript(opts: PaginateOptions): string {
  return `(${SCRIPT})(${JSON.stringify(opts)})`;
}

const SCRIPT = String.raw`function (o) {
  var H = o.height;
  var FITS = "fits";
  var root = document.body.firstElementChild;
  var sections = Array.prototype.slice.call(root.children);
  root.innerHTML = "";

  var style = document.createElement("style");
  style.textContent =
    ".pg{position:relative;width:" + o.width + "px;height:" + H + "px;overflow:hidden;display:flex;flex-direction:column;background:#fff;break-after:page;}" +
    ".pg:last-child{break-after:auto;}" +
    ".pg>section{flex-shrink:0;}" +
    ".pg-foot{position:absolute;left:48px;right:48px;bottom:32px;display:flex;justify-content:space-between;font-family:'Bebas Neue',Arial,sans-serif;font-size:15px;line-height:1;letter-spacing:0.08em;text-transform:uppercase;color:rgba(1,25,85,0.35);}";
  document.head.appendChild(style);

  var pages = [];
  var page = null;
  function newPage() {
    page = document.createElement("div");
    page.className = "pg";
    root.appendChild(page);
    pages.push(page);
  }
  function top(el) { return el.getBoundingClientRect().top - page.getBoundingClientRect().top; }
  function bottom(el) { return el.getBoundingClientRect().bottom - page.getBoundingClientRect().top; }
  function isKeep(el) { return el.style.breakInside === "avoid"; }
  function keepsWithNext(el) {
    if (el.hasAttribute("data-kwn") || /^H[1-6]$/.test(el.tagName)) return true;
    var prev = el.previousElementSibling;
    return el.tagName === "P" && !!prev && prev.tagName === "H2";
  }

  // Moves whatever of el's content falls below the page line (limit, in page
  // coordinates) into a shallow clone of el, and returns that clone. Returns
  // FITS when nothing needs to move, and null when nothing could stay.
  function split(el, limit) {
    var kids = Array.prototype.slice.call(el.children);
    var i = -1;
    for (var n = 0; n < kids.length; n++) if (bottom(kids[n]) > limit) { i = n; break; }
    if (i < 0) return FITS;
    var k = kids[i];
    var from = -1;
    var tooBig = bottom(k) - top(k) > H * 0.9;
    if (k.children.length && (!isKeep(k) || tooBig)) {
      var sub = split(k, limit);
      if (sub && sub !== FITS) {
        var rest = el.cloneNode(false);
        rest.appendChild(sub);
        for (var m = i + 1; m < kids.length; m++) rest.appendChild(kids[m]);
        return rest;
      }
      if (sub === FITS) from = i + 1;
    }
    if (from < 0) {
      // Cut above k's row: grid siblings sharing its row move with it.
      var rowTop = top(k) - 1;
      from = i;
      for (var r = 0; r < kids.length; r++) if (top(kids[r]) >= rowTop) { from = r; break; }
    }
    if (from >= kids.length) return FITS;
    while (from > 0 && keepsWithNext(kids[from - 1])) from--;
    if (from === 0) return null;
    var out = el.cloneNode(false);
    for (var q = from; q < kids.length; q++) out.appendChild(kids[q]);
    return out;
  }

  function padBottom(el) { return parseFloat(getComputedStyle(el).paddingBottom) || 0; }

  newPage();
  var queue = sections.slice();
  while (queue.length) {
    var s = queue.shift();
    var first = !page.firstElementChild;
    if (!first && s.style.breakBefore === "page") { newPage(); first = true; }
    page.appendChild(s);
    if (bottom(s) <= H) continue;

    var height = s.getBoundingClientRect().height;
    var room = H - top(s);
    var whole = height <= H && (isKeep(s) || room < H * 0.4);
    if (!first && (whole || room < 400)) {
      page.removeChild(s);
      newPage();
      queue.unshift(s);
      continue;
    }
    var rest = split(s, H - padBottom(s));
    if (rest === null) {
      if (!first) {
        page.removeChild(s);
        newPage();
        queue.unshift(s);
      }
      continue; // alone on a page and still too tall: clipped, nothing better to do
    }
    if (rest === FITS) continue;
    // A continuation starts flush under its own top padding.
    var lead = rest;
    while ((lead = lead.firstElementChild)) lead.style.marginTop = "0";
    newPage();
    queue.unshift(rest);
  }

  var total = pages.length;
  var firstPage = {};
  pages.forEach(function (pg, n) {
    var last = pg.lastElementChild;
    if (last) last.style.flexGrow = "1";
    pg.querySelectorAll("[data-sec]").forEach(function (sec) {
      var id = sec.getAttribute("data-sec");
      if (!(id in firstPage)) firstPage[id] = n + 1;
    });
    if (n === 0) return;
    var foot = document.createElement("div");
    foot.className = "pg-foot";
    var l = document.createElement("span");
    l.textContent = o.footerLeft;
    var r = document.createElement("span");
    r.textContent = "Page " + (n + 1) + " / " + total;
    foot.appendChild(l);
    foot.appendChild(r);
    pg.appendChild(foot);
  });
  document.querySelectorAll("[data-toc]").forEach(function (el) {
    var n = firstPage[el.getAttribute("data-toc")];
    if (n) el.textContent = String(n);
  });
}`;
