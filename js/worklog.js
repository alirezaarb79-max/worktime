/* =============================================================
 * کارنما — ماژول ثبت کارکرد (Work Logs)
 * جدول اصلی + جستجو/فیلتر + فرم ثبت/ویرایش + کپی روز قبل
 * ============================================================= */
(function (root) {
  'use strict';

  const App = root.App = root.App || {};
  const J = App.jalali;
  const U = App.util;
  const C = App.calc;

  /* وضعیت فیلترها (در طول بازتعویض صفحه حفظ می‌شود) */
  const filterState = {
    search: '',
    status: 'all',
    onlyMission: false,
    onlyOnCall: false,
    view: 'table' /* table | calendar */
  };

  /* =============================================================
   * اجزای مشترک (ردیف جدول روزها — در گزارش‌ها هم استفاده می‌شود)
   * ============================================================= */
  App.shared = App.shared || {};

  App.shared.statusChip = function (status) {
    return `<span class="chip chip--${status}">${C.STATUS_LABELS[status]}</span>`;
  };

  App.shared.dayRowHtml = function (day, withActions) {
    const ctx = day.ctx;
    const rec = day.rec;
    const calc = day.calc;

    const startTime = calc.hasTimes ? U.toFa(rec.startTime) : '—';
    const endTime = calc.hasTimes ? U.toFa(rec.endTime) : '—';
    const worked = calc.worked ? C.formatDurationFa(calc.worked) : '—';
    const duty = calc.duty ? C.formatDurationFa(calc.duty) : '—';
    const overtime = calc.overtime ? '<b class="ot-text">' + C.formatDurationFa(calc.overtime) + '</b>' : '۰:۰۰';

    const missionCell = calc.mission
      ? `<span class="chip chip--mission" title="${U.escapeHtml(rec.missionLocation || '')}">${App.icons.mission}${rec.missionLocation ? U.escapeHtml(U.clampText(rec.missionLocation, 18)) : 'مأموریت'}</span>`
      : '—';
    const onCallCell = calc.onCall ? '<span class="oncall-badge" title="آنکال">' + App.icons.oncall + '</span>' : '—';

    /* توضیحات = محل کارکرد + یادداشت (مثل فرم اکسل) */
    const descParts = [];
    if (rec && rec.workLocation) descParts.push(rec.workLocation);
    if (rec && rec.notes) descParts.push(rec.notes);
    const desc = descParts.join('، ');
    const notes = desc
      ? `<span class="notes-text${rec && rec.workLocation ? ' notes-text--loc' : ''}" title="${U.escapeHtml(desc)}">${U.escapeHtml(U.clampText(desc, 30))}</span>`
      : '—';

    let actions = '';
    if (withActions) {
      actions = rec
        ? `<div class="td-actions">
            <button type="button" class="row-btn" data-act="edit" data-key="${ctx.dateKey}" title="ویرایش">${App.icons.edit}</button>
            <button type="button" class="row-btn row-btn--danger" data-act="delete" data-key="${ctx.dateKey}" title="حذف">${App.icons.trash}</button>
          </div>`
        : `<div class="td-actions">
            <button type="button" class="btn btn--soft btn--xs" data-act="edit" data-key="${ctx.dateKey}">${App.icons.plus}<span>ثبت</span></button>
          </div>`;
    }

    return `
      <tr class="day-row ${calc.status === 'none' ? 'day-row--empty' : ''}" data-key="${ctx.dateKey}">
        <td class="td-date">
          <span class="date-main">${U.escapeHtml(J.formatDate(ctx, 'day'))}</span>
          <span class="date-sub">${U.escapeHtml(J.formatDate(ctx, 'short'))}</span>
        </td>
        <td>${App.shared.statusChip(calc.status)}</td>
        <td class="td-time">${startTime}</td>
        <td class="td-time">${endTime}</td>
        <td class="td-num">${worked}</td>
        <td class="td-num">${duty}</td>
        <td class="td-num">${overtime}</td>
        <td class="td-mission">${missionCell}</td>
        <td class="td-oncall">${onCallCell}</td>
        <td class="td-notes">${notes}</td>
        ${withActions ? '<td>' + actions + '</td>' : ''}
      </tr>`;
  };

  /* =============================================================
   * اعمال فیلترها روی روزهای ماه
   * ============================================================= */
  function applyFilters(days) {
    const search = U.toEn(filterState.search).trim().toLowerCase();
    return days.filter(function (day) {
      const rec = day.rec;
      if (filterState.status !== 'all' && day.calc.status !== filterState.status) return false;
      if (filterState.onlyMission && !day.calc.mission) return false;
      if (filterState.onlyOnCall && !day.calc.onCall) return false;
      if (search) {
        const ctx = day.ctx;
        const haystack = [
          ctx.dateKey,
          J.formatDate(ctx, 'full'),
          J.formatDate(ctx, 'short'),
          J.formatDate(ctx, 'day'),
          rec ? rec.notes : '',
          rec ? rec.missionLocation : '',
          rec ? (rec.workLocation || '') : '',
          rec ? rec.startTime + ' - ' + rec.endTime : ''
        ].join(' ').toLowerCase();
        if (U.toEn(haystack).indexOf(search) === -1) return false;
      }
      return true;
    });
  }

  /* =============================================================
   * صفحه ثبت کارکرد
   * ============================================================= */
  App.pages = App.pages || {};

  App.pages.logs = {
    render: function (container) {
      const period = App.state.period;
      const summary = C.summarizeMonth(period.jy, period.jm, App.data.records, App.data.settings, App.state.today);
      const t = summary.totals;

      container.innerHTML = `
        <div class="page-head">
          <h2 class="page-h2">ثبت کارکرد — ${U.escapeHtml(J.monthYearLabel(period.jy, period.jm))}</h2>
          <p class="page-desc">${U.toFa(t.recordedDays)} روز ثبت‌شده از ${U.toFa(summary.days.length)} روز ماه</p>
        </div>

        <div class="toolbar">
          <div class="period-picker" id="period-picker"></div>
          <div class="view-toggle" role="tablist" aria-label="نوع نمایش">
            <button type="button" class="view-toggle__btn ${filterState.view === 'table' ? 'is-active' : ''}" data-view="table" title="نمای جدول">${App.icons.table}<span>جدول</span></button>
            <button type="button" class="view-toggle__btn ${filterState.view === 'calendar' ? 'is-active' : ''}" data-view="calendar" title="نمای تقویم">${App.icons.calendar}<span>تقویم</span></button>
          </div>
          <div class="toolbar__spacer"></div>
          <button type="button" class="btn btn--soft" id="btn-excel" title="خروجی Excel این ماه">${App.icons.excel}<span>Excel</span></button>
          <button type="button" class="btn btn--primary" id="btn-new">${App.icons.plus}<span>ثبت روز جدید</span></button>
        </div>

        <div class="toolbar toolbar--filters">
          <div class="search-box">
            ${App.icons.search}
            <input class="input search-input" id="log-search" placeholder="جستجو در تاریخ، توضیحات، محل مأموریت…" value="${U.escapeHtml(filterState.search)}" />
          </div>
          <select class="select select--status" id="log-status" title="فیلتر وضعیت">
            <option value="all">همه وضعیت‌ها</option>
            ${C.VALID_STATUSES.map(function (st) {
              return `<option value="${st}" ${filterState.status === st ? 'selected' : ''}>${C.STATUS_LABELS[st]}</option>`;
            }).join('')}
          </select>
          <button type="button" class="filter-chip ${filterState.onlyMission ? 'is-active' : ''}" id="chip-mission">${App.icons.mission}<span>فقط مأموریت</span></button>
          <button type="button" class="filter-chip ${filterState.onlyOnCall ? 'is-active' : ''}" id="chip-oncall">${App.icons.oncall}<span>فقط آنکال</span></button>
        </div>

        <div id="logs-view"></div>
      `;

      App.ui.periodPicker(container.querySelector('#period-picker'));

      container.querySelector('#btn-new').addEventListener('click', function () {
        App.actions.openDayForm({ jy: period.jy, jm: period.jm, jd: 1 });
      });
      container.querySelector('#btn-excel').addEventListener('click', function () {
        App.excel.exportMonth(period.jy, period.jm);
      });

      container.querySelectorAll('.view-toggle__btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          filterState.view = btn.getAttribute('data-view');
          container.querySelectorAll('.view-toggle__btn').forEach(function (b) { b.classList.toggle('is-active', b === btn); });
          renderView(container, summary);
        });
      });

      const searchInput = container.querySelector('#log-search');
      let searchTimer = null;
      searchInput.addEventListener('input', function () {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(function () {
          filterState.search = searchInput.value;
          renderView(container, summary);
        }, 180);
      });

      container.querySelector('#log-status').addEventListener('change', function (e) {
        filterState.status = e.target.value;
        renderView(container, summary);
      });

      container.querySelector('#chip-mission').addEventListener('click', function (e) {
        filterState.onlyMission = !filterState.onlyMission;
        e.currentTarget.classList.toggle('is-active', filterState.onlyMission);
        renderView(container, summary);
      });
      container.querySelector('#chip-oncall').addEventListener('click', function (e) {
        filterState.onlyOnCall = !filterState.onlyOnCall;
        e.currentTarget.classList.toggle('is-active', filterState.onlyOnCall);
        renderView(container, summary);
      });

      renderView(container, summary);
    }
  };

  /* رندر نمای جدول یا تقویم */
  function renderView(container, summary) {
    const mount = container.querySelector('#logs-view');
    if (filterState.view === 'calendar') {
      App.calendar.render(mount, {
        jy: summary.jy,
        jm: summary.jm,
        onDayClick: function (date) { App.actions.openDayForm(date); }
      });
      return;
    }
    renderTable(mount, summary);
  }

  function renderTable(mount, summary) {
    const period = App.state.period;
    const filtered = applyFilters(summary.days);
    const t = summary.totals;

    if (!filtered.length) {
      mount.innerHTML = `
        <div class="card">
          <div class="empty-state">
            <div class="empty-state__icon">${App.icons.search}</div>
            <h3 class="empty-state__title">موردی مطابق فیلترها پیدا نشد</h3>
            <p class="empty-state__text">فیلترها را تغییر دهید یا روز جدیدی ثبت کنید.</p>
          </div>
        </div>`;
      return;
    }

    mount.innerHTML = `
      <div class="card table-card">
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>تاریخ</th>
                <th>وضعیت</th>
                <th>ورود</th>
                <th>خروج</th>
                <th>کارکرد</th>
                <th>موظفی</th>
                <th>اضافه‌کاری</th>
                <th>مأموریت</th>
                <th>آنکال</th>
                <th>توضیحات</th>
                <th class="th-actions">عملیات</th>
              </tr>
            </thead>
            <tbody>
              ${filtered.map(function (day) { return App.shared.dayRowHtml(day, true); }).join('')}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="4">جمع ${U.escapeHtml(J.monthName(period.jm))}</td>
                <td class="td-num"><b>${C.formatDurationFa(t.worked)}</b></td>
                <td class="td-num"><b>${C.formatDurationFa(t.duty)}</b></td>
                <td class="td-num"><b class="ot-text">${C.formatDurationFa(t.overtime)}</b></td>
                <td class="td-num">${U.toFa(t.missionDays)}</td>
                <td class="td-num">${U.toFa(t.onCallDays)}</td>
                <td colspan="2">${U.toFa(t.leaveDays)} مرخصی · ${U.toFa(t.holidayDays)} تعطیل · ${U.toFa(t.unrecordedDays)} بدون ثبت</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div class="table-foot-note">
          نمایش ${U.toFa(filtered.length)} روز از ${U.toFa(summary.days.length)} روز ماه — سطرهای «بدون ثبت» با کلیک روی دکمه «ثبت» تکمیل می‌شوند.
        </div>
      </div>`;

    mount.querySelector('tbody').addEventListener('click', function (e) {
      const btn = e.target.closest('[data-act]');
      if (!btn) return;
      const key = btn.getAttribute('data-key');
      const date = J.parseKey(key);
      if (!date) return;
      if (btn.getAttribute('data-act') === 'edit') {
        App.actions.openDayForm(date);
      } else if (btn.getAttribute('data-act') === 'delete') {
        confirmDelete(date);
      }
    });
  }

  /* تأیید حذف یک روز */
  function confirmDelete(date) {
    const rec = App.data.records.get(J.keyOfDate(date));
    if (!rec) return;
    App.ui.confirm({
      title: 'حذف ثبت روز',
      message: 'آیا از حذف ثبتِ «' + J.formatDate(date, 'full') + '» مطمئن هستید؟ این عملیات قابل بازگشت نیست.',
      confirmText: 'حذف کن',
      danger: true
    }).then(function (ok) {
      if (!ok) return;
      App.actions.deleteRecord(J.keyOfDate(date)).then(function () {
        App.ui.toast('ثبت ' + J.formatDate(date, 'day') + ' حذف شد', 'success');
      });
    });
  }

  /* =============================================================
   * ابزارهای ورود سریع ساعت
   * ============================================================= */
  const QUICK_TIMES = (function () {
    const list = [];
    for (let m = 6 * C.MINUTES_PER_HOUR; m <= 23 * C.MINUTES_PER_HOUR + 30; m += 30) {
      list.push(C.minutesToClock(m));
    }
    return list;
  })();

  /* نرمال‌سازی ورودی سریع ساعت: «8» → 08:00 ، «830» → 08:30 ، «0730» → 07:30 */
  function normalizeTimeInput(raw) {
    const s = U.toEn(String(raw == null ? '' : raw)).trim().replace(/[.،]/g, ':');
    let m = /^(\d{1,2})$/.exec(s);
    if (m) {
      const h = +m[1];
      if (h >= 0 && h <= 23) return U.pad2(h) + ':00';
      return s;
    }
    m = /^(\d{3,4})$/.exec(s);
    if (m) {
      const padded = m[1].length === 3 ? '0' + m[1] : m[1];
      const h = +padded.slice(0, 2);
      const mi = +padded.slice(2);
      if (h <= 23 && mi <= 59) return padded.slice(0, 2) + ':' + padded.slice(2);
      return s;
    }
    return s;
  }

  /* =============================================================
   * فرم ثبت/ویرایش روز (Modal)
   * ============================================================= */
  function defaultRecordFor(date) {
    const weekday = J.weekdayOf(date.jy, date.jm, date.jd);
    const settings = App.data.settings;
    const isWorkDay = settings.workDays.indexOf(weekday) !== -1;
    return {
      dateKey: J.keyOfDate(date),
      status: isWorkDay ? 'work' : 'holiday',
      startTime: '',
      endTime: '',
      mission: false,
      missionLocation: '',
      workLocation: '',
      onCall: false,
      notes: ''
    };
  }

  /* باز کردن فرم روز؛ opts.quick = پیش‌پرکردن ساعت‌های استاندارد */
  function openDayForm(date, opts) {
    const options = opts || {};
    const settings = App.data.settings;
    const existing = App.data.records.get(J.keyOfDate(date));
    const isNew = !existing;

    const rec = existing ? Object.assign({}, existing) : defaultRecordFor(date);
    if (options.quick && isNew) {
      rec.startTime = settings.standardStart;
      rec.endTime = settings.standardEnd;
    }

    let current = { jy: date.jy, jm: date.jm, jd: date.jd };
    const years = availableYears();

    const modal = App.ui.modal({
      title: (isNew ? 'ثبت کارکرد — ' : 'ویرایش کارکرد — ') + J.formatDate(current, 'full'),
      wide: true,
      body: `
        <form id="day-form" novalidate>
          <div class="form-grid">
            <div class="field">
              <label class="field__label">تاریخ</label>
              <div class="date-selects">
                <select class="select" id="f-jd" aria-label="روز"></select>
                <select class="select" id="f-jm" aria-label="ماه"></select>
                <select class="select" id="f-jy" aria-label="سال"></select>
              </div>
            </div>
            <div class="field">
              <label class="field__label" for="f-status">وضعیت روز</label>
              <select class="select" id="f-status">
                <option value="work">کاری</option>
                <option value="leave">مرخصی</option>
                <option value="holiday">تعطیل</option>
                <option value="none">بدون ثبت</option>
              </select>
            </div>
            <div class="field">
              <label class="field__label" for="f-start">ساعت ورود</label>
              <div class="time-group">
                <button type="button" class="time-step" data-target="f-start" data-step="-15" title="۱۵ دقیقه کمتر" tabindex="-1">−</button>
                <input class="input input--time" id="f-start" placeholder="8 یا 830 یا 08:30" autocomplete="off" value="${U.escapeHtml(rec.startTime)}" />
                <button type="button" class="time-step" data-target="f-start" data-step="15" title="۱۵ دقیقه بیشتر" tabindex="-1">+</button>
                <button type="button" class="time-quick-toggle" data-target="f-start" title="انتخاب سریع ساعت" tabindex="-1">${App.icons.clock}</button>
              </div>
              <div class="time-quick" data-quick="f-start" hidden></div>
              <div class="field__hint">تایپ سریع: «8» → ۰۸:۰۰ یا «830» → ۰۸:۳۰ — یا از دکمه‌های ± و ساعت استفاده کنید</div>
              <div class="field__err" data-err="start"></div>
            </div>
            <div class="field">
              <label class="field__label" for="f-end">ساعت خروج</label>
              <div class="time-group">
                <button type="button" class="time-step" data-target="f-end" data-step="-15" title="۱۵ دقیقه کمتر" tabindex="-1">−</button>
                <input class="input input--time" id="f-end" placeholder="17 یا 1630 یا 16:30" autocomplete="off" value="${U.escapeHtml(rec.endTime)}" />
                <button type="button" class="time-step" data-target="f-end" data-step="15" title="۱۵ دقیقه بیشتر" tabindex="-1">+</button>
                <button type="button" class="time-quick-toggle" data-target="f-end" title="انتخاب سریع ساعت" tabindex="-1">${App.icons.clock}</button>
              </div>
              <div class="time-quick" data-quick="f-end" hidden></div>
              <div class="field__hint" data-hint="overnight"></div>
              <div class="field__err" data-err="end"></div>
            </div>
            <div class="field">
              <label class="field__label" for="f-workloc">محل کارکرد</label>
              <input class="input" id="f-workloc" list="work-locations" placeholder="مثلاً: بیمارستان رضوی" maxlength="${C.LOCATION_MAX_LENGTH}" value="${U.escapeHtml(rec.workLocation || '')}" />
              <datalist id="work-locations">
                ${(settings.workLocations || []).map(function (loc) {
                  return `<option value="${U.escapeHtml(loc)}"></option>`;
                }).join('')}
              </datalist>
              <div class="field__hint">محل انجام کار در آن روز — در ستون توضیحات خروجی Excel درج می‌شود</div>
            </div>
            <div class="field field--switch">
              <label class="switch"><input type="checkbox" id="f-mission" ${rec.mission ? 'checked' : ''} /><span></span></label>
              <span class="switch__title">مأموریت</span>
            </div>
            <div class="field">
              <label class="field__label" for="f-location">محل مأموریت</label>
              <input class="input" id="f-location" list="mission-locations" placeholder="انتخاب یا تایپ…" maxlength="${C.LOCATION_MAX_LENGTH}" value="${U.escapeHtml(rec.missionLocation)}" />
              <datalist id="mission-locations">
                ${(settings.missionLocations || []).map(function (loc) {
                  return `<option value="${U.escapeHtml(loc)}"></option>`;
                }).join('')}
              </datalist>
            </div>
            <div class="field field--switch">
              <label class="switch"><input type="checkbox" id="f-oncall" ${rec.onCall ? 'checked' : ''} /><span></span></label>
              <span class="switch__title">آنکال</span>
            </div>
            <div class="field field--full">
              <label class="field__label" for="f-notes">توضیحات</label>
              <textarea class="textarea" id="f-notes" maxlength="${C.NOTE_MAX_LENGTH}" rows="2" placeholder="توضیح اختیاری…"></textarea>
              <div class="char-count"><span id="notes-count">۰</span>/${U.toFa(C.NOTE_MAX_LENGTH)}</div>
            </div>
          </div>

          <div class="live-calc">
            <div class="lc-box"><span class="lc-label">کارکرد</span><b class="lc-value" id="lc-worked">—</b></div>
            <div class="lc-box"><span class="lc-label">موظفی</span><b class="lc-value" id="lc-duty">—</b></div>
            <div class="lc-box lc-box--ot"><span class="lc-label">اضافه‌کاری</span><b class="lc-value" id="lc-ot">—</b></div>
            <div class="lc-note" id="lc-note"></div>
          </div>

          <div class="form-actions">
            <button type="button" class="btn btn--ghost" id="f-copy-prev">${App.icons.copy}<span>کپی از روز قبل</span></button>
            <span class="spacer"></span>
            <button type="button" class="btn btn--ghost" data-close>انصراف</button>
            <button type="submit" class="btn btn--primary">${App.icons.save}<span>ذخیره</span></button>
          </div>
        </form>`,
      onMount: function (body, modalApi) {
        const form = body.querySelector('#day-form');
        const selDay = form.querySelector('#f-jd');
        const selMonth = form.querySelector('#f-jm');
        const selYear = form.querySelector('#f-jy');
        const selStatus = form.querySelector('#f-status');
        const inpStart = form.querySelector('#f-start');
        const inpEnd = form.querySelector('#f-end');
        const chkMission = form.querySelector('#f-mission');
        const inpLocation = form.querySelector('#f-location');
        const chkOnCall = form.querySelector('#f-oncall');
        const inpNotes = form.querySelector('#f-notes');
        const notesCount = form.querySelector('#notes-count');
        const inpWorkloc = form.querySelector('#f-workloc');

        /* ---------- انتخابگرهای تاریخ ---------- */
        function fillYearOptions() {
          const cur = current.jy;
          selYear.innerHTML = years.map(function (y) {
            return `<option value="${y}" ${y === cur ? 'selected' : ''}>${U.toFa(y)}</option>`;
          }).join('');
        }
        function fillMonthOptions() {
          selMonth.innerHTML = J.MONTH_NAMES.map(function (name, i) {
            const m = i + 1;
            return `<option value="${m}" ${m === current.jm ? 'selected' : ''}>${name}</option>`;
          }).join('');
        }
        function fillDayOptions() {
          const dim = J.daysInMonth(current.jy, current.jm);
          const jd = Math.min(current.jd, dim);
          current.jd = jd;
          let html = '';
          for (let d = 1; d <= dim; d++) {
            const weekday = J.weekdayOf(current.jy, current.jm, d);
            html += `<option value="${d}" ${d === jd ? 'selected' : ''}>${U.toFa(U.pad2(d))} (${J.WEEKDAY_NAMES[weekday]})</option>`;
          }
          selDay.innerHTML = html;
        }
        fillYearOptions();
        fillMonthOptions();
        fillDayOptions();

        function onDateChange() {
          current = { jy: +selYear.value, jm: +selMonth.value, jd: +selDay.value };
          fillDayOptions();
          updateTitle();
          liveCalc();
        }
        selYear.addEventListener('change', onDateChange);
        selMonth.addEventListener('change', onDateChange);
        selDay.addEventListener('change', function () {
          current.jd = +selDay.value;
          updateTitle();
          liveCalc();
        });

        function updateTitle() {
          modalApi.setTitle((App.data.records.has(J.keyOfDate(current)) ? 'ویرایش کارکرد — ' : 'ثبت کارکرد — ') + J.formatDate(current, 'full'));
        }

        /* ---------- وضعیت روز ---------- */
        selStatus.value = rec.status;
        function syncStatusUI() {
          const st = selStatus.value;
          const timesDisabled = (st === 'leave' || st === 'none');
          inpStart.disabled = timesDisabled;
          inpEnd.disabled = timesDisabled;
          if (timesDisabled) {
            inpStart.value = '';
            inpEnd.value = '';
            form.querySelector('[data-quick="f-start"]').hidden = true;
            form.querySelector('[data-quick="f-end"]').hidden = true;
            form.querySelector('[data-hint="overnight"]').textContent = st === 'leave'
              ? 'در روز مرخصی، کارکرد و اضافه‌کاری صفر محاسبه می‌شود'
              : '';
          }
          liveCalc();
        }
        selStatus.addEventListener('change', syncStatusUI);

        /* ---------- ورود سریع ساعت: دکمه‌های ±۱۵ دقیقه + پنل انتخاب سریع ---------- */
        function bindTimeHelpers(input, quickPanel, fallbackTime) {
          quickPanel.innerHTML = QUICK_TIMES.map(function (t) {
            return `<button type="button" class="time-chip" data-time="${t}" tabindex="-1" title="${U.toFa(t)}">${U.toFa(t)}</button>`;
          }).join('');

          input.addEventListener('focus', function () {
            if (!input.disabled) quickPanel.hidden = false;
          });
          input.addEventListener('blur', function () {
            quickPanel.hidden = true;
          });

          /* mousedown پیش‌گیرانه تا با کلیک روی چیپ، فوکوس (و پنل) از دست نرود */
          quickPanel.addEventListener('mousedown', function (e) { e.preventDefault(); });
          quickPanel.addEventListener('click', function (e) {
            const chip = e.target.closest('.time-chip');
            if (!chip) return;
            input.value = chip.getAttribute('data-time');
            quickPanel.hidden = true;
            input.focus();
            liveCalc();
          });
        }

        bindTimeHelpers(inpStart, form.querySelector('[data-quick="f-start"]'), settings.standardStart);
        bindTimeHelpers(inpEnd, form.querySelector('[data-quick="f-end"]'), settings.standardEnd);

        form.querySelectorAll('.time-step').forEach(function (btn) {
          btn.addEventListener('click', function () {
            const target = form.querySelector('#' + btn.getAttribute('data-target'));
            if (!target || target.disabled) return;
            const fallback = target === inpStart ? settings.standardStart : settings.standardEnd;
            let cur = C.parseTime(normalizeTimeInput(target.value.trim()));
            if (cur == null) {
              /* فیلد خالی → کلیک اول مستقیماً ساعت استاندارد را می‌گذارد */
              const std = C.parseTime(fallback);
              if (std != null) {
                target.value = C.minutesToClock(std);
                liveCalc();
                return;
              }
              cur = 0;
            }
            const step = +btn.getAttribute('data-step');
            const next = ((cur + step) % C.MINUTES_PER_DAY + C.MINUTES_PER_DAY) % C.MINUTES_PER_DAY;
            target.value = C.minutesToClock(next);
            liveCalc();
          });
        });

        form.querySelectorAll('.time-quick-toggle').forEach(function (btn) {
          btn.addEventListener('click', function () {
            const target = form.querySelector('#' + btn.getAttribute('data-target'));
            if (!target || target.disabled) return;
            target.focus();
            const panel = form.querySelector('[data-quick="' + target.id + '"]');
            if (panel) panel.hidden = false;
          });
        });

        /* ---------- شمارنده توضیحات ---------- */
        inpNotes.value = rec.notes;
        function syncNotesCount() {
          notesCount.textContent = U.toFa(inpNotes.value.length);
        }
        inpNotes.addEventListener('input', syncNotesCount);
        syncNotesCount();

        /* ---------- محاسبه زنده ---------- */
        function readForm() {
          return {
            dateKey: J.keyOfDate(current),
            status: selStatus.value,
            startTime: normalizeTimeInput(inpStart.value.trim()),
            endTime: normalizeTimeInput(inpEnd.value.trim()),
            mission: chkMission.checked,
            missionLocation: inpLocation.value.trim(),
            workLocation: inpWorkloc.value.trim(),
            onCall: chkOnCall.checked,
            notes: inpNotes.value.trim()
          };
        }

        function liveCalc() {
          const draft = readForm();
          const ctx = {
            jy: current.jy, jm: current.jm, jd: current.jd,
            weekday: J.weekdayOf(current.jy, current.jm, current.jd),
            passed: true, isToday: false
          };
          const calc = C.computeDay(draft, ctx, App.data.settings);

          form.querySelector('#lc-worked').textContent = calc.status === 'none' ? '—' : C.formatDurationFa(calc.worked);
          form.querySelector('#lc-duty').textContent = calc.duty ? C.formatDurationFa(calc.duty) : '—';
          form.querySelector('#lc-ot').textContent = calc.overtime ? C.formatDurationFa(calc.overtime) : '۰:۰۰';

          const hintEl = form.querySelector('[data-hint="overnight"]');
          const noteEl = form.querySelector('#lc-note');
          const startMin = C.parseTime(draft.startTime);
          const endMin = C.parseTime(draft.endTime);
          if (startMin != null && endMin != null && endMin < startMin && (draft.status === 'work' || draft.status === 'holiday')) {
            hintEl.textContent = 'شیفت عبوری از نیمه‌شب — تا فردا محاسبه می‌شود';
          } else if (draft.status !== 'leave') {
            hintEl.textContent = '';
          }
          noteEl.textContent = (calc.mission && !calc.hasTimes && App.data.settings.missionCountsAsDuty && calc.status === 'work')
            ? 'مأموریت بدون ساعت، معادل موظفی کامل در نظر گرفته شد'
            : '';
        }

        [inpStart, inpEnd].forEach(function (el) {
          el.addEventListener('input', liveCalc);
          el.addEventListener('blur', function () {
            const parsed = C.parseTime(normalizeTimeInput(el.value.trim()));
            if (parsed != null) el.value = C.minutesToClock(parsed);
            liveCalc();
          });
        });
        [chkMission, chkOnCall].forEach(function (el) { el.addEventListener('change', liveCalc); });

        syncStatusUI();

        /* ---------- کپی از روز قبل ---------- */
        form.querySelector('#f-copy-prev').addEventListener('click', function () {
          let prev = null;
          for (let i = 1; i <= 62; i++) {
            const d = J.addDays(current.jy, current.jm, current.jd, -i);
            if (App.data.records.has(J.keyOfDate(d))) { prev = App.data.records.get(J.keyOfDate(d)); break; }
          }
          if (!prev) {
            App.ui.toast('روز قبلِ ثبت‌شده‌ای پیدا نشد', 'info');
            return;
          }
          selStatus.value = C.VALID_STATUSES.indexOf(prev.status) !== -1 ? prev.status : 'work';
          inpStart.value = prev.startTime;
          inpEnd.value = prev.endTime;
          chkMission.checked = !!prev.mission;
          chkOnCall.checked = !!prev.onCall;
          inpLocation.value = prev.missionLocation || '';
          inpWorkloc.value = prev.workLocation || '';
          inpNotes.value = prev.notes || '';
          syncNotesCount();
          syncStatusUI();
          App.ui.toast('اطلاعات ' + J.formatDate({ jy: prev.jy, jm: prev.jm, jd: prev.jd }, 'day') + ' کپی شد', 'info');
        });

        /* ---------- اعتبارسنجی و ذخیره ---------- */
        form.addEventListener('submit', function (e) {
          e.preventDefault();
          const draft = readForm();

          const errors = {};
          const setErr = function (name, msg) {
            const el = form.querySelector('[data-err="' + name + '"]');
            if (el) el.textContent = msg || '';
            if (msg) errors[name] = msg;
          };
          setErr('start', '');
          setErr('end', '');

          const timesNeeded = draft.status === 'work' || draft.status === 'holiday';
          if (timesNeeded) {
            const s = C.parseTime(draft.startTime);
            const en = C.parseTime(draft.endTime);
            if ((draft.startTime !== '') !== (draft.endTime !== '')) {
              setErr(draft.startTime === '' ? 'start' : 'end', 'هر دو ساعت ورود و خروج را وارد کنید (یا هر دو خالی)');
            } else if (draft.startTime !== '') {
              if (s == null) setErr('start', 'قالب ساعت معتبر نیست (مثلاً 08:00)');
              if (en == null) setErr('end', 'قالب ساعت معتبر نیست (مثلاً 18:00)');
              if (s != null && en != null && s === en) setErr('end', 'ساعت خروج نمی‌تواند برابر ورود باشد');
            }
          }

          if (draft.status === 'leave' || draft.status === 'none') {
            draft.startTime = '';
            draft.endTime = '';
          }

          /* جلوگیری از رکورد تکراری */
          const targetKey = J.keyOfDate(current);
          if (isNew && App.data.records.has(targetKey)) {
            App.ui.toast('برای این تاریخ قبلاً ثبت شده است — آن را ویرایش کنید', 'error');
            return;
          }
          if (!isNew && targetKey !== rec.dateKey && App.data.records.has(targetKey)) {
            App.ui.toast('تاریخ انتخاب‌شده از قبل ثبت دارد؛ ابتدا آن را حذف یا ویرایش کنید', 'error');
            return;
          }

          if (Object.keys(errors).length) {
            App.ui.toast('لطفاً خطاهای فرم را برطرف کنید', 'error');
            return;
          }

          App.actions.saveRecord(draft).then(function (result) {
            if (!result.ok) {
              App.ui.toast('ذخیره ناموفق بود — داده‌های ورودی معتبر نیستند', 'error');
              return;
            }
            modalApi.close();
            const calc = result.calc;
            const parts = [];
            if (calc.worked) parts.push('کارکرد ' + C.formatDurationFa(calc.worked));
            if (calc.overtime) parts.push('اضافه‌کاری ' + C.formatDurationFa(calc.overtime));
            if (calc.status === 'leave') parts.push('مرخصی ثبت شد');
            if (calc.status === 'holiday') parts.push('روز تعطیل');
            App.ui.toast('ذخیره شد' + (parts.length ? ' — ' + parts.join('، ') : ''), 'success');
          });
        });
      }
    });

    return modal;
  }

  /* سال‌های قابل انتخاب: سال‌های دارای رکورد + سال جاری و بعد از آن */
  function availableYears() {
    const years = new Set();
    App.data.records.forEach(function (r) { years.add(r.jy); });
    years.add(App.state.today.jy);
    years.add(App.state.today.jy + 1);
    return Array.from(years).sort(function (a, b) { return a - b; });
  }

  /* =============================================================
   * اکشن‌های عمومی داده
   * ============================================================= */
  App.actions = App.actions || {};

  App.actions.openDayForm = openDayForm;

  App.actions.quickToday = function () {
    const today = App.state.today;
    if (App.state.period.jy !== today.jy || App.state.period.jm !== today.jm) {
      App.setPeriod(today.jy, today.jm);
    }
    openDayForm({ jy: today.jy, jm: today.jm, jd: today.jd }, { quick: true });
  };

  App.actions.saveRecord = function (raw) {
    const rec = C.normalizeRecord(Object.assign({}, raw, { updatedAt: new Date().toISOString() }));
    if (!rec) return Promise.resolve({ ok: false, error: 'invalid' });
    return App.db.putRecord(rec).then(function () {
      App.data.records.set(rec.dateKey, rec);
      const ctx = {
        jy: rec.jy, jm: rec.jm, jd: rec.jd,
        weekday: J.weekdayOf(rec.jy, rec.jm, rec.jd),
        passed: true, isToday: false
      };
      const calc = C.computeDay(rec, ctx, App.data.settings);
      App.updateSidebarStats();
      App.refresh();
      return { ok: true, record: rec, calc: calc };
    });
  };

  App.actions.deleteRecord = function (dateKey) {
    return App.db.deleteRecord(dateKey).then(function () {
      App.data.records.delete(dateKey);
      App.updateSidebarStats();
      App.refresh();
      return { ok: true };
    });
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = App;
})(typeof window !== 'undefined' ? window : globalThis);
