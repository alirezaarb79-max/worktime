/* =============================================================
 * کارنما — پلی‌فیل‌های سازگاری برای مرورگرهای/WebViewهای قدیمی‌تر
 * قبل از همه اسکریپت‌های دیگر بارگذاری می‌شود.
 * هر تعریف فقط وقتی انجام می‌شود که مرورگر آن را نداشته باشد.
 * ============================================================= */
(function (root) {
  'use strict';

  /* String.prototype.replaceAll — Chromium 85+ */
  if (typeof String.prototype.replaceAll !== 'function') {
    String.prototype.replaceAll = function (search, replacement) {
      if (search instanceof RegExp) {
        if (!search.global) {
          throw new TypeError('replaceAll با regex باید پرچم g داشته باشد');
        }
        return this.replace(search, replacement);
      }
      var s = String(search);
      if (s === '') return this;
      return this.split(s).join(String(replacement));
    };
  }

  /* Array.prototype.at — Chromium 92+ */
  if (typeof Array.prototype.at !== 'function') {
    Array.prototype.at = function (idx) {
      var n = Math.trunc(Number(idx) || 0);
      if (n < 0) n += this.length;
      if (n < 0 || n >= this.length) return undefined;
      return this[n];
    };
  }

  /* Promise.prototype.finally — Chromium 63+ */
  if (root.Promise && typeof root.Promise.prototype.finally !== 'function') {
    root.Promise.prototype.finally = function (cb) {
      return this.then(
        function (v) { return root.Promise.resolve(cb()).then(function () { return v; }); },
        function (e) { return root.Promise.resolve(cb()).then(function () { throw e; }); }
      );
    };
  }

  /* Object.hasOwn — Chromium 93+ */
  if (typeof Object.hasOwn !== 'function') {
    Object.hasOwn = function (obj, key) {
      return Object.prototype.hasOwnProperty.call(obj, key);
    };
  }
})(typeof window !== 'undefined' ? window : this);
