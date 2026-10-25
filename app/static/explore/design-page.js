/* A whole design you can take through the flow: the page engine. It reads
   window.DESIGN (one file per design, under designs/) and lays out the
   design, its settings, the flow, and the result. Sections whose data is
   not defined yet say so rather than showing anything invented. */

(function () {
  "use strict";
  var D = window.DESIGN;
  var root = document.getElementById("design-root");
  if (!D || !root) return;

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function rows(list, cls) {
    return '<table class="ff-table ' + (cls || "") + '">' + list.map(function (r) {
      return "<tr><th>" + r[0] + "</th><td>" + r[1] + "</td>" + (r[2] ? '<td class="dz-src"><code>' + esc(r[2]) + "</code></td>" : "") + "</tr>";
    }).join("") + "</table>";
  }

  var SRC = D.sources || { files: {}, blackbox: {} };
  function modTag(name) {
    if (SRC.files[name]) return '<button type="button" class="dz-mod" data-mod="' + esc(name) + '">' + esc(name) + "</button>";
    if (SRC.blackbox && SRC.blackbox[name]) return '<code class="dz-bb" title="' + esc(SRC.blackbox[name]) + '">' + esc(name) + "</code>";
    return "<code>" + esc(name) + "</code>";
  }
  function tree(node) {
    return "<li>" + modTag(node.name) + (node.count ? ' <span class="dz-count">× ' + node.count + "</span>" : "") +
      (node.note ? ' <span class="dz-note">' + esc(node.note) + "</span>" : "") +
      (node.kids ? "<ul>" + node.kids.map(tree).join("") + "</ul>" : "") + "</li>";
  }

  function pending(what) {
    return '<div class="dz-pending"><strong>To be defined.</strong> ' + what + "</div>";
  }

  var html = [];

  /* the layout, and beside it the block diagram it implements */
  var figs = [];
  if (D.layout) {
    figs.push('<figure class="dz-fig"><img src="' + D.layout.src + '" alt="The finished layout of ' + esc(D.short) +
      '"><figcaption>' + esc(D.layout.caption) + "</figcaption></figure>");
  }
  if (D.blockDiagram) {
    figs.push('<figure class="dz-fig dz-bd">' + D.blockDiagram() + "<figcaption>" + esc(D.blockCaption || "") +
      "</figcaption></figure>");
  }
  html.push('<section class="pane dz-sec"><h2>The design</h2>' +
    (figs.length ? '<div class="dz-figs">' + figs.join("") + "</div>" : "") + rows(D.facts) +
    "<h3>How it is built</h3><p>The modules as the Verilog instantiates them, top to bottom." +
    (D.sources && D.sources.remote ? "" : D.sources ? " Click any module to read its Verilog; the modules it uses are links inside the code too." : "") + "</p>" +
    '<div class="dz-build"><ul class="dz-tree">' + tree(D.hierarchy) + "</ul>" +
    (D.sources ? '<div class="dz-viewer" id="dz-viewer" aria-live="polite"></div>' : "") + "</div></section>");

  if (D.engine) {
    html.push('<section class="pane dz-sec"><h2>Your settings</h2><div id="dz-knobs"></div>' +
      '<details class="dz-flowset"><summary>The flow\'s own settings for this design</summary>' +
      rows(D.defaults, "dz-defaults") + "</details></section>");
  } else {
    html.push('<section class="pane dz-sec"><h2>Your settings</h2>' +
      (D.knobs.length ? "" : pending("Which settings you can change, and over what range, is the next decision. " +
        "For reference, these are the flow's own settings for this design:")) +
      rows(D.defaults, "dz-defaults") + "</section>");
  }

  html.push('<section class="pane dz-sec"><h2>The flow</h2><p>Each run goes through the same stages as the ' +
    '<a href="/sandboxes">OpenROAD flow walkthrough</a>. Each stage links to its walkthrough page.</p>' +
    '<ol class="dz-stages">' + D.stages.map(function (s, i) {
      return '<li data-stage="' + s.k + '"><a href="/explore/examples/' + s.k + '"><span class="dz-n">' + (i + 1) + "</span>" +
        esc(s.name) + '</a><span class="dz-state">' + (D.engine ? (s.k === "synthesis" ? "from the real flow"
          : D.engine.stages[s.k] ? "waiting" : "not in the engine yet") : "waiting") + "</span></li>";
    }).join("") + "</ol></section>");

  if (D.engine) {
    html.push('<section class="pane dz-sec"><h2>The result</h2><div id="dz-result"></div></section>');
    if (D.engine.sweep) html.push('<section class="pane dz-sec dz-sweepsec"><h2>Clock sweep: how fast can it go?</h2>' +
      '<p class="dz-3dlede">A faster clock gives every path less time. The engine runs the whole flow again at a ' +
      "range of clock periods, keeping your other settings, and plots what comes out beside real runs of the " +
      "flow at a range of clocks.</p><div id=\"dz-sweep\"></div></section>");
    html.push('<section class="pane dz-sec dz-3dsec"><h2>Your layout in three dimensions</h2>' +
      '<p class="dz-3dlede">The chip you just made, as it would stand in silicon: the cells on the bottom, then ' +
      "every wire the router laid down, one metal layer stacked on the next. Turn it, look under the wires, " +
      "switch layers off. Change a knob above and it rebuilds.</p><div id=\"dz-3d\"></div></section>");
    html.push(howItWorks(D.engine));
  } else html.push('<section class="pane dz-sec"><h2>The result</h2>' +
    (D.runs.length ? "" : pending("Once a run is chosen, this is where its result appears.")) +
    '<div class="dz-results">' + ["Layout", "Timing", "Area", "Power"].map(function (t) {
      return '<div class="dz-card"><h3>' + t + '</h3><div class="dz-empty">no run yet</div></div>';
    }).join("") + "</div></section>");

  /* ----- how the engine works: what it is, what it is not, stage by stage ----- */
  function howItWorks(E) {
    var OR = "https://github.com/The-OpenROAD-Project/OpenROAD/tree/master/src/";
    function tool(name, path) { return '<a href="' + (path.indexOf("http") === 0 ? path : OR + path) + '" target="_blank" rel="noopener">' + name + "</a>"; }
    var STAGES = [
      ["Floorplan",
       "Sizes the die from the design's area and the utilization you ask for, lays out the rows, places the memories, " +
       "the tap cells and the power grid, and spreads the pins along the edges.",
       "Does the arithmetic the same way: core area is the cells' (and any memories') area over the utilization, " +
       "with the design's own margin, rows 0.27 micrometers tall, and memories, when there are any, put where the " +
       "knob says with a 2 micrometer halo. The pins go where the design's settings put them (the bottom edge, or " +
       "all four), each moved to follow the cells it connects to. " +
       "There are no tap cells and no power grid."],
      ["Placement",
       tool("RePlAce", "gpl") + " spreads the cells with an electrostatic model of density, solved by Nesterov's " +
       "method, re-weighting timing-critical nets as it goes; " + tool("OpenDP", "dpl") + " then puts every cell " +
       "on a legal site and improves the result.",
       "Minimizes squared wire length: small nets are tied pin to pin, big ones through a star at their centre, and " +
       "the system is solved by conjugate gradients. It then alternates: cells are spread over 3 micrometer bins to " +
       "fit the density target, and pulled toward the spread positions ever harder, until less than 10% of the cell " +
       "area is over the target. Twice on the way (at 65% and 30% overflow) it times the design and makes the worst " +
       "10% of nets pull up to 1.9 times harder, as the real placer does. Last, each cell moves to the nearest free " +
       "spot on a row. There is no detailed placement improvement afterwards."],
      ["Clock tree",
       tool("TritonCTS", "cts") + " clusters the flip-flops, builds an H-tree over the clusters, buffers it from its " +
       "characterized buffers, and balances the memories' tree against the flip-flops'.",
       "Builds the same structure: flip-flops cut into clusters no bigger or wider than the knobs allow, an H-tree " +
       "halving the area until each region holds 15 clusters or fewer, a large buffer at each cluster and a smaller " +
       "one at each branch, and, when there are memories, a separate tree for them, balanced with delay buffers. " +
       "Unlike the real tool it always uses the same two large buffer types, even on a small design. Its delays come from " +
       "the buffers' library tables and the wire's resistance and capacitance, not from characterization."],
      ["Routing",
       tool("FastRoute", "grt") + " routes every net through a grid of tiles, then " + tool("TritonRoute", "drt") +
       " lays down the actual metal, track by track, checking every design rule.",
       "Does only the first half, simply: the core is cut into 1 micrometer tiles whose capacity comes from the metal " +
       "2 to 7 track pitches, less the 25% the flow sets aside; over a memory only metal 5 and up are free. Each net " +
       "is split into two-pin connections by a minimum spanning tree, each routed as an L or Z shape at the lowest " +
       "cost, with three passes of ripping up and rerouting whatever overflows. Each piece's layer is chosen by its " +
       "length. There is no detailed routing, so no real tracks, no design-rule checking and no exact geometry."],
      ["Repair and timing",
       tool("Resizer", "rsz") + " buffers the ports, fixes nets that break the library's load and slew limits, and " +
       "then works along failing paths with many kinds of move; " + tool("OpenSTA", "https://github.com/The-OpenROAD-Project/OpenSTA") +
       " times the design from the extracted wires.",
       "Buffers the ports; resizes each gate to the smallest version of itself fast enough for its load, then " +
       "buffers what still breaks the limits; adds a buffer where it makes a stage faster. Then up to 8 passes over " +
       "the failing paths. Each pass first rearranges the failing nets: on a net with no buffers, pins with time to " +
       "spare go behind a new buffer (the real repair's split-load move); on a net already buffered, its few " +
       "critical pins come out of the buffer tree and the driver feeds them directly. Then it makes the gates on " +
       "failing paths stronger. A pass that does not help is undone and tried again with resizing alone. It does " +
       "not copy gates or swap pins, as the real repair can. Timing follows rising and falling " +
       "edges separately through the library's delay tables, with each wire's delay estimated from its routed length " +
       "and the flow's per-micrometer resistance and capacitance. It checks setup only, not hold."],
      ["Power",
       tool("OpenSTA", "https://github.com/The-OpenROAD-Project/OpenSTA") + " estimates how often each net switches " +
       "and adds up switching, internal and leakage power from the library.",
       "Follows OpenSTA's method closely: inputs switch 0.1 times a cycle, each gate's output activity comes from its " +
       "logic function (the chance each input decides the output), registers pass it through, up to 50 passes. " +
       "Switching power is half C V squared per switch; internal energy is looked up at each net's load; leakage " +
       "comes straight from the library."],
      ["Finishing",
       "Fills the rows with filler cells, adds metal fill, re-times the design, checks the power grid's voltage drop, " +
       "writes the layout file, and runs the design-rule and layout-versus-schematic checks.",
       "Only works out how much row is left to fill. None of the checks or files exist here."],
    ];
    return '<section class="pane dz-sec dz-howsec" id="dz-how"><h2>How this engine works</h2>' +
      '<div class="dz-notor"><strong>This is not OpenROAD.</strong> Every number marked "this engine", every picture ' +
      "of your layout, and the three-dimensional view come from a small program written for this site. It runs in " +
      "your browser, in about a second, and imitates what each OpenROAD tool does in far fewer steps. The only " +
      "numbers from OpenROAD itself are in the \"real OpenROAD\" column, read from the reports of one real run " +
      "of the flow. Use the engine to see how the stages behave and how the knobs push them; do not " +
      "use it to judge a real chip.</div>" +
      "<h3>What in it is real</h3><ul class=\"dz-howlist\">" +
      "<li>The netlist: the real run's synthesized netlist, every one of its cells and every connection between them.</li>" +
      "<li>The library: each cell's size, pin capacitances, delay and slew tables, internal energy tables and leakage, " +
      "read from the process's own library files.</li>" +
      "<li>The settings: utilization, density, margins, halos and clock-tree clusters default to the flow's own " +
      "configuration, and wires use the flow's own resistance and capacitance per micrometer.</li>" +
      "<li>The real runs it is compared with use the flow's own settings in all but two: each is run at a chosen " +
      "clock period (a sweep of them), and each is synthesized with resyn2, the classic optimization recipe of the " +
      "ABC logic optimizer, instead of the flow's default recipe. The engine starts from that same synthesized " +
      "netlist.</li></ul>" +
      "<h3>Stage by stage</h3>" +
      STAGES.map(function (st) {
        return '<details class="dz-howstage"><summary>' + st[0] + '</summary><div class="dz-howcols">' +
          "<div><h4>What OpenROAD does</h4><p>" + st[1] + "</p></div>" +
          "<div><h4>What this engine does instead</h4><p>" + st[2] + "</p></div></div></details>";
      }).join("") +
      (E.closeness ? "<h3>How close it gets</h3><p>At the flow's own settings, against the real run:</p>" +
        '<table class="ff-table dz-howtable"><tbody>' + E.closeness.map(function (c) {
          return "<tr><th>" + esc(c[0]) + "</th><td>" + esc(c[1]) + "</td></tr>";
        }).join("") + "</tbody></table><p>Move the knobs away from the flow's settings and there is no real run to " +
        "compare with, so treat the engine's answers as the direction things move, not as exact values.</p>" : "") +
      "<h3>What it leaves out</h3><p>Detailed routing and design-rule checking, extraction of each wire's resistance " +
      "and capacitance from real geometry, hold timing, the power grid and its voltage drop, tap cells, metal fill, " +
      "and the final layout file with its checks. A real chip needs all of them, which is why the real flow takes " +
      "minutes where this takes a second.</p>" +
      '<p class="dz-howcode">The engine\'s code is plain JavaScript you can read: ' +
      '<a href="/static/explore/engine/pd-engine.js" target="_blank" rel="noopener">floorplan and placement</a>, ' +
      '<a href="/static/explore/engine/pd-stages.js" target="_blank" rel="noopener">clock tree, routing, repair, timing, ' +
      "power and finishing</a>.</p></section>";
  }

  root.innerHTML = html.join("");
  if (D.engine && window.DesignEngineUI) window.DesignEngineUI(D, root);

  /* ----- the Verilog viewer ----- */
  var viewer = document.getElementById("dz-viewer");
  /* a design whose Verilog is linked rather than copied: say so, and link it */
  if (viewer && SRC.remote) {
    viewer.innerHTML = '<div class="dz-vhead"><code>' + esc(SRC.remote.file) + "</code><span>not copied here</span></div>" +
      '<div class="dz-vremote"><p>' + esc(SRC.remote.note) + '</p><p><a href="' + SRC.remote.url +
      '" target="_blank" rel="noopener">Read ' + esc(SRC.remote.file) + " on GitHub</a>, at the same commit the " +
      "flow ran from.</p></div>";
    return;
  }
  if (!viewer) return;
  var cache = {};
  var KW = /\b(module|endmodule|input|output|inout|wire|reg|assign|always|begin|end|if|else|case|endcase|default|posedge|negedge|parameter|localparam|generate|endgenerate|for|integer)\b/g;
  function colour(line) {
    var at = line.indexOf("//"), code = at < 0 ? line : line.slice(0, at), note = at < 0 ? "" : line.slice(at);
    var h = esc(code).replace(KW, '<span class="vk">$1</span>');
    /* a line that starts with a known module's name is an instance of it */
    h = h.replace(/^(\s*)([A-Za-z_][A-Za-z0-9_]*)(?=\s)/, function (m, sp, name) {
      return SRC.files[name] ? sp + '<a href="#" class="vm" data-mod="' + name + '">' + name + "</a>" : m;
    });
    return h + (note ? '<span class="vc">' + esc(note) + "</span>" : "");
  }
  function show(name) {
    var file = SRC.files[name];
    if (!file) return;
    root.querySelectorAll(".dz-mod").forEach(function (b) { b.classList.toggle("dz-on", b.getAttribute("data-mod") === name); });
    function render(text) {
      var lines = text.replace(/\t/g, "   ").replace(/\s+$/, "").split("\n");
      viewer.innerHTML = '<div class="dz-vhead"><code>' + esc(file) + "</code><span>module " + esc(name) + ", " + lines.length +
        " lines</span>" + '<a href="' + SRC.dir + file + '" target="_blank" rel="noopener">raw</a></div>' +
        '<pre class="dz-code">' + lines.map(function (l, i) {
          return '<span class="vn">' + (i + 1) + "</span>" + colour(l);
        }).join("\n") + "</pre>" +
        '<div class="dz-vfoot">' + esc(SRC.origin) + ", under the " +
        '<a href="' + SRC.dir + SRC.license + '" target="_blank" rel="noopener">' + esc(SRC.licenseName) + "</a>.</div>";
    }
    if (cache[file]) return render(cache[file]);
    viewer.innerHTML = '<div class="dz-vhead"><code>' + esc(file) + "</code><span>loading</span></div>";
    fetch(SRC.dir + file).then(function (r) { return r.text(); }).then(function (t) { cache[file] = t; render(t); })
      .catch(function () { viewer.innerHTML = '<div class="dz-vhead"><code>' + esc(file) + "</code><span>could not load</span></div>"; });
  }
  root.addEventListener("click", function (ev) {
    var t = ev.target.closest && ev.target.closest("[data-mod]");
    if (!t) return;
    ev.preventDefault();
    show(t.getAttribute("data-mod"));
    /* a citation up in the facts table: bring the viewer into sight */
    if (t.classList.contains("dz-cite") && viewer.scrollIntoView) viewer.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  show(SRC.start || Object.keys(SRC.files)[0]);
})();
