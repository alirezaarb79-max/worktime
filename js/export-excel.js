/* =============================================================
 * کارنما — ماژول خروجی Excel (SheetJS / xlsx-js-style)
 * سه شیت: «گزارش کارکرد»، «محاسبات» و «خلاصه»
 * + پس‌پردازش ZIP برای تضمین RTL، Freeze Header و AutoFilter
 * ============================================================= */
(function (root) {
  'use strict';

  const App = root.App = root.App || {};
  const J = App.jalali;
  const U = App.util;
  const C = App.calc;

  /* ---------- ثابت‌های استایل ---------- */
  const COLOR_HEADER_BG = '4F46E5';
  const COLOR_HEADER_FG = 'FFFFFF';
  const COLOR_BORDER = 'CBD5E1';
  const COLOR_ZEBRA = 'F5F7FB';
  const COLOR_TOTAL_BG = 'EDEFFF';
  const COLOR_HOLIDAY_BG = 'FFE699'; /* هایلایت زرد ردیف روزهای تعطیل (جمعه و …) */
  const TITLE_FONT_SIZE = 13;
  const BODY_FONT_SIZE = 11;
  const TIME_FORMAT = 'hh:mm';
  const DURATION_FORMAT = '[h]:mm';

  const SHEET1_NAME = 'گزارش کارکرد';
  const SHEET2_NAME = 'محاسبات';
  const SHEET3_NAME = 'خلاصه';

  /* عرض ستون‌ها (بر حسب نویسه) */
  const COLS_SHEET1 = [{ wch: 13 }, { wch: 19 }, { wch: 10 }, { wch: 10 }, { wch: 30 }];
  const COLS_SHEET2 = [{ wch: 13 }, { wch: 9 }, { wch: 9 }, { wch: 9 }, { wch: 9 }, { wch: 11 }, { wch: 20 }, { wch: 10 }, { wch: 20 }, { wch: 11 }, { wch: 32 }];
  const COLS_SHEET3 = [{ wch: 30 }, { wch: 18 }];

  /* =============================================================
   * ابزار استایل سلول
   * ============================================================= */
  function thinBorder() {
    const b = { style: 'thin', color: { rgb: COLOR_BORDER } };
    return { top: b, bottom: b, left: b, right: b };
  }

  function titleCell(text) {
    return {
      v: text, t: 's',
      s: {
        font: { bold: true, sz: TITLE_FONT_SIZE, color: { rgb: COLOR_HEADER_FG } },
        fill: { patternType: 'solid', fgColor: { rgb: COLOR_HEADER_BG } },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: thinBorder()
      }
    };
  }

  function headerCell(text) {
    return {
      v: text, t: 's',
      s: {
        font: { bold: true, sz: BODY_FONT_SIZE, color: { rgb: COLOR_HEADER_FG } },
        fill: { patternType: 'solid', fgColor: { rgb: COLOR_HEADER_BG } },
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
        border: thinBorder()
      }
    };
  }

  function textCell(text, opts) {
    const o = opts || {};
    return {
      v: text == null ? '' : String(text), t: 's',
      s: {
        font: { sz: BODY_FONT_SIZE, bold: !!o.bold },
        fill: o.fill ? { patternType: 'solid', fgColor: { rgb: o.fill } } : (o.zebra ? { patternType: 'solid', fgColor: { rgb: COLOR_ZEBRA } } : undefined),
        alignment: { horizontal: o.align || 'center', vertical: 'center', wrapText: !!o.wrap },
        border: thinBorder()
      }
    };
  }

  /* عدد (تعداد روز و…) */
  function numCell(value, opts) {
    const o = opts || {};
    return {
      v: value, t: 'n',
      s: {
        font: { sz: BODY_FONT_SIZE, bold: !!o.bold },
        fill: o.fill ? { patternType: 'solid', fgColor: { rgb: o.fill } } : (o.zebra ? { patternType: 'solid', fgColor: { rgb: COLOR_ZEBRA } } : undefined),
        alignment: { horizontal: 'center', vertical: 'center' },
        border: thinBorder()
      }
    };
  }

  /* ساعت روز (08:00) — عدد واقعی اکسل با فرمت hh:mm */
  function timeCell(timeStr, opts) {
    const o = opts || {};
    const m = C.parseTime(timeStr);
    if (m == null) return textCell('—', o);
    return {
      v: m / C.MINUTES_PER_DAY, t: 'n', z: TIME_FORMAT,
      s: {
        font: { sz: BODY_FONT_SIZE },
        fill: o.fill ? { patternType: 'solid', fgColor: { rgb: o.fill } } : (o.zebra ? { patternType: 'solid', fgColor: { rgb: COLOR_ZEBRA } } : undefined),
        alignment: { horizontal: 'center', vertical: 'center' },
        border: thinBorder()
      }
    };
  }

  /* مدت زمانی (ساعت:دقیقه) — عدد واقعی اکسل با فرمت [h]:mm
   * پشتیبانی از مقادیر بالای ۲۴ ساعت مثل 27:45 */
  function durationCell(minutes, opts) {
    const o = opts || {};
    return {
      v: (Number(minutes) || 0) / C.MINUTES_PER_DAY, t: 'n', z: DURATION_FORMAT,
      s: {
        font: { sz: BODY_FONT_SIZE, bold: !!o.bold },
        fill: o.fill ? { patternType: 'solid', fgColor: { rgb: o.fill } } : (o.zebra ? { patternType: 'solid', fgColor: { rgb: COLOR_ZEBRA } } : undefined),
        alignment: { horizontal: 'center', vertical: 'center' },
        border: thinBorder()
      }
    };
  }

  /* ساخت شیت از آرایه دو بعدیِ سلول‌های آماده */
  function sheetFromMatrix(matrix) {
    const ws = {};
    const range = { s: { r: 0, c: 0 }, e: { r: matrix.length - 1, c: 0 } };
    matrix.forEach(function (row, r) {
      if (row.length - 1 > range.e.c) range.e.c = row.length - 1;
      row.forEach(function (cell, c) {
        if (cell == null) return;
        const addr = XLSX.utils.encode_cell({ r: r, c: c });
        ws[addr] = cell;
      });
    });
    ws['!ref'] = XLSX.utils.encode_range(range);
    return ws;
  }

  /* =============================================================
   * پس‌پردازش فایل XLSX (ZIP)
   * تضمین rightToLeft در sheetView + درج pane فریز + AutoFilter
   * ============================================================= */
  const ZIP_LOCAL_SIG = 0x04034b50;

  function crc32(bytes) {
    if (!crc32.table) {
      const t = new Uint32Array(256);
      for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        t[n] = c >>> 0;
      }
      crc32.table = t;
    }
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) {
      crc = crc32.table[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  /* خواندن ورودی‌های STORED از یک ZIP استاندارد */
  function parseZip(buffer) {
    const u8 = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    const entries = [];
    let off = 0;
    while (off + 30 <= u8.length) {
      if (dv.getUint32(off, true) !== ZIP_LOCAL_SIG) break;
      const flags = dv.getUint16(off + 6, true);
      const method = dv.getUint16(off + 8, true);
      const crc = dv.getUint32(off + 14, true) >>> 0;
      const compSize = dv.getUint32(off + 18, true);
      const nameLen = dv.getUint16(off + 26, true);
      const extraLen = dv.getUint16(off + 28, true);
      const name = new TextDecoder().decode(u8.subarray(off + 30, off + 30 + nameLen));
      const dataStart = off + 30 + nameLen + extraLen;
      entries.push({
        name: name,
        data: u8.subarray(dataStart, dataStart + compSize),
        method: method,
        crc: crc,
        flags: flags & ~0x08 /* حذف بیت Data Descriptor */
      });
      off = dataStart + compSize;
    }
    if (!entries.length) throw new Error('ZIP parse failed');
    return entries;
  }

  /* ساخت ZIP جدید با ورودی‌های STORED */
  function buildZip(entries) {
    const enc = new TextEncoder();
    const parts = [];
    const central = [];
    let offset = 0;
    const DOS_TIME = 0;
    const DOS_DATE = 0x21;

    entries.forEach(function (e) {
      const nameBytes = enc.encode(e.name);
      const data = e.data;
      const crc = (e.crc != null && !e.modified) ? e.crc : crc32(data);
      const flags = e.flags != null ? e.flags : 0;

      const local = new Uint8Array(30 + nameBytes.length);
      const lv = new DataView(local.buffer);
      lv.setUint32(0, ZIP_LOCAL_SIG, true);
      lv.setUint16(4, 20, true);
      lv.setUint16(6, flags, true);
      lv.setUint16(8, 0, true); /* STORED */
      lv.setUint16(10, DOS_TIME, true);
      lv.setUint16(12, DOS_DATE, true);
      lv.setUint32(14, crc, true);
      lv.setUint32(18, data.length, true);
      lv.setUint32(22, data.length, true);
      lv.setUint16(26, nameBytes.length, true);
      lv.setUint16(28, 0, true);
      local.set(nameBytes, 30);
      parts.push(local, data);

      const cen = new Uint8Array(46 + nameBytes.length);
      const cv = new DataView(cen.buffer);
      cv.setUint32(0, 0x02014b50, true);
      cv.setUint16(4, 20, true);
      cv.setUint16(6, 20, true);
      cv.setUint16(8, flags, true);
      cv.setUint16(10, 0, true);
      cv.setUint16(12, DOS_TIME, true);
      cv.setUint16(14, DOS_DATE, true);
      cv.setUint32(16, crc, true);
      cv.setUint32(20, data.length, true);
      cv.setUint32(24, data.length, true);
      cv.setUint16(28, nameBytes.length, true);
      cv.setUint32(42, offset, true);
      cen.set(nameBytes, 46);
      central.push(cen);

      offset += local.length + data.length;
    });

    const centralSize = central.reduce(function (s, c) { return s + c.length; }, 0);
    const eocd = new Uint8Array(22);
    const ev = new DataView(eocd.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(8, entries.length, true);
    ev.setUint16(10, entries.length, true);
    ev.setUint32(12, centralSize, true);
    ev.setUint32(16, offset, true);

    const out = new Uint8Array(offset + centralSize + 22);
    let pos = 0;
    parts.concat(central, [eocd]).forEach(function (p) {
      out.set(p, pos);
      pos += p.length;
    });
    return out;
  }

  /* وصله XML یک شیت: rightToLeft + Pane فریز + AutoFilter */
  function patchSheetXml(xml, opts) {
    /* ۱) راست‌به‌چپ کردن sheetView */
    if (!/<sheetView[^>]*\brightToLeft=/.test(xml)) {
      xml = xml.replace(/<sheetView\b/, '<sheetView rightToLeft="1"');
    }
    /* ۲) درج Pane فریز */
    if (opts.freezeRows > 0) {
      const topLeft = 'A' + (opts.freezeRows + 1);
      const pane = '<pane ySplit="' + opts.freezeRows + '" topLeftCell="' + topLeft + '" activePane="bottomLeft" state="frozen"/>'
        + '<selection pane="bottomLeft" activeCell="' + topLeft + '" sqref="' + topLeft + '"/>';
      const selfClosing = /<sheetView\b([^>]*)\/>/.exec(xml);
      if (selfClosing) {
        xml = xml.replace(/<sheetView\b([^>]*)\/>/, '<sheetView$1>' + pane + '</sheetView>');
      } else if (/<sheetView\b[^>]*>/.test(xml) && xml.indexOf('<pane ') === -1) {
        xml = xml.replace(/(<sheetView\b[^>]*>)/, '$1' + pane);
      }
    }
    /* ۳) AutoFilter در صورت نبود */
    if (opts.autoFilter && xml.indexOf('<autoFilter ') === -1) {
      xml = xml.replace('</sheetData>', '</sheetData><autoFilter ref="' + opts.autoFilter + '"/>');
    }
    return xml;
  }

  /* اعمال وصله‌ها روی کل ورک‌بوک:
   * راست‌به‌چپ بودن هر شیت از طریق sheetView@rightToLeft اعمال می‌شود
   * (استاندارد ECMA-376؛ workbookView چنین اتریبیوتی ندارد) */
  function patchWorkbook(buffer, sheetPatches) {
    const entries = parseZip(buffer);
    const enc = new TextEncoder();
    entries.forEach(function (e) {
      const m = /^xl\/worksheets\/sheet(\d+)\.xml$/.exec(e.name);
      if (!m) return;
      const patch = sheetPatches[+m[1] - 1];
      if (!patch) return;
      let xml = new TextDecoder().decode(e.data);
      xml = patchSheetXml(xml, patch);
      e.data = enc.encode(xml);
      e.method = 0;
      e.crc = null; /* محاسبه مجدد */
      e.modified = true;
    });
    return buildZip(entries);
  }

  /* =============================================================
   * ساخت داده شیت‌ها
   * ============================================================= */
  function periodLabel(jy, jm) {
    return jm ? (J.monthName(jm) + ' ' + U.toFa(jy)) : ('سال ' + U.toFa(jy));
  }

  /* تاریخ با ارقام لاتین مثل فرم اصلی: 1405/05/01 */
  function latinDate(ctx) {
    return ctx.jy + '/' + U.pad2(ctx.jm) + '/' + U.pad2(ctx.jd);
  }

  /* متن ستون توضیحات شیت ۱ — مثل فرم اصلی:
   * برچسب وضعیت (مرخصی/تعطیل) + محل کارکرد + یادداشت */
  function sheet1NotesText(rec, status) {
    const parts = [];
    if (status === 'leave') parts.push('مرخصی');
    else if (status === 'holiday') parts.push('تعطیل');
    if (rec && rec.workLocation) parts.push(rec.workLocation);
    if (rec && rec.notes) parts.push(rec.notes);
    return parts.join('، ');
  }

  /* ساعت ورود و خروج در یک سلول مثل فرم اصلی: "08:00  16:30" */
  function sheet1TimesCell(rec, calc, styleOpts) {
    if (!calc.hasTimes) return textCell('', styleOpts);
    return textCell(rec.startTime + '  ' + rec.endTime, Object.assign({}, styleOpts, { align: 'center' }));
  }

  /* استایل ردیف روز: روزهای تعطیل (جمعه‌ها و تعطیل رسمی) هایلایت زرد می‌گیرند
   * و در غیر این صورت ردیف‌های یک‌درمیان (zebra) می‌مانند */
  function rowStyle(calc, zebra) {
    return calc && calc.status === 'holiday'
      ? { fill: COLOR_HOLIDAY_BG }
      : { zebra: zebra };
  }

  /* شیت ۱: دقیقاً مطابق فرم Excel اصلی
   * سطر ۱: تاریخ شروع/پایان — سطر ۲: هدر — تاریخ | ساعت ورود و خروج | ماموریت | آنکال | توضیحات */
  function buildSheet1(jy, jm) {
    const summary = C.summarizeMonth(jy, jm, App.data.records, App.data.settings, App.state.today);
    const matrix = [];

    const firstCtx = summary.days.length ? summary.days[0].ctx : { jy: jy, jm: jm, jd: 1 };
    const lastCtx = summary.days.length ? summary.days[summary.days.length - 1].ctx : firstCtx;
    const title = 'تاریخ شروع : ' + latinDate(firstCtx) + '     تاریخ پایان : ' + latinDate(lastCtx);
    matrix.push([titleCell(title), titleCell(''), titleCell(''), titleCell(''), titleCell('')]);
    matrix.push([
      headerCell('تاریخ'), headerCell('ساعت ورود و خروج'), headerCell('ماموریت'),
      headerCell('آنکال'), headerCell('توضیحات')
    ]);

    summary.days.forEach(function (day, i) {
      const rec = day.rec;
      const calc = day.calc;
      const zebra = i % 2 === 1;
      const opts = rowStyle(calc, zebra);

      matrix.push([
        textCell(latinDate(day.ctx), opts),
        sheet1TimesCell(rec, calc, opts),
        textCell(rec ? (rec.mission ? 'بله' : 'خیر') : '', opts),
        textCell(rec ? (rec.onCall ? 'بله' : 'خیر') : '', opts),
        textCell(rec ? sheet1NotesText(rec, calc.status) : '', Object.assign({}, opts, { align: 'right', wrap: true }))
      ]);
    });

    const ws = sheetFromMatrix(matrix);
    ws['!cols'] = COLS_SHEET1;
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }];
    ws['!rows'] = [{ hpx: 28 }, { hpx: 22 }];
    const lastRow = matrix.length; /* شامل ردیف عنوان و هدر */
    ws['!autofilter'] = { ref: 'A2:E' + lastRow };
    return ws;
  }

  /* شیت ۲: محاسبات — فقط روزهای دارای ثبت */
  function buildSheet2(jy, jm) {
    const summary = C.summarizeMonth(jy, jm, App.data.records, App.data.settings, App.state.today);
    const matrix = [];

    matrix.push([
      headerCell('تاریخ'), headerCell('ورود'), headerCell('خروج'), headerCell('کارکرد'),
      headerCell('موظفی'), headerCell('اضافه‌کاری'), headerCell('مأموریت'), headerCell('آنکال'),
      headerCell('محل کارکرد'), headerCell('وضعیت'), headerCell('توضیحات')
    ]);

    let i = 0;
    summary.days.forEach(function (day) {
      const rec = day.rec;
      const calc = day.calc;
      if (!rec) return;
      const zebra = i % 2 === 1;
      const opts = rowStyle(calc, zebra);
      matrix.push([
        textCell(latinDate(day.ctx), opts),
        timeCell(rec.startTime, opts),
        timeCell(rec.endTime, opts),
        durationCell(calc.worked, opts),
        durationCell(calc.duty, opts),
        durationCell(calc.overtime, Object.assign({}, opts, { bold: calc.overtime > 0 })),
        textCell(rec.mission ? (rec.missionLocation ? 'بله — ' + rec.missionLocation : 'بله') : 'خیر', opts),
        textCell(rec.onCall ? 'بله' : 'خیر', opts),
        textCell(rec.workLocation || '', Object.assign({}, opts, { align: 'right', wrap: true })),
        textCell(C.STATUS_LABELS[calc.status], opts),
        textCell(rec.notes, Object.assign({}, opts, { align: 'right', wrap: true }))
      ]);
      i++;
    });

    /* ردیف جمع */
    const t = summary.totals;
    matrix.push([
      textCell('جمع ' + periodLabel(jy, jm), { bold: true, fill: COLOR_TOTAL_BG }),
      textCell('', { fill: COLOR_TOTAL_BG }),
      textCell('', { fill: COLOR_TOTAL_BG }),
      durationCell(t.worked, { bold: true, fill: COLOR_TOTAL_BG }),
      durationCell(t.duty, { bold: true, fill: COLOR_TOTAL_BG }),
      durationCell(t.overtime, { bold: true, fill: COLOR_TOTAL_BG }),
      textCell(U.toFa(t.missionDays) + ' روز', { bold: true, fill: COLOR_TOTAL_BG }),
      textCell(U.toFa(t.onCallDays) + ' روز', { bold: true, fill: COLOR_TOTAL_BG }),
      textCell('', { fill: COLOR_TOTAL_BG }),
      textCell('', { fill: COLOR_TOTAL_BG }),
      textCell('', { fill: COLOR_TOTAL_BG })
    ]);

    const ws = sheetFromMatrix(matrix);
    ws['!cols'] = COLS_SHEET2;
    ws['!rows'] = [{ hpx: 24 }];
    const lastRow = matrix.length;
    ws['!autofilter'] = { ref: 'A1:K' + lastRow };
    return ws;
  }

  /* شیت ۳: خلاصه — برای ماه مشخص یا کل سال (jm=null) */
  function buildSheet3(jy, jm) {
    const s = App.data.settings;
    let t;
    let daysCount;
    let yearSummary = null;
    if (jm) {
      const summary = C.summarizeMonth(jy, jm, App.data.records, App.data.settings, App.state.today);
      t = summary.totals;
      daysCount = summary.days.length;
    } else {
      yearSummary = C.summarizeYear(jy, App.data.records, App.data.settings, App.state.today);
      t = yearSummary.totals;
      daysCount = yearSummary.months.reduce(function (sum, m) { return sum + m.days.length; }, 0);
    }
    const matrix = [];

    matrix.push([titleCell('خلاصه گزارش — ' + periodLabel(jy, jm)), titleCell('')]);

    const rows = [
      ['تعداد روزهای دوره', U.toFa(daysCount) + ' روز'],
      ['روزهای کاری (ثبت‌شده)', U.toFa(t.workDays) + ' روز'],
      ['کل ساعات کارکرد', null, t.worked],
      ['کل ساعات موظفی', null, t.duty],
      ['مجموع اضافه‌کاری', null, t.overtime],
      ['تعداد روزهای مأموریت', U.toFa(t.missionDays) + ' روز'],
      ['مجموع ساعت مأموریت', null, t.missionMinutes],
      ['تعداد آنکال', U.toFa(t.onCallDays) + ' روز'],
      ['تعداد مرخصی', U.toFa(t.leaveDays) + ' روز'],
      ['تعداد تعطیل', U.toFa(t.holidayDays) + ' روز'],
      ['تعداد روزهای بدون ثبت', U.toFa(t.unrecordedDays) + ' روز'],
      ['موظفی روزانه (تنظیمات)', null, s.dutyMinutes],
      ['ساعات استاندارد', U.toFa(s.standardStart) + ' تا ' + U.toFa(s.standardEnd)],
      ['شیوه محاسبه اضافه‌کاری', s.overtime.method === 'afterEnd' ? 'فقط پس از پایان ساعت استاندارد' : 'کارکرد منهای موظفی']
    ];

    rows.forEach(function (row, i) {
      const zebra = i % 2 === 1;
      if (row[2] !== undefined) {
        matrix.push([
          textCell(row[0], { zebra: zebra, align: 'right', bold: true }),
          durationCell(row[2], { zebra: zebra, bold: true })
        ]);
      } else {
        matrix.push([
          textCell(row[0], { zebra: zebra, align: 'right', bold: true }),
          textCell(row[1], { zebra: zebra })
        ]);
      }
    });

    /* برای خروجی سالانه: جدول ماهانه اضافه می‌شود */
    if (!jm) {
      matrix.push([headerCell('ماه'), headerCell('کارکرد'), headerCell('موظفی'), headerCell('اضافه‌کاری')]);
      yearSummary.months.forEach(function (m, i) {
        const zebra = i % 2 === 1;
        matrix.push([
          textCell(J.monthName(m.jm), { zebra: zebra }),
          durationCell(m.totals.worked, { zebra: zebra }),
          durationCell(m.totals.duty, { zebra: zebra }),
          durationCell(m.totals.overtime, { zebra: zebra })
        ]);
      });
      matrix.push([
        textCell('جمع سال', { bold: true, fill: COLOR_TOTAL_BG }),
        durationCell(yearSummary.totals.worked, { bold: true, fill: COLOR_TOTAL_BG }),
        durationCell(yearSummary.totals.duty, { bold: true, fill: COLOR_TOTAL_BG }),
        durationCell(yearSummary.totals.overtime, { bold: true, fill: COLOR_TOTAL_BG })
      ]);
    }

    const ws = sheetFromMatrix(matrix);
    ws['!cols'] = jm ? COLS_SHEET3 : [{ wch: 30 }, { wch: 18 }, { wch: 18 }, { wch: 18 }];
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }];
    ws['!rows'] = [{ hpx: 30 }];
    return ws;
  }

  /* در اپ اندروید خروجی Excel تک‌برگ است: فقط «گزارش کارکرد» (ساعت کاری‌ها) */
  function compactForAndroid() {
    return !!(root.KarnamaAndroid && typeof root.KarnamaAndroid.saveFile === 'function');
  }

  /* =============================================================
   * ساخت کامل ورک‌بوک + دانلود
   * ============================================================= */
  function buildWorkbook(jy, jm) {
    if (typeof XLSX === 'undefined') {
      throw new Error('کتابخانه XLSX بارگذاری نشده است');
    }
    const wb = XLSX.utils.book_new();
    wb.Workbook = { Views: [{ RTL: true }] };

    const compact = compactForAndroid();

    const ws1 = buildSheet1(jy, jm);
    XLSX.utils.book_append_sheet(wb, ws1, SHEET1_NAME);
    if (!compact) {
      const ws2 = buildSheet2(jy, jm);
      const ws3 = buildSheet3(jy, jm);
      XLSX.utils.book_append_sheet(wb, ws2, SHEET2_NAME);
      XLSX.utils.book_append_sheet(wb, ws3, SHEET3_NAME);
    }

    const raw = XLSX.write(wb, { bookType: 'xlsx', type: 'array', compression: false });

    /* پس‌پردازش: شیت ۱ فریز ۲ ردیف، شیت ۲ فریز ۱ ردیف */
    const patched = patchWorkbook(raw, compact
      ? [{ freezeRows: 2, autoFilter: null }]
      : [
          { freezeRows: 2, autoFilter: null },
          { freezeRows: 1, autoFilter: null },
          { freezeRows: 0, autoFilter: null }
        ]);
    return patched;
  }

  /* برای خروجی سالانه، شیت‌ها بر اساس کل سال ساخته می‌شوند */
  function buildYearSheets(jy) {
    if (typeof XLSX === 'undefined') {
      throw new Error('کتابخانه XLSX بارگذاری نشده است');
    }
    const wb = XLSX.utils.book_new();
    wb.Workbook = { Views: [{ RTL: true }] };

    /* شیت ۱ سالانه: همه روزهای سال — با همان ساختار فرم اصلی */
    const compact = compactForAndroid();
    const year = C.summarizeYear(jy, App.data.records, App.data.settings, App.state.today);
    const matrix1 = [];
    const yearStart = { jy: jy, jm: 1, jd: 1 };
    const yearEnd = { jy: jy, jm: 12, jd: J.daysInMonth(jy, 12) };
    matrix1.push([titleCell('تاریخ شروع : ' + latinDate(yearStart) + '     تاریخ پایان : ' + latinDate(yearEnd)), titleCell(''), titleCell(''), titleCell(''), titleCell('')]);
    matrix1.push([headerCell('تاریخ'), headerCell('ساعت ورود و خروج'), headerCell('ماموریت'), headerCell('آنکال'), headerCell('توضیحات')]);
    let zebraIdx = 0;
    year.months.forEach(function (m) {
      m.days.forEach(function (day) {
        const rec = day.rec;
        const zebra = (zebraIdx++ % 2) === 1;
        const opts = rowStyle(day.calc, zebra);
        matrix1.push([
          textCell(latinDate(day.ctx), opts),
          sheet1TimesCell(rec, day.calc, opts),
          textCell(rec ? (rec.mission ? 'بله' : 'خیر') : '', opts),
          textCell(rec ? (rec.onCall ? 'بله' : 'خیر') : '', opts),
          textCell(rec ? sheet1NotesText(rec, day.calc.status) : '', Object.assign({}, opts, { align: 'right', wrap: true }))
        ]);
      });
    });
    const ws1 = sheetFromMatrix(matrix1);
    ws1['!cols'] = COLS_SHEET1;
    ws1['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }];
    ws1['!rows'] = [{ hpx: 28 }, { hpx: 22 }];
    ws1['!autofilter'] = { ref: 'A2:E' + matrix1.length };

    /* شیت ۲ و ۳ سالانه — فقط در خروجی کامل (روی کامپیوتر) */
    if (!compact) {
      /* شیت ۲ سالانه: همه روزهای دارای ثبت */
      const matrix2 = [[
        headerCell('تاریخ'), headerCell('ورود'), headerCell('خروج'), headerCell('کارکرد'),
        headerCell('موظفی'), headerCell('اضافه‌کاری'), headerCell('مأموریت'), headerCell('آنکال'),
        headerCell('محل کارکرد'), headerCell('وضعیت'), headerCell('توضیحات')
      ]];
      let idx2 = 0;
      year.months.forEach(function (m) {
        m.days.forEach(function (day) {
          const rec = day.rec;
          if (!rec) return;
          const calc = day.calc;
          const zebra = (idx2++ % 2) === 1;
          const opts = rowStyle(calc, zebra);
          matrix2.push([
            textCell(latinDate(day.ctx), opts),
            timeCell(rec.startTime, opts),
            timeCell(rec.endTime, opts),
            durationCell(calc.worked, opts),
            durationCell(calc.duty, opts),
            durationCell(calc.overtime, Object.assign({}, opts, { bold: calc.overtime > 0 })),
            textCell(rec.mission ? (rec.missionLocation ? 'بله — ' + rec.missionLocation : 'بله') : 'خیر', opts),
            textCell(rec.onCall ? 'بله' : 'خیر', opts),
            textCell(rec.workLocation || '', Object.assign({}, opts, { align: 'right', wrap: true })),
            textCell(C.STATUS_LABELS[calc.status], opts),
            textCell(rec.notes, Object.assign({}, opts, { align: 'right', wrap: true }))
          ]);
        });
      });
      const t = year.totals;
      matrix2.push([
        textCell('جمع سال ' + U.toFa(jy), { bold: true, fill: COLOR_TOTAL_BG }),
        textCell('', { fill: COLOR_TOTAL_BG }), textCell('', { fill: COLOR_TOTAL_BG }),
        durationCell(t.worked, { bold: true, fill: COLOR_TOTAL_BG }),
        durationCell(t.duty, { bold: true, fill: COLOR_TOTAL_BG }),
        durationCell(t.overtime, { bold: true, fill: COLOR_TOTAL_BG }),
        textCell(U.toFa(t.missionDays) + ' روز', { bold: true, fill: COLOR_TOTAL_BG }),
        textCell(U.toFa(t.onCallDays) + ' روز', { bold: true, fill: COLOR_TOTAL_BG }),
        textCell('', { fill: COLOR_TOTAL_BG }),
        textCell('', { fill: COLOR_TOTAL_BG }),
        textCell('', { fill: COLOR_TOTAL_BG })
      ]);
      const ws2 = sheetFromMatrix(matrix2);
      ws2['!cols'] = COLS_SHEET2;
      ws2['!rows'] = [{ hpx: 24 }];
      ws2['!autofilter'] = { ref: 'A1:K' + matrix2.length };

      /* شیت ۳ سالانه (با جدول ماهانه) */
      const ws3 = buildSheet3(jy, null);

      XLSX.utils.book_append_sheet(wb, ws2, SHEET2_NAME);
      XLSX.utils.book_append_sheet(wb, ws3, SHEET3_NAME);
    }

    XLSX.utils.book_append_sheet(wb, ws1, SHEET1_NAME);

    const raw = XLSX.write(wb, { bookType: 'xlsx', type: 'array', compression: false });
    return patchWorkbook(raw, compact
      ? [{ freezeRows: 2, autoFilter: null }]
      : [
          { freezeRows: 2, autoFilter: null },
          { freezeRows: 1, autoFilter: null },
          { freezeRows: 0, autoFilter: null }
        ]);
  }

  /* =============================================================
   * API عمومی
   * ============================================================= */
  App.excel = {
    exportMonth: function (jy, jm) {
      try {
        const u8 = buildWorkbook(jy, jm);
        const blob = new Blob([u8], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const name = 'karnama-report-' + jy + '-' + U.pad2(jm) + '.xlsx';
        App.download(blob, name);
        App.ui.toast('فایل Excel «' + name + '» ساخته شد', 'success');
      } catch (e) {
        App.ui.toast('خطا در ساخت فایل Excel: ' + (e && e.message ? e.message : ''), 'error');
      }
    },
    exportYear: function (jy) {
      try {
        const u8 = buildYearSheets(jy);
        const blob = new Blob([u8], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const name = 'karnama-report-' + jy + '.xlsx';
        App.download(blob, name);
        App.ui.toast('فایل Excel «' + name + '» ساخته شد', 'success');
      } catch (e) {
        App.ui.toast('خطا در ساخت فایل Excel: ' + (e && e.message ? e.message : ''), 'error');
      }
    }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = App;
})(typeof window !== 'undefined' ? window : globalThis);
