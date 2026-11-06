/* =============================================================
 * کارنما — ماژول محاسبات
 * تمام محاسبات زمانی بر اساس «دقیقه» انجام می‌شود (نه اعشار)
 * مثال: 08:00 → 480 دقیقه
 * ============================================================= */
(function (root) {
  'use strict';

  const App = root.App = root.App || {};
  const J = App.jalali;
  const U = App.util;

  /* ---------- ثابت‌ها ---------- */
  const MINUTES_PER_HOUR = 60;
  const HOURS_PER_DAY = 24;
  const MINUTES_PER_DAY = MINUTES_PER_HOUR * HOURS_PER_DAY; /* 1440 */
  const TIME_PATTERN = /^(\d{1,2}):(\d{1,2})$/;
  const NOTE_MAX_LENGTH = 300;
  const LOCATION_MAX_LENGTH = 100;
  const VALID_STATUSES = ['work', 'leave', 'holiday', 'none'];
  const OVERTIME_METHODS = ['excess', 'afterEnd'];
  const OT_ROUND_STEPS = [1, 5, 15, 30, 60];

  const STATUS_LABELS = {
    work: 'کاری',
    leave: 'مرخصی',
    holiday: 'تعطیل',
    none: 'بدون ثبت'
  };

  /* =============================================================
   * ابزارهای زمان
   * ============================================================= */

  /* "08:00" → 480 ؛ ورودی نامعتبر → null
   * ارقام فارسی/عربی هم پذیرفته می‌شود */
  function parseTime(value) {
    if (value == null) return null;
    const s = U.toEn(String(value)).trim().replace(/[.،]/g, ':');
    const m = TIME_PATTERN.exec(s);
    if (!m) return null;
    const h = +m[1];
    const mi = +m[2];
    if (h > 23 || mi > 59) return null;
    return h * MINUTES_PER_HOUR + mi;
  }

  /* 480 → "08:00" (ساعت روز) */
  function minutesToClock(minutes) {
    let m = ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
    return U.pad2(Math.floor(m / MINUTES_PER_HOUR)) + ':' + U.pad2(m % MINUTES_PER_HOUR);
  }

  /* 1665 → "27:45" — پشتیبانی از مدت‌های بالای ۲۴ ساعت */
  function formatDuration(minutes) {
    let m = Math.round(Number(minutes) || 0);
    if (m < 0) m = 0;
    return Math.floor(m / MINUTES_PER_HOUR) + ':' + U.pad2(m % MINUTES_PER_HOUR);
  }

  function formatDurationFa(minutes) {
    return U.toFa(formatDuration(minutes));
  }

  /* مدت به ساعت اعشاری (برای نمودارها) */
  function toHours(minutes) {
    return Math.round(((Number(minutes) || 0) / MINUTES_PER_HOUR) * 100) / 100;
  }

  /* =============================================================
   * اعتبارسنجی و نرمال‌سازی رکورد روزانه
   * ============================================================= */
  function normalizeRecord(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const date = J.parseKey(raw.dateKey);
    if (!date) return null;

    const status = VALID_STATUSES.indexOf(raw.status) !== -1 ? raw.status : null;
    if (!status) return null;

    let startTime = '';
    let endTime = '';
    if (raw.startTime != null && String(raw.startTime).trim() !== '') {
      if (parseTime(raw.startTime) == null) return null;
      startTime = minutesToClock(parseTime(raw.startTime));
    }
    if (raw.endTime != null && String(raw.endTime).trim() !== '') {
      if (parseTime(raw.endTime) == null) return null;
      endTime = minutesToClock(parseTime(raw.endTime));
    }
    /* فقط یکی از دو ساعت وارد شده باشد → نامعتبر */
    if ((startTime === '') !== (endTime === '')) return null;
    if (startTime !== '' && endTime !== '' && startTime === endTime) return null;

    /* روز مرخصی نباید ساعت کاری داشته باشد */
    if (status === 'leave' && startTime !== '') return null;

    const notes = String(raw.notes || '').trim().slice(0, NOTE_MAX_LENGTH);
    const missionLocation = String(raw.missionLocation || '').trim().slice(0, LOCATION_MAX_LENGTH);
    const workLocation = String(raw.workLocation || '').trim().slice(0, LOCATION_MAX_LENGTH);

    return {
      dateKey: raw.dateKey,
      jy: date.jy, jm: date.jm, jd: date.jd,
      status: status,
      startTime: startTime,
      endTime: endTime,
      mission: !!raw.mission,
      missionLocation: missionLocation,
      workLocation: workLocation,
      onCall: !!raw.onCall,
      notes: notes,
      updatedAt: raw.updatedAt || new Date().toISOString()
    };
  }

  /* =============================================================
   * محاسبات روزانه
   * ============================================================= */

  /* وضعیت مؤثر روز: رکورد ثبت‌شده مقدم است؛ در غیر این صورت
   * روزهای غیرکاریِ هفته (مثل جمعه) طبق تنظیمات «تعطیل» تلقی می‌شوند.
   * روز بدون ثبت هرگز خودکار مرخصی یا غیبت محسوب نمی‌شود. */
  function effectiveStatus(rec, ctx, settings) {
    if (rec) {
      if (rec.status === 'work' || rec.status === 'leave' || rec.status === 'holiday') return rec.status;
      return 'none';
    }
    if (settings.nonWorkAsHoliday && settings.workDays.indexOf(ctx.weekday) === -1) {
      return 'holiday';
    }
    return 'none';
  }

  /* محاسبه اضافه‌کاری خام (قبل از آستانه و رند) بر اساس روش تنظیم‌شده */
  function rawOvertime(workedMinutes, rec, settings) {
    const method = settings.overtime && OVERTIME_METHODS.indexOf(settings.overtime.method) !== -1
      ? settings.overtime.method
      : 'excess';

    if (method === 'afterEnd') {
      const stdEnd = parseTime(settings.standardEnd);
      const start = parseTime(rec.startTime);
      const end = parseTime(rec.endTime);
      if (stdEnd == null || start == null || end == null) return 0;
      if (end > start) {
        /* شیفت عادی: فقط ساعات پس از پایان استاندارد */
        return Math.max(0, end - Math.max(start, stdEnd));
      }
      /* شیفت عبوری از نیمه‌شب: از پایان استاندارد تا ۲۴:۰۰ + از ۰:۰۰ تا ساعت خروج */
      return (MINUTES_PER_DAY - Math.max(start, stdEnd)) + end;
    }

    /* روش پیش‌فرض: کارکرد منهای موظفی */
    return Math.max(0, workedMinutes - settings.dutyMinutes);
  }

  /* اعمال آستانه و رند بر اساس قوانین تنظیمات */
  function applyOvertimeRules(minutes, settings) {
    const threshold = Math.max(0, Number(settings.overtime && settings.overtime.thresholdMinutes) || 0);
    let v = Math.max(0, minutes - threshold);
    const step = Number(settings.overtime && settings.overtime.roundToMinutes) || 1;
    if (step > 1) v = Math.floor(v / step) * step;
    return v;
  }

  /* محاسبه کامل یک روز
   * ctx = { jy, jm, jd, weekday, passed, isToday }
   * خروجی = { status, worked, duty, overtime, mission, onCall, hasTimes } (همه بر حسب دقیقه) */
  function computeDay(rec, ctx, settings) {
    const dutySetting = settings.dutyMinutes;
    const status = effectiveStatus(rec, ctx, settings);

    let worked = 0;
    let duty = 0;
    let overtime = 0;

    const mission = !!(rec && rec.mission);
    const onCall = !!(rec && rec.onCall);
    const startMin = rec ? parseTime(rec.startTime) : null;
    const endMin = rec ? parseTime(rec.endTime) : null;
    const hasTimes = startMin != null && endMin != null;

    if (status === 'leave') {
      /* روز مرخصی: کارکرد و اضافه‌کاری صفر، موظفی محسوب می‌شود */
      duty = dutySetting;
    } else if (status === 'work') {
      /* روز خارج از هفته کاری (مثلاً جمعه): موظفی اعمال نمی‌شود */
      const offWeekday = settings.workDays.indexOf(ctx.weekday) === -1;
      if (hasTimes) {
        let mins = endMin - startMin;
        if (mins < 0) mins += MINUTES_PER_DAY; /* شیفت عبوری از نیمه‌شب */
        worked = mins;
        if (offWeekday) {
          /* کار در روز غیرکاری هفته: کل کارکرد اضافه‌کاری است */
          overtime = worked;
        } else {
          duty = dutySetting;
          overtime = rawOvertime(worked, rec, settings);
        }
      } else {
        if (!offWeekday) duty = dutySetting;
        if (mission && settings.missionCountsAsDuty) {
          /* مأموریت بدون ساعت ثبت‌شده: معادل موظفی کامل */
          worked = dutySetting;
        }
      }
    } else if (status === 'holiday') {
      if (hasTimes) {
        let mins = endMin - startMin;
        if (mins < 0) mins += MINUTES_PER_DAY;
        worked = mins;
        if (settings.overtime && settings.overtime.holidayWorkAsOvertime) {
          /* کار در روز تعطیل: کل کارکرد اضافه‌کاری است */
          overtime = worked;
        } else {
          duty = dutySetting;
          overtime = rawOvertime(worked, rec, settings);
        }
      }
    }
    /* status === 'none' → همه مقادیر صفر می‌مانند */

    overtime = applyOvertimeRules(overtime, settings);

    return {
      status: status,
      worked: worked,
      duty: duty,
      overtime: overtime,
      mission: mission,
      onCall: onCall,
      hasTimes: hasTimes
    };
  }

  /* =============================================================
   * محاسبات ماهانه و سالانه
   * ============================================================= */

  /* بافت روزهای یک ماه: وضعیت تقویمی هر روز */
  function monthContexts(jy, jm, today) {
    const dim = J.daysInMonth(jy, jm);
    const list = [];
    for (let jd = 1; jd <= dim; jd++) {
      const date = { jy: jy, jm: jm, jd: jd };
      list.push({
        jy: jy, jm: jm, jd: jd,
        weekday: J.weekdayOf(jy, jm, jd),
        passed: J.compare(date, today) <= 0,
        isToday: J.compare(date, today) === 0,
        dateKey: J.keyOf(jy, jm, jd)
      });
    }
    return list;
  }

  function emptyTotals() {
    return {
      worked: 0, duty: 0, overtime: 0,
      workDays: 0, missionDays: 0, missionMinutes: 0, onCallDays: 0,
      leaveDays: 0, holidayDays: 0, unrecordedDays: 0,
      recordedDays: 0, expectedWorkdays: 0, passedDays: 0
    };
  }

  /* خلاصه یک ماه: آرایه روزها + مجموع‌ها */
  function summarizeMonth(jy, jm, recordsMap, settings, today) {
    const totals = emptyTotals();
    const days = [];

    for (const ctx of monthContexts(jy, jm, today)) {
      const rec = recordsMap.get(ctx.dateKey) || null;
      const calc = computeDay(rec, ctx, settings);
      const t = totals;

      t.worked += calc.worked;
      t.duty += calc.duty;
      t.overtime += calc.overtime;

      if (calc.status === 'work') t.workDays++;
      if (calc.status === 'leave') t.leaveDays++;
      if (calc.status === 'holiday') t.holidayDays++;
      if (calc.status === 'none' && ctx.passed) t.unrecordedDays++;
      if (rec) t.recordedDays++;
      if (ctx.passed) {
        t.passedDays++;
        if (settings.workDays.indexOf(ctx.weekday) !== -1) t.expectedWorkdays++;
      }
      if (calc.mission) {
        t.missionDays++;
        t.missionMinutes += calc.worked;
      }
      if (calc.onCall) t.onCallDays++;

      days.push({ ctx: ctx, rec: rec, calc: calc });
    }

    return { jy: jy, jm: jm, days: days, totals: totals };
  }

  /* خلاصه سالانه: ۱۲ ماه + جمع کل */
  function summarizeYear(jy, recordsMap, settings, today) {
    const months = [];
    const yearTotals = emptyTotals();
    for (let jm = 1; jm <= J.MONTHS_IN_YEAR; jm++) {
      const ms = summarizeMonth(jy, jm, recordsMap, settings, today);
      months.push(ms);
      for (const k in yearTotals) yearTotals[k] += ms.totals[k];
    }
    return { jy: jy, months: months, totals: yearTotals };
  }

  /* =============================================================
   * API عمومی
   * ============================================================= */
  App.calc = {
    /* ثابت‌ها برای استفاده در سایر ماژول‌ها */
    MINUTES_PER_DAY: MINUTES_PER_DAY,
    MINUTES_PER_HOUR: MINUTES_PER_HOUR,
    NOTE_MAX_LENGTH: NOTE_MAX_LENGTH,
    LOCATION_MAX_LENGTH: LOCATION_MAX_LENGTH,
    OT_ROUND_STEPS: OT_ROUND_STEPS,
    VALID_STATUSES: VALID_STATUSES,
    STATUS_LABELS: STATUS_LABELS,

    parseTime: parseTime,
    minutesToClock: minutesToClock,
    formatDuration: formatDuration,
    formatDurationFa: formatDurationFa,
    toHours: toHours,
    normalizeRecord: normalizeRecord,
    effectiveStatus: effectiveStatus,
    computeDay: computeDay,
    monthContexts: monthContexts,
    summarizeMonth: summarizeMonth,
    summarizeYear: summarizeYear
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = App;
})(typeof window !== 'undefined' ? window : globalThis);
