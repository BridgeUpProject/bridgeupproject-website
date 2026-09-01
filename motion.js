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

  /* ----------------------------------------------------------
     Reduced motion is honoured NOWHERE. Every visitor gets the
     full animated site regardless of their system setting.

     Requested, and the cost belongs in the code rather than only
     in a chat log: Reduce Motion is switched on for vestibular
     disorders, migraine and seizure triggers, where motion
     produces physical symptoms - nausea, vertigo, headache -
     rather than mild annoyance. Those visitors asked their
     browser for less motion and this site declines.

     To restore the accessible behaviour, set this back to
     `reduceQuery.matches` AND restore the
     @media (prefers-reduced-motion: reduce) block removed from
     site.css (see TIER 7 there). The two layers must agree: CSS
     suppressing motion the engine is still driving leaves
     elements frozen part-way through their animation, which is
     worse than either choice made alone.

     reduceQuery itself stays live below, because a mid-session
     switch must not tear the page down.
     ---------------------------------------------------------- */
  var honoursReduce = false;

  var hasLibs = window.gsap && window.ScrollTrigger && window.SplitText &&
                window.DrawSVGPlugin && window.ScrambleTextPlugin;

  /* ----------------------------------------------------------
     HERO CONSTELLATION — deliberately ABOVE the gate below.

     The constellation is the hero's "bridge" motif rendered
     literally: it is identity, not decoration. It also happens to
     need nothing from GSAP — it is a canvas of its own — so there
     was never a technical reason for it to sit behind the gate.

     It did, though, and the cost was severe. Returning early for
     prefers-reduced-motion took the constellation out of the page
     ENTIRELY, and site.js never rebuilds it, so an iPhone with
     Reduce Motion switched on — a very common accessibility
     setting, not an edge case — rendered a plain navy hero while
     the same visitor's laptop rendered the full one. That is not
     a motion difference between the two devices. It is a
     different design on each.

     The conflation is the bug: prefers-reduced-motion asks us not
     to ANIMATE, not to remove content. So the nodes and their
     links are always drawn, at the same derived density; only the
     drift and the pointer-grab response are conditional on the
     preference. A reader who asked for stillness gets a still
     constellation, not an empty hero.
     ---------------------------------------------------------- */
  var constellation = (function () {
    /* Density is DERIVED, not fixed. The tuned look - 44 nodes
       linking at 160px - was measured in a 1440x539 hero: one node
       per ~17,600 square px, link reach ~1.2x the mean spacing
       between nodes. Ship those constants unchanged to a 390x409
       phone hero and the area collapses to a fifth while count and
       reach stay put, so nearly every node reaches every other and
       the constellation renders as a solid mesh over the headline.

       Holding node DENSITY constant overshoots the other way (9
       nodes on a phone reads as empty), so count follows the
       hero's linear dimension - the square root of the area ratio
       - and the reach is re-derived from the spacing that implies.
       Both expressions return 44 and 160 exactly at 1440x539, so
       the laptop look is untouched. */
    var REF_AREA  = 1440 * 539;
    var REF_COUNT = 44;
    var REACH     = 1.205;

    var CREAM = '250, 248, 244';
    var GOLD  = '233, 190, 63';

    var host = null, canvas = null, ctx = null;
    var nodes = [], w = 0, h = 0, dpr = 1, reach = 160;
    var running = false, rafId = 0, visible = true;
    /* cx/cy are CLIENT coordinates. Handlers only store them - the
       conversion to canvas space needs a layout read, and doing that
       inside a touchmove that fires throughout a scroll gesture is a
       forced reflow per frame. step() does it once, batched with the
       draw it already performs.

       strength eases toward target instead of switching, so the web
       gathers and releases rather than snapping on and off. That
       matters most on touch, where the finger leaves abruptly. */
    var pointer = { x: -1e4, y: -1e4, cx: -1e4, cy: -1e4,
                    target: 0, strength: 0 };
    var grabReach = 170;

    function tune() {
      var r = host.getBoundingClientRect();
      var area  = Math.max(r.width * r.height, 1);
      var count = Math.min(52, Math.max(16,
                    Math.round(REF_COUNT * Math.sqrt(area / REF_AREA))));
      var distance = Math.round(REACH * Math.sqrt(area / count));
      return { count: count, distance: Math.min(175, Math.max(88, distance)) };
    }

    function makeNode(i) {
      var a = Math.random() * Math.PI * 2;
      var v = 0.14 + Math.random() * 0.14;
      return {
        x: Math.random() * w,
        y: Math.random() * h,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        r: 1.5 + Math.random() * 1.5,
        a: 0.3 + Math.random() * 0.4,
        /* One node in three is gold, matching the wordmark's
           keystone against its cream span. */
        c: (i % 3 === 2) ? GOLD : CREAM
      };
    }

    function seed(count) {
      nodes = [];
      for (var i = 0; i < count; i++) nodes.push(makeNode(i));
    }

    /* Grow or shrink to the derived count without disturbing the
       nodes already on screen. */
    function fitCount(count) {
      while (nodes.length > count) nodes.pop();
      while (nodes.length < count) nodes.push(makeNode(nodes.length));
    }

    function resize() {
      var r = host.getBoundingClientRect();
      w = Math.max(Math.round(r.width), 1);
      h = Math.max(Math.round(r.height), 1);
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width  = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width  = w + 'px';
      canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function draw() {
      ctx.clearRect(0, 0, w, h);

      /* Links first so nodes sit on top of their own threads. */
      var reach2 = reach * reach;
      var grab2  = grabReach * grabReach;
      for (var i = 0; i < nodes.length; i++) {
        var a = nodes[i];
        for (var j = i + 1; j < nodes.length; j++) {
          var b  = nodes[j];
          var dx = a.x - b.x, dy = a.y - b.y;
          var d2 = dx * dx + dy * dy;
          if (d2 > reach2) continue;

          /* Fade with distance so the mesh has depth rather than
             a hard cut-off at the reach radius. */
          var o = 0.22 * (1 - Math.sqrt(d2) / reach);

          if (o <= 0.004) continue;

          ctx.strokeStyle = 'rgba(' + CREAM + ',' + o.toFixed(3) + ')';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }

      /* Grab: lines reach from the cursor out to every node within
         range, brightest at the pointer and fading to nothing at the
         edge of it. This is the thing that makes the field feel
         attached to you rather than merely nearby - the previous
         version only brightened links that already existed between
         nodes, which is close to invisible. */
      if (pointer.strength > 0.01) {
        for (var p = 0; p < nodes.length; p++) {
          var pn = nodes[p];
          var px = pn.x - pointer.x, py = pn.y - pointer.y;
          var pd2 = px * px + py * py;
          if (pd2 > grab2) continue;
          var po = 0.38 * (1 - Math.sqrt(pd2) / grabReach) * pointer.strength;
          if (po <= 0.004) continue;
          ctx.strokeStyle = 'rgba(' + CREAM + ',' + po.toFixed(3) + ')';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(pointer.x, pointer.y);
          ctx.lineTo(pn.x, pn.y);
          ctx.stroke();
        }
      }

      for (var k = 0; k < nodes.length; k++) {
        var n = nodes[k];
        ctx.fillStyle = 'rgba(' + n.c + ',' + n.a + ')';
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function step() {
      /* One layout read per frame, for every pointer event since the
         last one. */
      if (pointer.target > 0 || pointer.strength > 0.01) {
        var pr = canvas.getBoundingClientRect();
        pointer.x = pointer.cx - pr.left;
        pointer.y = pointer.cy - pr.top;
      }
      pointer.strength += (pointer.target - pointer.strength) * 0.12;
      if (pointer.strength < 0.005) pointer.strength = 0;

      for (var i = 0; i < nodes.length; i++) {
        var n = nodes[i];
        n.x += n.vx;
        n.y += n.vy;
        /* Wrap rather than bounce: a bounce reads as a wall, and
           the hero has no walls. */
        if (n.x < -8) n.x = w + 8; else if (n.x > w + 8) n.x = -8;
        if (n.y < -8) n.y = h + 8; else if (n.y > h + 8) n.y = -8;
      }
      draw();
      rafId = window.requestAnimationFrame(step);
    }

    function play() {
      if (running || !visible || honoursReduce) return;
      running = true;
      rafId = window.requestAnimationFrame(step);
    }

    function pause() {
      running = false;
      if (rafId) { window.cancelAnimationFrame(rafId); rafId = 0; }
    }

    /* apply(true) builds the field from nothing. apply(false) fits an
       EXISTING field to a new box.

       This distinction is the whole bug. apply() used to call seed()
       unconditionally, which regenerates every node at a fresh random
       position - and on a phone the collapsing URL bar fires resize
       continuously while you scroll, so the entire constellation
       teleported roughly every 250ms for the whole length of the
       page. The library this replaced guarded against it by keying
       on the derived count and refusing to refresh when it had not
       changed; the guard did not survive the rewrite.

       Now positions are carried into the new box proportionally, and
       only the DIFFERENCE in node count is added or removed. A phone
       turning landscape still re-derives its density - which is what
       the derivation exists for - but it does so without resetting
       anything the reader was already looking at. */
    function apply(fresh) {
      var t = tune();
      reach = t.distance;
      grabReach = Math.round(t.distance * 1.06);

      var pw = w, ph = h;
      resize();

      if (fresh || !nodes.length) {
        seed(t.count);
      } else {
        if (pw > 0 && ph > 0 && (pw !== w || ph !== h)) {
          var sx = w / pw, sy = h / ph;
          for (var i = 0; i < nodes.length; i++) {
            nodes[i].x *= sx;
            nodes[i].y *= sy;
          }
        }
        fitCount(t.count);
      }
      draw();
    }

    /* ----------------------------------------------------------
       Why this is hand-written rather than a library.

       This replaced a 183 KB particle bundle that was 40% of the
       homepage's JavaScript and existed to draw one field of dots
       and lines. The derivation above is the only part that was
       ever hard, and it is unchanged.

       The bundle also could not do the two things this hero
       actually needs: stop completely when scrolled out of view,
       and draw a single static frame under Reduce Motion without
       keeping a rAF loop alive to do it.
       ---------------------------------------------------------- */
    function build() {
      host = document.querySelector('.hero-bg');
      if (!host) return;
      if (!window.requestAnimationFrame) return;

      canvas = document.createElement('canvas');
      canvas.id = 'hero-net';
      canvas.setAttribute('aria-hidden', 'true');
      canvas.style.cssText = 'position:absolute;inset:0;display:block;';
      ctx = canvas.getContext && canvas.getContext('2d');
      if (!ctx) return;
      host.appendChild(canvas);

      apply(true);

      /* Reduce Motion draws the constellation once and stops. The
         nodes and links are content - they are the hero's bridge
         motif rendered literally - so they stay. Only the drift
         and the pointer response are the preference's business. */
      if (honoursReduce) return;

      if (window.IntersectionObserver) {
        new window.IntersectionObserver(function (entries) {
          visible = entries[0].isIntersecting;
          if (visible) play(); else pause();
        }, { threshold: 0 }).observe(host);
      } else {
        play();
      }
      play();

      /* The listener goes on the hero SECTION, not on .hero-bg.

         .hero-bg is pointer-events:none (site.css) so that the
         decorative layer never intercepts clicks on the CTAs sitting
         above it - which also means it never receives pointermove,
         so the handler that used to live here could not fire at all.
         The old library sidestepped this by listening at the document
         level. Listening on .hero keeps the scope tight and still
         gets the events. */
      var pointerHost = host.closest('.hero') || host.parentNode || host;

      var reach = function (x, y) {
        pointer.cx = x;
        pointer.cy = y;
        pointer.target = 1;
        /* A pointer arriving over a field that paused off-screen
           would otherwise leave the grab lines unpainted. */
        if (!running) play();
      };
      var release = function () { pointer.target = 0; };

      /* MOUSE: the web follows the cursor with no click needed. */
      pointerHost.addEventListener('mousemove', function (e) {
        reach(e.clientX, e.clientY);
      }, { passive: true });
      pointerHost.addEventListener('mouseleave', release, { passive: true });

      /* TOUCH: the whole effect used to be gated behind
         (hover: hover) and (pointer: fine), so on a phone none of
         this was attached and the web never reached for anything.
         There is no cursor on a touchscreen, but there is a finger,
         and it is a better target than a cursor because you can see
         exactly where it is.

         Touch events rather than pointer events on purpose. iOS
         fires pointercancel the moment it claims a gesture for
         scrolling, which killed the effect the instant you started
         to move - whereas touchmove keeps firing all the way
         through the scroll. Passive throughout, and nothing calls
         preventDefault, so scrolling is untouched. */
      pointerHost.addEventListener('touchstart', function (e) {
        var t = e.touches[0];
        if (t) reach(t.clientX, t.clientY);
      }, { passive: true });
      pointerHost.addEventListener('touchmove', function (e) {
        var t = e.touches[0];
        if (t) reach(t.clientX, t.clientY);
      }, { passive: true });
      pointerHost.addEventListener('touchend', release, { passive: true });
      pointerHost.addEventListener('touchcancel', release, { passive: true });

      /* Refit, never reseed. See apply() above for why. */
      var timer = 0;
      window.addEventListener('resize', function () {
        window.clearTimeout(timer);
        timer = window.setTimeout(function () { apply(false); }, 250);
      });
    }

    /* Mid-session switch to Reduce Motion: stop the drift, keep
       the picture. Destroying it here would reintroduce exactly
       the blank hero this module exists to prevent. */
    function freeze() {
      pause();
      pointer.target = 0;
      pointer.strength = 0;
      if (ctx) draw();
    }

    return { build: build, freeze: freeze };
  })();

  constellation.build();

  /* Hand the page back to the legacy engine in site.js. */
  if (!hasLibs || honoursReduce) {
    root.classList.remove('gsap');
    return;
  }

  /* Claimed synchronously, and it has to be.

     site.js loads immediately after this file and reads the flag
     the moment it parses, to decide whether GSAP is driving or a
     vendor script failed and the legacy engine should take over.
     That check runs long before any async work here resolves, so
     setting the flag later means site.js ALWAYS concludes failure:
     it strips .gsap and runs its own engine alongside this one,
     and the .js:not(.gsap) rules in site.css start matching and
     fight the tweens. Two engines, one DOM.

     Setting it here does disarm the inline <head> timeout early.
     That is safe now because the recovery no longer depends on it:
     the .catch() below hands the page back fully visible if any
     init throws, and sweep() rescues anything still hidden at 4s -
     including below the fold, which it used to skip. */
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
  var notes     = [];

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
    /* These two loops run forever with repeat: -1, on all four
       pages. Because they never finish, GSAP's ticker never idles,
       so the browser holds a rAF loop open for the life of every
       page, ticking sixty times a second whether or not anything
       is moving. On a laptop that is invisible; on a phone it is
       battery spent on two blurred ellipses nobody is looking at.

       ScrollTrigger pauses each tween when its glow leaves the
       viewport and resumes on the way back, which lets the ticker
       actually go quiet once the hero is scrolled past. */
    glows.forEach(function (g, i) {
      var breathe = gsap.to(g, {
        scale: 1.12,
        xPercent: i % 2 ? 5 : -4,
        yPercent: i % 2 ? -4 : 3,
        duration: 9 + i * 3,
        yoyo: true,
        repeat: -1,
        ease: 'sine.inOut',
        delay: 1.5,
        paused: true
      });

      var hostSection = g.closest('.hero, .page-header') || g;
      ScrollTrigger.create({
        trigger: hostSection,
        start: 'top bottom',
        end: 'bottom top',
        onToggle: function (self) {
          if (self.isActive) breathe.play(); else breathe.pause();
        }
      });

      /* Above the fold on load, so start it. */
      if (hostSection.getBoundingClientRect().top < window.innerHeight) breathe.play();
    });
    /* Travel is scaled to the viewport rather than shipped as the
       same pixel count everywhere. 220px and 160px were chosen
       against a 1440x900 laptop; sent unchanged to a 390px phone
       the horizontal ride becomes 18% of the screen width instead
       of 5%, which does not read as the same effect scaled down,
       it reads as a different, twitchier one. Each axis scales on
       the dimension it actually travels along, with a floor so
       the motion thins out rather than disappearing. Both factors
       are exactly 1 at 1440x900, so the laptop is untouched. */
    var fx = Math.min(1.1, Math.max(0.34, window.innerWidth  / 1440));
    var fy = Math.min(1.1, Math.max(0.72, window.innerHeight /  900));
    qa('[data-parallax-y], [data-parallax-x]', container).forEach(function (el) {
      var sy = parseFloat(el.getAttribute('data-parallax-y')) || 0;
      var sx = parseFloat(el.getAttribute('data-parallax-x')) || 0;
      gsap.to(el, {
        y: sy * 220 * fy,
        x: sx * 160 * fx,
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

    /* Reveals first. Everything after this line is enhancement;
       if one of them throws, the page is already readable. */
    initReveals();
    initDrift();

    initHero();
    initPageHeader();
    initCounters();
    initMission();
    initNotation();
    initProgram();
    initSessionCards();
    initBio();
    initFinePointer();

    ScrollTrigger.refresh();
  }).catch(function (err) {
    /* An init threw. The engine owns hidden state that CSS cannot
       undo on its own, so hand the page back fully visible rather
       than leaving anything stranded at opacity 0. */
    if (window.console && console.error) console.error('[bridge-up] motion init failed', err);
    try { neutralize(); } catch (e) {}
    root.classList.remove('gsap');
  });


  /* ---------------- HOME: mission annotations ---------------- */
  /* Hand-drawn rough-notation marks on the two phrases the mission
     statement actually argues for. Drawn once, sequenced, after the
     masked-line reveal has finished settling. */
  /* site.css gives these two marks a plain CSS underline and box by
     default, because rough-notation is the one library on this page
     whose absence would be silent - the sentence stays readable and
     simply stops emphasising anything.

     .rn-live is what turns that fallback off, and it is added only
     once the annotations have actually been constructed. Every
     failure path - script missing, GSAP dead upstream, annotate()
     throwing - just never reaches it, so the fallback stands with no
     detection needed.

     The class goes on at construction rather than at draw, so the
     swap happens before the mission is scrolled into view and never
     reads as a flicker. If the deferred show() throws anyway, the
     fallback is put straight back. */
  function initNotation() {
    if (!window.RoughNotation) return;
    var marks = qa('.mission .note-mark');
    if (!marks.length) return;

    try {
      marks.forEach(function (el) {
        var box = el.getAttribute('data-note') === 'box';
        notes.push(RoughNotation.annotate(el, {
          type: box ? 'box' : 'underline',
          color: box ? '#1161A8' : '#E9BE3F',
          strokeWidth: 2.5,
          padding: box ? 5 : 2,
          iterations: 2,
          animationDuration: 900,
          multiline: true
        }));
      });
    } catch (e) {
      notes.length = 0;
      return;                      /* fallback stands */
    }

    root.classList.add('rn-live');

    ScrollTrigger.create({
      trigger: '.mission',
      start: 'top 60%',
      once: true,
      onEnter: function () {
        window.setTimeout(function () {
          try {
            RoughNotation.annotationGroup(notes).show();
          } catch (e) {
            /* Nothing will be drawn. Give the marks back. */
            root.classList.remove('rn-live');
          }
        }, 650);
      }
    });
  }

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

      /* The authored figure stays on screen until the count-up
         actually starts.

         Rendering at p=0 up front (which this did) rewrites
         "+69%" to "+0%" the moment the script runs, and leaves it
         there for good if the trigger never fires. These are cited
         statistics about real children in foster care. A number
         that animates is worth something; a number that can read
         zero is worth less than no animation at all. */
      ScrollTrigger.create({
        trigger: el,
        start: 'top 86%',
        once: true,
        onEnter: function () {
          gsap.to(state, {
            p: 1,
            duration: 1.6,
            ease: 'power2.out',
            onStart: render,
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
      /* Anchored to the VISUAL, not the section.

         Triggering on .program meant the end position - center 40%
         - referred to the section's centre, and the section is
         804px tall on a phone against 566 on a laptop. Below
         1000px .visual-shell also takes order:-1, so the bridge
         sits at the TOP of a section whose centre is far below it.
         The two effects compounded: on a 390x844 phone the build
         completed at scrollY 1566, by which point the bridge's top
         edge was at viewport y=7 - it finished at the instant it
         slid off the top of the screen, after 739px of scrolling.

         Anchoring to the visual makes both positions describe the
         thing the reader is actually watching, so it stays correct
         under the mobile reorder and at any section height. The
         percentages are viewport-relative, so this adapts by
         construction: the build now completes with the bridge
         centred at 58% of the viewport - comfortably in frame -
         373px of scroll earlier on a phone and 153px earlier on a
         laptop. */
      /* The keystone needed more scroll to land in.

         Measured on the shipped build, it moved through a clean
         seven-frame ease - 0.05, 0.27, 0.44, 0.61, 0.74, 0.86,
         0.95 - across 24px of scroll. Nothing was wrong with the
         animation; there was simply nowhere to see it. One notch
         of a scroll wheel is roughly 100px, so the entire landing
         happened between two frames for anyone not dragging the
         scrollbar by hand, and the circle appeared to snap.

         Two changes, no choreography touched. The trigger ends
         higher up the viewport, which buys the whole build more
         scroll distance while still completing well in frame. And
         the keystone takes a longer slice of the timeline, so it
         gets a proportionally larger share of that distance. Every
         ease, order and overlap is unchanged. */
      var build = gsap.timeline({
        scrollTrigger: { trigger: visual, start: 'top 92%', end: 'center 50%', scrub: 0.5 }
      });
      build
        .to('.arc-pillar-l', { scaleY: 1, duration: 0.35, ease: 'power1.out' }, 0)
        .to('.arc-pillar-r', { scaleY: 1, duration: 0.35, ease: 'power1.out' }, 0.08)
        .to('.arc-deck',     { scaleX: 1, duration: 0.4,  ease: 'power1.inOut' }, 0.12)
        .to('.arc-span',     { drawSVG: '100%', duration: 0.85, ease: 'power1.inOut' }, 0.35)
        .to('.arc-key',      { scale: 1, y: 0, duration: 0.55, ease: 'back.out(2.5)' }, 0.9);
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
     Column counter-drift — EVERY width, not just desktop.

     It used to sit inside the fine-pointer block below, which
     made it desktop-only, but it reads no pointer at all: it is
     scrubbed to scroll. The gate was really about frame cost on
     phones, and deriving the particle count paid that back.

     The amplitude needs no viewport scaling the way parallax does
     because yPercent is already relative to each child's own
     height, so it adapts by construction. What does change on a
     phone is the column count: the grids collapse to one column,
     so `cols` becomes 1 and adjacent CARDS counter-drift where on
     a laptop adjacent COLUMNS do. That is the same idea rendered
     in the layout that is actually on screen.
     ---------------------------------------------------------- */
  function initDrift() {
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
  }

  /* ----------------------------------------------------------
     Fine-pointer layer: CTA choreography and 3D card tilt.

     Still gated, and not for cost: both read a live cursor
     position. A touchscreen has no cursor, so these are undefined
     there rather than switched off. gsap.matchMedia reverts them
     automatically when input capability changes.
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

      /* Cards tip subtly toward the cursor.

         The rect is measured on enter and cached, not read inside
         mousemove. getBoundingClientRect() forces a synchronous
         layout flush, and calling it on every pointer frame is
         exactly the pattern that was removed from the CTAs above
         for that reason - it just never got removed here. It costs
         most on /programs, where eight cards are doing it while a
         scrub is running.

         Scroll invalidates the cached top, so the enter handler
         re-measures each time and a scroll listener is not needed. */
      qa('.path-card, .session-card, .stat-card').forEach(function (card) {
        gsap.set(card, { transformPerspective: 850 });
        var rxTo = gsap.quickTo(card, 'rotationX', { duration: 0.5, ease: 'power2.out' });
        var ryTo = gsap.quickTo(card, 'rotationY', { duration: 0.5, ease: 'power2.out' });
        var rect = null;

        on(card, 'mouseenter', function () { rect = card.getBoundingClientRect(); });
        on(card, 'mousemove', function (e) {
          if (!rect) rect = card.getBoundingClientRect();
          rxTo(((e.clientY - rect.top) / rect.height - 0.5) * -5);
          ryTo(((e.clientX - rect.left) / rect.width - 0.5) * 5);
        });
        on(card, 'mouseleave', function () {
          rect = null;
          rxTo(0);
          ryTo(0);
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

  /* Content must never be stranded invisible.

     This used to skip anything below the fold, on the theory that
     its ScrollTrigger had simply not fired yet. That is true in
     the healthy case and false in exactly the case a failsafe is
     for: if the batch never got created, below-fold elements are
     the ones that stay hidden forever. So sweep everything, and
     let the still-pending triggers no-op on already-visible
     elements instead. */
  function sweep() {
    qa('[data-reveal], [data-words]').forEach(function (el) {
      var style = window.getComputedStyle(el);
      if (style.opacity !== '0' && style.visibility !== 'hidden') return;
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
    constellation.freeze();
    /* The annotations are being torn off the page, so the CSS
       fallback has to come back with them or the mission statement
       loses its emphasis for the rest of the session. */
    notes.forEach(function (n) { try { n.remove(); } catch (e) {} });
    notes = [];
    root.classList.remove('rn-live');
    if (progressBar.parentNode) progressBar.parentNode.removeChild(progressBar);
    gsap.set(qa(
      '[data-reveal], [data-words], .hero-glow, .hero-arcline path, .hero-inner, ' +
      '.session-num, .session-card li, .session-list li, .nav-logo svg rect, ' +
      '.nav-logo svg path, .nav-logo svg circle, .program-visual svg *'
    ), { clearProps: 'all' });
  }

  /* Nothing to do on a mid-session switch: the preference is not
     honoured, so flipping it must not tear the page down. Kept
     wired up so restoring honoursReduce restores this too. */
  var onMotionChange = function (e) { if (e.matches && honoursReduce) neutralize(); };
  if (typeof reduceQuery.addEventListener === 'function') {
    reduceQuery.addEventListener('change', onMotionChange);
  } else if (typeof reduceQuery.addListener === 'function') {
    reduceQuery.addListener(onMotionChange);
  }
})();
