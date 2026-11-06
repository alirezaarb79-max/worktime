/* =============================================================
 * کارنما — ماژول تنظیمات + مدیریت داده‌ها (Backup / Restore / حذف)
 * ============================================================= */
(function (root) {
  'use strict';

  const App = root.App = root.App || {};
  const J = App.jalali;
  const U = App.util;
  const C = App.calc;

  /* ---------- ثابت‌های اعتبارسنجی ---------- */
  const DUTY_MIN = 30;          /* حداقل موظفی روزانه (دقیقه) */
  const DUTY_MAX = 1440;        /* حداکثر موظفی روزانه */
  const THRESHOLD_MAX = 240;    /* حداکثر آستانه اضافه‌کاری */
  const LOCATIONS_MAX = 60;     /* حداکثر تعداد محل‌های مأموریت */
  const BACKUP_FORMAT = 1;
  const DELETE_CONFIRM_WORD = 'حذف';
  const THEMES = ['system', 'light', 'dark'];

  /* ---------- مقادیر پیش‌فرض ---------- */
  function defaultSettings() {
    return {
      theme: 'system',
      dutyMinutes: 480,          /* ۸ ساعت موظفی روزانه */
      standardStart: '08:00',
      standardEnd: '18:00',
      overtime: {
        method: 'excess',            /* excess: کارکرد منهای موظفی | afterEnd: پس از پایان استاندارد */
        thresholdMinutes: 0,         /* دقایق ابتدایی اضافه‌کاری که محاسبه نمی‌شود */
        roundToMinutes: 1,           /* رند اضافه‌کاری به مضرب دقیقه */
        holidayWorkAsOvertime: false /* کل کارکرد روز تعطیل = اضافه‌کاری */
      },
      workDays: [0, 1, 2, 3, 4], /* شنبه تا چهارشنبه (۰=شنبه ... ۶=جمعه) */
      nonWorkAsHoliday: true,    /* جمعه و روزهای غیرکاریِ بدون ثبت = تعطیل */
      missionCountsAsDuty: true, /* مأموریت بدون ساعت = موظفی کامل */
      missionLocations: [],       /* لیست محل‌های مأموریت */
      workLocations: []           /* لیست محل‌های کاری (مثل بیمارستان‌ها) */
    };
  }

  /* پاک‌سازی امن لیست محل‌ها (مأموریت / کاری) */
  function sanitizeLocationList(list) {
    return list
      .filter(function (x) { return typeof x === 'string' && x.trim() !== ''; })
      .map(function (x) { return x.trim().slice(0, C.LOCATION_MAX_LENGTH); })
      .filter(function (x, i, a) { return a.indexOf(x) === i; })
      .slice(0, LOCATIONS_MAX);
  }

  /* ادغام امن تنظیمات ذخیره‌شده با پیش‌فرض‌ها */
  function mergeSettings(stored) {
    const next = defaultSettings();
    if (!stored || typeof stored !== 'object') return next;
    if (THEMES.indexOf(stored.theme) !== -1) next.theme = stored.theme;
    if (Number.isFinite(stored.dutyMinutes)) next.dutyMinutes = stored.dutyMinutes;
    if (C.parseTime(stored.standardStart) != null) next.standardStart = C.minutesToClock(C.parseTime(stored.standardStart));
    if (C.parseTime(stored.standardEnd) != null) next.standardEnd = C.minutesToClock(C.parseTime(stored.standardEnd));
    if (stored.overtime && typeof stored.overtime === 'object') {
      const ot = stored.overtime;
      if (ot.method === 'excess' || ot.method === 'afterEnd') next.overtime.method = ot.method;
      if (Number.isFinite(ot.thresholdMinutes)) next.overtime.thresholdMinutes = Math.max(0, Math.min(THRESHOLD_MAX, ot.thresholdMinutes));
      if (C.OT_ROUND_STEPS.indexOf(ot.roundToMinutes) !== -1) next.overtime.roundToMinutes = ot.roundToMinutes;
      if (typeof ot.holidayWorkAsOvertime === 'boolean') next.overtime.holidayWorkAsOvertime = ot.holidayWorkAsOvertime;
    }
    if (Array.isArray(stored.workDays)) {
      const days = stored.workDays
        .filter(function (d) { return Number.isInteger(d) && d >= 0 && d <= 6; })
        .filter(function (d, i, a) { return a.indexOf(d) === i; });
      if (days.length) next.workDays = days.sort(function (a, b) { return a - b; });
    }
    if (typeof stored.nonWorkAsHoliday === 'boolean') next.nonWorkAsHoliday = stored.nonWorkAsHoliday;
    if (typeof stored.missionCountsAsDuty === 'boolean') next.missionCountsAsDuty = stored.missionCountsAsDuty;
    if (Array.isArray(stored.missionLocations)) {
      next.missionLocations = sanitizeLocationList(stored.missionLocations);
    }
    if (Array.isArray(stored.workLocations)) {
      next.workLocations = sanitizeLocationList(stored.workLocations);
    }
    return next;
  }

  /* ---------- تم ---------- */
  const theme = {
    media: null,

    resolve: function (mode) {
      if (mode !== 'system') return mode;
      try {
        return root.matchMedia && root.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      } catch (e) {
        return 'light';
      }
    },

    apply: function () {
      if (typeof document === 'undefined') return;
      const mode = (App.data.settings && App.data.settings.theme) || 'system';
      document.documentElement.setAttribute('data-theme', theme.resolve(mode));
      document.documentElement.setAttribute('data-theme-mode', mode);
      const btn = document.getElementById('btn-theme');
      if (btn && App.icons) {
        btn.innerHTML = mode === 'system' ? App.icons.monitor : (mode === 'dark' ? App.icons.moon : App.icons.sun);
      }
    },

    watchSystem: function () {
      if (typeof root.matchMedia !== 'function') return;
      theme.media = root.matchMedia('(prefers-color-scheme: dark)');
      theme.media.addEventListener('change', function () {
        if (App.data.settings && App.data.settings.theme === 'system') {
          theme.apply();
          if (App.refresh) App.refresh();
        }
      });
    }
  };

  /* ---------- API تنظیمات ---------- */
  const settingsApi = {
    defaults: defaultSettings,
    merge: mergeSettings,
    theme: theme,

    load: function () {
      return App.db.getSettings().then(function (stored) {
        return mergeSettings(stored);
      });
    },

    save: function (next) {
      const merged = mergeSettings(next);
      return App.db.putSettings(merged).then(function () {
        App.data.settings = merged;
        theme.apply();
        return merged;
      });
    }
  };

  /* =============================================================
   * صفحه تنظیمات
   * ============================================================= */
  App.pages = App.pages || {};

  App.pages.settings = {
    render: function (container) {
      const s = App.data.settings;

      container.innerHTML = `
        <div class="page-head">
          <h2 class="page-h2">تنظیمات</h2>
          <p class="page-desc">قوانین محاسبه، ظاهر برنامه و مدیریت داده‌ها</p>
        </div>

        <form id="settings-form" novalidate>
          <section class="card settings-card">
            <div class="card__head">
              <h3 class="card__title">برنامه کاری هفتگی و اضافه‌کاری</h3>
              <p class="card__sub">روزها و ساعت‌های کاری شما و قوانین محاسبه — کارکرد در روزهای خارج از برنامه، کامل اضافه‌کاری محاسبه می‌شود</p>
            </div>
            <div class="settings-grid">
              <div class="field">
                <label class="field__label" for="st-duty">ساعات موظفی روزانه</label>
                <input class="input input--time" id="st-duty" value="${U.escapeHtml(C.minutesToClock(s.dutyMinutes))}" placeholder="08:00" autocomplete="off" />
                <div class="field__err" data-err="duty"></div>
              </div>
              <div class="field">
                <label class="field__label" for="st-start">ساعت شروع استاندارد</label>
                <input class="input input--time" id="st-start" value="${U.escapeHtml(s.standardStart)}" placeholder="08:00" autocomplete="off" />
                <div class="field__err" data-err="start"></div>
              </div>
              <div class="field">
                <label class="field__label" for="st-end">ساعت پایان استاندارد</label>
                <input class="input input--time" id="st-end" value="${U.escapeHtml(s.standardEnd)}" placeholder="18:00" autocomplete="off" />
                <div class="field__err" data-err="end"></div>
              </div>
              <div class="field field--full">
                <label class="field__label" for="st-method">شیوه محاسبه اضافه‌کاری</label>
                <select class="select" id="st-method">
                  <option value="excess" ${s.overtime.method === 'excess' ? 'selected' : ''}>کارکرد منهای موظفی (پیش‌فرض)</option>
                  <option value="afterEnd" ${s.overtime.method === 'afterEnd' ? 'selected' : ''}>فقط ساعات پس از پایان ساعت استاندارد</option>
                </select>
                <div class="field__hint">مثال: موظفی ۸ ساعت و کارکرد ۱۰ ساعت → اضافه‌کاری ۲ ساعت</div>
              </div>
              <div class="field">
                <label class="field__label" for="st-threshold">آستانه اضافه‌کاری (دقیقه)</label>
                <input class="input input--num" id="st-threshold" type="number" min="0" max="${THRESHOLD_MAX}" step="5" value="${U.toEn(String(s.overtime.thresholdMinutes))}" />
                <div class="field__hint">دقایق ابتداییِ اضافه‌کاری که مشمول محاسبه نمی‌شود (۰ = بدون کسر)</div>
              </div>
              <div class="field">
                <label class="field__label" for="st-round">رند اضافه‌کاری</label>
                <select class="select" id="st-round">
                  ${C.OT_ROUND_STEPS.map(function (st) {
                    return `<option value="${st}" ${s.overtime.roundToMinutes === st ? 'selected' : ''}>${st === 1 ? 'بدون رند' : 'ضربدر ' + U.toFa(st) + ' دقیقه (به پایین)'}</option>`;
                  }).join('')}
                </select>
              </div>
              <div class="field field--full field--switch">
                <label class="switch"><input type="checkbox" id="st-holiday-ot" ${s.overtime.holidayWorkAsOvertime ? 'checked' : ''} /><span></span></label>
                <div>
                  <span class="switch__title">کارکرد روز تعطیل، کامل اضافه‌کاری محاسبه شود</span>
                  <span class="switch__sub">در صورت فعال بودن، کل ساعت‌های کارکرده در روز تعطیل به‌عنوان اضافه‌کاری ثبت می‌شود</span>
                </div>
              </div>
              <div class="field field--full field--switch">
                <label class="switch"><input type="checkbox" id="st-mission-duty" ${s.missionCountsAsDuty ? 'checked' : ''} /><span></span></label>
                <div>
                  <span class="switch__title">مأموریت بدون ساعت ثبت‌شده، معادل موظفی کامل در نظر گرفته شود</span>
                  <span class="switch__sub">برای روزهای مأموریتی که ساعت ورود/خروج ندارند</span>
                </div>
              </div>
              <div class="field field--full field--switch">
                <label class="switch"><input type="checkbox" id="st-nonwork-holiday" ${s.nonWorkAsHoliday ? 'checked' : ''} /><span></span></label>
                <div>
                  <span class="switch__title">روزهای غیرکاری هفته (مثل جمعه) در آمار، تعطیل محسوب شوند</span>
                  <span class="switch__sub">روی رنگ‌بندی تقویم و شمار «تعطیل» اثر می‌گذارد</span>
                </div>
              </div>
              <div class="field field--full">
                <label class="field__label">روزهای کاری هفته</label>
                <div class="weekday-picker" id="weekday-picker">
                  ${J.WEEKDAY_NAMES.map(function (name, i) {
                    return `<label class="weekday-item${s.workDays.indexOf(i) !== -1 ? ' is-checked' : ''}"><input type="checkbox" value="${i}" ${s.workDays.indexOf(i) !== -1 ? 'checked' : ''} /><span>${name}</span></label>`;
                  }).join('')}
                </div>
                <div class="field__hint">اگر در روزی خارج از این فهرست (مثلاً جمعه) سر کار بروید و ساعت ثبت کنید، تمام ساعت آن روز به‌طور کامل اضافه‌کاری محاسبه می‌شود</div>
                <div class="field__err" data-err="workdays"></div>
              </div>
            </div>
          </section>

          <section class="card settings-card">
            <div class="card__head">
              <h3 class="card__title">محل‌های کاری</h3>
              <p class="card__sub">محل‌هایی که معمولاً در آن‌ها کار می‌کنید (مثل بیمارستان‌ها) — در فرم ثبت روز پیشنهاد می‌شوند</p>
            </div>
            <div class="location-manager" id="wloc-manager">
              <div class="location-input-row">
                <input class="input" id="wloc-new" placeholder="مثلاً: بیمارستان رضوی" maxlength="${C.LOCATION_MAX_LENGTH}" />
                <button type="button" class="btn btn--soft" id="wloc-add">${App.icons.plus}<span>افزودن</span></button>
              </div>
              <div class="tag-list" id="wloc-list"></div>
              <div class="field__hint">در فرم ثبت روز، این موارد به‌صورت پیشنهاد نمایش داده می‌شوند؛ تایپ آزاد هم مجاز است و در خروجی Excel (ستون توضیحات) درج می‌شود.</div>
            </div>
          </section>

          <section class="card settings-card">
            <div class="card__head">
              <h3 class="card__title">محل‌های مأموریت</h3>
              <p class="card__sub">لیست پیشنهادی هنگام ثبت مأموریت</p>
            </div>
            <div class="location-manager" id="loc-manager">
              <div class="location-input-row">
                <input class="input" id="loc-new" placeholder="مثلاً: سایت پروژه اصفهان" maxlength="${C.LOCATION_MAX_LENGTH}" />
                <button type="button" class="btn btn--soft" id="loc-add">${App.icons.plus}<span>افزودن</span></button>
              </div>
              <div class="tag-list" id="loc-list"></div>
              <div class="field__hint">در فرم ثبت روز، این موارد به‌صورت پیشنهاد نمایش داده می‌شوند؛ تایپ آزاد هم مجاز است.</div>
            </div>
          </section>

          <div class="btn-row btn-row--end">
            <button type="submit" class="btn btn--primary">${App.icons.save}<span>ذخیره تنظیمات</span></button>
          </div>
        </form>

        <section class="card settings-card">
          <div class="card__head">
            <h3 class="card__title">ظاهر برنامه</h3>
            <p class="card__sub">پوسته روشن، تاریک یا هماهنگ با سیستم‌عامل</p>
          </div>
          <div class="theme-cards" id="theme-cards">
            ${THEMES.map(function (t) {
              const labels = { light: 'روشن', dark: 'تاریک', system: 'هماهنگ با سیستم' };
              const icons = { light: App.icons.sun, dark: App.icons.moon, system: App.icons.monitor };
              return `<button type="button" class="theme-card ${s.theme === t ? 'is-active' : ''}" data-theme-mode="${t}">${icons[t]}<span>${labels[t]}</span></button>`;
            }).join('')}
          </div>
        </section>

        <section class="card settings-card">
          <div class="card__head">
            <h3 class="card__title">داده‌ها و پشتیبان‌گیری</h3>
            <p class="card__sub">نسخه پشتیبان JSON، بازیابی و حذف کامل اطلاعات</p>
          </div>
          <div class="data-info" id="data-info"></div>
          <div class="data-actions">
            <button type="button" class="btn btn--soft" id="btn-backup">${App.icons.download}<span>دریافت نسخه پشتیبان (JSON)</span></button>
            <button type="button" class="btn btn--soft" id="btn-import">${App.icons.upload}<span>بازیابی از فایل پشتیبان…</span></button>
            <input type="file" id="import-file" accept="application/json,.json,application/octet-stream" hidden style="display:none" />
            <button type="button" class="btn btn--danger-soft" id="btn-wipe">${App.icons.trash}<span>حذف کامل اطلاعات…</span></button>
          </div>
          <div class="import-options" id="import-options" hidden>
            <label class="radio-line"><input type="radio" name="import-mode" value="merge" checked /><span>ادغام با داده‌های فعلی (رکورد تکراری جایگزین می‌شود)</span></label>
            <label class="radio-line"><input type="radio" name="import-mode" value="replace" /><span>جایگزینی کامل داده‌های فعلی</span></label>
            <button type="button" class="btn btn--primary" id="btn-import-pick">${App.icons.upload}<span>انتخاب فایل پشتیبان…</span></button>
          </div>
          <div class="disk-box" id="disk-box">
            <div class="disk-box__title">${App.icons.hard}<span>نسخه آینه روی هارد دیسک</span></div>
            <div class="disk-box__status" id="disk-status">در حال بررسی…</div>
            <div class="disk-box__actions" id="disk-actions"></div>
          </div>
        </section>
      `;

      bindSettingsPage(container);
    }
  };

  /* ---------- منطق صفحه تنظیمات ---------- */
  function bindSettingsPage(container) {
    const form = container.querySelector('#settings-form');

    /* ---------- نسخه آینه روی هارد دیسک ---------- */
    function renderDiskStatus() {
      const statusEl = container.querySelector('#disk-status');
      const actionsEl = container.querySelector('#disk-actions');
      if (!statusEl || !actionsEl) return;

      if (!App.disk || !App.disk.started) {
        statusEl.innerHTML = '<span class="disk-wait">در حال بررسی سرور…</span>';
        actionsEl.innerHTML = '';
        return;
      }
      const st = App.disk.status();
      if (st.state === 'on') {
        let html = '<span class="disk-on">فعال است</span> — هر تغییری به‌صورت خودکار در فایل <code>' +
          U.escapeHtml(st.file) + '</code> (کنار فایل‌های برنامه) ذخیره می‌شود؛ حتی اگر داده‌های مرورگر پاک شود، همه‌چیز از همین فایل برمی‌گردد.';
        if (st.lastSavedAt) {
          const t = new Date(st.lastSavedAt);
          const hh = U.pad2(t.getHours()), mm = U.pad2(t.getMinutes());
          html += '<div class="disk-meta">آخرین ذخیره: ' + U.toFa(hh + ':' + mm) + ' — ' + U.toFa(st.recordCount) + ' رکورد روی دیسک</div>';
        }
        if (st.lastError) {
          html += '<div class="disk-meta disk-err">' + U.escapeHtml(st.lastError) + '</div>';
        }
        statusEl.innerHTML = html;
        actionsEl.innerHTML = '<button type="button" class="btn btn--soft" id="btn-disk-save">' + App.icons.save + '<span>ذخیره فوری روی دیسک</span></button>';
        const saveBtn = actionsEl.querySelector('#btn-disk-save');
        if (saveBtn) {
          saveBtn.addEventListener('click', function () {
            App.disk.flush().then(function (ok) {
              if (ok) {
                App.ui.toast('داده‌ها روی دیسک ذخیره شد', 'success');
                renderDiskStatus();
              } else {
                App.ui.toast('ذخیره روی دیسک انجام نشد', 'error');
              }
            });
          });
        }
      } else if (st.state === 'needs-key') {
        statusEl.innerHTML = '<span class="disk-on">فعال — نیاز به رمز عبور</span> — سرور هوشمند آنلاین این نسخه با رمز محافظت می‌شود. ' +
          'برای همگام‌سازی داده‌ها روی سرور، رمز را وارد کنید.';
        actionsEl.innerHTML = '<button type="button" class="btn btn--soft" id="btn-disk-key">' + App.icons.hard + '<span>ورود رمز و همگام‌سازی</span></button>';
        const keyBtn = actionsEl.querySelector('#btn-disk-key');
        if (keyBtn) {
          keyBtn.addEventListener('click', function () {
            App.disk._authFailed = false;
            App.disk.restoreFromDisk().then(function (result) {
              if (App.ui && App.ui.toast && result && (result.restored || result.merged)) {
                App.ui.toast('همگام‌سازی انجام شد: ' + U.toFa(result.restored || result.merged) + ' رکورد', 'success');
              }
              renderDiskStatus();
              if (App.refresh) App.refresh();
            });
          });
        }
      } else {
        statusEl.innerHTML = '<span class="disk-off">غیرفعال</span> — برنامه با «سرور هوشمند» اجرا نشده است. ' +
          'روی کامپیوتر با <code>run.bat</code> یا <code>run.sh</code>، و روی هاست آنلاین با نصب <code>server.php</code> (راهنمای README-HOST)، ' +
          'همگام‌سازی فعال می‌شود؛ در غیر این صورت (مثل هاست‌های استاتیک و GitHub Pages) داده‌ها فقط در همین مرورگر (IndexedDB) ذخیره می‌شوند ' +
          'و برای جابه‌جایی بین دستگاه‌ها از «خروجی بکاپ» و «بازیابی از فایل» استفاده کنید.';
        actionsEl.innerHTML = '';
      }
    }
    renderDiskStatus();
    /* اگر تشخیص سرور هنوز در جریان است، بعد از نتیجه دوباره رندر کن */
    if (App.disk && App.disk.whenReady) {
      App.disk.whenReady.then(function () { renderDiskStatus(); });
    }

    /* مدیریت لیست‌های محل (کاری / مأموریت) — یک سازنده مشترک */
    function createTagListManager(ids, initial) {
      const list = initial.slice();
      const input = container.querySelector('#' + ids.input);
      const listEl = container.querySelector('#' + ids.list);

      function render() {
        if (!list.length) {
          listEl.innerHTML = '<div class="empty-mini">هنوز موردی ثبت نشده است</div>';
          return;
        }
        listEl.innerHTML = list.map(function (name, i) {
          return `<span class="tag-item">${U.escapeHtml(name)}<button type="button" class="tag-item__remove" data-i="${i}" aria-label="حذف ${U.escapeHtml(name)}">×</button></span>`;
        }).join('');
      }
      render();

      container.querySelector('#' + ids.add).addEventListener('click', function () {
        const value = input.value.trim();
        if (!value) return;
        if (value.length > C.LOCATION_MAX_LENGTH) {
          App.ui.toast('نام محل حداکثر ' + U.toFa(C.LOCATION_MAX_LENGTH) + ' نویسه می‌تواند باشد', 'error');
          return;
        }
        if (list.indexOf(value) === -1) {
          if (list.length >= LOCATIONS_MAX) {
            App.ui.toast('حداکثر ' + U.toFa(LOCATIONS_MAX) + ' مورد می‌توانید داشته باشید', 'error');
            return;
          }
          list.push(value);
          render();
        }
        input.value = '';
        input.focus();
      });

      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          container.querySelector('#' + ids.add).click();
        }
      });

      listEl.addEventListener('click', function (e) {
        const btn = e.target.closest('.tag-item__remove');
        if (!btn) return;
        list.splice(+btn.getAttribute('data-i'), 1);
        render();
      });

      return { get: function () { return list.slice(); } };
    }

    const missionLocManager = createTagListManager(
      { input: 'loc-new', add: 'loc-add', list: 'loc-list' },
      App.data.settings.missionLocations || []
    );
    const workLocManager = createTagListManager(
      { input: 'wloc-new', add: 'wloc-add', list: 'wloc-list' },
      App.data.settings.workLocations || []
    );

    /* اعتبارسنجی و ذخیره تنظیمات */
    form.addEventListener('submit', function (e) {
      e.preventDefault();

      const dutyMin = C.parseTime(form.querySelector('#st-duty').value);
      const startMin = C.parseTime(form.querySelector('#st-start').value);
      const endMin = C.parseTime(form.querySelector('#st-end').value);
      const threshold = Math.max(0, Math.min(THRESHOLD_MAX, +U.toEn(form.querySelector('#st-threshold').value) || 0));
      const checkedDays = Array.from(form.querySelectorAll('#weekday-picker input:checked')).map(function (i) { return +i.value; });

      const errors = [];
      const setErr = function (name, msg) {
        const el = form.querySelector('[data-err="' + name + '"]');
        if (el) el.textContent = msg || '';
        if (msg) errors.push(msg);
      };
      setErr('duty', '');
      setErr('start', '');
      setErr('end', '');
      setErr('workdays', '');

      if (dutyMin == null || dutyMin < DUTY_MIN || dutyMin >= DUTY_MAX) {
        setErr('duty', 'ساعت موظفی معتبر وارد کنید (مثلاً 08:00)');
      }
      if (startMin == null) setErr('start', 'ساعت شروع استاندارد معتبر وارد کنید');
      if (endMin == null) setErr('end', 'ساعت پایان استاندارد معتبر وارد کنید');
      if (startMin != null && endMin != null && endMin <= startMin) {
        setErr('end', 'ساعت پایان باید بعد از ساعت شروع باشد');
      }
      if (!checkedDays.length) setErr('workdays', 'حداقل یک روز کاری انتخاب کنید');

      if (errors.length) {
        App.ui.toast('لطفاً خطاهای فرم را برطرف کنید', 'error');
        return;
      }

      const next = {
        theme: App.data.settings.theme,
        dutyMinutes: dutyMin,
        standardStart: C.minutesToClock(startMin),
        standardEnd: C.minutesToClock(endMin),
        overtime: {
          method: form.querySelector('#st-method').value,
          thresholdMinutes: threshold,
          roundToMinutes: +form.querySelector('#st-round').value,
          holidayWorkAsOvertime: form.querySelector('#st-holiday-ot').checked
        },
        workDays: checkedDays,
        nonWorkAsHoliday: form.querySelector('#st-nonwork-holiday').checked,
        missionCountsAsDuty: form.querySelector('#st-mission-duty').checked,
        missionLocations: missionLocManager.get(),
        workLocations: workLocManager.get()
      };

      App.settings.save(next).then(function () {
        App.ui.toast('تنظیمات ذخیره شد', 'success');
        App.updateSidebarStats();
        App.refresh();
      });
    });

    /* انتخاب تم */
    container.querySelector('#theme-cards').addEventListener('click', function (e) {
      const btn = e.target.closest('.theme-card');
      if (!btn) return;
      const mode = btn.getAttribute('data-theme-mode');
      App.settings.save(Object.assign({}, App.data.settings, { theme: mode })).then(function () {
        App.ui.toast(mode === 'dark' ? 'پوسته تاریک فعال شد' : (mode === 'light' ? 'پوسته روشن فعال شد' : 'پوسته هماهنگ با سیستم فعال شد'), 'success');
        App.refresh();
      });
    });

    /* انتخابگر روزهای کاری: کلاس is-checked (به‌جای :has — سازگار با همه مرورگرها) */
    const weekdayPicker = container.querySelector('#weekday-picker');
    if (weekdayPicker) {
      weekdayPicker.addEventListener('change', function (e) {
        const input = e.target;
        if (input && input.type === 'checkbox' && input.parentElement) {
          input.parentElement.classList.toggle('is-checked', input.checked);
        }
      });
    }

    /* اطلاعات داده‌ها */
    renderDataInfo(container);

    /* خروجی پشتیبان JSON */
    container.querySelector('#btn-backup').addEventListener('click', exportBackup);

    /* ورود پشتیبان */
    const importOptions = container.querySelector('#import-options');
    const importFileEl = container.querySelector('#import-file');
    container.querySelector('#btn-import').addEventListener('click', function () {
      importOptions.hidden = !importOptions.hidden;
      if (!importOptions.hidden) importOptions.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
    container.querySelector('#import-file').addEventListener('change', function (e) {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const mode = container.querySelector('input[name="import-mode"]:checked').value;
      const reader = new FileReader();
      reader.onload = function () { importBackup(reader.result, mode, importOptions); };
      reader.onerror = function () { App.ui.toast('خواندن فایل ناموفق بود', 'error'); };
      reader.readAsText(file, 'utf-8');
      e.target.value = '';
    });

    /* انتخاب فایل پشتیبان: در اپ اندروید از انتخاب‌گر بومی (پل)، در مرورگر از input فایل */
    container.querySelector('#btn-import-pick').addEventListener('click', function () {
      const bridge = (typeof root.KarnamaAndroid === 'object') ? root.KarnamaAndroid : null;
      if (bridge && typeof bridge.pickBackupFile === 'function') {
        try {
          const res = JSON.parse(bridge.pickBackupFile() || '{}');
          if (!res.ok) App.ui.toast(res.error || 'باز کردن انتخاب فایل ممکن نشد', 'error');
        } catch (e) {
          App.ui.toast('خطا در باز کردن انتخاب فایل', 'error');
        }
      } else if (importFileEl) {
        importFileEl.click();
      }
    });

    /* هوک اپ اندروید: متن فایل پشتیبان از انتخاب‌گر بومی می‌رسد */
    root.__karnamaBackupFile = function (text) {
      const mode = container.querySelector('input[name="import-mode"]:checked').value;
      importBackup(String(text), mode, importOptions);
    };
    root.__karnamaBackupError = function (msg) {
      App.ui.toast('خطا در خواندن فایل: ' + msg, 'error');
    };

    /* حذف کامل اطلاعات (چندمرحله‌ای) */
    container.querySelector('#btn-wipe').addEventListener('click', openWipeDialog);
  }

  function renderDataInfo(container) {
    const box = container.querySelector('#data-info');
    if (!box) return;
    const records = Array.from(App.data.records.values());
    let oldest = null;
    let newest = null;
    records.forEach(function (r) {
      if (!oldest || r.dateKey < oldest) oldest = r.dateKey;
      if (!newest || r.dateKey > newest) newest = r.dateKey;
    });
    box.innerHTML = `
      <div class="data-info__row"><span>نوع ذخیره‌سازی</span><b>${U.escapeHtml(App.db.label)}</b></div>
      <div class="data-info__row"><span>تعداد رکوردهای ثبت‌شده</span><b>${U.toFa(App.data.records.size)} روز</b></div>
      <div class="data-info__row"><span>بازه ثبت‌شده</span><b>${oldest ? U.toFa(oldest) + ' تا ' + U.toFa(newest) : '—'}</b></div>
    `;
  }

  /* ---------- پشتیبان‌گیری / بازیابی ---------- */
  function buildBackupPayload() {
    const records = Array.from(App.data.records.values());
    return {
      app: 'karnama',
      format: BACKUP_FORMAT,
      exportedAt: new Date().toISOString(),
      exportedAtJalali: J.formatDate(J.today(), 'short'),
      recordCount: records.length,
      settings: App.data.settings,
      records: records
    };
  }

  function exportBackup() {
    const payload = buildBackupPayload();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const name = 'karnama-backup-' + J.keyOfDate(J.today()) + '.json';
    App.download(blob, name);
    App.ui.toast('نسخه پشتیبان دریافت شد', 'success');
  }

  function importBackup(text, mode, optionsBox) {
    let payload;
    try {
      payload = JSON.parse(text);
    } catch (e) {
      App.ui.toast('فایل JSON معتبر نیست', 'error');
      return;
    }
    if (!payload || typeof payload !== 'object' || !Array.isArray(payload.records)) {
      App.ui.toast('ساختار فایل پشتیبان شناسایی نشد', 'error');
      return;
    }

    const valid = [];
    let skipped = 0;
    payload.records.forEach(function (raw) {
      const rec = C.normalizeRecord(raw);
      if (rec) valid.push(rec); else skipped++;
    });

    const nextSettings = (payload.settings && typeof payload.settings === 'object')
      ? App.settings.merge(payload.settings)
      : null;

    const applyImport = function () {
      const finish = function () {
        if (mode === 'replace') {
          App.data.records = new Map(valid.map(function (r) { return [r.dateKey, r]; }));
        } else {
          valid.forEach(function (r) { App.data.records.set(r.dateKey, r); });
        }
        App.ui.toast('بازیابی انجام شد: ' + U.toFa(valid.length) + ' رکورد' + (skipped ? ' (' + U.toFa(skipped) + ' نامعتبر نادیده گرفته شد)' : ''), 'success');
        if (optionsBox) optionsBox.hidden = true;
        App.updateSidebarStats();
        App.refresh();
      };

      if (mode === 'replace') {
        App.db.replaceAll(valid, nextSettings).then(function () {
          if (nextSettings) App.data.settings = nextSettings;
          App.settings.theme.apply();
          finish();
        }).catch(function () {
          App.ui.toast('خطا در جایگزینی داده‌ها', 'error');
        });
      } else {
        App.db.putRecords(valid).then(finish).catch(function () {
          App.ui.toast('خطا در ادغام داده‌ها', 'error');
        });
      }
    };

    if (mode === 'replace' && App.data.records.size) {
      App.ui.confirm({
        title: 'جایگزینی کامل داده‌ها',
        message: 'همهٔ ثبت‌های فعلی (' + U.toFa(App.data.records.size) + ' روز) حذف و ' + U.toFa(valid.length) + ' رکورد فایل جایگزین می‌شود. ادامه می‌دهید؟',
        confirmText: 'جایگزین کن',
        danger: true
      }).then(function (ok) {
        if (ok) applyImport();
      });
    } else {
      applyImport();
    }
  }

  /* ---------- حذف کامل چندمرحله‌ای ---------- */
  function openWipeDialog() {
    let step = 1;
    const selections = { records: true, settings: false };

    App.ui.modal({
      title: 'حذف کامل اطلاعات',
      danger: true,
      body: '',
      onMount: function (body, modalApi) {
        function render() {
          if (step === 1) {
            body.innerHTML = `
              <div class="wipe-step">
                <div class="wipe-warn">${App.icons.alert}<span>این عملیات غیرقابل بازگشت است. پیشنهاد می‌شود ابتدا نسخه پشتیبان تهیه کنید.</span></div>
                <label class="check-line"><input type="checkbox" id="wipe-records" ${selections.records ? 'checked' : ''} /><span>حذف تمام سوابق کارکرد (${U.toFa(App.data.records.size)} روز)</span></label>
                <label class="check-line"><input type="checkbox" id="wipe-settings" ${selections.settings ? 'checked' : ''} /><span>بازنشانی تنظیمات به حالت پیش‌فرض</span></label>
                <div class="btn-row btn-row--end">
                  <button type="button" class="btn btn--ghost" data-close>انصراف</button>
                  <button type="button" class="btn btn--danger" id="wipe-next" ${(!(selections.records || selections.settings)) ? 'disabled' : ''}>مرحله بعد</button>
                </div>
              </div>`;
            body.querySelectorAll('input[type=checkbox]').forEach(function (cb) {
              cb.addEventListener('change', function () {
                selections[cb.id === 'wipe-records' ? 'records' : 'settings'] = cb.checked;
                body.querySelector('#wipe-next').disabled = !(selections.records || selections.settings);
              });
            });
            body.querySelector('#wipe-next').addEventListener('click', function () {
              if (!selections.records && !selections.settings) return;
              step = 2;
              render();
            });
          } else {
            body.innerHTML = `
              <div class="wipe-step">
                <p class="wipe-confirm-text">برای تأیید نهایی، واژه <b>«${DELETE_CONFIRM_WORD}»</b> را در کادر زیر بنویسید:</p>
                <input class="input wipe-confirm-input" id="wipe-confirm" autocomplete="off" />
                <div class="btn-row btn-row--end">
                  <button type="button" class="btn btn--ghost" data-back>بازگشت</button>
                  <button type="button" class="btn btn--danger" id="wipe-final" disabled>${App.icons.trash}<span>حذف قطعی</span></button>
                </div>
              </div>`;
            const input = body.querySelector('#wipe-confirm');
            const finalBtn = body.querySelector('#wipe-final');
            input.focus();
            input.addEventListener('input', function () {
              finalBtn.disabled = input.value.trim() !== DELETE_CONFIRM_WORD;
            });
            body.querySelector('[data-back]').addEventListener('click', function () {
              step = 1;
              render();
            });
            finalBtn.addEventListener('click', function () {
              performWipe(selections, modalApi);
            });
          }
        }
        render();
      }
    });
  }

  function performWipe(selections, modalApi) {
    let chain = Promise.resolve();
    if (selections.records) {
      chain = chain.then(function () { return App.db.clearRecords(); });
    }
    if (selections.settings) {
      chain = chain.then(function () { return App.db.clearSettings(); });
    }
    chain.then(function () {
      if (selections.records) App.data.records = new Map();
      if (selections.settings) {
        App.data.settings = App.settings.defaults();
        App.settings.theme.apply();
      }
      if (modalApi) modalApi.close();
      App.ui.toast('اطلاعات حذف شد', 'success');
      App.updateSidebarStats();
      App.refresh();
    }).catch(function () {
      App.ui.toast('خطا در حذف اطلاعات', 'error');
    });
  }

  /* ---------- ثبت API عمومی ---------- */
  App.settings = settingsApi;

  if (typeof module !== 'undefined' && module.exports) module.exports = App;
})(typeof window !== 'undefined' ? window : globalThis);
