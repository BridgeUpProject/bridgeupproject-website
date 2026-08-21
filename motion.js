/* ============================================================
   The Bridge Up Project — motion engine
   Loads after the self-hosted animation bundles (see /vendor:
   GSAP + plugins, Motion's WAAPI `animate`, anime.js) and
   before site.js. GSAP is required; Motion and anime.js are
   feature-detected and only enrich the CTA choreography.
   When every library is present and the visitor
   has not asked for reduced motion, this file owns all motion on
   the site and site.js keeps only its interaction plumbing
   (menu, anchors). In every other case the <html> "gsap" class
   is dropped and the original dependency-free engine in site.js
   takes over — including its reduced-motion behaviour.

   Choreography map:
     all pages   nav bridge draws itself · gold scroll-progress
                 rail · batched blur/lift reveals · 3D card tilt
                 (fine pointers only)
     CTAs        primary buttons ripple their label outward from
                 the letter the cursor arrived over; the secondary
                 button completes a border circuit. The anchor itself
                 never moves — see the block in initFinePointer for
                 why that matters.
     home        hero: glows breathe, arcline draws, eyebrow
                 de-scrambles, headline enters as masked lines ·
                 stat counters count up · mission statement inks
                 in word-by-word with the scrollbar · the bridge
                 builds itself, scrubbed to scroll
     programs    session cards swing in with 3D perspective,
                 badges pop, curriculum lines cascade
     about       bio resolves line-by-line through a mask
     connect     path cards ride the shared reveal + tilt system
   ============================================================ */
