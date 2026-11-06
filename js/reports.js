/* =============================================================
 * کارنما — ماژول گزارش‌ها
 * گزارش ماهانه + گزارش سالانه + مقایسه چند ماه
 * ============================================================= */
(function (root) {
  'use strict';

  const App = root.App = root.App || {};
  const J = App.jalali;
  const U = App.util;
  const C = App.calc;

  const TABS = [
    { id: 'monthly', label: 'ماهانه' },
    { id: 'yearly', label: 'سالانه' },
    { id: 'compare', label: 'مقایسه ماه‌ها' }
  ];

  /* وضعیت تب جاری (بین رندرها حفظ می‌شود) */
  let currentTab = 'monthly';
  const compareState = { year: null, months: [] };

  let activeCharts = [];
  function destroyCharts() {
    activeCharts.forEach(function (ch) {
      try { ch.destroy(); } catch (e) { /* بی‌اهمیت */ }
    });
    activeCharts = [];
  }

  App.pages = App.pages || {};

  App.pages.reports = {
    render: function (container) {
      destroyCharts();
      if (compareState.year === null) compareState.year = App.state.period.jy;

      container.innerHTML = `
        <div class="page-head">
          <h2 class="page-h2">گزارش‌ها</h2>
          <p class="page-desc">گزارش ماهانه، سالانه و مقایسه چند ماه — قابل چاپ و خروجی Excel</p>
        </div>

        <div class="toolbar">
          <div class="tabs" id="report-tabs" role="tablist">
            ${TABS.map(function (t) {
              return `<button type="button" class="tab ${currentTab === t.id ? 'is-active' : ''}" data-tab="${t.id}" role="tab" aria-selected="${currentTab === t.id}">${t.label}</button>`;
            }).join('')}
          </div>
          <div class="toolbar__spacer"></div>
          <button type="button" class="btn btn--soft" id="btn-print">${App.icons.print}<span>چاپ گزارش</span></button>
        </div>

        <div id="report-body"></div>
      `;

      container.querySelector('#report-tabs').addEventListener('click', function (e) {
        const tab = e.target.closest('.tab');
        if (!tab) return;
        currentTab = tab.getAttribute('data-tab');
        container.querySelectorAll('.tab').forEach(function (b) {
          const active = b === tab;
          b.classList.toggle('is-active', active);
          b.setAttribute('aria-selected', active);
        });
        renderTab(container.querySelector('#report-body'));
      });

      container.querySelector('#btn-print').addEventListener('click', function () {
        try { window.print(); } catch (e) { /* در محیط بدون چاپ */ }
      });

      renderTab(container.querySelector('#report-body'));
    }
  };

  /* =============================================================
   * تب گزارش ماهانه
   * ============================================================= */
  function renderMonthlyView(mount) {
    const period = App.state.period;
    const summary = C.summarizeMonth(period.jy, period.jm, App.data.records, App.data.settings, App.state.today);
    const t = summary.totals;

    mount.innerHTML = `
      <div class="toolbar">
        <div class="period-picker" id="period-picker"></div>
        <div class="toolbar__spacer"></div>
        <button type="button" class="btn btn--soft" id="btn-excel">${App.icons.excel}<span>خروجی Excel ماهانه</span></button>
      </div>

      <div class="summary-strip">
        <span class="sum-chip sum-chip--primary">کارکرد <b>${C.formatDurationFa(t.worked)}</b></span>
        <span class="sum-chip sum-chip--info">موظفی <b>${C.formatDurationFa(t.duty)}</b></span>
        <span class="sum-chip sum-chip--warning">اضافه‌کاری <b>${C.formatDurationFa(t.overtime)}</b></span>
        <span class="sum-chip">روز کاری <b>${U.toFa(t.workDays)}</b></span>
        <span class="sum-chip">مأموریت <b>${U.toFa(t.missionDays)}</b></span>
        <span class="sum-chip">آنکال <b>${U.toFa(t.onCallDays)}</b></span>
        <span class="sum-chip">مرخصی <b>${U.toFa(t.leaveDays)}</b></span>
        <span class="sum-chip">تعطیل <b>${U.toFa(t.holidayDays)}</b></span>
        <span class="sum-chip">بدون ثبت <b>${U.toFa(t.unrecordedDays)}</b></span>
      </div>

      <div class="card table-card">
        <div class="card__head">
          <h3 class="card__title">گزارش تفصیلی ${U.escapeHtml(J.monthYearLabel(period.jy, period.jm))}</h3>
          <p class="card__sub">${U.toFa(t.recordedDays)} روز ثبت‌شده از ${U.toFa(summary.days.length)} روز</p>
        </div>
        <div class="table-wrap">
          <table class="data-table data-table--report">
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
              </tr>
            </thead>
            <tbody>
              ${summary.days.map(function (day) { return App.shared.dayRowHtml(day, false); }).join('')}
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
              </tr>
            </tfoot>
          </table>
        </div>
      </div>`;

    App.ui.periodPicker(mount.querySelector('#period-picker'));
    mount.querySelector('#btn-excel').addEventListener('click', function () {
      App.excel.exportMonth(period.jy, period.jm);
    });
  }

  /* =============================================================
   * تب گزارش سالانه
   * ============================================================= */
  function yearRowHtml(label, t, extra) {
    return `
      <tr>
        <td class="td-date"><span class="date-main">${label}</span></td>
        <td class="td-num">${U.toFa(t.workDays)}</td>
        <td class="td-num">${C.formatDurationFa(t.worked)}</td>
        <td class="td-num">${C.formatDurationFa(t.duty)}</td>
        <td class="td-num"><b class="ot-text">${C.formatDurationFa(t.overtime)}</b></td>
        <td class="td-num">${U.toFa(t.missionDays)}${t.missionMinutes ? '<span class="cell-sub">' + C.formatDurationFa(t.missionMinutes) + '</span>' : ''}</td>
        <td class="td-num">${U.toFa(t.onCallDays)}</td>
        <td class="td-num">${U.toFa(t.leaveDays)}</td>
        <td class="td-num">${U.toFa(t.holidayDays)}</td>
        <td class="td-num">${U.toFa(t.unrecordedDays)}</td>
        ${extra ? '<td></td>' : ''}
      </tr>`;
  }

  function renderYearlyView(mount) {
    const period = App.state.period;
    const year = C.summarizeYear(period.jy, App.data.records, App.data.settings, App.state.today);

    mount.innerHTML = `
      <div class="toolbar">
        <div class="year-picker" id="year-picker"></div>
        <div class="toolbar__spacer"></div>
        <button type="button" class="btn btn--soft" id="btn-excel-year">${App.icons.excel}<span>خروجی Excel سالانه</span></button>
      </div>

      <div class="card table-card">
        <div class="card__head">
          <h3 class="card__title">گزارش سالانه ${U.toFa(period.jy)}</h3>
          <p class="card__sub">خلاصه دوازده ماه سال</p>
        </div>
        <div class="table-wrap">
          <table class="data-table data-table--year">
            <thead>
              <tr>
                <th>ماه</th>
                <th>روز کاری</th>
                <th>کارکرد</th>
                <th>موظفی</th>
                <th>اضافه‌کاری</th>
                <th>مأموریت</th>
                <th>آنکال</th>
                <th>مرخصی</th>
                <th>تعطیل</th>
                <th>بدون ثبت</th>
              </tr>
            </thead>
            <tbody>
              ${year.months.map(function (m) {
                return yearRowHtml(J.monthName(m.jm), m.totals, false);
              }).join('')}
            </tbody>
            <tfoot>
              ${yearRowHtml('جمع سال', year.totals, true)}
            </tfoot>
          </table>
        </div>
      </div>`;

    App.ui.yearPicker(mount.querySelector('#year-picker'), period.jy, function (jy) {
      App.setPeriod(jy, App.state.period.jm);
    });
    mount.querySelector('#btn-excel-year').addEventListener('click', function () {
      App.excel.exportYear(period.jy);
    });
  }

  /* =============================================================
   * تب مقایسه ماه‌ها
   * ============================================================= */
  function renderCompareView(mount) {
    const jy = compareState.year;
    const year = C.summarizeYear(jy, App.data.records, App.data.settings, App.state.today);
    const selected = compareState.months.filter(function (m) { return m >= 1 && m <= 12; });

    const chipsHtml = year.months.map(function (m) {
      const active = selected.indexOf(m.jm) !== -1;
      const hasData = m.totals.recordedDays > 0;
      return `<button type="button" class="filter-chip ${active ? 'is-active' : ''} ${hasData ? '' : 'filter-chip--muted'}" data-month="${m.jm}">
        ${J.monthName(m.jm)}${hasData ? ' <small>(' + U.toFa(m.totals.recordedDays) + ')</small>' : ''}
      </button>`;
    }).join('');

    let body = '';
    if (!selected.length) {
      body = `
        <div class="card">
          <div class="empty-state">
            <div class="empty-state__icon">${App.icons.bar}</div>
            <h3 class="empty-state__title">ماه‌هایی برای مقایسه انتخاب کنید</h3>
            <p class="empty-state__text">با کلیک روی ماه‌های بالا، مقایسه کارکرد و اضافه‌کاری آن‌ها نمایش داده می‌شود.</p>
          </div>
        </div>`;
    } else {
      const rows = selected.slice().sort(function (a, b) { return a - b; }).map(function (jm) {
        const m = year.months[jm - 1];
        return yearRowHtml(J.monthName(jm), m.totals, false);
      });
      const totals = { workDays: 0, worked: 0, duty: 0, overtime: 0, missionDays: 0, missionMinutes: 0, onCallDays: 0, leaveDays: 0, holidayDays: 0, unrecordedDays: 0 };
      selected.forEach(function (jm) {
        const tt = year.months[jm - 1].totals;
        for (const k in totals) totals[k] += tt[k] || 0;
      });

      body = `
        <div class="card table-card">
          <div class="card__head">
            <h3 class="card__title">مقایسه ${U.toFa(selected.length)} ماه از ${U.toFa(jy)}</h3>
            <p class="card__sub">مقادیر زمانی به ساعت:دقیقه</p>
          </div>
          <div class="table-wrap">
            <table class="data-table data-table--year">
              <thead>
                <tr>
                  <th>ماه</th>
                  <th>روز کاری</th>
                  <th>کارکرد</th>
                  <th>موظفی</th>
                  <th>اضافه‌کاری</th>
                  <th>مأموریت</th>
                  <th>آنکال</th>
                  <th>مرخصی</th>
                  <th>تعطیل</th>
                  <th>بدون ثبت</th>
                </tr>
              </thead>
              <tbody>${rows.join('')}</tbody>
              <tfoot>${yearRowHtml('جمع', totals, true)}</tfoot>
            </table>
          </div>
        </div>
        <div class="card chart-card">
          <div class="card__head">
            <h3 class="card__title">نمودار مقایسه</h3>
            <p class="card__sub">ساعت</p>
          </div>
          <div class="chart-wrap"><canvas id="chart-compare" aria-label="نمودار مقایسه ماه‌ها"></canvas></div>
        </div>`;
    }

    mount.innerHTML = `
      <div class="toolbar">
        <div class="year-picker" id="compare-year-picker"></div>
      </div>
      <div class="month-chips" id="month-chips">${chipsHtml}</div>
      ${body}`;

    App.ui.yearPicker(mount.querySelector('#compare-year-picker'), jy, function (newYear) {
      compareState.year = newYear;
      App.pages.reports.render(document.getElementById('page-container'));
    });

    mount.querySelector('#month-chips').addEventListener('click', function (e) {
      const chip = e.target.closest('[data-month]');
      if (!chip) return;
      const m = +chip.getAttribute('data-month');
      const i = compareState.months.indexOf(m);
      if (i === -1) compareState.months.push(m); else compareState.months.splice(i, 1);
      renderCompareView(mount);
    });

    if (selected.length) drawCompareChart(mount, year, selected.slice().sort(function (a, b) { return a - b; }));
  }

  function drawCompareChart(mount, year, months) {
    const ChartLib = root.Chart;
    const canvas = mount.querySelector('#chart-compare');
    if (!ChartLib || !canvas) return;
    try {
      activeCharts.push(new ChartLib(canvas, {
        type: 'bar',
        data: {
          labels: months.map(function (jm) { return J.monthName(jm); }),
          datasets: [
            {
              label: 'کارکرد',
              data: months.map(function (jm) { return C.toHours(year.months[jm - 1].totals.worked); }),
              backgroundColor: '#4f46e5',
              borderRadius: 6,
              maxBarThickness: 40
            },
            {
              label: 'موظفی',
              data: months.map(function (jm) { return C.toHours(year.months[jm - 1].totals.duty); }),
              backgroundColor: '#0284c7',
              borderRadius: 6,
              maxBarThickness: 40
            },
            {
              label: 'اضافه‌کاری',
              data: months.map(function (jm) { return C.toHours(year.months[jm - 1].totals.overtime); }),
              backgroundColor: '#d97706',
              borderRadius: 6,
              maxBarThickness: 40
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { rtl: true, textDirection: 'rtl', position: 'bottom', labels: { usePointStyle: true, pointStyle: 'circle', padding: 16 } },
            tooltip: {
              rtl: true, textDirection: 'rtl',
              callbacks: { label: function (ctx) { return ' ' + ctx.dataset.label + ': ' + U.toFa(ctx.parsed.y) + ' ساعت'; } }
            }
          },
          scales: {
            x: { grid: { display: false } },
            y: {
              beginAtZero: true,
              ticks: { callback: function (v) { return U.toFa(v); } }
            }
          }
        }
      }));
    } catch (e) {
      if (canvas.parentElement) canvas.parentElement.innerHTML = '<div class="chart-empty">نمودار در این محیط قابل رسم نیست</div>';
    }
  }

  function renderTab(mount) {
    destroyCharts();
    if (currentTab === 'monthly') renderMonthlyView(mount);
    else if (currentTab === 'yearly') renderYearlyView(mount);
    else renderCompareView(mount);
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = App;
})(typeof window !== 'undefined' ? window : globalThis);
