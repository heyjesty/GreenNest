// GreenNest – storefront interactions
(function () {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const csrf = $('meta[name="csrf-token"]')?.content || '';

  /* ---------- Toasts ---------- */
  const stack = $('#toastStack');
  function dismiss(toast) {
    toast.classList.add('is-leaving');
    setTimeout(() => toast.remove(), 300);
  }
  function toast(message, type = 'success') {
    if (!stack) return;
    const el = document.createElement('div');
    el.className = `toast toast--${type}`;
    el.setAttribute('role', 'status');
    el.innerHTML = `<svg><use href="#${type === 'error' ? 'i-close' : 'i-check'}"/></svg><span></span><button class="toast__close" aria-label="Dismiss">&times;</button>`;
    el.querySelector('span').textContent = message;
    stack.appendChild(el);
    setTimeout(() => dismiss(el), 4500);
  }
  if (stack) {
    stack.addEventListener('click', (e) => {
      if (e.target.closest('.toast__close')) dismiss(e.target.closest('.toast'));
    });
    $$('.toast', stack).forEach((t) => setTimeout(() => dismiss(t), 5000));
  }

  /* ---------- Mobile menu ---------- */
  const toggle = $('#navToggle');
  const menu = $('#navMenu');
  if (toggle && menu) {
    const setMenu = (open) => {
      menu.classList.toggle('is-open', open);
      toggle.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    };
    toggle.addEventListener('click', () => setMenu(!menu.classList.contains('is-open')));
    $$('a', menu).forEach((a) => a.addEventListener('click', () => setMenu(false)));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });
    window.addEventListener('resize', () => { if (window.innerWidth > 1024) setMenu(false); });
  }

  /* ---------- Header shadow ---------- */
  const header = $('.header');
  if (header) {
    const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ---------- Home page product tabs ---------- */
  const tabs = $$('.tab');
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => {
        t.classList.toggle('is-active', t === tab);
        t.setAttribute('aria-selected', String(t === tab));
      });
      const filter = tab.dataset.filter;
      $$('.favorites .product').forEach((p) => {
        const show = filter === 'all' || (p.dataset.cat || '').split(' ').includes(filter);
        p.classList.toggle('is-hidden', !show);
      });
    });
  });

  /* ---------- Cart badge ---------- */
  function setCartCount(count) {
    $$('[data-cart-count]').forEach((b) => {
      b.textContent = count;
      b.hidden = !count;
      b.classList.remove('bump');
      void b.offsetWidth;
      b.classList.add('bump');
    });
  }

  /* ---------- Add to cart (AJAX with normal form fallback) ---------- */
  $$('.js-add-to-cart').forEach((form) => {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = form.querySelector('button:not([type="button"])');
      btn.disabled = true;
      try {
        const res = await fetch(form.action, {
          method: 'POST',
          headers: { Accept: 'application/json', 'x-csrf-token': csrf },
          body: new URLSearchParams(new FormData(form)),
        });
        const data = await res.json();
        toast(data.message, data.ok ? 'success' : 'error');
        if (typeof data.count === 'number') setCartCount(data.count);
        if (data.ok && btn.classList.contains('product__cart')) {
          btn.classList.remove('is-added');
          void btn.offsetWidth;
          btn.classList.add('is-added');
        }
      } catch {
        form.submit();
      } finally {
        btn.disabled = false;
      }
    });
  });

  /* ---------- Newsletter (AJAX) ---------- */
  $$('.js-subscribe').forEach((form) => {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = form.querySelector('button');
      const label = btn.textContent;
      btn.disabled = true;
      btn.textContent = 'Subscribing…';
      try {
        const res = await fetch(form.action, {
          method: 'POST',
          headers: { Accept: 'application/json', 'x-csrf-token': csrf },
          body: new URLSearchParams(new FormData(form)),
        });
        const data = await res.json();
        toast(data.message, data.ok ? 'success' : 'error');
        if (data.ok) form.reset();
      } catch {
        form.submit();
      } finally {
        btn.disabled = false;
        btn.textContent = label;
      }
    });
  });

  /* ---------- Quantity steppers ---------- */
  $$('[data-qty]').forEach((wrap) => {
    const input = $('input', wrap);
    const autosubmit = wrap.hasAttribute('data-autosubmit');
    let timer;
    const commit = () => {
      if (!autosubmit) return;
      clearTimeout(timer);
      timer = setTimeout(() => wrap.closest('form').submit(), 450);
    };
    $$('[data-step]', wrap).forEach((b) => {
      b.addEventListener('click', () => {
        const min = Number(input.min || 0);
        const max = Number(input.max || 99);
        input.value = Math.min(max, Math.max(min, (Number(input.value) || 0) + Number(b.dataset.step)));
        commit();
      });
    });
    input.addEventListener('change', commit);
  });

  /* ---------- Shop: sort + filter drawer ---------- */
  const sort = $('.js-sort');
  if (sort) {
    sort.addEventListener('change', () => {
      const base = sort.dataset.base || '';
      const sep = base.includes('?') ? '&' : '?';
      window.location.href = `/shop${base}${sep}sort=${encodeURIComponent(sort.value)}`;
    });
  }
  const filters = $('#shopFilters');
  const backdrop = $('.filters-backdrop');
  if (filters) {
    const open = (state) => {
      filters.classList.toggle('is-open', state);
      backdrop?.classList.toggle('is-open', state);
      document.body.style.overflow = state ? 'hidden' : '';
    };
    $$('[data-open-filters]').forEach((b) => b.addEventListener('click', () => open(true)));
    $$('[data-close-filters]').forEach((b) => b.addEventListener('click', () => open(false)));
    $$('input[type="radio"], input[type="checkbox"]', filters).forEach((i) => {
      i.addEventListener('change', () => { if (window.innerWidth > 1024) i.form.submit(); });
    });
  }

  /* ---------- Password visibility ---------- */
  $$('[data-toggle-password]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const input = btn.previousElementSibling;
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.textContent = show ? 'Hide' : 'Show';
      btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
    });
  });

  /* ---------- Scroll reveal ---------- */
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const REVEAL = [
    ['.section-title, .blog__intro, .divider, .eyebrow, .care__title--center', ''],
    ['.feature', ''],
    ['.why__image', 'reveal--zoom'],
    ['.care__intro, .split__media', 'reveal--left'],
    ['.care__cards .glass-card, .split__text', 'reveal--right'],
    ['.tabs, .shop__toolbar, .blog-toolbar', ''],
    ['.product, .post, .value-card, .steps li, .info-card, .review, .accordion details', ''],
    ['.sale__title, .sale__text, .btn--sale, .sale__code', 'reveal--left'],
    ['.newsletter__panel', 'reveal--zoom'],
    ['.panel, .table-wrap, .center > .btn, .center-text, .article-cta, .prose > *', ''],
    ['.footer__brand, .footer__col', ''],
  ];

  if (!reduceMotion && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        el.classList.add('is-visible');
        io.unobserve(el);
        // Clean up afterwards so the element's own hover transitions take over again.
        const done = () => {
          el.classList.remove('reveal', 'reveal--left', 'reveal--right', 'reveal--zoom', 'is-visible');
          el.style.removeProperty('--reveal-delay');
        };
        el.addEventListener('transitionend', (e) => { if (e.target === el) done(); });
        setTimeout(done, 1600);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

    const seen = new Set();
    REVEAL.forEach(([selector, variant]) => {
      $$(selector).forEach((el) => {
        if (seen.has(el) || el.closest('.reveal')) return;
        // Only hide things that start below the fold, so nothing visible ever flickers.
        if (el.getBoundingClientRect().top < window.innerHeight * 0.9) return;
        seen.add(el);
        // Stagger siblings in grids (products, posts, cards...).
        const siblings = Array.from(el.parentElement.children).filter((c) => c.matches(selector));
        const index = Math.max(0, siblings.indexOf(el));
        el.style.setProperty('--reveal-delay', `${Math.min(index % 4, 3) * 0.1}s`);
        el.classList.add('reveal');
        if (variant) el.classList.add(variant);
        io.observe(el);
      });
    });
  }

  /* ---------- Count-up for stats ---------- */
  const counters = $$('.stat__num');
  if (counters.length && !reduceMotion && 'IntersectionObserver' in window) {
    const countIO = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        countIO.unobserve(entry.target);
        const node = Array.from(entry.target.childNodes).find((n) => n.nodeType === 3 && /\d/.test(n.textContent));
        if (!node) return;
        const original = node.textContent;
        const match = original.match(/[\d,.]+/);
        const target = parseFloat(match[0].replace(/,/g, ''));
        const decimals = (match[0].split('.')[1] || '').length;
        const start = performance.now();
        const duration = 1600;
        const tick = (now) => {
          const p = Math.min(1, (now - start) / duration);
          const eased = 1 - Math.pow(1 - p, 3);
          const value = (target * eased).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
          node.textContent = original.replace(match[0], value);
          if (p < 1) requestAnimationFrame(tick);
          else node.textContent = original;
        };
        requestAnimationFrame(tick);
      });
    }, { threshold: 0.6 });
    counters.forEach((c) => countIO.observe(c));
  }

  /* ---------- Confirm before destructive actions ---------- */
  $$('form[data-confirm]').forEach((form) => {
    form.addEventListener('submit', (e) => {
      if (!window.confirm(form.dataset.confirm)) e.preventDefault();
    });
  });
})();