(function () {
  'use strict';

  var root = document.documentElement;
  var reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

  var hasLibs = window.gsap && window.ScrollTrigger && window.SplitText &&
                window.DrawSVGPlugin && window.ScrambleTextPlugin;

  /* Hand the page back to the legacy engine in site.js. */
  if (!hasLibs || reduceQuery.matches) {
    root.classList.remove('gsap');
    return;
  }

  window.__BU_MOTION_OK__ = true;

  gsap.registerPlugin(ScrollTrigger, SplitText, DrawSVGPlugin, ScrambleTextPlugin);
  gsap.defaults({ ease: 'power3.out', duration: 0.8 });

  var q  = function (s, c) { return (c || document).querySelector(s); };
  var qa = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  /* Registries so a mid-session switch to reduced motion can put
     the DOM back exactly as it was. */
  var splits    = [];
  var counters  = [];
  var scrambles = [];
  var mm        = gsap.matchMedia();

  /* Sections with bespoke choreography opt out of the generic
     reveal batch. */
  function isChoreographed(el) {
    return !!el.closest('.hero, .page-header, .mission, .program-grid, .session-grid, .bio');
  }

  /* ----------------------------------------------------------
     Masked line reveal. Split happens against loaded fonts (we
     await fonts.ready below); autoSplit then only re-splits on
     width changes. Load-time entrances pass onceOnly so a later
     re-split shows the settled text instead of replaying.
     ---------------------------------------------------------- */
  function maskedLines(el, tweenVars, onceOnly) {
    var done = false;
    var split = SplitText.create(el, {
      type: 'lines',
      mask: 'lines',
      autoSplit: true,
      aria: 'auto',
      onSplit: function (self) {
        if (onceOnly && done) return;
        return gsap.from(self.lines, Object.assign({
          yPercent: 115,
          duration: 1.05,
          stagger: 0.12,
          ease: 'power4.out',
          onComplete: function () { done = true; }
        }, tweenVars || {}));
      }
    });
    splits.push(split);
    gsap.set(el, { autoAlpha: 1, y: 0 });
    return split;
  }

  /* Eyebrow labels decode into place — a nod to "AI Pathways". */
  function scrambleIn(tl, el, position) {
    var text = el.textContent;
    el.setAttribute('aria-label', text);
    scrambles.push({ el: el, text: text });
    tl.set(el, { autoAlpha: 1, y: 0 }, position)
      .to(el, {
        duration: 1,
        scrambleText: { text: text, chars: 'upperCase', speed: 0.35, revealDelay: 0.12 }
      }, position);
  }

  /* Decorative glow layers: soft entrance, then an endless slow
     breathe, plus a scroll-scrubbed parallax ride out of frame.
     Breathe uses scale/percent, parallax uses px — GSAP composes
     the two without them fighting over the transform. */
  function glowLife(container, tl) {
    var glows = qa('.hero-glow', container);
    if (glows.length && tl) {
      tl.from(glows, { autoAlpha: 0, scale: 0.65, duration: 1.6, ease: 'expo.out', stagger: 0.15 }, 0);
    }
    glows.forEach(function (g, i) {
      gsap.to(g, {
        scale: 1.12,
        xPercent: i % 2 ? 5 : -4,
        yPercent: i % 2 ? -4 : 3,
        duration: 9 + i * 3,
        yoyo: true,
        repeat: -1,
        ease: 'sine.inOut',
        delay: 1.5
      });
    });
    qa('[data-parallax-y], [data-parallax-x]', container).forEach(function (el) {
      var sy = parseFloat(el.getAttribute('data-parallax-y')) || 0;
      var sx = parseFloat(el.getAttribute('data-parallax-x')) || 0;
      gsap.to(el, {
        y: sy * 220,
        x: sx * 160,
        ease: 'none',
        scrollTrigger: { trigger: container, start: 'top top', end: 'bottom top', scrub: 0.4 }
      });
    });
  }

  /* ----------------------------------------------------------
     Instant layer — nothing here depends on webfonts.
     ---------------------------------------------------------- */

  /* Gold progress rail under the nav, scrubbed to page scroll. */
  var progressBar = document.createElement('div');
  progressBar.className = 'scroll-progress';
  progressBar.setAttribute('aria-hidden', 'true');
  document.body.appendChild(progressBar);
  gsap.to(progressBar, {
    scaleX: 1,
    ease: 'none',
    scrollTrigger: { trigger: document.body, start: 'top top', end: 'bottom bottom', scrub: 0.3 }
  });

  /* Nav depth (site.js's scroll engine is off in gsap mode). */
  var nav = q('nav');
  if (nav) {
    ScrollTrigger.create({ start: 8, end: 'max', toggleClass: { targets: nav, className: 'is-scrolled' } });
  }

  /* The wordmark bridge constructs itself on every page load:
     deck slides out, pillars rise, span draws, keystone pops. */
  (function () {
    var svg = q('.nav-logo svg');
    if (!svg) return;
    var rects = qa('rect', svg); /* [left pillar, right pillar, deck] */
    var span  = q('path', svg);
    var key   = q('circle', svg);
    var tl = gsap.timeline({ delay: 0.1 });
    if (rects[2]) tl.from(rects[2], { scaleX: 0, transformOrigin: '50% 50%', duration: 0.5, ease: 'power2.inOut' }, 0);
    if (rects[0]) tl.from(rects[0], { scaleY: 0, transformOrigin: '50% 100%', duration: 0.45 }, 0.15);
    if (rects[1]) tl.from(rects[1], { scaleY: 0, transformOrigin: '50% 100%', duration: 0.45 }, 0.25);
    if (span)     tl.from(span, { drawSVG: '0%', duration: 0.9, ease: 'power2.inOut' }, 0.35);
    if (key)      tl.from(key, { scale: 0, transformOrigin: '50% 50%', duration: 0.5, ease: 'back.out(3)' }, 1.05);
  })();

  /* Decorative glow layers and the hero arcline are font-independent,
     so they animate immediately — waiting for the font gate would
     leave them painted, then popping hidden and replaying when slow
     fonts finally resolve. */
  (function () {
    var stage = q('.hero') || q('.page-header');
    if (!stage) return;
    var tl = gsap.timeline();
    glowLife(stage, tl);
    var arcline = q('.hero-arcline path', stage);
    if (arcline) tl.from(arcline, { drawSVG: '0%', duration: 2.1, ease: 'power2.inOut' }, 0.25);
  })();

  /* ----------------------------------------------------------
     Font-gated layer. Splitting against fallback fonts produces
     wrong line boxes, so all text choreography (and the triggers
     whose positions depend on final metrics) waits for
     fonts.ready — with a cap so a hung font never blocks motion.
     ---------------------------------------------------------- */
  var fontsReady = Promise.race([
    (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve(),
    new Promise(function (r) { window.setTimeout(r, 2500); })
  ]);

  fontsReady.then(function () {
    if (root.classList.contains('gsap-off')) return;

    initHero();
    initPageHeader();
    initCounters();
    initMission();
    initProgram();
    initSessionCards();
    initBio();
    initReveals();
    initFinePointer();

    ScrollTrigger.refresh();
  });

  /* ---------------- HOME: hero ---------------- */
  function initHero() {
    var hero = q('.hero');
    if (!hero) return;

    var tl = gsap.timeline();

    var eyebrow = q('.eyebrow', hero);
    if (eyebrow) scrambleIn(tl, eyebrow, 0.3);

    var h1 = q('h1[data-words]', hero);
    if (h1) maskedLines(h1, { delay: 0.5 }, true);

    var buttons = q('.hero-buttons', hero);
    if (buttons) {
      tl.from(qa('a', buttons), { y: 26, autoAlpha: 0, duration: 0.9, stagger: 0.09 }, 1.05)
        .set(buttons, { autoAlpha: 1, y: 0 }, 1.05);
    }

    /* Content eases up and out as the hero leaves. */
    var inner = q('.hero-inner', hero);
    if (inner) {
      gsap.to(inner, {
        y: -90,
        autoAlpha: 0,
        ease: 'none',
        scrollTrigger: { trigger: hero, start: 'top top', end: '75% top', scrub: 0.3 }
      });
    }
  }

  /* ---------------- Subpages: header ---------------- */
  function initPageHeader() {
    var header = q('.page-header');
    if (!header) return;

    var tl = gsap.timeline();

    var eyebrow = q('.eyebrow', header);
    if (eyebrow) scrambleIn(tl, eyebrow, 0.2);

    var h1 = q('h1[data-words]', header);
    if (h1) maskedLines(h1, { delay: 0.4 }, true);

    var p = q('p[data-reveal]', header);
    if (p) tl.fromTo(p, { y: 24, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.9 }, 0.6);
  }

  /* ---------------- HOME: stat counters ---------------- */
  function initCounters() {
    qa('.stat-number').forEach(function (el) {
      var original = el.textContent;
      if (!/\d/.test(original)) return;
      el.setAttribute('aria-label', original);
      counters.push({ el: el, text: original });

      var parts = original.split(/(\d+)/);
      var state = { p: 0 };
      var render = function () {
        el.textContent = parts.map(function (part) {
          return /^\d+$/.test(part) ? Math.round(parseInt(part, 10) * state.p) : part;
        }).join('');
      };
      render();

      ScrollTrigger.create({
        trigger: el,
        start: 'top 86%',
        once: true,
        onEnter: function () {
          gsap.to(state, {
            p: 1,
            duration: 1.6,
            ease: 'power2.out',
            onUpdate: render,
            onComplete: function () { el.textContent = original; }
          });
        }
      });
    });
  }

  /* ---------------- HOME: mission statement ---------------- */
  function initMission() {
    var wrap = q('.mission .section-inner');
    if (!wrap) return;

    gsap.set(wrap, { '--rule': 0 });

    var h2 = q('h2', wrap);
    if (h2) {
      /* Words ink in from ghost to full as the scrollbar moves —
         the statement is literally read into existence. */
      splits.push(SplitText.create(h2, {
        type: 'words',
        aria: 'auto',
        autoSplit: true,
        onSplit: function (self) {
          return gsap.from(self.words, {
            autoAlpha: 0.12,
            stagger: 0.05,
            ease: 'none',
            scrollTrigger: { trigger: h2, start: 'top 85%', end: 'top 42%', scrub: 0.4 }
          });
        }
      }));
    }

    var tl = gsap.timeline({
      scrollTrigger: { trigger: wrap, start: 'top 82%', once: true }
    });
    var eyebrow = q('.eyebrow', wrap);
    if (eyebrow) tl.from(eyebrow, { y: 18, autoAlpha: 0, duration: 0.7 }, 0);
    tl.to(wrap, { '--rule': 1, duration: 0.8, ease: 'power3.inOut' }, 0.1);

    gsap.set(wrap, { autoAlpha: 1, y: 0 });
  }

  /* ---------------- HOME: program + the bridge build ---------------- */
  function initProgram() {
    var section = q('.program');
    if (!section) return;

    var textCol = q('.program-grid > div:first-child', section);
    if (textCol) {
      var bits  = qa(':scope > .program-tag, :scope > h3, :scope > p:not(.program-more)', textCol);
      var items = qa('.session-list li', textCol);
      var more  = q('.program-more', textCol);
      var tl = gsap.timeline({
        scrollTrigger: { trigger: section, start: 'top 74%', once: true }
      });
      if (bits.length)  tl.from(bits, { y: 26, autoAlpha: 0, duration: 0.85, stagger: 0.1 }, 0);
      if (items.length) tl.from(items, { x: -22, autoAlpha: 0, duration: 0.6, stagger: 0.06 }, 0.35);
      if (more)         tl.from(more, { y: 14, autoAlpha: 0, duration: 0.6 }, 0.7);
      gsap.set(textCol, { autoAlpha: 1, y: 0 });
    }

    /* The signature piece: scrubbing the scrollbar constructs the
       bridge — pillars rise, deck spans, arc draws, keystone drops.
       Initial states are set explicitly and the timeline is pure
       to() tweens: from() states ahead of a scrubbed playhead can
       be flushed by ScrollTrigger's refresh cycle. */
    var visual = q('.program-visual', section);
    if (visual) {
      gsap.set('.arc-pillar-l, .arc-pillar-r', { scaleY: 0, transformOrigin: '50% 100%' });
      gsap.set('.arc-deck', { scaleX: 0, transformOrigin: '50% 50%' });
      gsap.set('.arc-span', { drawSVG: '0%' });
      gsap.set('.arc-key', { scale: 0, y: -30, transformOrigin: '50% 50%' });
      var build = gsap.timeline({
        scrollTrigger: { trigger: section, start: 'top 80%', end: 'center 40%', scrub: 0.5 }
      });
      build
        .to('.arc-pillar-l', { scaleY: 1, duration: 0.35, ease: 'power1.out' }, 0)
        .to('.arc-pillar-r', { scaleY: 1, duration: 0.35, ease: 'power1.out' }, 0.08)
        .to('.arc-deck',     { scaleX: 1, duration: 0.4,  ease: 'power1.inOut' }, 0.12)
        .to('.arc-span',     { drawSVG: '100%', duration: 0.85, ease: 'power1.inOut' }, 0.35)
        .to('.arc-key',      { scale: 1, y: 0, duration: 0.28, ease: 'back.out(2.5)' }, 1.0);
      gsap.set(visual, { autoAlpha: 1, y: 0 });
    }
  }

  /* ---------------- PROGRAMS: session cards ---------------- */
  function initSessionCards() {
    var cards = qa('.session-grid .session-card');
    if (!cards.length) return;

    gsap.set(cards, { rotationX: -14, y: 64, transformPerspective: 1000, transformOrigin: '50% 0%', filter: 'blur(7px)' });
    var nums = qa('.session-num');
    if (nums.length) gsap.set(nums, { scale: 0, rotation: -90 });
    var lis = qa('.session-grid .session-card li');
    if (lis.length) gsap.set(lis, { autoAlpha: 0, x: -16 });

    ScrollTrigger.batch(cards, {
      start: 'top 88%',
      once: true,
      onEnter: function (batch) {
        gsap.to(batch, {
          autoAlpha: 1,
          y: 0,
          rotationX: 0,
          scale: 1,
          filter: 'blur(0px)',
          duration: 0.95,
          ease: 'power3.out',
          stagger: 0.12,
          clearProps: 'filter'
        });
        batch.forEach(function (card, i) {
          var num = q('.session-num', card);
          if (num) gsap.to(num, { scale: 1, rotation: 0, duration: 0.7, ease: 'back.out(2.4)', delay: 0.3 + i * 0.12 });
          gsap.to(qa('li', card), { autoAlpha: 1, x: 0, duration: 0.55, stagger: 0.05, delay: 0.35 + i * 0.12 });
        });
      }
    });
  }

  /* ---------------- ABOUT: bio ---------------- */
  function initBio() {
    var bio = q('.bio');
    if (!bio) return;

    qa('p[data-reveal]', bio).forEach(function (p) {
      maskedLines(p, {
        yPercent: 110,
        duration: 0.95,
        stagger: 0.09,
        ease: 'power3.out',
        scrollTrigger: { trigger: p, start: 'top 86%', once: true }
      }, false);
    });

    var signoff = q('.signoff', bio);
    if (signoff) {
      gsap.to(signoff, {
        autoAlpha: 1,
        y: 0,
        duration: 0.8,
        scrollTrigger: { trigger: signoff, start: 'top 92%', once: true }
      });
    }
  }

  /* ---------------- Generic reveal batch ---------------- */
  function initReveals() {
    var targets = qa('[data-reveal]').filter(function (el) { return !isChoreographed(el); });
    if (!targets.length) return;

    /* CSS drops its resting blur in gsap mode; cards get it here
       so the entrance can resolve out of it and clear it fully. */
    var cards = targets.filter(function (el) { return el.classList.contains('reveal-card'); });
    if (cards.length) gsap.set(cards, { filter: 'blur(7px)' });

    ScrollTrigger.batch(targets, {
      start: 'top 88%',
      once: true,
      onEnter: function (batch) {
        gsap.to(batch, {
          autoAlpha: 1,
          y: 0,
          scale: 1,
          filter: 'blur(0px)',
          duration: 0.85,
          ease: 'power3.out',
          stagger: 0.09,
          clearProps: 'filter'
        });
      }
    });
  }

  /* ----------------------------------------------------------
     Fine-pointer desktop layer: magnetic CTAs, 3D card tilt,
     and column counter-drift. gsap.matchMedia reverts all of it
     automatically when the viewport or input capability changes.
     ---------------------------------------------------------- */
  function initFinePointer() {
    mm.add('(min-width: 761px) and (hover: hover) and (pointer: fine)', function () {
      var handlers = [];
      var ctas     = [];
      var on = function (el, type, fn) {
        el.addEventListener(type, fn);
        handlers.push([el, type, fn]);
      };

      /* ------------------------------------------------------
         CTA choreography — replaces the magnetic buttons.

         The magnet translated the <a> toward the cursor. Near an
         edge the element slid out from under the pointer, fired
         mouseleave, launched a 0.9s elastic snap-back, slid back
         under the pointer and fired mouseenter mid-flight. That
         oscillation was the "glitch". It also read the button's
         rect inside every mousemove, forcing a synchronous layout
         flush 60+ times a second, and CSS still carried a
         `transition: transform` that re-interpolated every value
         GSAP wrote — so the motion was smoothed twice and lagged
         the cursor. That was the "lag".

         So: the anchor never transforms. Every animated layer
         lives inside it, is pointer-events:none, and touches only
         transform / opacity. The hit box is stable to the pixel,
         which makes the whole failure mode unreachable.

         Work is split by what each library is genuinely best at:
           GSAP   — the continuous, interruptible cursor follow
                    (quickTo; no layout reads per frame)
           Motion — one-shot enter/leave flourishes through the Web
                    Animations API, which the compositor can run
                    off the main thread even while ScrollTrigger is
                    mid-scrub
           anime  — staggered per-character choreography and the
                    CSS-variable tween that drives the border trace
         ------------------------------------------------------ */
      var MOTION = (window.Motion && window.Motion.animate) ? window.Motion : null;
      var ANIME  = (window.anime  && window.anime.animate)  ? window.anime  : null;
      var SVGNS  = 'http://www.w3.org/2000/svg';
      var EASE_OUT = [0.23, 1, 0.32, 1];
      var EASE_IN  = [0.4, 0, 1, 1];
      var EASE_BACK = [0.34, 1.4, 0.64, 1];

      function mk(cls, tag) {
        var n = document.createElement(tag || 'span');
        n.className = cls;
        return n;
      }
      function svgNode(name, attrs) {
        var n = document.createElementNS(SVGNS, name), k;
        for (k in attrs) { if (attrs.hasOwnProperty(k)) n.setAttribute(k, attrs[k]); }
        return n;
      }

      /* WAAPI, with the destination also pinned to the inline style
         so the resting state never depends on a fill mode — and so
         the effect degrades to an instant set if Motion is absent. */
      function waapi(node, from, to, opts) {
        var kf = {}, k;
        for (k in to) {
          if (!to.hasOwnProperty(k)) continue;
          node.style[k] = to[k];
          kf[k] = [from[k], to[k]];
        }
        if (MOTION) MOTION.animate(node, kf, opts);
      }

      /* One shared frame loop for cursor tracking. Pointer handlers
         record clientX and nothing else — no rect reads, no style
         writes — and the value is flushed once per frame. A 1000Hz
         mouse therefore costs exactly what a 125Hz one does. */
      var hot = [], ticking = false;
      function frame() {
        for (var i = 0; i < hot.length; i++) {
          var c = hot[i];
          if (c.x === c.sent) continue;
          c.sent = c.x;
          c.glowTo(c.x);
        }
      }
      function warm(c) {
        if (hot.indexOf(c) !== -1) return;
        hot.push(c);
        if (!ticking) { gsap.ticker.add(frame); ticking = true; }
      }
      function cool(c) {
        var i = hot.indexOf(c);
        if (i !== -1) hot.splice(i, 1);
        if (!hot.length && ticking) { gsap.ticker.remove(frame); ticking = false; }
      }

      /* ---------- structure ---------- */
      function buildCTA(btn) {
        var c = {
          btn: btn,
          primary: btn.classList.contains('btn-primary'),
          html: btn.innerHTML,          /* for teardown */
          x: 0, sent: -1, w: 0,
          hover: false, focus: false, on: false
        };

        var icon = btn.querySelector('.btn-icon');
        if (icon) icon.parentNode.removeChild(icon);

        var label = mk('cta-label');
        while (btn.firstChild) label.appendChild(btn.firstChild);

        var inner = mk('cta-inner');
        inner.appendChild(label);
        if (icon) inner.appendChild(icon);

        var fx = mk('cta-fx');
        fx.setAttribute('aria-hidden', 'true');
        var glow = mk('cta-glow');

        c.inner = inner;
        c.glow  = glow;
        c.icon  = icon;

        if (!c.primary) {
          /* Two tracers leave the top edge in opposite directions
             and meet at the bottom — the circuit completing. The
             paths are exact mirrors, so they always meet dead
             centre no matter how the viewBox is stretched.
             pathLength=100 normalises the perimeter, which is what
             lets one unitless --trace value drive any width. */
          c.wash = mk('cta-wash');
          var circuit = svgNode('svg', {
            'class': 'cta-circuit', viewBox: '0 0 100 100', preserveAspectRatio: 'none'
          });
          c.traces = [
            svgNode('path', { 'class': 'cta-trace', pathLength: '100', d: 'M 50 0 H 100 V 100 H 0 V 0 H 50' }),
            svgNode('path', { 'class': 'cta-trace', pathLength: '100', d: 'M 50 0 H 0 V 100 H 100 V 0 H 50' })
          ];
          c.traces.forEach(function (t) { circuit.appendChild(t); });
          fx.appendChild(c.wash);
          fx.appendChild(circuit);
        }

        fx.appendChild(glow);
        btn.appendChild(fx);
        btn.appendChild(inner);
        btn.classList.add('cta');

        /* Split for the per-character stagger. SplitText handles the
           aria restoration; anime.js does the choreography. */
        if (ANIME) {
          try {
            c.split = SplitText.create(label, { type: 'chars', charsClass: 'cta-char', aria: 'auto' });
            c.chars = c.split.chars;
            splits.push(c.split);
            /* Cache each character's centre once, here, so the ripple
               can start at whichever letter the cursor arrived over
               without ever measuring again. offsetLeft resolves
               against .cta (position:relative), the same origin the
               pointer maths uses. */
            c.charX = c.chars.map(function (ch) {
              return ch.offsetLeft + ch.offsetWidth / 2;
            });
          } catch (e) { c.chars = null; }
        }

        c.glowTo = gsap.quickTo(glow, 'x', { duration: 0.4, ease: 'power3.out' });
        return c;
      }

      /* ---------- states ---------- */

      /* The wave starts at the letter nearest the cursor rather than
         always at the middle, so entering from the left ripples left
         to right and entering from the right does the opposite. Uses
         the cached centres and the pointer x we already have, so it
         costs no measurement. */
      function rippleOrigin(c) {
        if (!c.charX || !c.charX.length) return 'center';
        var best = 0, bestD = Infinity, i, d;
        for (i = 0; i < c.charX.length; i++) {
          d = Math.abs(c.charX[i] - c.x);
          if (d < bestD) { bestD = d; best = i; }
        }
        return best;
      }

      function ctaEnter(c, clientX) {
        var r = c.btn.getBoundingClientRect();   /* one read, once per hover */
        c.w = r.width;
        c.x = (clientX == null) ? r.width / 2 : clientX - r.left;
        c.left = r.left;
        c.sent = -1;
        c.glow.style.willChange = 'transform, opacity';
        c.inner.style.willChange = 'transform';
        warm(c);

        gsap.to(c.glow, { opacity: 1, scale: 1, duration: 0.34, ease: 'power2.out' });

        if (c.icon) {
          waapi(c.icon, { transform: 'translate3d(0,0,0) scale(1)' },
                        { transform: 'translate3d(4px,-1px,0) scale(1.09)' },
                { duration: 0.36, ease: EASE_BACK });
        }
        if (c.wash) {
          /* The wash enters from whichever edge the pointer crossed. */
          c.washFromLeft = c.x < c.w / 2;
          c.wash.style.transformOrigin = c.washFromLeft ? '0% 50%' : '100% 50%';
          waapi(c.wash, { transform: 'scaleX(0)' }, { transform: 'scaleX(1)' },
                { duration: 0.44, ease: EASE_OUT });
        }
        if (c.traces && ANIME) {
          ANIME.animate(c.traces, {
            /* 50 is exactly half the normalised perimeter; the extra
               0.5 lets the two tracers overlap at the bottom instead
               of racing to a shared endpoint they can only approach. */
            '--trace': 50.5,
            duration: 580,
            ease: 'outQuart',
            delay: ANIME.stagger(55)
          });
        }
        if (c.chars && ANIME) {
          /* Lift, then settle on a spring. The stagger is what turns
             23 independent letter tweens into one travelling wave —
             slow enough to read as a wave, short enough that the
             whole label has settled well before anyone finishes
             moving onto the button. */
          ANIME.animate(c.chars, {
            translateY: [
              { to: -5, duration: 190, ease: 'outQuad' },
              { to: 0,  duration: 620, ease: 'outElastic(1, .5)' }
            ],
            delay: ANIME.stagger(19, { from: rippleOrigin(c) })
          });
        }
      }

      function ctaLeave(c) {
        cool(c);
        gsap.to(c.glow, { opacity: 0, scale: 0.6, duration: 0.32, ease: 'power2.out' });

        if (c.icon) {
          waapi(c.icon, { transform: 'translate3d(4px,-1px,0) scale(1.09)' },
                        { transform: 'translate3d(0,0,0) scale(1)' },
                { duration: 0.3, ease: EASE_OUT });
        }
        if (c.wash) {
          /* Flip the origin so the wash sweeps out of the far edge
             rather than retracting the way it came — it reads as
             light passing through instead of a rewind. */
          c.wash.style.transformOrigin = c.washFromLeft ? '100% 50%' : '0% 50%';
          waapi(c.wash, { transform: 'scaleX(1)' }, { transform: 'scaleX(0)' },
                { duration: 0.34, ease: EASE_IN });
        }
        if (c.traces && ANIME) {
          ANIME.animate(c.traces, { '--trace': 0, duration: 320, ease: 'inQuad' });
        }
        if (c.chars && ANIME) {
          /* A shallower echo of the entrance, running from the same
             origin, so the label subsides instead of simply stopping. */
          ANIME.animate(c.chars, {
            translateY: [
              { to: 2, duration: 150, ease: 'outQuad' },
              { to: 0, duration: 380, ease: 'outQuad' }
            ],
            delay: ANIME.stagger(14, { from: rippleOrigin(c) })
          });
        }
        window.setTimeout(function () {
          if (c.on) return;
          c.glow.style.willChange = '';
          c.inner.style.willChange = '';
        }, 420);
      }

      qa('.btn-primary, .btn-secondary').forEach(function (btn) {
        var c = buildCTA(btn);
        ctas.push(c);

        function sync(clientX) {
          if (c.hover || c.focus) {
            if (!c.on) { c.on = true; ctaEnter(c, clientX); }
          } else if (c.on) {
            c.on = false; ctaLeave(c);
          }
        }

        on(btn, 'pointerenter', function (e) {
          if (e.pointerType === 'touch') return;
          c.hover = true; sync(e.clientX);
        });
        on(btn, 'pointerleave', function () { c.hover = false; sync(); });

        /* The only work done per pointer event. */
        on(btn, 'pointermove', function (e) { c.x = e.clientX - c.left; });

        /* Press feedback lives on the inner wrapper, so the anchor's
           box — and therefore the hit test — is untouched. */
        on(btn, 'pointerdown', function () {
          waapi(c.inner, { transform: 'scale(1)' }, { transform: 'scale(0.955)' },
                { duration: 0.12, ease: EASE_IN });
        });
        var release = function () {
          waapi(c.inner, { transform: 'scale(0.955)' }, { transform: 'scale(1)' },
                { duration: 0.42, ease: EASE_BACK });
        };
        on(btn, 'pointerup', release);
        on(btn, 'pointercancel', release);

        /* Keyboard parity: the same choreography on focus-visible. */
        on(btn, 'focus', function () {
          if (btn.matches && btn.matches(':focus-visible')) { c.focus = true; sync(null); }
        });
        on(btn, 'blur', function () { c.focus = false; sync(); });
      });

      /* Cards tip subtly toward the cursor. */
      qa('.path-card, .session-card, .stat-card').forEach(function (card) {
        gsap.set(card, { transformPerspective: 850 });
        var rxTo = gsap.quickTo(card, 'rotationX', { duration: 0.5, ease: 'power2.out' });
        var ryTo = gsap.quickTo(card, 'rotationY', { duration: 0.5, ease: 'power2.out' });
        on(card, 'mousemove', function (e) {
          var r = card.getBoundingClientRect();
          rxTo(((e.clientY - r.top) / r.height - 0.5) * -5);
          ryTo(((e.clientX - r.left) / r.width - 0.5) * 5);
        });
        on(card, 'mouseleave', function () {
          rxTo(0);
          ryTo(0);
        });
      });

      /* Column counter-drift, scrubbed. yPercent so it composes
         with the px-based entrance without touching the same
         transform channel. */
      qa('[data-drift]').forEach(function (host) {
        var amp  = (parseFloat(host.getAttribute('data-drift')) || 10) * 0.25;
        var axis = host.getAttribute('data-drift-axis') === 'column' ? 'column' : 'row';
        var tpl  = window.getComputedStyle(host).gridTemplateColumns;
        var cols = axis === 'column' ? 1 : (tpl && tpl !== 'none' ? tpl.split(/\s+/).filter(Boolean).length : 1);
        qa(':scope > *', host).forEach(function (child, i) {
          var unit = axis === 'column' ? i : Math.floor(i / Math.max(cols, 1));
          var dir  = unit % 2 === 0 ? -1 : 1;
          gsap.fromTo(child, { yPercent: dir * amp }, {
            yPercent: dir * -amp,
            ease: 'none',
            scrollTrigger: { trigger: host, start: 'top bottom', end: 'bottom top', scrub: 0.5 }
          });
        });
      });

      return function () {
        handlers.forEach(function (h) { h[0].removeEventListener(h[1], h[2]); });
        if (ticking) { gsap.ticker.remove(frame); ticking = false; }
        hot.length = 0;
        /* Restore the CTAs to their authored markup. Reverting the
           split alone is not enough: the injected fx/inner wrappers
           have to go too, so the fallback engine in site.js finds
           exactly the DOM it was written against. */
        ctas.forEach(function (c) {
          if (c.split) {
            try { c.split.revert(); } catch (e) {}
            var i = splits.indexOf(c.split);
            if (i !== -1) splits.splice(i, 1);
          }
          c.btn.classList.remove('cta');
          c.btn.innerHTML = c.html;
        });
        ctas.length = 0;
        gsap.set(qa('.path-card, .session-card, .stat-card'), {
          clearProps: 'rotationX,rotationY,transformPerspective'
        });
      };
    });
  }

  /* ----------------------------------------------------------
     Failsafes.
     ---------------------------------------------------------- */

  /* Content must never be stranded invisible: sweep anything at
     or above the fold that is still hidden after settle time. */
  function sweep() {
    qa('[data-reveal], [data-words]').forEach(function (el) {
      var style = window.getComputedStyle(el);
      if (style.opacity !== '0' && style.visibility !== 'hidden') return;
      if (el.getBoundingClientRect().top >= window.innerHeight) return;
      gsap.set(el, { autoAlpha: 1, y: 0, clearProps: 'filter' });
    });
  }
  window.setTimeout(sweep, 4000);
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) { ScrollTrigger.refresh(); window.setTimeout(sweep, 500); }
  });

  /* Mid-session switch to reduced motion: stop everything, put
     the DOM back, and let CSS force a fully visible page. */
  function neutralize() {
    root.classList.add('gsap-off');
    ScrollTrigger.getAll().forEach(function (t) { t.kill(); });
    gsap.globalTimeline.getChildren(true, true, true).forEach(function (a) { a.kill(); });
    splits.forEach(function (s) { try { s.revert(); } catch (e) {} });
    counters.forEach(function (c) { c.el.textContent = c.text; });
    scrambles.forEach(function (s) { s.el.textContent = s.text; });
    mm.revert();
    if (progressBar.parentNode) progressBar.parentNode.removeChild(progressBar);
    gsap.set(qa(
      '[data-reveal], [data-words], .hero-glow, .hero-arcline path, .hero-inner, ' +
      '.session-num, .session-card li, .session-list li, .nav-logo svg rect, ' +
      '.nav-logo svg path, .nav-logo svg circle, .program-visual svg *'
    ), { clearProps: 'all' });
  }

  var onMotionChange = function (e) { if (e.matches) neutralize(); };
  if (typeof reduceQuery.addEventListener === 'function') {
    reduceQuery.addEventListener('change', onMotionChange);
  } else if (typeof reduceQuery.addListener === 'function') {
    reduceQuery.addListener(onMotionChange);
  }
})();
