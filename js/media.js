/* =========================================================
   media.js — 일기 사진·동영상 보관소 (IndexedDB)
   · 사진/동영상 원본(Blob)은 IndexedDB('myDiaryMedia' → 'files')에 넣고,
     일기에는 가벼운 정보(id·종류·이름·형식·크기)만 남깁니다.
   · 영상은 localStorage(약 5MB)에 담을 수 없어서 IndexedDB를 씁니다.
   · 사진은 붙일 때 긴 변 1400px JPEG로 줄여 저장합니다.
   ========================================================= */
window.MediaStore = (function () {
  'use strict';

  const DB_NAME = 'myDiaryMedia';
  const DB_VERSION = 1;
  const STORE = 'files';

  const IMAGE_MAX = 1400;   // 사진 긴 변 최대(px)
  const IMAGE_QUALITY = 0.82;

  let dbPromise = null;

  function supported() {
    try { return !!window.indexedDB; } catch (e) { return false; }
  }

  /* ---------- 연결 ---------- */
  function openDB() {
    if (dbPromise) return dbPromise;

    const p = new Promise(function (resolve, reject) {
      if (!supported()) {
        reject(new Error('이 브라우저에서는 사진·동영상을 저장할 수 없어요'));
        return;
      }
      let req;
      try { req = indexedDB.open(DB_NAME, DB_VERSION); }
      catch (e) { reject(e); return; }

      req.onupgradeneeded = function () {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error || new Error('사진·동영상 보관함을 열지 못했어요')); };
      req.onblocked = function () { reject(new Error('보관함이 다른 창에서 쓰이고 있어요')); };
    });

    dbPromise = p;
    // 실패한 연결은 기억해 두지 않습니다(다음에 다시 시도).
    p.catch(function () { if (dbPromise === p) dbPromise = null; });
    return p;
  }

  function run(mode, work) {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        let tx;
        try { tx = db.transaction(STORE, mode); }
        catch (e) { reject(e); return; }
        const store = tx.objectStore(STORE);
        let req;
        try { req = work(store); }
        catch (e) { reject(e); return; }

        tx.oncomplete = function () { resolve(req ? req.result : undefined); };
        tx.onerror = function () { reject(tx.error || new Error('사진·동영상을 저장하지 못했어요')); };
        tx.onabort = function () { reject(tx.error || new Error('사진·동영상 저장이 취소됐어요')); };
      });
    });
  }

  /* ---------- 기본 API ---------- */
  function put(id, blob) {
    return new Promise(function (resolve, reject) {
      if (!id || !blob) { reject(new Error('저장할 파일이 없어요')); return; }
      run('readwrite', function (s) { return s.put(blob, String(id)); }).then(function () { resolve(String(id)); }, reject);
    });
  }

  function get(id) {
    return run('readonly', function (s) { return s.get(String(id)); }).then(function (blob) {
      return blob || null;
    });
  }

  function del(id) {
    return run('readwrite', function (s) { return s['delete'](String(id)); }).then(function () { return true; });
  }

  function delMany(ids) {
    const list = (ids || []).filter(Boolean).map(String);
    if (!list.length) return Promise.resolve(0);
    return run('readwrite', function (s) {
      list.forEach(function (id) { s['delete'](id); });
      return null;
    }).then(function () { return list.length; });
  }

  // 보관함에 남아 있는 모든 파일 id (사용하지 않는 파일 정리용)
  function keys() {
    return run('readonly', function (s) { return s.getAllKeys(); }).then(function (list) {
      return Array.prototype.slice.call(list || []);
    });
  }

  function clear() {
    return run('readwrite', function (s) { return s.clear(); }).then(function () { return true; });
  }

  /* ---------- 사진 줄이기 ---------- */
  function dataUrlToBlob(dataUrl) {
    try {
      const parts = String(dataUrl).split(',');
      const mime = (parts[0].match(/:(.*?);/) || [])[1] || 'image/jpeg';
      const bin = atob(parts[1] || '');
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      return new Blob([arr], { type: mime });
    } catch (e) {
      return null;
    }
  }

  /**
   * 사진 파일을 긴 변 maxSize 픽셀의 JPEG로 줄입니다.
   * 줄이지 못하면(예: 열 수 없는 형식) 원본을 그대로 돌려줍니다.
   * @returns Promise<{ blob: Blob, width: number, height: number }>
   */
  function compressImage(file, maxSize, quality) {
    const max = Math.max(320, Number(maxSize) || IMAGE_MAX);
    const q = Math.min(0.95, Math.max(0.4, Number(quality) || IMAGE_QUALITY));

    return new Promise(function (resolve) {
      const original = { blob: file, width: 0, height: 0 };
      let url = '';
      try { url = URL.createObjectURL(file); }
      catch (e) { resolve(original); return; }

      const img = new Image();
      let done = false;
      const finish = function (r) {
        if (done) return;
        done = true;
        try { URL.revokeObjectURL(url); } catch (e) {}
        resolve(r);
      };

      img.onload = function () {
        let w = img.naturalWidth || img.width;
        let h = img.naturalHeight || img.height;
        if (!w || !h) { finish(original); return; }

        const scale = Math.min(1, max / Math.max(w, h));
        w = Math.max(1, Math.round(w * scale));
        h = Math.max(1, Math.round(h * scale));

        let canvas = null;
        try {
          canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) { finish(original); return; }
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
        } catch (e) { finish(original); return; }

        const keep = function (blob) {
          if (!blob || !blob.size) { finish(original); return; }
          // 줄이지 않아도 더 가벼우면 바꿔 씁니다.
          if (scale < 1 || !file.size || blob.size < file.size) finish({ blob: blob, width: w, height: h });
          else finish(original);
        };

        if (canvas.toBlob) {
          canvas.toBlob(function (blob) { keep(blob); }, 'image/jpeg', q);
        } else {
          try { keep(dataUrlToBlob(canvas.toDataURL('image/jpeg', q))); }
          catch (e) { finish(original); }
        }
      };

      img.onerror = function () { finish(original); };
      img.src = url;
    });
  }

  /* ---------- 상태 ---------- */
  function usage() {
    try {
      if (navigator.storage && navigator.storage.estimate) {
        return navigator.storage.estimate().then(function (e) {
          return { used: e.usage || 0, quota: e.quota || 0 };
        });
      }
    } catch (e) {}
    return Promise.resolve({ used: 0, quota: 0 });
  }

  return {
    DB_NAME: DB_NAME,
    STORE: STORE,
    IMAGE_MAX: IMAGE_MAX,
    supported: supported,
    put: put,
    get: get,
    del: del,
    delMany: delMany,
    keys: keys,
    clear: clear,
    compressImage: compressImage,
    usage: usage
  };
})();
