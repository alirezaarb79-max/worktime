/* =============================================================
 * کارنما — ماژول پایگاه داده (IndexedDB)
 * لایه‌بندی پایدار: IndexedDB → localStorage → حافظه موقت
 * تا برنامه در هیچ محیطی از کار نیفتد.
 * ============================================================= */
(function (root) {
  'use strict';

  const App = root.App = root.App || {};

  /* ---------- ثابت‌ها ---------- */
  const DB_NAME = 'karnama-db';
  const DB_VERSION = 1;
  const STORE_RECORDS = 'records';   /* keyPath: dateKey */
  const STORE_SETTINGS = 'settings'; /* keyPath: key */
  const SETTINGS_KEY = 'app';
  const LS_RECORDS_KEY = 'karnama:records';
  const LS_SETTINGS_KEY = 'karnama:settings';
  const LS_TEST_KEY = 'karnama:probe';

  /* ---------- ابزار Promise برای IndexedDB ---------- */
  function reqAsPromise(request) {
    return new Promise(function (resolve, reject) {
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(request.error); };
    });
  }

  function openIndexedDB() {
    return new Promise(function (resolve, reject) {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB unavailable'));
        return;
      }
      let request;
      try {
        request = indexedDB.open(DB_NAME, DB_VERSION);
      } catch (e) {
        reject(e);
        return;
      }
      request.onupgradeneeded = function (event) {
        const idb = event.target.result;
        if (!idb.objectStoreNames.contains(STORE_RECORDS)) {
          idb.createObjectStore(STORE_RECORDS, { keyPath: 'dateKey' });
        }
        if (!idb.objectStoreNames.contains(STORE_SETTINGS)) {
          idb.createObjectStore(STORE_SETTINGS, { keyPath: 'key' });
        }
      };
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(request.error); };
      request.onblocked = function () { reject(new Error('IndexedDB blocked')); };
    });
  }

  function withIdbStore(idb, storeName, mode, executor) {
    return new Promise(function (resolve, reject) {
      let tx;
      try {
        tx = idb.transaction(storeName, mode);
      } catch (e) {
        reject(e);
        return;
      }
      let result;
      Promise.resolve(executor(tx.objectStore(storeName)))
        .then(function (r) { result = r; }, reject);
      tx.oncomplete = function () { resolve(result); };
      tx.onerror = function () { reject(tx.error); };
      tx.onabort = function () { reject(tx.error || new Error('Transaction aborted')); };
    });
  }

  /* ---------- آداپتورها ---------- */

  function createIdbAdapter(idb) {
    return {
      kind: 'idb',
      label: 'IndexedDB (پایدار)',
      getAllRecords: function () {
        return withIdbStore(idb, STORE_RECORDS, 'readonly', function (st) {
          return reqAsPromise(st.getAll());
        });
      },
      getRecord: function (key) {
        return withIdbStore(idb, STORE_RECORDS, 'readonly', function (st) {
          return reqAsPromise(st.get(key));
        });
      },
      putRecord: function (record) {
        return withIdbStore(idb, STORE_RECORDS, 'readwrite', function (st) {
          return reqAsPromise(st.put(record));
        });
      },
      putRecords: function (records) {
        return withIdbStore(idb, STORE_RECORDS, 'readwrite', function (st) {
          records.forEach(function (r) { st.put(r); });
        });
      },
      deleteRecord: function (key) {
        return withIdbStore(idb, STORE_RECORDS, 'readwrite', function (st) {
          return reqAsPromise(st.delete(key));
        });
      },
      clearRecords: function () {
        return withIdbStore(idb, STORE_RECORDS, 'readwrite', function (st) {
          return reqAsPromise(st.clear());
        });
      },
      getSettings: function () {
        return withIdbStore(idb, STORE_SETTINGS, 'readonly', function (st) {
          return reqAsPromise(st.get(SETTINGS_KEY));
        }).then(function (row) { return row ? row.value : null; });
      },
      putSettings: function (value) {
        return withIdbStore(idb, STORE_SETTINGS, 'readwrite', function (st) {
          return reqAsPromise(st.put({ key: SETTINGS_KEY, value: value }));
        });
      },
      clearSettings: function () {
        return withIdbStore(idb, STORE_SETTINGS, 'readwrite', function (st) {
          return reqAsPromise(st.clear());
        });
      }
    };
  }

  function localStorageAvailable() {
    try {
      const ls = root.localStorage;
      if (!ls) return false;
      ls.setItem(LS_TEST_KEY, '1');
      ls.removeItem(LS_TEST_KEY);
      return true;
    } catch (e) {
      return false;
    }
  }

  function readLocalJson(key, fallback) {
    try {
      const raw = root.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function writeLocalJson(key, value) {
    root.localStorage.setItem(key, JSON.stringify(value));
  }

  function createLocalAdapter() {
    return {
      kind: 'local',
      label: 'localStorage (پایدار)',
      getAllRecords: function () {
        const rows = readLocalJson(LS_RECORDS_KEY, []);
        return Promise.resolve(Array.isArray(rows) ? rows.slice() : []);
      },
      getRecord: function (key) {
        const rows = readLocalJson(LS_RECORDS_KEY, []);
        return Promise.resolve(rows.find(function (r) { return r.dateKey === key; }) || null);
      },
      putRecord: function (record) {
        const rows = readLocalJson(LS_RECORDS_KEY, []);
        const i = rows.findIndex(function (r) { return r.dateKey === record.dateKey; });
        if (i >= 0) rows[i] = record; else rows.push(record);
        writeLocalJson(LS_RECORDS_KEY, rows);
        return Promise.resolve(record.dateKey);
      },
      putRecords: function (records) {
        const rows = readLocalJson(LS_RECORDS_KEY, []);
        const map = new Map(rows.map(function (r) { return [r.dateKey, r]; }));
        records.forEach(function (r) { map.set(r.dateKey, r); });
        writeLocalJson(LS_RECORDS_KEY, Array.from(map.values()));
        return Promise.resolve();
      },
      deleteRecord: function (key) {
        const rows = readLocalJson(LS_RECORDS_KEY, []);
        writeLocalJson(LS_RECORDS_KEY, rows.filter(function (r) { return r.dateKey !== key; }));
        return Promise.resolve();
      },
      clearRecords: function () {
        root.localStorage.removeItem(LS_RECORDS_KEY);
        return Promise.resolve();
      },
      getSettings: function () {
        return Promise.resolve(readLocalJson(LS_SETTINGS_KEY, null));
      },
      putSettings: function (value) {
        writeLocalJson(LS_SETTINGS_KEY, value);
        return Promise.resolve();
      },
      clearSettings: function () {
        root.localStorage.removeItem(LS_SETTINGS_KEY);
        return Promise.resolve();
      }
    };
  }

  function createMemoryAdapter() {
    const records = new Map();
    let settings = null;
    return {
      kind: 'memory',
      label: 'حافظه موقت (ناپایدار)',
      getAllRecords: function () { return Promise.resolve(Array.from(records.values())); },
      getRecord: function (key) { return Promise.resolve(records.get(key) || null); },
      putRecord: function (record) {
        records.set(record.dateKey, record);
        return Promise.resolve(record.dateKey);
      },
      putRecords: function (list) {
        list.forEach(function (r) { records.set(r.dateKey, r); });
        return Promise.resolve();
      },
      deleteRecord: function (key) {
        records.delete(key);
        return Promise.resolve();
      },
      clearRecords: function () {
        records.clear();
        return Promise.resolve();
      },
      getSettings: function () { return Promise.resolve(settings); },
      putSettings: function (value) {
        settings = value;
        return Promise.resolve();
      },
      clearSettings: function () {
        settings = null;
        return Promise.resolve();
      }
    };
  }

  /* ---------- نمونه اصلی ---------- */
  let adapter = null;

  const db = {
    get kind() { return adapter ? adapter.kind : null; },
    get label() { return adapter ? adapter.label : ''; },

    /* انتخاب بهترین لایه ذخیره‌سازی در دسترس */
    init: function () {
      return openIndexedDB()
        .then(function (idb) {
          adapter = createIdbAdapter(idb);
          return adapter.kind;
        })
        .catch(function () {
          if (localStorageAvailable()) {
            adapter = createLocalAdapter();
          } else {
            adapter = createMemoryAdapter();
          }
          return adapter.kind;
        });
    },

    getAllRecords: function () { return adapter.getAllRecords(); },
    getRecord: function (key) { return adapter.getRecord(key); },
    putRecord: function (record) { return adapter.putRecord(record); },
    putRecords: function (records) { return adapter.putRecords(records); },
    deleteRecord: function (key) { return adapter.deleteRecord(key); },
    clearRecords: function () { return adapter.clearRecords(); },
    getSettings: function () { return adapter.getSettings(); },
    putSettings: function (value) { return adapter.putSettings(value); },
    clearSettings: function () { return adapter.clearSettings(); },

    /* جایگزینی کامل داده‌ها (برای Restore) */
    replaceAll: function (records, settings) {
      let chain = adapter.clearRecords();
      if (settings !== undefined && settings !== null) {
        chain = chain.then(function () { return adapter.clearSettings(); });
      }
      if (records && records.length) {
        chain = chain.then(function () { return adapter.putRecords(records); });
      }
      if (settings !== undefined && settings !== null) {
        chain = chain.then(function () { return adapter.putSettings(settings); });
      }
      return chain;
    }
  };

  App.db = db;

  if (typeof module !== 'undefined' && module.exports) module.exports = App;
})(typeof window !== 'undefined' ? window : globalThis);
