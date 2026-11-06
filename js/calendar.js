/* =============================================================
 * کارنما — ماژول تقویم ماهانه شمسی (RTL)
 * روزها بر اساس وضعیت رنگ‌بندی می‌شوند و با کلیک روی هر روز،
 * فرم ثبت/ویرایش همان روز باز می‌شود.
 * ============================================================= */
(function (root) {
  'use strict';

  const App = root.App = root.App || {};
  const J = App.jalali;
  const U = App.util;
  const C = App.calc;

  const calendar = {};

  /* رندر تقویم یک ماه داخل عنصر داده‌شده
   * opts = { jy, jm, onDayClick(dateObj), showLegend, compact } */
  calendar.render = function (mount, opts) {
    const options = opts || {};
    const jy = options.jy;
    const jm = options.jm;
    const today = App.state.today;
    const settings = App.data.settings;

    const summary = C.summarizeMonth(jy, jm, App.data.records, settings, today);
    const firstWeekday = summary.days.length ? summary.days[0].ctx.weekday : 0;

    /* سلول‌های خالی ابتدای ماه + سلول‌های روزها */
    let cellsHtml = '';
    for (let i = 0; i < firstWeekday; i++) {
      cellsHtml += '<div class="cal__cell cal__cell--blank" aria-hidden="true"></div>';
    }

    summary.days.forEach(function (day) {
      const ctx = day.ctx;
      const calc = day.calc;

      const classes = ['cal__cell', 'st-' + calc.status];
      if (ctx.isToday) classes.push('is-today');
      if (ctx.weekday === 6) classes.push('is-friday');
      if (!ctx.passed) classes.push('is-future');
      if (calc.mission) classes.push('has-mission');
      if (calc.onCall) classes.push('has-oncall');

      /* متن کوچک داخل هر سلول */
      let info = '';
      if (calc.status === 'work') {
        if (calc.hasTimes) {
          info = C.formatDurationFa(calc.worked) + (calc.overtime ? ' <b class="cal-ot">+' + C.formatDurationFa(calc.overtime) + '</b>' : '');
        } else if (calc.mission) {
          info = 'مأموریت';
        } else {
          info = 'بدون ساعت';
        }
      } else if (calc.status === 'leave') {
        info = 'مرخصی';
      } else if (calc.status === 'holiday') {
        info = calc.hasTimes ? C.formatDurationFa(calc.worked) : 'تعطیل';
      } else {
        info = '—';
      }

      const tags = [];
      if (calc.mission) tags.push('<span class="tag-ico" title="مأموریت">' + App.icons.mission + '</span>');
      if (calc.onCall) tags.push('<span class="tag-ico tag-ico--oncall" title="آنکال">' + App.icons.oncall + '</span>');

      cellsHtml += `
        <button type="button" class="${classes.join(' ')}" data-key="${ctx.dateKey}"
          title="${U.escapeHtml(J.formatDate(ctx, 'full'))}">
          <span class="cal__day">${U.toFa(ctx.jd)}</span>
          ${(tags.length && !options.compact) ? '<span class="cal__tags">' + tags.join('') + '</span>' : ''}
          <span class="cal__info">${info}</span>
        </button>`;
    });

    const weekdaysHtml = J.WEEKDAY_NAMES.map(function (name, i) {
      return `<span class="cal__weekday ${i === 6 ? 'cal__weekday--friday' : ''}">${name}</span>`;
    }).join('');

    const t = summary.totals;
    const legend = options.showLegend === false ? '' : `
      <div class="cal__legend">
        <span class="legend-item"><i class="dot dot--work"></i>کاری <b>${U.toFa(t.workDays)}</b></span>
        <span class="legend-item"><i class="dot dot--leave"></i>مرخصی <b>${U.toFa(t.leaveDays)}</b></span>
        <span class="legend-item"><i class="dot dot--holiday"></i>تعطیل <b>${U.toFa(t.holidayDays)}</b></span>
        <span class="legend-item"><i class="dot dot--none"></i>بدون ثبت <b>${U.toFa(t.unrecordedDays)}</b></span>
        <span class="legend-item">${App.icons.mission} مأموریت <b>${U.toFa(t.missionDays)}</b></span>
        <span class="legend-item">${App.icons.oncall} آنکال <b>${U.toFa(t.onCallDays)}</b></span>
      </div>`;

    mount.innerHTML = `
      <div class="calendar ${options.compact ? 'calendar--compact' : ''}">
        <div class="cal__weekdays">${weekdaysHtml}</div>
        <div class="cal__grid">${cellsHtml}</div>
      </div>
      ${legend}
    `;

    if (typeof options.onDayClick === 'function') {
      mount.querySelector('.calendar').addEventListener('click', function (e) {
        const cell = e.target.closest('.cal__cell[data-key]');
        if (!cell) return;
        const date = J.parseKey(cell.getAttribute('data-key'));
        if (date) options.onDayClick(date);
      });
    }

    return summary;
  };

  /* =============================================================
   * صفحه تقویم
   * ============================================================= */
  App.pages = App.pages || {};

  App.pages.calendar = {
    render: function (container) {
      const period = App.state.period;
      const monthLabel = J.monthYearLabel(period.jy, period.jm);

      container.innerHTML = `
        <div class="page-head">
          <h2 class="page-h2">تقویم ${U.escapeHtml(monthLabel)}</h2>
          <p class="page-desc">روی هر روز کلیک کنید تا فرم ثبت/ویرایش آن باز شود</p>
        </div>
        <div class="toolbar">
          <div class="period-picker" id="period-picker"></div>
          <div class="toolbar__spacer"></div>
          <button type="button" class="btn btn--primary" id="btn-quick">${App.icons.zap}<span>ثبت سریع امروز</span></button>
        </div>
        <div class="card calendar-card">
          <div id="calendar-mount"></div>
        </div>
      `;

      App.ui.periodPicker(container.querySelector('#period-picker'));

      calendar.render(container.querySelector('#calendar-mount'), {
        jy: period.jy,
        jm: period.jm,
        onDayClick: function (date) {
          App.actions.openDayForm(date);
        }
      });

      container.querySelector('#btn-quick').addEventListener('click', function () {
        App.actions.quickToday();
      });
    }
  };

  App.calendar = calendar;

  if (typeof module !== 'undefined' && module.exports) module.exports = App;
})(typeof window !== 'undefined' ? window : globalThis);
