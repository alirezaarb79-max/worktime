/* =============================================================
 * کارنما — ماژول تقویم جلالی و ابزارهای قالب‌بندی فارسی
 * پیاده‌سازی الگوریتم استاندارد تبدیل تقویم جلالی/میلادی
 * بدون هیچ وابستگی خارجی — کاملاً آفلاین
 * ============================================================= */
(function (root) {
  'use strict';

  const App = root.App = root.App || {};

  /* ---------- ثابت‌ها (بدون Magic Number در بقیه کد) ---------- */
  const PERSIAN_EPOCH_OFFSET = 621;   // اختلاف سال جلالی با میلادی
  const WEEKDAY_COUNT = 7;
  const MONTHS_IN_YEAR = 12;
  const FIRST_SIX_MONTH_DAYS = 31;
  const LAST_FIVE_MONTH_DAYS = 30;

  /* نام ماه‌های جلالی */
  const MONTH_NAMES = [
    'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
    'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'
  ];

  /* نام روزهای هفته — اندیس صفر = شنبه */
  const WEEKDAY_NAMES = [
    'شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'
  ];

  const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
  const EN_DIGITS = '0123456789';
  const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';

  /* نقاط شکست چرخه ۳۳ ساله تقویم جلالی */
  const BREAKS = [
    -61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181,
    1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178
  ];

  /* ---------- توابع کمکی ریاضی ---------- */
  function div(a, b) { return ~~(a / b); }
  function mod(a, b) { return a - ~~(a / b) * b; }

  /* =============================================================
   * الگوریتم تبدیل (Jalaali Algorithm)
   * ============================================================= */

  /* محاسبه اطلاعات سال جلالی: روز مارس شروع سال + کبیسه */
  function jalCal(jy, withoutLeap) {
    const bl = BREAKS.length;
    const gy = jy + PERSIAN_EPOCH_OFFSET;
    let leapJ = -14;
    let jp = BREAKS[0];
    let jm = 0;
    let jump = 0;
    let leap = 0;
    let n = 0;

    if (jy < jp || jy >= BREAKS[bl - 1]) {
      throw new Error('سال جلالی خارج از بازه معتبر است: ' + jy);
    }

    for (let i = 1; i < bl; i += 1) {
      jm = BREAKS[i];
      jump = jm - jp;
      if (jy < jm) break;
      leapJ = leapJ + div(jump, 33) * 8 + div(mod(jump, 33), 4);
      jp = jm;
    }
    n = jy - jp;

    leapJ = leapJ + div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
    if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;

    const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
    const march = 20 + leapJ - leapG;

    if (!withoutLeap) {
      if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
      leap = mod(mod(n + 1, 33) - 1, 4);
      if (leap === -1) leap = 4;
    }

    return { leap: leap, gy: gy, march: march };
  }

  /* تبدیل میلادی به شماره روز جولیَن */
  function g2d(gy, gm, gd) {
    let d = div((gy + div(gm - 8, 6) + 100100) * 1461, 4)
      + div(153 * mod(gm + 9, 12) + 2, 5)
      + gd - 34840408;
    d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
    return d;
  }

  /* تبدیل شماره روز جولیَن به میلادی */
  function d2g(jdn) {
    let j = 4 * jdn + 139361631;
    j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
    const i = div(mod(j, 1461), 4) * 5 + 308;
    const gd = div(mod(i, 153), 5) + 1;
    const gm = mod(div(i, 153), 12) + 1;
    const gy = div(j, 1461) - 100100 + div(8 - gm, 6);
    return { gy: gy, gm: gm, gd: gd };
  }

  /* تبدیل جلالی به شماره روز جولیَن */
  function j2d(jy, jm, jd) {
    const r = jalCal(jy, true);
    return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1;
  }

  /* تبدیل شماره روز جولیَن به جلالی */
  function d2j(jdn) {
    const gy = d2g(jdn).gy;
    let jy = gy - PERSIAN_EPOCH_OFFSET;
    const r = jalCal(jy, false);
    const jdn1f = g2d(gy, 3, r.march);
    let k = jdn - jdn1f;

    if (k >= 0) {
      if (k <= 185) {
        const jm = 1 + div(k, 31);
        const jd = mod(k, 31) + 1;
        return { jy: jy, jm: jm, jd: jd };
      }
      k -= 186;
    } else {
      jy -= 1;
      k += 179;
      if (r.leap === 1) k += 1;
    }
    const jm = 7 + div(k, 30);
    const jd = mod(k, 30) + 1;
    return { jy: jy, jm: jm, jd: jd };
  }

  /* =============================================================
   * API عمومی
   * ============================================================= */
  const J = {};

  J.MONTH_NAMES = MONTH_NAMES;
  J.WEEKDAY_NAMES = WEEKDAY_NAMES;
  J.WEEKDAY_COUNT = WEEKDAY_COUNT;
  J.MONTHS_IN_YEAR = MONTHS_IN_YEAR;

  J.toJalaali = function (gy, gm, gd) {
    return d2j(g2d(gy, gm, gd));
  };

  J.toGregorian = function (jy, jm, jd) {
    return d2g(j2d(jy, jm, jd));
  };

  J.isLeapYear = function (jy) {
    return J.daysInMonth(jy, MONTHS_IN_YEAR) === FIRST_SIX_MONTH_DAYS - 1;
  };

  J.daysInMonth = function (jy, jm) {
    if (jm < 1 || jm > MONTHS_IN_YEAR) {
      throw new Error('ماه جلالی نامعتبر است: ' + jm);
    }
    if (jm <= 6) return FIRST_SIX_MONTH_DAYS;
    if (jm <= 11) return LAST_FIVE_MONTH_DAYS;
    /* اسفند: با فاصله تا فروردین سال بعد محاسبه می‌شود */
    return j2d(jy + 1, 1, 1) - j2d(jy, MONTHS_IN_YEAR, 1);
  };

  /* تاریخ جلالی امروز بر اساس ساعت سیستم */
  J.today = function () {
    const n = new Date();
    return J.toJalaali(n.getFullYear(), n.getMonth() + 1, n.getDate());
  };

  /* روز هفته (۰ = شنبه ... ۶ = جمعه) */
  J.weekdayOf = function (jy, jm, jd) {
    const g = J.toGregorian(jy, jm, jd);
    const jsDay = new Date(g.gy, g.gm - 1, g.gd).getDay(); /* 0=یکشنبه میلادی */
    return (jsDay + 1) % WEEKDAY_COUNT;
  };

  J.keyOf = function (jy, jm, jd) {
    return jy + '-' + U.pad2(jm) + '-' + U.pad2(jd);
  };

  J.keyOfDate = function (d) {
    return J.keyOf(d.jy, d.jm, d.jd);
  };

  /* تبدیل کلید تاریخ به شیء تاریخ با اعتبارسنجی */
  J.parseKey = function (key) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(key || ''));
    if (!m) return null;
    const jy = +m[1], jm = +m[2], jd = +m[3];
    if (jm < 1 || jm > MONTHS_IN_YEAR) return null;
    if (jd < 1 || jd > J.daysInMonth(jy, jm)) return null;
    return { jy: jy, jm: jm, jd: jd };
  };

  /* مقایسه دو تاریخ جلالی: -1/0/1 */
  J.compare = function (a, b) {
    if (a.jy !== b.jy) return a.jy < b.jy ? -1 : 1;
    if (a.jm !== b.jm) return a.jm < b.jm ? -1 : 1;
    if (a.jd !== b.jd) return a.jd < b.jd ? -1 : 1;
    return 0;
  };

  /* تبدیل تاریخ جلالی به شیء Date جاوااسکریپت (به وقت محلی) */
  J.toDate = function (jy, jm, jd) {
    const g = J.toGregorian(jy, jm, jd);
    return new Date(g.gy, g.gm - 1, g.gd);
  };

  /* جمع/کسر روز از تاریخ جلالی */
  J.addDays = function (jy, jm, jd, delta) {
    const date = J.toDate(jy, jm, jd);
    date.setDate(date.getDate() + delta);
    return J.toJalaali(date.getFullYear(), date.getMonth() + 1, date.getDate());
  };

  J.monthName = function (jm) { return MONTH_NAMES[jm - 1] || ''; };

  J.monthYearLabel = function (jy, jm) {
    return MONTH_NAMES[jm - 1] + ' ' + U.toFa(jy);
  };

  /* قالب‌های نمایش تاریخ:
   * full  → شنبه ۱۳ شهریور ۱۴۰۵
   * day   → شنبه ۱۳ شهریور
   * short → ۱۴۰۵/۰۶/۱۳ */
  J.formatDate = function (date, style) {
    const mode = style || 'full';
    const weekday = WEEKDAY_NAMES[J.weekdayOf(date.jy, date.jm, date.jd)];
    if (mode === 'short') {
      return U.toFa(date.jy + '/' + U.pad2(date.jm) + '/' + U.pad2(date.jd));
    }
    if (mode === 'day') {
      return weekday + ' ' + U.toFa(date.jd) + ' ' + MONTH_NAMES[date.jm - 1];
    }
    return weekday + ' ' + U.toFa(date.jd) + ' ' + MONTH_NAMES[date.jm - 1] + ' ' + U.toFa(date.jy);
  };

  /* ---------- ابزارهای ارقام و متن ---------- */
  const U = App.util = App.util || {};

  U.toFa = function (value) {
    return String(value).replace(/[0-9]/g, function (d) { return FA_DIGITS[+d]; });
  };

  U.toEn = function (value) {
    return String(value)
      .replace(/[۰-۹]/g, function (d) { return String(FA_DIGITS.indexOf(d)); })
      .replace(/[٠-٩]/g, function (d) { return String(AR_DIGITS.indexOf(d)); });
  };

  U.pad2 = function (n) {
    return (n < 10 ? '0' : '') + n;
  };

  /* جلوگیری از تزریق HTML در محتوای کاربر */
  U.escapeHtml = function (value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  U.clampText = function (text, maxLen) {
    const t = String(text || '');
    return t.length > maxLen ? t.slice(0, maxLen - 1) + '…' : t;
  };

  App.jalali = J;

  if (typeof module !== 'undefined' && module.exports) module.exports = App;
})(typeof window !== 'undefined' ? window : globalThis);
