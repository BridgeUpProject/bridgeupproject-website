/* ============================================================
   The Bridge Up Project — interaction & motion layer
   No dependencies. Everything degrades to a fully readable page
   if this file fails to load (see the .js gate in site.css).

   Motion values follow the ui-ux-pro-max motion DB:
     - parallax on decorative layers only, never reading copy
     - small deltas, <= 3 layers, no section pinning
     - stagger 30-80ms, reveal y-offset 8-24px
     - all scroll-linked motion disabled under reduced-motion
   ============================================================ */
(function () {
  'use strict';

  var motionQuery  = window.matchMedia('(prefers-reduced-motion: reduce)');
  var reduceMotion = motionQuery.matches;

  /* GSAP handoff. motion.js (loaded just before this file) sets
     __BU_MOTION_OK__ once the GSAP engine owns the page. If the
     <html> gsap class is present without that flag, a vendor
     script failed to load — drop the class so the CSS transition
     system comes back, and run the legacy engine below as usual.
     Sections 1–4 (measure, word split, reveal, scroll engine)
     are motion and belong to whichever engine is active;
     sections 5–6 (menu, anchors) are interaction and always run. */
  var gsapMode = document.documentElement.classList.contains('gsap');
  if (gsapMode && !window.__BU_MOTION_OK__) {
    document.documentElement.classList.remove('gsap');
    gsapMode = false;
  }

  var clamp = function (v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; };

  if (!gsapMode) {

  /* Tell the inline head failsafe an engine owns the page, so it
     never strips the .js gate out from under a running reveal. */
  window.__BU_LEGACY_OK__ = true;

  /* ----------------------------------------------------------
     1. Measure the bridge span so the draw-in ends exactly on
        the path, whatever its geometry. Must run before reveal.
     ---------------------------------------------------------- */
  Array.prototype.forEach.call(document.querySelectorAll('.arc-span'), function (path) {
    if (typeof path.getTotalLength !== 'function') return;
    path.style.setProperty('--arc-len', Math.ceil(path.getTotalLength()));
  });

  /* ----------------------------------------------------------
     2. Headline word split.
        Done in JS so the markup stays clean text for crawlers
        and for anyone without scripting. Words, not characters:
        these headlines run past the ~8-word limit where
        per-character splitting stops being safe for DOM size
        and screen-reader pacing.
     ---------------------------------------------------------- */
  var WORD_STEP = 45; // ms

  Array.prototype.forEach.call(document.querySelectorAll('[data-words]'), function (el) {
    var words = el.textContent.trim().split(/\s+/);
    if (!words.length) return;

    var frag = document.createDocumentFragment();
    words.forEach(function (word, i) {
      var span = document.createElement('span');
      span.className = 'word';
      span.textContent = word;
      span.style.setProperty('--word-delay', i * WORD_STEP + 'ms');
      frag.appendChild(span);
      if (i < words.length - 1) frag.appendChild(document.createTextNode(' '));
    });

    el.textContent = '';
    el.appendChild(frag);
    el.classList.add('word-reveal');

    // Drop will-change once the last word has landed
    var settleAfter = words.length * WORD_STEP + 800;
    el.addEventListener('transitionend', function once() {
      window.setTimeout(function () { el.classList.add('is-settled'); }, settleAfter);
      el.removeEventListener('transitionend', once);
    });
  });

  /* ----------------------------------------------------------
     3. Scroll reveal.
        Delay is assigned per intersection *batch*, not per DOM
        index: elements crossing together read as a staggered
        group, while an element arriving alone gets no delay.
     ---------------------------------------------------------- */
  var targets = document.querySelectorAll('[data-reveal], [data-words]');

  if (!('IntersectionObserver' in window)) {
    Array.prototype.forEach.call(targets, function (el) { el.classList.add('is-visible'); });
  } else {
    var STEP = 70; // ms between items in a batch
    var MAX  = 5;  // cap so a large batch never feels slow

    var observer = new IntersectionObserver(function (entries) {
      entries
        .filter(function (entry) { return entry.isIntersecting; })
        .sort(function (a, b) {
          var pos = a.target.compareDocumentPosition(b.target);
          return (pos & Node.DOCUMENT_POSITION_FOLLOWING) ? -1 : 1;
        })
        .forEach(function (entry, i) {
          var el = entry.target;
          var delay = Math.min(i, MAX) * STEP;
          el.style.setProperty('--reveal-delay', delay + 'ms');
          el.classList.add('is-visible');
          observer.unobserve(el);

          // Hand transform control over to the scroll engine once the
          // reveal has finished, so drift tracks scroll without lag.
          if (el.classList.contains('drift-col')) {
            window.setTimeout(function () { el.classList.add('drift-live'); }, delay + 700);
          }
        });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });

    Array.prototype.forEach.call(targets, function (el) {
      // Anything already scrolled past (deep link, restored scroll position,
      // browser back) must not sit at opacity:0 waiting for an intersection
      // that will never come.
      if (el.getBoundingClientRect().bottom < 0) {
        el.classList.add('is-visible');
        if (el.classList.contains('drift-col')) el.classList.add('drift-live');
        return;
      }
      observer.observe(el);
    });

    /* Failsafe. Content must never be stranded at opacity:0 because an
       intersection never arrived — IntersectionObserver does not fire
       while the document is hidden (background tab, prerender, an
       occluded window), and a page that loads in that state would
       otherwise render blank. Sweeping only what is already at or above
       the fold keeps the scroll animation intact for everything below. */
    var sweep = function () {
      var vh = window.innerHeight;
      Array.prototype.forEach.call(targets, function (el) {
        if (el.classList.contains('is-visible')) return;
        if (el.getBoundingClientRect().top >= vh) return;
        el.classList.add('is-visible');
        if (el.classList.contains('drift-col')) el.classList.add('drift-live');
        observer.unobserve(el);
      });
    };

    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) sweep();
    });
    window.setTimeout(sweep, 3000);
  }

  /* ----------------------------------------------------------
     4. Scroll engine — hero transformation, parallax, drift.
        One rAF loop, reads batched before writes so nothing
        thrashes layout. Skipped entirely under reduced motion.
     ---------------------------------------------------------- */
  var nav       = document.querySelector('nav');
  var hero      = document.querySelector('.hero');
  var heroInner = document.querySelector('.hero-inner');
  var layers    = Array.prototype.slice.call(
    document.querySelectorAll('[data-parallax-y], [data-parallax-x]')
  );

  /* Counter-drift.
     Two axes, because they are not the same design problem:

     - axis "column" is for an asymmetric pair (a text block beside a
       visual). The two halves are different kinds of content, so
       offsetting them against each other reads as depth.

     - axis "row" (the default) is for a grid of peer cards. Cards in
       the same row must keep a shared baseline — offsetting siblings
       against each other reads as broken alignment, not parallax — so
       the whole row moves together and depth comes from row-to-row
       difference instead. */
  var driftGroups = [];
  Array.prototype.forEach.call(document.querySelectorAll('[data-drift]'), function (grid) {
    var group = {
      host: grid,
      amp: parseFloat(grid.getAttribute('data-drift')) || 12,
      axis: grid.getAttribute('data-drift-axis') === 'column' ? 'column' : 'row',
      children: Array.prototype.slice.call(grid.children),
      cols: 1
    };
    group.children.forEach(function (child) {
      child.classList.add('drift-col');
      // Already revealed above (scrolled past at load): hand it straight
      // to the scroll engine, there is no reveal left to wait for.
      if (child.classList.contains('is-visible')) child.classList.add('drift-live');
    });
    driftGroups.push(group);
  });

  function measureColumns() {
    driftGroups.forEach(function (g) {
      var tpl = window.getComputedStyle(g.host).gridTemplateColumns;
      g.cols = tpl && tpl !== 'none' ? tpl.split(/\s+/).filter(Boolean).length : 1;
    });
  }
  measureColumns();

  function driftDir(group, index) {
    var unit = group.axis === 'column' ? index : Math.floor(index / Math.max(group.cols, 1));
    return unit % 2 === 0 ? -1 : 1;
  }

  var idleTimer = null;
  var ticking   = false;

  function markIdle() {
    layers.forEach(function (el) { el.classList.add('parallax-idle'); });
  }

  function hostProgress(rect, vh) {
    // -1 while entering from below, 0 at centre, +1 once fully above
    return clamp(((vh - rect.top) / (vh + rect.height) - 0.5) * 2, -1, 1);
  }

  function frame() {
    ticking = false;
    var vh = window.innerHeight;
    var writes = [];

    // --- reads ---
    if (nav) {
      var scrolled = window.scrollY > 8;
      writes.push(function () { nav.classList.toggle('is-scrolled', scrolled); });
    }

    if (hero && heroInner) {
      var heroH = hero.offsetHeight || 1;
      var p = clamp(window.scrollY / heroH, 0, 1);
      writes.push(function () {
        heroInner.style.transform = 'translate3d(0,' + (p * -72).toFixed(2) + 'px,0)';
        heroInner.style.opacity = clamp(1 - p * 1.35, 0, 1).toFixed(3);
      });
    }

    layers.forEach(function (el) {
      var host = el.closest('.hero, .page-header') || el.parentElement;
      var shift = hostProgress(host.getBoundingClientRect(), vh);
      var sy = parseFloat(el.getAttribute('data-parallax-y')) || 0;
      var sx = parseFloat(el.getAttribute('data-parallax-x')) || 0;
      writes.push(function () {
        el.style.transform =
          'translate3d(' + (shift * sx * 150).toFixed(2) + 'px,' +
                           (shift * sy * 150).toFixed(2) + 'px,0)';
      });
    });

    if (window.innerWidth > 760) {
      driftGroups.forEach(function (group) {
        var shift = hostProgress(group.host.getBoundingClientRect(), vh);
        group.children.forEach(function (child, i) {
          var offset = (shift * group.amp * driftDir(group, i)).toFixed(2) + 'px';
          writes.push(function () { child.style.setProperty('--drift', offset); });
        });
      });
    }

    // --- writes ---
    writes.forEach(function (w) { w(); });

    layers.forEach(function (el) { el.classList.remove('parallax-idle'); });
    window.clearTimeout(idleTimer);
    idleTimer = window.setTimeout(markIdle, 180);
  }

  function onResize() {
    measureColumns();
    onScroll();
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(frame);
  }

  // Nav depth is a state change, not motion, so it stays live even when
  // the scroll engine is off. Named (not anonymous) so that toggling
  // reduced-motion repeatedly cannot pile up listeners.
  function syncNavOnly() {
    if (nav) nav.classList.toggle('is-scrolled', window.scrollY > 8);
  }

  function startEngine() {
    window.removeEventListener('scroll', syncNavOnly);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize, { passive: true });
    frame();
  }

  function stopEngine() {
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onResize);
    window.clearTimeout(idleTimer);
    if (heroInner) { heroInner.style.transform = ''; heroInner.style.opacity = ''; }
    layers.forEach(function (el) { el.style.transform = ''; });
    driftGroups.forEach(function (g) {
      g.children.forEach(function (c) { c.style.removeProperty('--drift'); });
    });
    window.removeEventListener('scroll', syncNavOnly);
    window.addEventListener('scroll', syncNavOnly, { passive: true });
    syncNavOnly();
  }

  if (reduceMotion) { stopEngine(); } else { startEngine(); }

  // Honour a mid-session change to the OS setting
  var onMotionChange = function (e) {
    reduceMotion = e.matches;
    if (reduceMotion) { stopEngine(); } else { startEngine(); }
  };
  if (typeof motionQuery.addEventListener === 'function') {
    motionQuery.addEventListener('change', onMotionChange);
  } else if (typeof motionQuery.addListener === 'function') {
    motionQuery.addListener(onMotionChange);
  }

  } /* end !gsapMode — legacy motion engine */

  /* ----------------------------------------------------------
     5. Dropdown dismissal. A <details> menu that only closes by
        clicking its own summary is a trap — wire up outside
        click and Escape.
     ---------------------------------------------------------- */
  var menu = document.querySelector('.nav-menu');
  if (menu) {
    document.addEventListener('click', function (e) {
      if (menu.open && !menu.contains(e.target)) menu.open = false;
    });

    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape' || !menu.open) return;
      menu.open = false;
      var summary = menu.querySelector('summary');
      if (summary) summary.focus();
    });

    Array.prototype.forEach.call(menu.querySelectorAll('a'), function (link) {
      link.addEventListener('click', function () { menu.open = false; });
    });
  }

  /* ----------------------------------------------------------
     6. In-page anchors: honour reduced-motion, land clear of nav.
     ---------------------------------------------------------- */
  Array.prototype.forEach.call(document.querySelectorAll('a[href^="#"]'), function (link) {
    link.addEventListener('click', function (e) {
      var id = link.getAttribute('href');
      if (!id || id === '#') return;
      var target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      /* Read the live value: the listener that refreshes reduceMotion
         belongs to the legacy engine and is absent in gsap mode. */
      target.scrollIntoView({ behavior: motionQuery.matches ? 'auto' : 'smooth', block: 'start' });
      history.replaceState(null, '', id);
    });
  });
})();
