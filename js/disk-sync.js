/* =============================================================
 * کارنما — همگام‌سازی داده‌ها با فایل روی هارد دیسک
 * -------------------------------------------------------------
 * اگر برنامه با «سرور هوشمند» خودش اجرا شود (server.py یا server.js
 * از طریق run.sh / run.bat)، یک نسخه آینه از کل داده‌ها به‌صورت
 * خودکار در فایل data/karnama-data.json (کنار فایل‌های برنامه)
 * نگه داشته می‌شود:
 *
 *   - هر ذخیره/حذف/تنظیماتی → چند لحظه بعد روی دیسک نوشته می‌شود
 *   - اگر داده‌های مرورگر پاک شود (Clear browsing data و …)،
 *     در اجرای بعدی برنامه همه‌چیز از فایل دیسک بازیابی می‌شود
 *   - حذف کامل اطلاعات، فایل دیسک را هم خالی می‌کند (بازگشت ناخواسته ندارد)
 *
 * اگر سرور هوشمند در دسترس نباشد (مثل http.server ساده یا file://)،
 * این ماژول بی‌صدا غیرفعال می‌شود و برنامه مثل قبل فقط از
 * IndexedDB مرورگر استفاده می‌کند.
 * ============================================================= */
(function (root) {
  'use strict';

  const App = root.App = root.App || {};
  const C = App.calc;
  const U = App.util;
  const J = App.jalali;

  const DISK_FORMAT = 1;
  const PING_TIMEOUT_MS = 2500;   /* حداکثر انتظار برای تشخیص سرور */
  const DEBOUNCE_MS = 800;        /* فاصله بین نوشتن‌های خودکار روی دیسک */
  const DISK_FILE_LABEL = 'data/karnama-data.json';

  const disk = {
    started: false,      /* start اجرا شده است */
    available: false,    /* سرور هوشمند در دسترس است */
    lastSavedAt: null,   /* زمان آخرین نوشتن موفق روی دیسک */
    lastError: null,     /* آخرین خطای همگام‌سازی (در صورت وجود) */
    _installed: false,
    _saving: false,
    _dirty: false,
    _timer: null,
    _replaceNext: false, /* نوشتنِ بعدی به‌صورت جایگزینی کامل باشد (حذف کامل/جایگزینی) */
    _rev: 0,             /* آخرین نسخهٔ فایل دیسک که این دستگاه دیده است */
    _needsAuth: false,   /* سرور رمز می‌خواهد (هاست آنلاین) */
    _authFailed: false   /* رمز وارد نشده/غلط است */
  };

  /* ---------- ارتباط با سرور (fetch با timeout) ---------- */

  /* رمز عبور سرور آنلاین (هاست PHP) — در localStorage ذخیره می‌شود */
  const SERVER_KEY_LS = 'karnama:server-key';

  function serverKey() {
    try { return root.localStorage.getItem(SERVER_KEY_LS) || ''; } catch (e) { return ''; }
  }

  function saveServerKey(v) {
    try {
      if (v) root.localStorage.setItem(SERVER_KEY_LS, v);
      else root.localStorage.removeItem(SERVER_KEY_LS);
    } catch (e) { /* بی‌صدا */ }
  }

  function fetchJson(url, opts) {
    if (typeof root.fetch !== 'function') return Promise.resolve(null);
    let timer = null;
    const merged = Object.assign({}, opts || {});
    const key = serverKey();
    if (key) merged.headers = Object.assign({}, merged.headers, { 'X-Karnama-Key': key });
    if (typeof root.AbortController === 'function') {
      const ctrl = new root.AbortController();
      merged.signal = ctrl.signal;
      timer = setTimeout(function () { ctrl.abort(); }, PING_TIMEOUT_MS);
    }
    return root.fetch(url, merged)
      .then(function (res) {
        if (timer) clearTimeout(timer);
        if (res && res.status === 401) {
          const err = new Error('unauthorized');
          err.status = 401;
          throw err;
        }
        if (!res || !res.ok) return null;
        return res.json();
      })
      .catch(function (e) {
        if (timer) clearTimeout(timer);
        if (e && e.status === 401) throw e; /* خطای رمز به فراخواننده می‌رسد */
        return null;
      });
  }

  /* پرسش رمز عبور سرور آنلاین (مودال) — خروجی: رمز یا '' در صورت لغو.
   * تک‌نمونه است: اگر مودال رمز از قبل باز باشد، همان Promise برگردده می‌شود
   * تا هرگز دو مودال همزمان (و id تکراری در سند) شکل نگیرد. */
  let keyModalPromise = null;

  function promptForKey(isWrong) {
    if (keyModalPromise) return keyModalPromise;
    keyModalPromise = new Promise(function (resolve) {
      const finish = function (v) { keyModalPromise = null; resolve(v); };
      if (!App.ui || !App.ui.modal) { finish(''); return; }
      const api = App.ui.modal({
        title: 'رمز عبور کارنما',
        danger: !!isWrong,
        body: '<p style="margin:0 0 12px;font-size:13px;line-height:2">' +
          (isWrong
            ? 'رمز واردشده درست نیست؛ دوباره تلاش کنید.'
            : 'این نسخه آنلاین با رمز محافظت می‌شود. برای همگام‌سازی داده‌ها روی سرور، رمز عبور را وارد کنید.') +
          '</p>' +
          '<input type="password" id="karnama-server-key" class="input" placeholder="رمز عبور" autocomplete="off" style="width:100%;text-align:left" />'
      });
      if (!api) { finish(''); return; }
      /* با نوع انتخاب می‌کنیم نه id — مقاوم در برابر id تکراری در سند */
      const input = api.body.querySelector('input[type="password"]');
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:8px;margin-top:14px;align-items:center';
      const okBtn = document.createElement('button');
      okBtn.type = 'button';
      okBtn.className = 'btn btn--primary';
      okBtn.innerHTML = '<span>تأیید</span>';
      const cancel = document.createElement('button');
      cancel.type = 'button';
      cancel.className = 'btn btn--soft';
      cancel.style.display = 'inline-flex';
      cancel.innerHTML = '<span>فعلاً نه</span>';
      row.appendChild(okBtn);
      row.appendChild(cancel);
      api.body.appendChild(row);
      const done = function (v) { api.close(); finish(v); };
      okBtn.addEventListener('click', function () { done(input.value || ''); });
      cancel.addEventListener('click', function () { done(''); });
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') done(input.value || '');
      });
      setTimeout(function () { try { input.focus(); } catch (e) { /* بی‌صدا */ } }, 60);
    });
    return keyModalPromise;
  }

  /* ---------- ساخت snapshot کامل داده‌ها ---------- */

  disk.buildSnapshot = function () {
    const records = Array.from(App.data.records.values());
    return {
      app: 'karnama',
      format: DISK_FORMAT,
      exportedAt: new Date().toISOString(),
      exportedAtJalali: J.formatDate(J.today(), 'short'),
      recordCount: records.length,
      settings: App.data.settings,
      records: records
    };
  };

  /* ---------- نوشتن روی دیسک ---------- */

  disk.saveNow = function (opts) {
    if (!disk.available) return Promise.resolve(false);
    if (disk._saving) {
      disk._dirty = true; /* در انتظار نوشتن بعدی */
      return Promise.resolve(false);
    }
    disk._saving = true;
    /* حالت replace: کل فایل جایگزین می‌شود (حذف کامل/جایگزینی) —
     * در غیر این صورت baseRev می‌رود: اگر فایل از آخرین دیدِ این دستگاه تغییر نکرده
     * باشد سرور کامل جایگزین می‌کند (حذف رکورد معتبر می‌ماند) و اگر دستگاه دیگری
     * چیزی نوشته باشد، سرور بر اساس updatedAt ادغام می‌کند تا چیزی از دست نرود. */
    const o = opts || {};
    const replace = !!o.replace || disk._replaceNext;
    disk._replaceNext = false;
    const payload = disk.buildSnapshot();
    if (replace) payload.replace = true;
    else payload.baseRev = disk._rev;
    return fetchJson('api/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function (res) {
      disk._saving = false;
      if (res && res.ok) {
        disk.lastSavedAt = new Date().toISOString();
        disk.lastError = null;
        if (typeof res.rev === 'number') disk._rev = res.rev;
        /* فقط اگر در حین ذخیره، تغییر تازه‌ای رسیده باشد دوباره زمان‌بندی می‌شود */
        if (disk._dirty) {
          disk._dirty = false;
          disk.scheduleSave();
        }
        return true;
      }
      disk.lastError = 'خطا در نوشتن فایل دیسک';
      return false;
    }).catch(function (err) {
      disk._saving = false;
      if (err && err.status === 401 && !o._authRetry) {
        /* سرور آنلاین رمز می‌خواهد: پرسش رمز و تلاش دوباره */
        return promptForKey(!!serverKey()).then(function (key) {
          if (!key) {
            disk.lastError = 'همگام‌سازی نیازمند رمز عبور است';
            return false;
          }
          saveServerKey(key);
          return disk.saveNow({ replace: replace, _authRetry: true });
        });
      }
      disk.lastError = 'ارتباط با سرور برقرار نشد';
      return false;
    });
  };

  disk.scheduleSave = function () {
    if (!disk.available) return;
    disk._dirty = true;
    if (disk._timer) clearTimeout(disk._timer);
    disk._timer = setTimeout(function () {
      disk._timer = null;
      disk._dirty = false; /* تغییرات ثبت‌شده مصرف می‌شوند — بدون این، حلقه بی‌نهایت POST شکل می‌گیرد */
      disk.saveNow();
    }, DEBOUNCE_MS);
  };

  /* نوشتن فوری (دکمه «ذخیره فوری روی دیسک» و تست‌ها) */
  disk.flush = function (opts) {
    if (disk._timer) {
      clearTimeout(disk._timer);
      disk._timer = null;
    }
    disk._dirty = false;
    return disk.saveNow(opts);
  };

  /* ---------- خواندن و بازیابی از دیسک ---------- */

  function normalizeSnapshotPayload(payload) {
    if (!payload || typeof payload !== 'object' || !Array.isArray(payload.records)) return null;
    const valid = [];
    payload.records.forEach(function (raw) {
      const rec = C.normalizeRecord(raw);
      if (rec) valid.push(rec);
    });
    return {
      records: valid,
      settings: (payload.settings && typeof payload.settings === 'object') ? payload.settings : null
    };
  }

  /* خواندن فایل دیسک:
   * null → فایلی نیست یا خوانده نشد */
  function readDiskSnapshot() {
    /* اگر سرور رمز بخواهد (هاست آنلاین): پرسش رمز و تلاش دوباره */
    function attempt(isWrong) {
      return fetchJson('api/data').then(function (res) {
        disk._authFailed = false;
        if (!res) return null;
        if (res.exists === false) { disk._rev = 0; return null; } /* هنوز فایلی ساخته نشده */
        if (typeof res.rev === 'number') disk._rev = res.rev;
        return normalizeSnapshotPayload(res);
      }).catch(function (err) {
        if (err && err.status === 401) {
          return promptForKey(isWrong).then(function (key) {
            if (!key) { disk._authFailed = true; return null; }
            saveServerKey(key);
            return attempt(true);
          });
        }
        return null;
      });
    }
    return attempt(false);
  }

  /*
   * بازیابی/ادغام:
   * - مرورگر خالی + دیسک پر  → بازیابی کامل (رکوردها + تنظیمات)
   * - هر دو پر                → ادغام رکوردهای گمشده/جدیدتر
   * خروجی: null یا { restored: n } یا { merged: n }
   */
  disk.restoreFromDisk = function () {
    return readDiskSnapshot().then(function (snap) {
      if (!snap || !snap.records.length) return null;

      /* حالت ۱: پاک شدن داده‌های مرورگر → بازیابی کامل */
      if (App.data.records.size === 0) {
        return App.db.putRecords(snap.records).then(function () {
          snap.records.forEach(function (r) {
            App.data.records.set(r.dateKey, r);
          });
          let settingsApplied = false;
          const finishSettings = function () {
            return { restored: snap.records.length, settingsApplied: settingsApplied };
          };
          if (snap.settings) {
            const merged = App.settings.merge(snap.settings);
            return App.db.putSettings(merged).then(function () {
              App.data.settings = merged;
              settingsApplied = true;
              if (App.settings.theme && App.settings.theme.apply) App.settings.theme.apply();
              return finishSettings();
            });
          }
          return finishSettings();
        });
      }

      /* حالت ۲: هر دو پر → فقط رکوردهای گمشده یا جدیدتر */
      const toAdd = [];
      snap.records.forEach(function (r) {
        const cur = App.data.records.get(r.dateKey);
        if (!cur || String(r.updatedAt || '') > String(cur.updatedAt || '')) toAdd.push(r);
      });
      if (!toAdd.length) return null;
      return App.db.putRecords(toAdd).then(function () {
        toAdd.forEach(function (r) {
          App.data.records.set(r.dateKey, r);
        });
        return { merged: toAdd.length };
      });
    });
  };

  /* ---------- قلاب روی تغییرات داده ---------- */

  disk.installHooks = function () {
    if (disk._installed || !disk.available) return;
    disk._installed = true;
    /* هر متد تغییردهندهٔ db پس از اجرا، همگام‌سازی دیسک را زمان‌بندی می‌کند */
    ['putRecord', 'putRecords', 'deleteRecord', 'putSettings', 'clearSettings'].forEach(function (name) {
      const orig = App.db[name];
      if (typeof orig !== 'function') return;
      App.db[name] = function () {
        const args = arguments;
        return orig.apply(this, args).then(function (result) {
          disk.scheduleSave();
          return result;
        });
      };
    });
    /* حذف کامل / جایگزینی → نوشتنِ replace (سرور فایل را ادغام نمی‌کند تا رکوردهای حذف‌شده برنگردند) */
    ['clearRecords', 'replaceAll'].forEach(function (name) {
      const orig = App.db[name];
      if (typeof orig !== 'function') return;
      App.db[name] = function () {
        const args = arguments;
        return orig.apply(this, args).then(function (result) {
          disk._replaceNext = true;
          disk.scheduleSave();
          return result;
        });
      };
    });
  };

  /* ---------- راه‌اندازی (در boot برنامه) ---------- */

  disk.whenReady = null;

  disk.start = function () {
    if (disk.started) return (disk.whenReady || Promise.resolve(false));
    disk.started = true;
    disk.whenReady = fetchJson('api/ping').then(function (res) {
      if (!res || res.ok !== true || res.app !== 'karnama') return false;
      disk.available = true;
      disk._needsAuth = res.auth === true;

      return disk.restoreFromDisk().then(function (result) {
        disk.installHooks();

        if (result && result.restored) {
          const msg = 'داده‌های مرورگر خالی بود — ' + U.toFa(result.restored) + ' رکورد از فایل روی دیسک بازیابی شد' +
            (result.settingsApplied ? ' (به‌همراه تنظیمات)' : '');
          if (App.ui && App.ui.toast) App.ui.toast(msg, 'success');
          if (App.updateSidebarStats) App.updateSidebarStats();
          /* به‌روزرسانی صفحه فعلی (به‌جز تنظیمات که فرم دارد) */
          if (App.refresh && App.state.route !== 'settings') App.refresh();
          return true;
        }

        if (result && result.merged) {
          if (App.ui && App.ui.toast) {
            App.ui.toast(U.toFa(result.merged) + ' رکورد گمشده از فایل روی دیسک بازیابی شد', 'info');
          }
          if (App.updateSidebarStats) App.updateSidebarStats();
          if (App.refresh && App.state.route !== 'settings') App.refresh();
          return true;
        }

        /* تغییری نبود — همگام‌سازی اولیه (داده‌های فعلی روی دیسک نوشته شود) */
        disk.scheduleSave();
        return true;
      });
    }).catch(function () {
      return false;
    });
    return disk.whenReady;
  };

  /* وضعیت برای نمایش در صفحه تنظیمات */
  disk.status = function () {
    if (!disk.started) return { state: 'starting' };
    if (!disk.available) {
      return { state: 'off' };
    }
    if (disk._authFailed) {
      return { state: 'needs-key', file: DISK_FILE_LABEL };
    }
    return {
      state: 'on',
      file: DISK_FILE_LABEL,
      lastSavedAt: disk.lastSavedAt,
      lastError: disk.lastError,
      recordCount: App.data.records.size
    };
  };

  App.disk = disk;
  if (typeof module !== 'undefined' && module.exports) module.exports = App;
})(typeof window !== 'undefined' ? window : globalThis);
