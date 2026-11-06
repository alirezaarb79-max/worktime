/* =============================================================
 * کارنما — فایل اصلی برنامه
 * وضعیت سراسری، مسیریابی (Router)، کامپوننت‌های مشترک
 * (Toast / Modal / Confirm / PeriodPicker) و راه‌اندازی
 * ============================================================= */
(function (root) {
  'use strict';

  const App = root.App = root.App || {};
  const J = App.jalali;
  const U = App.util;

  App.version = '1.3.0';

  /* ---------- ثابت‌ها ---------- */
  const PERIOD_LS_KEY = 'karnama:period';
  const TOAST_DURATION_MS = 3800;
  const TOAST_MAX = 4;
  const ROUTES = ['dashboard', 'logs', 'calendar', 'reports', 'settings'];
  const ROUTE_TITLES = {
    dashboard: 'داشبورد',
    logs: 'ثبت کارکرد',
    calendar: 'تقویم',
    reports: 'گزارش‌ها',
    settings: 'تنظیمات'
  };
  const ROUTE_SUBTITLES = {
    dashboard: 'نمای کلی کارکرد و اضافه‌کاری',
    logs: 'ثبت و ویرایش کارکرد روزانه',
    calendar: 'تقویم ماهانه شمسی',
    reports: 'گزارش ماهانه و سالانه',
    settings: 'قوانین محاسبه و مدیریت داده‌ها'
  };

  /* =============================================================
   * وضعیت سراسری
   * ============================================================= */
  App.state = {
    route: 'dashboard',
    period: null, /* { jy, jm } */
    today: null   /* { jy, jm, jd } */
  };

  App.data = {
    records: new Map(),
    settings: null
  };

  /* =============================================================
   * آیکون‌های SVG (سبک Feather)
   * ============================================================= */
  function svg(paths, extra) {
    return '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"' + (extra || '') + '>' + paths + '</svg>';
  }

  App.icons = {
    clock: svg('<circle cx="12" cy="12" r="10"></circle><path d="M12 6v6l4 2"></path>'),
    target: svg('<circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle>'),
    zap: svg('<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>'),
    calendarCheck: svg('<rect x="3" y="4" width="18" height="18" rx="2"></rect><path d="M16 2v4M8 2v4M3 10h18"></path><path d="M9 16l2 2 4-4"></path>'),
    mission: svg('<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle>'),
    oncall: svg('<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>'),
    leave: svg('<path d="M23 12a11.05 11.05 0 0 0-22 0zm-5 7a3 3 0 0 1-6 0v-7"></path>'),
    holiday: svg('<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><path d="M4 22v-7"></path>'),
    inbox: svg('<path d="M22 12h-6l-2 3h-4l-2-3H2"></path><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"></path>'),
    alert: svg('<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><path d="M12 9v4M12 17h.01"></path>'),
    edit: svg('<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>'),
    trash: svg('<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><path d="M10 11v6M14 11v6"></path>'),
    copy: svg('<rect x="9" y="9" width="13" height="13" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>'),
    plus: svg('<path d="M12 5v14M5 12h14"></path>'),
    search: svg('<circle cx="11" cy="11" r="8"></circle><path d="M21 21l-4.35-4.35"></path>'),
    excel: svg('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8v0M10 9l4 10"></path>'),
    print: svg('<path d="M6 9V2h12v7"></path><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect>'),
    sun: svg('<circle cx="12" cy="12" r="5"></circle><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"></path>'),
    moon: svg('<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>'),
    monitor: svg('<rect x="2" y="3" width="20" height="14" rx="2"></rect><path d="M8 21h8M12 17v4"></path>'),
    grid: svg('<rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect>'),
    bar: svg('<path d="M12 20V10M18 20V4M6 20v-4"></path>'),
    sliders: svg('<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3"></path><path d="M1 14h6M9 8h6M17 16h6"></path>'),
    save: svg('<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><path d="M17 21v-8H7v8M7 3v5h8"></path>'),
    hard: svg('<line x1="22" y1="12" x2="2" y2="12"></line><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"></path><line x1="6" y1="16" x2="6.01" y2="16"></line><line x1="10" y1="16" x2="10.01" y2="16"></line>'),
    download: svg('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><path d="M7 10l5 5 5-5M12 15V3"></path>'),
    upload: svg('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><path d="M17 8l-5-5-5 5M12 3v12"></path>'),
    calendar: svg('<rect x="3" y="4" width="18" height="18" rx="2"></rect><path d="M16 2v4M8 2v4M3 10h18"></path>'),
    table: svg('<rect x="3" y="3" width="18" height="18" rx="2"></rect><path d="M3 9h18M3 15h18M9 3v18"></path>'),
    menu: svg('<path d="M3 6h18M3 12h18M3 18h18"></path>'),
    x: svg('<path d="M18 6L6 18M6 6l12 12"></path>'),
    check: svg('<path d="M20 6L9 17l-5-5"></path>'),
    chevronRight: svg('<path d="M9 18l6-6-6-6"></path>'),
    chevronLeft: svg('<path d="M15 18l-6-6 6-6"></path>')
  };

  /* =============================================================
   * دانلود فایل (Blob)
   * ============================================================= */
  App.download = function (blob, filename) {
    /* در اپ اندروید: ذخیره از طریق پل بومی (مستقیم به پوشه Downloads گوشی) */
    const bridge = (typeof root.KarnamaAndroid === 'object' && root.KarnamaAndroid) ? root.KarnamaAndroid : null;
    const saveViaBrowser = function () {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(function () {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 0);
    };
    if (bridge && typeof bridge.saveFile === 'function') {
      const fr = new FileReader();
      fr.onload = function () {
        try {
          const b64 = String(fr.result).split(',')[1] || '';
          const res = JSON.parse(bridge.saveFile(filename, blob.type || '', b64) || '{}');
          if (res.ok) {
            ui.toast(res.pending ? 'در حال ذخیره…' : 'ذخیره شد: ' + (res.path || 'Downloads'), 'success');
          } else {
            ui.toast(res.error || 'خطا در ذخیره فایل', 'error');
          }
        } catch (e) { saveViaBrowser(); }
      };
      fr.onerror = saveViaBrowser;
      fr.readAsDataURL(blob);
      return;
    }
    saveViaBrowser();
  };

  /* =============================================================
   * Toast
   * ============================================================= */
  const ui = App.ui || (App.ui = {});

  ui.toast = function (message, type) {
    const kind = type || 'info';
    const rootEl = document.getElementById('toast-root');
    if (!rootEl) return;
    while (rootEl.children.length >= TOAST_MAX) {
      rootEl.removeChild(rootEl.firstChild);
    }
    const el = document.createElement('div');
    el.className = 'toast toast--' + kind;
    const icon = kind === 'success' ? App.icons.check : (kind === 'error' ? App.icons.alert : App.icons.clock);
    el.innerHTML = '<span class="toast__icon">' + icon + '</span><span class="toast__msg">' + U.escapeHtml(message) + '</span>';
    el.addEventListener('click', function () {
      if (el.parentNode) el.parentNode.removeChild(el);
    });
    rootEl.appendChild(el);
    setTimeout(function () {
      el.classList.add('toast--out');
      setTimeout(function () {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 250);
    }, TOAST_DURATION_MS);
  };

  /* =============================================================
   * Modal (با پشتیبانی از چند مودال همزمان)
   * ============================================================= */
  const modalStack = [];

  ui.modal = function (options) {
    const opts = options || {};
    const rootEl = document.getElementById('modal-root');
    if (!rootEl) return null;

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    const modal = document.createElement('div');
    modal.className = 'modal' + (opts.wide ? ' modal--wide' : '') + (opts.danger ? ' modal--danger' : '');
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');

    modal.innerHTML = `
      <div class="modal__head">
        <h3 class="modal__title">${U.escapeHtml(opts.title || '')}</h3>
        <button type="button" class="icon-btn modal__close" aria-label="بستن">${App.icons.x}</button>
      </div>
      <div class="modal__body"></div>`;

    overlay.appendChild(modal);
    rootEl.appendChild(overlay);

    const body = modal.querySelector('.modal__body');
    if (typeof opts.body === 'string') body.innerHTML = opts.body;

    const api = {
      el: modal,
      body: body,
      close: function () {
        const i = modalStack.indexOf(api);
        if (i !== -1) modalStack.splice(i, 1);
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        if (typeof opts.onClose === 'function') opts.onClose();
      },
      setTitle: function (title) {
        modal.querySelector('.modal__title').textContent = title;
      }
    };

    modal.querySelector('.modal__close').addEventListener('click', api.close);
    overlay.addEventListener('mousedown', function (e) {
      if (e.target === overlay) api.close();
    });

    modalStack.push(api);

    if (typeof opts.onMount === 'function') opts.onMount(body, api);

    /* دکمه‌های «انصراف» با data-close به‌صورت خودکار بسته می‌شوند */
    modal.querySelectorAll('[data-close]').forEach(function (btn) {
      btn.addEventListener('click', api.close);
    });

    return api;
  };

  /* بستن با کلید Esc (بالاترین مودال) — اما نه هنگام تایپ در فیلدها
   * تا ورودی نیمه‌کاره فرم‌ها به‌صورت تصادفی از دست نرود */
  if (typeof document !== 'undefined') {
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape' || !modalStack.length) return;
      const tag = (e.target && e.target.tagName || '').toUpperCase();
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        if (e.target.blur) e.target.blur();
        return;
      }
      modalStack[modalStack.length - 1].close();
    });
  }

  /* =============================================================
   * Confirm (قول بولی)
   * ============================================================= */
  ui.confirm = function (options) {
    const opts = options || {};
    return new Promise(function (resolve) {
      let settled = false;
      const api = ui.modal({
        title: opts.title || 'تأیید',
        danger: !!opts.danger,
        body: `
          <div class="confirm-box">
            <p class="confirm-msg">${U.escapeHtml(opts.message || '')}</p>
            <div class="btn-row btn-row--end">
              <button type="button" class="btn btn--ghost" data-no>انصراف</button>
              <button type="button" class="btn ${opts.danger ? 'btn--danger' : 'btn--primary'}" data-yes>${U.escapeHtml(opts.confirmText || 'تأیید')}</button>
            </div>
          </div>`,
        onMount: function (body, modalApi) {
          body.querySelector('[data-no]').addEventListener('click', function () {
            settled = true;
            modalApi.close();
            resolve(false);
          });
          body.querySelector('[data-yes]').addEventListener('click', function () {
            settled = true;
            modalApi.close();
            resolve(true);
          });
        },
        onClose: function () {
          if (!settled) resolve(false);
        }
      });
      if (!api) resolve(false);
    });
  };

  /* =============================================================
   * انتخابگر دوره (ماه/سال) + انتخابگر سال
   * ============================================================= */
  function yearOptions() {
    const years = new Set();
    App.data.records.forEach(function (r) { years.add(r.jy); });
    if (App.state.today) {
      years.add(App.state.today.jy);
      years.add(App.state.today.jy + 1);
    }
    return Array.from(years).sort(function (a, b) { return a - b; });
  }

  ui.periodPicker = function (mount) {
    if (!mount) return;
    const period = App.state.period;
    const today = App.state.today;
    mount.innerHTML = `
      <button type="button" class="icon-btn pp__nav" data-nav="-1" title="ماه قبل">${App.icons.chevronRight}</button>
      <select class="select select--month" aria-label="ماه">
        ${J.MONTH_NAMES.map(function (name, i) {
          const m = i + 1;
          return `<option value="${m}" ${m === period.jm ? 'selected' : ''}>${name}</option>`;
        }).join('')}
      </select>
      <select class="select select--year" aria-label="سال">
        ${yearOptions().map(function (y) {
          return `<option value="${y}" ${y === period.jy ? 'selected' : ''}>${U.toFa(y)}</option>`;
        }).join('')}
      </select>
      <button type="button" class="icon-btn pp__nav" data-nav="1" title="ماه بعد">${App.icons.chevronLeft}</button>
      ${today ? '<button type="button" class="btn btn--ghost btn--xs pp__today" data-today>این ماه</button>' : ''}`;

    mount.querySelector('.select--month').addEventListener('change', function (e) {
      App.setPeriod(period.jy, +e.target.value);
    });
    mount.querySelector('.select--year').addEventListener('change', function (e) {
      App.setPeriod(+e.target.value, period.jm);
    });
    mount.querySelectorAll('[data-nav]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const delta = +btn.getAttribute('data-nav');
        let jy = period.jy;
        let jm = period.jm + delta;
        if (jm < 1) { jm = 12; jy -= 1; }
        if (jm > 12) { jm = 1; jy += 1; }
        App.setPeriod(jy, jm);
      });
    });
    const todayBtn = mount.querySelector('[data-today]');
    if (todayBtn) {
      todayBtn.addEventListener('click', function () {
        App.setPeriod(today.jy, today.jm);
      });
    }
  };

  ui.yearPicker = function (mount, currentYear, onChange) {
    if (!mount) return;
    mount.innerHTML = `
      <span class="yp__label">سال:</span>
      <select class="select select--year" aria-label="سال">
        ${yearOptions().map(function (y) {
          return `<option value="${y}" ${y === currentYear ? 'selected' : ''}>${U.toFa(y)}</option>`;
        }).join('')}
      </select>`;
    mount.querySelector('select').addEventListener('change', function (e) {
      onChange(+e.target.value);
    });
  };

  /* =============================================================
   * مسیریابی
   * ============================================================= */
  function parseRoute() {
    const hash = (location.hash || '').replace(/^#\/?/, '').split('?')[0];
    return ROUTES.indexOf(hash) !== -1 ? hash : 'dashboard';
  }

  function renderRoute() {
    const route = parseRoute();
    App.state.route = route;

    document.querySelectorAll('#main-nav .nav-item').forEach(function (item) {
      item.classList.toggle('is-active', item.getAttribute('data-route') === route);
    });

    const titleEl = document.getElementById('page-title');
    const subEl = document.getElementById('page-subtitle');
    if (titleEl) titleEl.textContent = ROUTE_TITLES[route];
    if (subEl) subEl.textContent = ROUTE_SUBTITLES[route];

    const container = document.getElementById('page-container');
    if (!container) return;

    const page = App.pages[route];
    if (!page) return;

    closeSidebar();

    try {
      page.render(container);
    } catch (e) {
      container.innerHTML = `
        <div class="card">
          <div class="empty-state">
            <div class="empty-state__icon">${App.icons.alert}</div>
            <h3 class="empty-state__title">خطا در نمایش صفحه</h3>
            <p class="empty-state__text">${U.escapeHtml(e && e.message ? e.message : String(e))}</p>
          </div>
        </div>`;
    }
  }

  App.refresh = function () {
    if (typeof document === 'undefined') return;
    renderRoute();
  };

  App.setPeriod = function (jy, jm) {
    if (!Number.isInteger(jy) || !Number.isInteger(jm) || jm < 1 || jm > 12) return;
    App.state.period = { jy: jy, jm: jm };
    try {
      localStorage.setItem(PERIOD_LS_KEY, JSON.stringify(App.state.period));
    } catch (e) { /* محیط بدون localStorage */ }
    App.refresh();
  };

  /* =============================================================
   * سایدبار موبایل
   * ============================================================= */
  function closeSidebar() {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (sidebar) sidebar.classList.remove('is-open');
    if (backdrop) backdrop.classList.remove('is-visible');
  }

  function bindChrome() {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    const menuBtn = document.getElementById('btn-menu');

    if (menuBtn) {
      menuBtn.addEventListener('click', function () {
        sidebar.classList.toggle('is-open');
        backdrop.classList.toggle('is-visible', sidebar.classList.contains('is-open'));
      });
    }
    if (backdrop) backdrop.addEventListener('click', closeSidebar);

    /* انتخاب هر آیتم منو، کشوی موبایل را می‌بندد */
    if (sidebar) {
      sidebar.addEventListener('click', function (e) {
        if (e.target && e.target.closest && e.target.closest('.nav-item')) closeSidebar();
      });
    }

    const quickBtn = document.getElementById('btn-quick-add');
    if (quickBtn) quickBtn.addEventListener('click', function () { App.actions.quickToday(); });

    const themeBtn = document.getElementById('btn-theme');
    if (themeBtn) {
      themeBtn.addEventListener('click', function () {
        const order = ['system', 'light', 'dark'];
        const current = (App.data.settings && App.data.settings.theme) || 'system';
        const next = order[(order.indexOf(current) + 1) % order.length];
        App.settings.save(Object.assign({}, App.data.settings, { theme: next })).then(function () {
          const labels = { light: 'روشن', dark: 'تاریک', system: 'هماهنگ با سیستم' };
          App.ui.toast('پوسته: ' + labels[next], 'info');
          App.refresh();
        });
      });
    }
  }

  /* آمار کوچک سایدبار */
  App.updateSidebarStats = function () {
    const el = document.getElementById('sidebar-stats');
    if (!el) return;
    const diskBadge = (App.disk && App.disk.available) ? ' + دیسک' : '';
    el.innerHTML = `
      <div class="side-stat"><span>رکوردها</span><b>${U.toFa(App.data.records.size)}</b></div>
      <div class="side-stat"><span>ذخیره‌سازی</span><b>${U.escapeHtml(App.db.label + diskBadge)}</b></div>`;
  };

  /* =============================================================
   * راه‌اندازی
   * ============================================================= */
  function restorePeriod() {
    try {
      const raw = localStorage.getItem(PERIOD_LS_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        if (Number.isInteger(p.jy) && Number.isInteger(p.jm) && p.jm >= 1 && p.jm <= 12) {
          return p;
        }
      }
    } catch (e) { /* بی‌اهمیت */ }
    return null;
  }

  function showStorageBanner() {
    if (App.db.kind !== 'memory') return;
    const existing = document.querySelector('.storage-banner');
    if (existing) return;
    const banner = document.createElement('div');
    banner.className = 'storage-banner';
    banner.innerHTML = App.icons.alert + '<span>در این محیط، ذخیره‌سازی پایدار (IndexedDB/localStorage) در دسترس نیست و داده‌ها فقط تا refresh باقی می‌مانند. برنامه را روی Localhost اجرا کنید.</span>';
    document.body.appendChild(banner);
  }

  async function boot() {
    await App.db.init();

    App.data.settings = await App.settings.load();

    const records = await App.db.getAllRecords();
    App.data.records = new Map();
    records.forEach(function (r) {
      const rec = App.calc.normalizeRecord(r);
      if (rec) App.data.records.set(rec.dateKey, rec);
    });

    App.state.today = J.today();
    App.state.period = restorePeriod() || { jy: App.state.today.jy, jm: App.state.today.jm };

    App.settings.theme.apply();
    App.settings.theme.watchSystem();

    bindChrome();
    App.updateSidebarStats();

    window.addEventListener('hashchange', renderRoute);
    renderRoute();

    /* همگام‌سازی با فایل روی دیسک (اگر سرور هوشمند در دسترس باشد) */
    if (App.disk && typeof App.disk.start === 'function') {
      App.disk.start();
    }

    /* نصب به‌عنوان اپ روی گوشی (PWA) — فقط در زمینه امن (localhost/https)؛ در اپ بومی اندروید لازم نیست (همه‌چیز محلی است) */
    if (typeof root.KarnamaAndroid === 'undefined' &&
        root.navigator && 'serviceWorker' in root.navigator &&
        (root.location.protocol === 'https:' || root.location.hostname === 'localhost' || root.location.hostname === '127.0.0.1')) {
      try {
        root.navigator.serviceWorker.register('sw.js').catch(function () { /* بی‌صدا */ });
      } catch (e) { /* بی‌صدا */ }
    }

    showStorageBanner();

    /* بوت کامل شد: قلاب خطای بوت را خلع سلاح و اپ اندروید را مطلع کن */
    root.__karnamaBootDone = true;
    const bootErrBox = document.getElementById('boot-error');
    if (bootErrBox) bootErrBox.style.display = 'none';
    if (root.KarnamaAndroid && typeof root.KarnamaAndroid.bootOk === 'function') {
      try { root.KarnamaAndroid.bootOk(); } catch (e) { /* بی‌صدا */ }
    }
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', boot);
    } else {
      boot();
    }
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = App;
})(typeof window !== 'undefined' ? window : globalThis);
