/* GAJRA Earth map engine. No libraries, no tiles, no borders.
   One NASA Blue Marble texture drives two views: a WebGL globe and a flat
   equirectangular canvas. Pins come from a JSON file in this repo; the file
   grows by pull request, so the map grows as the garland does.
   Usage: <div data-earth-map data-src="data/groups.json" data-view="globe"></div>
   The page stays readable without JS: keep a <noscript> image beside it. */
(function () {
  "use strict";

  var TEX_SRC = "assets/earth-4096.jpg";
  var REDUCED = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- tiny mat4 helpers (column-major, WebGL order) ---------- */

  function mat4Identity() { return [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]; }
  function mat4Multiply(a, b) {
    var o = new Array(16);
    for (var c = 0; c < 4; c++) for (var r = 0; r < 4; r++) {
      o[c*4+r] = a[r]*b[c*4] + a[4+r]*b[c*4+1] + a[8+r]*b[c*4+2] + a[12+r]*b[c*4+3];
    }
    return o;
  }
  function mat4Perspective(fovY, aspect, near, far) {
    var f = 1 / Math.tan(fovY / 2), nf = 1 / (near - far);
    return [f/aspect,0,0,0, 0,f,0,0, 0,0,(far+near)*nf,-1, 0,0,2*far*near*nf,0];
  }
  function mat4RotateX(rad) {
    var c = Math.cos(rad), s = Math.sin(rad);
    return [1,0,0,0, 0,c,s,0, 0,-s,c,0, 0,0,0,1];
  }
  function mat4RotateY(rad) {
    var c = Math.cos(rad), s = Math.sin(rad);
    return [c,0,-s,0, 0,1,0,0, s,0,c,0, 0,0,0,1];
  }
  function mat4Translate(x, y, z) { return [1,0,0,0, 0,1,0,0, 0,0,1,0, x,y,z,1]; }
  function transformPoint(m, p) {
    var x = p[0], y = p[1], z = p[2];
    var w = m[3]*x + m[7]*y + m[11]*z + m[15];
    return [
      (m[0]*x + m[4]*y + m[8]*z  + m[12]) / w,
      (m[1]*x + m[5]*y + m[9]*z  + m[13]) / w,
      (m[2]*x + m[6]*y + m[10]*z + m[14]) / w
    ];
  }

  /* lat/lon in degrees to a unit-sphere point. lon 0 faces the camera at rest,
     east is +x (to the right), north is +y. */
  function llToVec(lat, lon) {
    var la = lat * Math.PI / 180, lo = lon * Math.PI / 180;
    return [Math.cos(la) * Math.sin(lo), Math.sin(la), Math.cos(la) * Math.cos(lo)];
  }

  /* ---------- sphere geometry ---------- */

  function buildSphere(stacks, slices) {
    var pos = [], uv = [], idx = [];
    for (var i = 0; i <= stacks; i++) {
      var lat = -90 + 180 * i / stacks;
      for (var j = 0; j <= slices; j++) {
        var lon = -180 + 360 * j / slices;
        var p = llToVec(lat, lon);
        pos.push(p[0], p[1], p[2]);
        uv.push(j / slices, i / stacks); /* v=0 south with flipY upload */
      }
    }
    var row = slices + 1;
    for (var s = 0; s < stacks; s++) for (var t = 0; t < slices; t++) {
      var a = s * row + t, b = a + row;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
    return { pos: new Float32Array(pos), uv: new Float32Array(uv), idx: new Uint16Array(idx) };
  }

  var VSH = [
    "attribute vec3 aPos; attribute vec2 aUV;",
    "uniform mat4 uMVP; uniform mat4 uRot;",
    "varying vec2 vUV; varying vec3 vN;",
    "void main(){ vUV=aUV; vN=(uRot*vec4(aPos,0.0)).xyz;",
    "gl_Position=uMVP*vec4(aPos,1.0); }"
  ].join("\n");
  var FSH = [
    "precision mediump float;",
    "uniform sampler2D uTex; varying vec2 vUV; varying vec3 vN;",
    "void main(){",
    "vec3 n=normalize(vN);",
    "float face=max(n.z,0.0);",
    "vec3 col=texture2D(uTex,vUV).rgb*(0.74+0.36*face);",
    "float rim=pow(1.0-face,3.0);",
    "col+=vec3(0.20,0.55,0.44)*rim*0.55;", /* auroral rim, the planetary gajra */
    "gl_FragColor=vec4(col,1.0); }"
  ].join("\n");

  /* ---------- shared texture image ---------- */

  var texImage = null, texWaiters = [];
  function withTexture(cb) {
    if (texImage && texImage.complete && texImage.naturalWidth) { cb(texImage); return; }
    texWaiters.push(cb);
    if (!texImage) {
      texImage = new Image();
      texImage.src = TEX_SRC;
      texImage.onload = function () {
        var w = texWaiters; texWaiters = [];
        w.forEach(function (f) { f(texImage); });
      };
    }
  }

  /* ---------- the component ---------- */

  function EarthMap(root) {
    var self = this;
    this.root = root;
    this.view = root.getAttribute("data-view") === "flat" ? "flat" : "globe";
    this.groups = [];
    this.lonC = 153.4; this.latC = -27.5;      /* opens over Minjerribah */
    this.dist = 2.6;                            /* camera distance, radii */
    this.flatZoom = 1; this.flatX = 0; this.flatY = 0;
    this.vLon = 0; this.vLat = 0;               /* inertia */
    this.touched = false;
    this.raf = 0; this.visible = true;

    root.classList.add("em");
    root.innerHTML = "";

    this.canvas = document.createElement("canvas");
    this.canvas.className = "em-canvas";
    this.canvas.tabIndex = 0;
    this.canvas.setAttribute("role", "application");
    this.canvas.setAttribute("aria-label",
      "Interactive Earth map. Drag or use arrow keys to move, plus and minus to zoom.");
    root.appendChild(this.canvas);

    this.pinLayer = document.createElement("div");
    this.pinLayer.className = "em-pins";
    root.appendChild(this.pinLayer);

    var ui = document.createElement("div");
    ui.className = "em-ui";
    this.btnGlobe = this.makeToggle(ui, "Globe", "globe");
    this.btnFlat = this.makeToggle(ui, "Flat", "flat");
    root.appendChild(ui);

    this.card = document.createElement("div");
    this.card.className = "em-card";
    this.card.hidden = true;
    root.appendChild(this.card);

    var src = root.getAttribute("data-src");
    if (src) {
      fetch(src).then(function (r) { return r.json(); }).then(function (data) {
        self.groups = (data && data.groups) || [];
        self.buildPins();
        self.requestRender();
      }).catch(function () { /* the map still works with zero pins */ });
    }

    withTexture(function (img) {
      self.img = img;
      self.initGL();
      self.applyView();
      self.bindInput();
      self.observe();
      self.resize();
      /* first paint immediately, so the map exists even before rAF runs */
      if (self.view === "globe") self.renderGlobe(); else self.renderFlat();
      self.loop();
    });
  }

  EarthMap.prototype.makeToggle = function (ui, label, mode) {
    var self = this, b = document.createElement("button");
    b.type = "button"; b.className = "em-btn"; b.textContent = label;
    b.setAttribute("aria-pressed", String(this.view === mode));
    b.addEventListener("click", function () { self.setView(mode); });
    ui.appendChild(b);
    return b;
  };

  EarthMap.prototype.setView = function (mode) {
    if (mode === "globe" && !this.gl) mode = "flat";
    this.view = mode;
    this.applyView();
    this.requestRender();
  };

  EarthMap.prototype.applyView = function () {
    if (!this.gl && this.view === "globe") this.view = "flat";
    this.btnGlobe.setAttribute("aria-pressed", String(this.view === "globe"));
    this.btnFlat.setAttribute("aria-pressed", String(this.view === "flat"));
    this.btnGlobe.hidden = !this.gl;
    if (this.view === "flat" && !this.ctx2d) {
      this.ctx2d = null; /* created lazily in renderFlat via context switch canvas */
    }
    /* one canvas cannot hold both a webgl and a 2d context: use a second canvas */
    if (!this.flatCanvas) {
      this.flatCanvas = document.createElement("canvas");
      this.flatCanvas.className = "em-canvas";
      this.root.insertBefore(this.flatCanvas, this.canvas.nextSibling);
    }
    this.canvas.style.display = this.view === "globe" ? "" : "none";
    this.flatCanvas.style.display = this.view === "flat" ? "" : "none";
  };

  /* ---------- WebGL globe ---------- */

  EarthMap.prototype.initGL = function () {
    var gl = this.canvas.getContext("webgl", { antialias: true, alpha: true });
    if (!gl) { this.gl = null; this.view = "flat"; return; }
    this.gl = gl;
    var self = this;
    this.canvas.addEventListener("webglcontextlost", function (e) {
      e.preventDefault(); self.gl = null; self.setView("flat");
    });

    function shader(type, srcText) {
      var s = gl.createShader(type);
      gl.shaderSource(s, srcText); gl.compileShader(s);
      return s;
    }
    var prog = gl.createProgram();
    gl.attachShader(prog, shader(gl.VERTEX_SHADER, VSH));
    gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FSH));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { this.gl = null; this.view = "flat"; return; }
    gl.useProgram(prog);
    this.prog = prog;
    this.uMVP = gl.getUniformLocation(prog, "uMVP");
    this.uRot = gl.getUniformLocation(prog, "uRot");

    var geo = buildSphere(48, 96);
    this.indexCount = geo.idx.length;
    var aPos = gl.getAttribLocation(prog, "aPos");
    var aUV = gl.getAttribLocation(prog, "aUV");
    var bufPos = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, bufPos);
    gl.bufferData(gl.ARRAY_BUFFER, geo.pos, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 0, 0);
    var bufUV = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, bufUV);
    gl.bufferData(gl.ARRAY_BUFFER, geo.uv, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(aUV);
    gl.vertexAttribPointer(aUV, 2, gl.FLOAT, false, 0, 0);
    var bufIdx = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bufIdx);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, geo.idx, gl.STATIC_DRAW);

    var tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, this.img);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    var aniso = gl.getExtension("EXT_texture_filter_anisotropic");
    if (aniso) gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT,
      Math.min(4, gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));

    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.clearColor(0, 0, 0, 0);
  };

  EarthMap.prototype.renderGlobe = function () {
    var gl = this.gl, c = this.canvas;
    if (!gl) return;
    gl.viewport(0, 0, c.width, c.height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    var aspect = c.width / Math.max(1, c.height);
    var proj = mat4Perspective(40 * Math.PI / 180, aspect, 0.1, 20);
    var rot = mat4Multiply(mat4RotateX(this.latC * Math.PI / 180),
                           mat4RotateY(-this.lonC * Math.PI / 180));
    var mv = mat4Multiply(mat4Translate(0, 0, -this.dist), rot);
    var mvp = mat4Multiply(proj, mv);
    gl.uniformMatrix4fv(this.uMVP, false, new Float32Array(mvp));
    gl.uniformMatrix4fv(this.uRot, false, new Float32Array(rot));
    gl.drawElements(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_SHORT, 0);
    this.placePinsGlobe(mvp, rot);
  };

  /* ---------- flat view ---------- */

  EarthMap.prototype.renderFlat = function () {
    var c = this.flatCanvas;
    if (!c) return;
    var ctx = c.getContext("2d");
    var w = c.width, h = c.height;
    ctx.clearRect(0, 0, w, h);
    var iw = this.img.naturalWidth, ih = this.img.naturalHeight;
    var base = Math.max(w / iw, h / ih);      /* cover */
    var s = base * this.flatZoom;
    var dw = iw * s, dh = ih * s;
    /* clamp pan so the image always covers the frame */
    this.flatX = Math.min(0, Math.max(w - dw, this.flatX));
    this.flatY = Math.min(0, Math.max(h - dh, this.flatY));
    ctx.drawImage(this.img, this.flatX, this.flatY, dw, dh);
    this.placePinsFlat(s, dw, dh);
  };

  /* ---------- pins ---------- */

  EarthMap.prototype.buildPins = function () {
    var self = this;
    this.pinLayer.innerHTML = "";
    this.pins = this.groups.map(function (g) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "em-pin em-pin-" + (g.label || "invitation");
      b.setAttribute("aria-label", g.name + (g.place ? ", " + g.place : ""));
      b.addEventListener("click", function () { self.showCard(g, b); });
      self.pinLayer.appendChild(b);
      return { g: g, el: b, vec: llToVec(g.lat, g.lon) };
    });
  };

  EarthMap.prototype.placePinsGlobe = function (mvp, rot) {
    if (!this.pins) return;
    var w = this.root.clientWidth, h = this.root.clientHeight;
    var horizon = 1 / this.dist;
    for (var i = 0; i < this.pins.length; i++) {
      var p = this.pins[i];
      var r = transformPoint(rot, p.vec);
      if (r[2] <= horizon) { p.el.classList.add("away"); continue; }
      p.el.classList.remove("away");
      var ndc = transformPoint(mvp, p.vec);
      p.el.style.transform = "translate(" + ((ndc[0] * 0.5 + 0.5) * w).toFixed(1) + "px," +
        ((-ndc[1] * 0.5 + 0.5) * h).toFixed(1) + "px)";
    }
  };

  EarthMap.prototype.placePinsFlat = function (s, dw, dh) {
    if (!this.pins) return;
    var dpr = this.dpr || 1;
    for (var i = 0; i < this.pins.length; i++) {
      var p = this.pins[i], g = p.g;
      var x = ((g.lon + 180) / 360 * dw + this.flatX) / dpr;
      var y = ((90 - g.lat) / 180 * dh + this.flatY) / dpr;
      p.el.classList.remove("away");
      p.el.style.transform = "translate(" + x.toFixed(1) + "px," + y.toFixed(1) + "px)";
    }
  };

  EarthMap.prototype.showCard = function (g, pinEl) {
    var self = this;
    var chip = g.label ? '<span class="chip ' + g.label + '">' +
      g.label.charAt(0).toUpperCase() + g.label.slice(1) + "</span> " : "";
    this.card.innerHTML = chip + "<strong>" + g.name + "</strong>" +
      (g.place ? '<span class="em-place">' + g.place + "</span>" : "") +
      (g.note ? "<p>" + g.note + "</p>" : "") +
      (g.url ? '<a href="' + g.url + '">More</a> ' : "") +
      '<button type="button" class="em-close" aria-label="Close">&times;</button>';
    this.card.hidden = false;
    var close = this.card.querySelector(".em-close");
    close.addEventListener("click", function () {
      self.card.hidden = true;
      if (pinEl) pinEl.focus();
    });
    close.focus();
  };

  /* ---------- input ---------- */

  EarthMap.prototype.bindInput = function () {
    var self = this, active = {}, lastX = 0, lastY = 0, pinchD = 0;

    function down(e) {
      active[e.pointerId] = e;
      self.touched = true;
      self.vLon = 0; self.vLat = 0;
      lastX = e.clientX; lastY = e.clientY;
      var keys = Object.keys(active);
      if (keys.length === 2) {
        var a = active[keys[0]], b = active[keys[1]];
        pinchD = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      }
      e.target.setPointerCapture && e.target.setPointerCapture(e.pointerId);
    }
    function move(e) {
      if (!(e.pointerId in active)) return;
      active[e.pointerId] = e;
      var keys = Object.keys(active);
      if (keys.length === 2) {
        var a = active[keys[0]], b = active[keys[1]];
        var d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        if (pinchD) self.zoomBy(d / pinchD, (a.clientX + b.clientX) / 2, (a.clientY + b.clientY) / 2);
        pinchD = d;
        return;
      }
      var dx = e.clientX - lastX, dy = e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      if (self.view === "globe") {
        var k = 0.22 * (self.dist - 1) / 1.6;
        self.lonC -= dx * k;
        self.latC = Math.max(-85, Math.min(85, self.latC + dy * k));
        if (!REDUCED) { self.vLon = -dx * k; self.vLat = dy * k; }
      } else {
        self.flatX += dx * (self.dpr || 1);
        self.flatY += dy * (self.dpr || 1);
      }
      self.requestRender();
    }
    function up(e) { delete active[e.pointerId]; pinchD = 0; }

    [this.canvas, this.flatCanvas].forEach(function (c) {
      if (!c) return;
      c.addEventListener("pointerdown", down);
      c.addEventListener("pointermove", move);
      c.addEventListener("pointerup", up);
      c.addEventListener("pointercancel", up);
      c.addEventListener("wheel", function (e) {
        e.preventDefault();
        self.zoomBy(Math.exp(-e.deltaY * 0.0012), e.clientX, e.clientY);
      }, { passive: false });
      c.addEventListener("keydown", function (e) {
        var step = 6;
        if (e.key === "ArrowLeft") { self.nudge(-step, 0); }
        else if (e.key === "ArrowRight") { self.nudge(step, 0); }
        else if (e.key === "ArrowUp") { self.nudge(0, step); }
        else if (e.key === "ArrowDown") { self.nudge(0, -step); }
        else if (e.key === "+" || e.key === "=") { self.zoomBy(1.2); }
        else if (e.key === "-") { self.zoomBy(1 / 1.2); }
        else return;
        e.preventDefault();
      });
    });
  };

  EarthMap.prototype.nudge = function (dLon, dLat) {
    this.touched = true;
    if (this.view === "globe") {
      this.lonC += dLon;
      this.latC = Math.max(-85, Math.min(85, this.latC + dLat));
    } else {
      this.flatX -= dLon * 8; this.flatY += dLat * 8;
    }
    this.requestRender();
  };

  EarthMap.prototype.zoomBy = function (f, cx, cy) {
    this.touched = true;
    if (this.view === "globe") {
      this.dist = Math.max(1.45, Math.min(5, this.dist / f));
    } else {
      var rect = this.flatCanvas.getBoundingClientRect();
      var px = ((cx == null ? rect.width / 2 : cx - rect.left)) * (this.dpr || 1);
      var py = ((cy == null ? rect.height / 2 : cy - rect.top)) * (this.dpr || 1);
      var z0 = this.flatZoom;
      this.flatZoom = Math.max(1, Math.min(9, this.flatZoom * f));
      var r = this.flatZoom / z0;
      this.flatX = px - (px - this.flatX) * r;
      this.flatY = py - (py - this.flatY) * r;
    }
    this.requestRender();
  };

  /* ---------- lifecycle ---------- */

  EarthMap.prototype.observe = function () {
    var self = this;
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (es) {
        es.forEach(function (e) { self.visible = e.isIntersecting; });
      }).observe(this.root);
    }
    if ("ResizeObserver" in window) {
      new ResizeObserver(function () { self.resize(); }).observe(this.root);
    } else {
      window.addEventListener("resize", function () { self.resize(); });
    }
  };

  EarthMap.prototype.resize = function () {
    var w = this.root.clientWidth, h = this.root.clientHeight;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    [this.canvas, this.flatCanvas].forEach(function (c) {
      if (!c) return;
      c.width = Math.round(w * this.dpr);
      c.height = Math.round(h * this.dpr);
    }, this);
    this.requestRender();
  };

  EarthMap.prototype.requestRender = function () { this.dirty = true; };

  EarthMap.prototype.loop = function () {
    var self = this;
    function frame() {
      self.raf = requestAnimationFrame(frame);
      if (!self.visible || document.hidden) return;
      var moving = false;
      if (self.view === "globe") {
        if (!self.touched && !REDUCED) { self.lonC += 0.03; moving = true; }
        if (Math.abs(self.vLon) > 0.005 || Math.abs(self.vLat) > 0.005) {
          self.lonC += self.vLon;
          self.latC = Math.max(-85, Math.min(85, self.latC + self.vLat));
          self.vLon *= 0.93; self.vLat *= 0.93;
          moving = true;
        }
      }
      if (self.dirty || moving) {
        self.dirty = false;
        if (self.view === "globe") self.renderGlobe(); else self.renderFlat();
      }
    }
    frame();
  };

  /* ---------- boot ---------- */

  function init() {
    var nodes = document.querySelectorAll("[data-earth-map]");
    var made = [];
    for (var i = 0; i < nodes.length; i++) made.push(new EarthMap(nodes[i]));
    window.__earthMaps = made; /* debug and test handle, not a public API */
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else { init(); }
})();
