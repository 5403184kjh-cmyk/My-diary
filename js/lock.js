/* =========================================================
   lock.js — 일기 잠금 (4자리 PIN + 지문/생체인증)
   · PIN 확인은 store.js에 해시로 저장합니다.
   · 지문은 WebAuthn(platform authenticator)으로 등록·확인합니다.
   · 이 잠금은 화면을 가리는 잠금이라, 기기에 저장된 일기 자체를
     암호화하지는 않습니다.
   ========================================================= */
window.DiaryLock = (function () {
  'use strict';

  const AUTO_LOCK_MS = 3 * 60 * 1000; // 다른 앱에 다녀온 시간이 3분을 넘으면 다시 잠급니다.

  let unlocked = false;   // 이번에 앱을 연 동안 풀어 둔 상태
  let hiddenAt = 0;
  let busy = false;

  function cfg() { return Store.diaryLock(); }
  function enabled() { return Store.lockReady(); }
  function isLocked() { return enabled() && !unlocked; }
  function unlock() { unlocked = true; }
  function lock() { unlocked = false; }

  function hasFingerprint() {
    const c = cfg();
    return !!(c.enabled && c.webauthn && c.webauthn.id);
  }

  /* ---------- WebAuthn 도우미 ---------- */
  function supported() {
    return !!(window.PublicKeyCredential && navigator.credentials &&
      typeof navigator.credentials.create === 'function' &&
      typeof navigator.credentials.get === 'function');
  }

  function platformAvailable() {
    return new Promise(function (resolve) {
      if (!supported() || typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable !== 'function') {
        resolve(false);
        return;
      }
      PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
        .then(function (ok) { resolve(!!ok); })
        .catch(function () { resolve(false); });
    });
  }

  function b64url(buf) {
    const bytes = new Uint8Array(buf);
    let s = '';
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function unb64url(str) {
    const s = String(str).replace(/-/g, '+').replace(/_/g, '/');
    const pad = s.length % 4 ? '='.repeat(4 - (s.length % 4)) : '';
    const bin = atob(s + pad);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  function randomBytes(n) {
    const a = new Uint8Array(n);
    if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(a);
    else for (let i = 0; i < n; i++) a[i] = Math.floor(Math.random() * 256);
    return a;
  }

  function reasonOf(err) {
    const name = err && err.name ? err.name : '';
    if (name === 'NotAllowedError') return '취소했거나 시간이 지났어요. PIN으로 열어 주세요.';
    if (name === 'InvalidStateError') return '이 기기에 이미 지문이 등록되어 있어요.';
    if (name === 'SecurityError') return '이 주소에서는 지문을 쓸 수 없어요(https 주소에서 열어 주세요).';
    if (name === 'NotSupportedError') return '이 기기에서는 지문 인증을 쓸 수 없어요.';
    return '지문 인증을 하지 못했어요. PIN으로 열어 주세요.';
  }

  /* 지문 등록 — 반드시 사용자가 누른 직후(같은 클릭 안에서) 호출하세요. */
  function registerFingerprint() {
    if (!supported()) {
      return Promise.resolve({ ok: false, message: '이 브라우저에서는 지문 인증을 쓸 수 없어요. PIN으로 여실 수 있어요.' });
    }
    const userHandle = randomBytes(16);
    return navigator.credentials.create({
      publicKey: {
        challenge: randomBytes(32),
        rp: { name: '나의 다이어리', id: location.hostname },
        user: { id: userHandle, name: 'diary-user', displayName: '나의 다이어리' },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
          residentKey: 'preferred'
        },
        timeout: 60000,
        attestation: 'none'
      }
    }).then(function (cred) {
      if (!cred || !cred.rawId) return { ok: false, message: '지문을 등록하지 못했어요.' };
      const id = b64url(cred.rawId);
      Store.setDiaryWebauthn({ id: id });
      return { ok: true, id: id };
    }).catch(function (err) {
      return { ok: false, message: reasonOf(err) };
    });
  }

  /* 지문으로 열기 */
  function unlockWithFingerprint() {
    const c = cfg();
    if (!c.webauthn || !c.webauthn.id) {
      return Promise.resolve({ ok: false, message: '등록된 지문이 없어요.' });
    }
    if (!supported()) {
      return Promise.resolve({ ok: false, message: '이 브라우저에서는 지문 인증을 쓸 수 없어요. PIN으로 열어 주세요.' });
    }
    if (busy) return Promise.resolve({ ok: false, message: '' });
    busy = true;
    return navigator.credentials.get({
      publicKey: {
        challenge: randomBytes(32),
        rpId: location.hostname,
        allowCredentials: [{ type: 'public-key', id: unb64url(c.webauthn.id) }],
        userVerification: 'required',
        timeout: 60000
      }
    }).then(function (assertion) {
      busy = false;
      if (!assertion) return { ok: false, message: '지문을 확인하지 못했어요. PIN으로 열어 주세요.' };
      unlocked = true;
      return { ok: true };
    }).catch(function (err) {
      busy = false;
      return { ok: false, message: reasonOf(err) };
    });
  }

  /* ---------- 앱을 떠나 있던 시간으로 다시 잠그기 ---------- */
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') {
      hiddenAt = Date.now();
      return;
    }
    if (hiddenAt && Date.now() - hiddenAt > AUTO_LOCK_MS) {
      unlocked = false;
      if (window.App && App.active === 'diary' && Tabs.diary && Tabs.diary.refresh) {
        try { Tabs.diary.refresh(); } catch (e) {}
      }
    }
    hiddenAt = 0;
  });

  return {
    enabled: enabled,
    isLocked: isLocked,
    unlock: unlock,
    lock: lock,
    hasFingerprint: hasFingerprint,
    supported: supported,
    platformAvailable: platformAvailable,
    registerFingerprint: registerFingerprint,
    unlockWithFingerprint: unlockWithFingerprint,
    AUTO_LOCK_MS: AUTO_LOCK_MS
  };
})();
