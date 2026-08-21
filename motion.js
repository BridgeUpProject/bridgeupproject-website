/* ============================================================
   The Bridge Up Project — GSAP motion engine
   Loads after the self-hosted GSAP bundles (see /vendor) and
   before site.js. When every library is present and the visitor
   has not asked for reduced motion, this file owns all motion on
   the site and site.js keeps only its interaction plumbing
   (menu, anchors). In every other case the <html> "gsap" class
   is dropped and the original dependency-free engine in site.js
   takes over — including its reduced-motion behaviour.

   Choreography map:
     all pages   nav bridge draws itself · gold scroll-progress
                 rail · batched blur/lift reveals · magnetic CTAs
                 · 3D card tilt (fine pointers only)
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
      var on = function (el, type, fn) {
        el.addEventListener(type, fn);
        handlers.push([el, type, fn]);
      };

      /* Magnetic buttons — they lean toward the cursor and snap
         back with an elastic release. */
      qa('.btn-primary, .btn-secondary').forEach(function (btn) {
        var xTo = gsap.quickTo(btn, 'x', { duration: 0.35, ease: 'power3.out' });
        var yTo = gsap.quickTo(btn, 'y', { duration: 0.35, ease: 'power3.out' });
        on(btn, 'mousemove', function (e) {
          var r = btn.getBoundingClientRect();
          xTo((e.clientX - (r.left + r.width / 2)) * 0.32);
          yTo((e.clientY - (r.top + r.height / 2)) * 0.32);
        });
        on(btn, 'mouseenter', function () {
          gsap.to(btn, { scale: 1.04, duration: 0.3 });
        });
        on(btn, 'mouseleave', function () {
          xTo(0);
          yTo(0);
          gsap.to(btn, { scale: 1, duration: 0.9, ease: 'elastic.out(1, 0.4)' });
        });
        /* The inline transform the magnet writes overrides the CSS
           :active press feedback, so replicate it here. */
        on(btn, 'mousedown', function () {
          gsap.to(btn, { scale: 0.97, duration: 0.14, ease: 'power3.out' });
        });
        on(btn, 'mouseup', function () {
          gsap.to(btn, { scale: 1.04, duration: 0.2, ease: 'power3.out' });
        });
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
        gsap.set(qa('.btn-primary, .btn-secondary, .path-card, .session-card, .stat-card'), {
          clearProps: 'x,y,scale,rotationX,rotationY,transformPerspective'
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
