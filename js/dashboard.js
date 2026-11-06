/* =============================================================
 * کارنما — ماژول داشبورد
 * KPI Card ها + نمودارهای Chart.js + آخرین ثبت‌ها
 * ============================================================= */
(function (root) {
  'use strict';

  const App = root.App = root.App || {};
  const J = App.jalali;
  const U = App.util;
  const C = App.calc;

  /* نمونه‌های فعال Chart.js برای جلوگیری از نشتی حافظه */
  let activeCharts = [];

  function destroyCharts() {
    activeCharts.forEach(function (ch) {
      try { ch.destroy(); } catch (e) { /* بی‌اهمیت */ }
    });
    activeCharts = [];
  }

  /* خواندن رنگ از متغیرهای CSS برای هماهنگی با تم */
  function cssVar(name, fallback) {
    try {
      const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      return v || fallback;
    } catch (e) {
      return fallback;
    }
  }

  /* =============================================================
   * صفحه داشبورد
   * ============================================================= */
  App.pages = App.pages || {};

  App.pages.dashboard = {
    render: function (container) {
      destroyCharts();

      const period = App.state.period;
      const settings = App.data.settings;
      const today = App.state.today;

      const month = C.summarizeMonth(period.jy, period.jm, App.data.records, settings, today);
      const year = C.summarizeYear(period.jy, App.data.records, settings, today);
      const t = month.totals;

      const hasAnyData = App.data.records.size > 0;

      /* ---------- KPI کارت‌ها ---------- */
      const kpis = [
        {
          key: 'worked', label: 'کل ساعات کارکرد', icon: 'clock', tone: 'primary',
          value: C.formatDurationFa(t.worked),
          sub: 'در ' + U.toFa(t.recordedDays) + ' روز ثبت‌شده'
        },
        {
          key: 'duty', label: 'کل ساعات موظفی', icon: 'target', tone: 'info',
          value: C.formatDurationFa(t.duty),
          sub: 'موظفی روزانه ' + C.formatDurationFa(settings.dutyMinutes) + (t.leaveDays ? ' — شامل ' + U.toFa(t.leaveDays) + ' روز مرخصی' : '')
        },
        {
          key: 'overtime', label: 'مجموع اضافه‌کاری', icon: 'zap', tone: 'warning',
          value: C.formatDurationFa(t.overtime),
          sub: t.overtime ? 'میانگین روزانه ' + C.formatDurationFa(Math.round(t.overtime / Math.max(1, t.workDays))) : 'بدون اضافه‌کاری'
        },
        {
          key: 'workDays', label: 'روزهای کاری', icon: 'calendarCheck', tone: 'success',
          value: U.toFa(t.workDays) + ' روز',
          sub: 'از ' + U.toFa(t.expectedWorkdays) + ' روز کاریِ گذشته'
        },
        {
          key: 'mission', label: 'مأموریت', icon: 'mission', tone: 'purple',
          value: U.toFa(t.missionDays) + ' روز',
          sub: t.missionMinutes ? 'مجموع ' + C.formatDurationFa(t.missionMinutes) : 'بدون مأموریت'
        },
        {
          key: 'oncall', label: 'آنکال', icon: 'oncall', tone: 'violet',
          value: U.toFa(t.onCallDays) + ' روز',
          sub: 'در ' + J.monthName(period.jm)
        },
        {
          key: 'leave', label: 'مرخصی', icon: 'leave', tone: 'amber',
          value: U.toFa(t.leaveDays) + ' روز',
          sub: 'کارکرد و اضافه‌کاری صفر'
        },
        {
          key: 'holiday', label: 'تعطیل', icon: 'holiday', tone: 'rose',
          value: U.toFa(t.holidayDays) + ' روز',
          sub: settings.nonWorkAsHoliday ? 'شامل تعطیلات هفتگی' : 'فقط تعطیلات ثبت‌شده'
        },
        {
          key: 'none', label: 'بدون ثبت', icon: 'inbox', tone: 'slate',
          value: U.toFa(t.unrecordedDays) + ' روز',
          sub: 'از ' + U.toFa(t.passedDays) + ' روزِ گذشته'
        }
      ];

      const kpiHtml = kpis.map(function (k) {
        return `
          <div class="kpi kpi--${k.tone}">
            <span class="kpi__icon">${App.icons[k.icon]}</span>
            <div class="kpi__meta">
              <span class="kpi__label">${k.label}</span>
              <b class="kpi__value">${k.value}</b>
              <span class="kpi__sub">${k.sub}</span>
            </div>
          </div>`;
      }).join('');

      /* ---------- آخرین ثبت‌ها ---------- */
      const recent = Array.from(App.data.records.values())
        .sort(function (a, b) { return (b.updatedAt || '').localeCompare(a.updatedAt || ''); })
        .slice(0, 5);

      const recentHtml = recent.length ? `
        <div class="card recent-card">
          <div class="card__head">
            <h3 class="card__title">آخرین ثبت‌ها</h3>
            <p class="card__sub">پنج رکورد اخیر</p>
          </div>
          <div class="recent-list">
            ${recent.map(function (r) {
              const date = { jy: r.jy, jm: r.jm, jd: r.jd };
              const ctx = { jy: r.jy, jm: r.jm, jd: r.jd, weekday: J.weekdayOf(r.jy, r.jm, r.jd), passed: true, isToday: false };
              const calc = C.computeDay(r, ctx, App.data.settings);
              return `
                <button type="button" class="recent-item" data-key="${r.dateKey}">
                  <span class="recent-item__date">${U.escapeHtml(J.formatDate(date, 'day'))}</span>
                  ${App.shared.statusChip(calc.status)}
                  <span class="recent-item__info">
                    ${calc.worked ? 'کارکرد ' + C.formatDurationFa(calc.worked) : ''}
                    ${calc.overtime ? ' · اضافه‌کاری ' + C.formatDurationFa(calc.overtime) : ''}
                    ${r.mission ? ' · مأموریت' : ''}
                    ${r.onCall ? ' · آنکال' : ''}
                  </span>
                </button>`;
            }).join('')}
          </div>
        </div>` : '';

      /* ---------- خروجی HTML ---------- */
      container.innerHTML = `
        <div class="page-head">
          <h2 class="page-h2">داشبورد — ${U.escapeHtml(J.monthYearLabel(period.jy, period.jm))}</h2>
          <p class="page-desc">نمای کلی کارکرد و اضافه‌کاری ماه انتخابی</p>
        </div>

        <div class="toolbar">
          <div class="period-picker" id="period-picker"></div>
          <div class="toolbar__spacer"></div>
          <button type="button" class="btn btn--soft" id="btn-excel-month">${App.icons.excel}<span>Excel ماه</span></button>
          <button type="button" class="btn btn--primary" id="btn-quick">${App.icons.zap}<span>ثبت سریع امروز</span></button>
        </div>

        ${!hasAnyData ? `
        <div class="card">
          <div class="empty-state">
            <div class="empty-state__icon">${App.icons.clock}</div>
            <h3 class="empty-state__title">هنوز کارکردی ثبت نشده است</h3>
            <p class="empty-state__text">با دکمه زیر اولین روز کاری خود را ثبت کنید؛ همه محاسبات به‌صورت خودکار انجام می‌شود.</p>
            <button type="button" class="btn btn--primary" id="btn-empty-quick">${App.icons.zap}<span>ثبت سریع امروز</span></button>
          </div>
        </div>` : ''}

        <div class="kpi-grid">${kpiHtml}</div>

        <div class="charts-grid">
          <div class="card chart-card">
            <div class="card__head">
              <h3 class="card__title">اضافه‌کاری ماهانه در طول سال ${U.toFa(period.jy)}</h3>
              <p class="card__sub">ساعت</p>
            </div>
            <div class="chart-wrap"><canvas id="chart-ot-year" aria-label="نمودار اضافه‌کاری ماهانه"></canvas></div>
          </div>
          <div class="card chart-card">
            <div class="card__head">
              <h3 class="card__title">کارکرد ماهانه در طول سال ${U.toFa(period.jy)}</h3>
              <p class="card__sub">ساعت</p>
            </div>
            <div class="chart-wrap"><canvas id="chart-work-year" aria-label="نمودار کارکرد ماهانه"></canvas></div>
          </div>
          <div class="card chart-card">
            <div class="card__head">
              <h3 class="card__title">توزیع وضعیت روزهای ${U.escapeHtml(J.monthName(period.jm))}</h3>
              <p class="card__sub">تعداد روز</p>
            </div>
            <div class="chart-wrap"><canvas id="chart-status" aria-label="نمودار توزیع وضعیت روزها"></canvas></div>
          </div>
          <div class="card chart-card">
            <div class="card__head">
              <h3 class="card__title">مأموریت‌های ${U.toFa(period.jy)}</h3>
              <p class="card__sub">تعداد روز و مدت (ساعت)</p>
            </div>
            <div class="chart-wrap"><canvas id="chart-missions" aria-label="نمودار مأموریت‌ها"></canvas></div>
          </div>
        </div>

        ${recentHtml}
      `;

      App.ui.periodPicker(container.querySelector('#period-picker'));

      container.querySelector('#btn-quick').addEventListener('click', function () {
        App.actions.quickToday();
      });
      const emptyBtn = container.querySelector('#btn-empty-quick');
      if (emptyBtn) emptyBtn.addEventListener('click', function () { App.actions.quickToday(); });

      container.querySelector('#btn-excel-month').addEventListener('click', function () {
        App.excel.exportMonth(period.jy, period.jm);
      });

      if (recent.length) {
        container.querySelector('.recent-list').addEventListener('click', function (e) {
          const item = e.target.closest('.recent-item');
          if (!item) return;
          const date = J.parseKey(item.getAttribute('data-key'));
          if (date) App.actions.openDayForm(date);
        });
      }

      /* ---------- ساخت نمودارها ---------- */
      const monthLabels = J.MONTH_NAMES.slice();

      /* ۱) اضافه‌کاری ماهانه در طول سال */
      barChart('chart-ot-year', monthLabels, year.months.map(function (m) {
        return C.toHours(m.totals.overtime);
      }), cssVar('--warning', '#d97706'), 'ساعت اضافه‌کاری');

      /* ۲) کارکرد ماهانه در طول سال */
      barChart('chart-work-year', monthLabels, year.months.map(function (m) {
        return C.toHours(m.totals.worked);
      }), cssVar('--primary', '#4f46e5'), 'ساعت کارکرد');

      /* ۳) توزیع وضعیت روزها (دونات) */
      doughnutChart('chart-status', [
        { label: 'کاری', value: t.workDays, color: cssVar('--success', '#059669') },
        { label: 'مرخصی', value: t.leaveDays, color: cssVar('--warning', '#d97706') },
        { label: 'تعطیل', value: t.holidayDays, color: cssVar('--rose', '#e11d48') },
        { label: 'بدون ثبت', value: t.unrecordedDays, color: cssVar('--slate', '#94a3b8') }
      ]);

      /* ۴) تعداد/مدت مأموریت‌ها */
      missionsChart('chart-missions', monthLabels, year.months.map(function (m) {
        return m.totals.missionDays;
      }), year.months.map(function (m) {
        return C.toHours(m.totals.missionMinutes);
      }));
    }
  };

  /* =============================================================
   * سازنده‌های نمودار
   * ============================================================= */
  function chartBase() {
    const ChartLib = root.Chart;
    if (!ChartLib) return null;
    ChartLib.defaults.font.family = "'Vazirmatn', 'Tahoma', sans-serif";
    ChartLib.defaults.font.size = 12;
    ChartLib.defaults.color = cssVar('--text-2', '#64748b');
    return ChartLib;
  }

  function barPlugins(suffix) {
    return {
      legend: { rtl: true, textDirection: 'rtl', display: false },
      tooltip: {
        rtl: true, textDirection: 'rtl',
        callbacks: {
          label: function (ctx) {
            return ' ' + U.toFa(ctx.parsed.y) + (suffix || '');
          }
        }
      }
    };
  }

  function barChart(canvasId, labels, data, color, label) {
    const ChartLib = chartBase();
    const canvas = document.getElementById(canvasId);
    if (!ChartLib || !canvas) return;
    try {
      activeCharts.push(new ChartLib(canvas, {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [{
            label: label,
            data: data,
            backgroundColor: color,
            borderRadius: 6,
            maxBarThickness: 34
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: barPlugins(' ساعت'),
          scales: {
            x: { grid: { display: false } },
            y: {
              beginAtZero: true,
              grid: { color: cssVar('--border', '#e2e8f0') },
              ticks: { callback: function (v) { return U.toFa(v); } }
            }
          }
        }
      }));
    } catch (e) {
      showChartFallback(canvasId);
    }
  }

  function doughnutChart(canvasId, slices) {
    const ChartLib = chartBase();
    const canvas = document.getElementById(canvasId);
    if (!ChartLib || !canvas) return;
    const hasData = slices.some(function (s) { return s.value > 0; });
    if (!hasData) {
      showChartFallback(canvasId, 'داده‌ای برای این ماه ثبت نشده است');
      return;
    }
    try {
      activeCharts.push(new ChartLib(canvas, {
        type: 'doughnut',
        data: {
          labels: slices.map(function (s) { return s.label; }),
          datasets: [{
            data: slices.map(function (s) { return s.value; }),
            backgroundColor: slices.map(function (s) { return s.color; }),
            borderWidth: 2,
            borderColor: cssVar('--surface', '#ffffff'),
            hoverOffset: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '62%',
          plugins: {
            legend: {
              rtl: true, textDirection: 'rtl', position: 'bottom',
              labels: { usePointStyle: true, pointStyle: 'circle', padding: 16 }
            },
            tooltip: {
              rtl: true, textDirection: 'rtl',
              callbacks: {
                label: function (ctx) {
                  const total = ctx.dataset.data.reduce(function (a, b) { return a + b; }, 0) || 1;
                  return ' ' + U.toFa(ctx.parsed) + ' روز (' + U.toFa(Math.round(ctx.parsed / total * 100)) + '٪)';
                }
              }
            }
          }
        }
      }));
    } catch (e) {
      showChartFallback(canvasId);
    }
  }

  function missionsChart(canvasId, labels, counts, hours) {
    const ChartLib = chartBase();
    const canvas = document.getElementById(canvasId);
    if (!ChartLib || !canvas) return;
    const hasData = counts.some(function (v) { return v > 0; });
    if (!hasData) {
      showChartFallback(canvasId, 'مأموریتی ثبت نشده است');
      return;
    }
    try {
      activeCharts.push(new ChartLib(canvas, {
        data: {
          labels: labels,
          datasets: [
            {
              type: 'bar',
              label: 'تعداد روز مأموریت',
              data: counts,
              backgroundColor: cssVar('--info', '#0284c7'),
              borderRadius: 6,
              maxBarThickness: 30,
              yAxisID: 'y'
            },
            {
              type: 'line',
              label: 'مدت مأموریت (ساعت)',
              data: hours,
              borderColor: cssVar('--purple', '#7c3aed'),
              backgroundColor: cssVar('--purple', '#7c3aed'),
              tension: 0.35,
              pointRadius: 3,
              yAxisID: 'y1'
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
              callbacks: {
                label: function (ctx) {
                  return ' ' + ctx.dataset.label + ': ' + U.toFa(ctx.parsed.y);
                }
              }
            }
          },
          scales: {
            x: { grid: { display: false } },
            y: {
              beginAtZero: true, position: 'right',
              title: { display: true, text: 'روز' },
              grid: { color: cssVar('--border', '#e2e8f0') },
              ticks: { callback: function (v) { return U.toFa(v); } }
            },
            y1: {
              beginAtZero: true, position: 'left',
              title: { display: true, text: 'ساعت' },
              grid: { drawOnChartArea: false },
              ticks: { callback: function (v) { return U.toFa(v); } }
            }
          }
        }
      }));
    } catch (e) {
      showChartFallback(canvasId);
    }
  }

  function showChartFallback(canvasId, message) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const wrap = canvas.parentElement;
    wrap.innerHTML = '<div class="chart-empty">' + U.escapeHtml(message || 'نمودار در این محیط قابل رسم نیست') + '</div>';
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = App;
})(typeof window !== 'undefined' ? window : globalThis);
