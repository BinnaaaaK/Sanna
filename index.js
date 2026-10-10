
/* =========================================================
   SANNA OFFICIAL WEBSITE
   index.js - Main Page Authentication & Member Access

   Requirements:
   - index.html
   - auth-core.js
   - supabase-config.js (loaded before this module)
   - Supabase profiles + RLS (to be installed later)
   ========================================================= */

import {
  db,
  getVerifiedUser,
  getMyProfile,
  canReadArchive,
  isAdmin,
  explainError,
  page
} from './auth-core.js';

const $ = (id) => document.getElementById(id);

const viewer = {
  phase: 'loading', // loading | guest | onboarding | ready | error | unconfigured
  user: null,
  profile: null
};

let refreshSequence = 0;
let previousFocus = null;

/* =========================================================
   1. DOM helpers (no user-provided HTML insertion)
   ========================================================= */

function makeElement(tag, className, value) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (value !== undefined) element.textContent = String(value);
  return element;
}

function addLoginLink(label = 'LOGIN', destination = 'login.html') {
  const link = makeElement('a', 'login-btn', label);
  link.href = page(destination);
  $('auth-nav-item').replaceChildren(link);
}

function setPrivateNavigation(showAccount, showAdmin) {
  $('account-nav').hidden = !showAccount;
  $('admin-nav').hidden = !showAdmin;
}

function roleLabel(profile) {
  if (!profile) return '가입 미완료';
  if (isAdmin(profile)) return '관리자';
  if (canReadArchive(profile)) return '산나 정회원';

  switch (profile.membership_status) {
    case 'pending': return '승인 대기';
    case 'rejected': return '신청 거절';
    case 'revoked': return '권한 회수';
    case 'not_requested': return '일반 회원';
    default: return '회원 상태 확인 필요';
  }
}

function displayName(user, profile) {
  const name = profile?.display_name || user?.email || 'SANNA 회원';
  return String(name).slice(0, 36);
}

/* =========================================================
   2. Top-right account navigation
   ========================================================= */

function renderSignedOut() {
  setPrivateNavigation(false, false);
  addLoginLink();
}

function renderLoading() {
  setPrivateNavigation(false, false);
  const label = makeElement('span', 'account-name', '확인 중...');
  label.setAttribute('aria-live', 'polite');
  $('auth-nav-item').replaceChildren(label);
}

function renderSignedIn(user, profile, profileError = false) {
  setPrivateNavigation(Boolean(profile), Boolean(profile && isAdmin(profile)));

  const bar = makeElement('div', 'account-bar');
  const name = makeElement('span', 'account-name', displayName(user, profile));
  const badge = makeElement(
    'span',
    'role-label',
    profileError ? '회원정보 확인 실패' : roleLabel(profile)
  );

  const accountLink = makeElement(
    'a',
    'login-btn',
    profile ? 'MY ACCOUNT' : '가입 완료하기'
  );
  accountLink.href = page(profile ? 'account.html' : 'login.html');

  const logoutButton = makeElement('button', 'nav-small', 'LOGOUT');
  logoutButton.type = 'button';
  logoutButton.setAttribute('aria-label', '로그아웃');
  logoutButton.addEventListener('click', () => void handleLogout(logoutButton));

  bar.append(name, badge, accountLink, logoutButton);
  $('auth-nav-item').replaceChildren(bar);
}

/* =========================================================
   3. Verify user + fetch member profile from Supabase
   ========================================================= */

async function refreshViewer() {
  const sequence = ++refreshSequence;

  if (!db) {
    viewer.phase = 'unconfigured';
    viewer.user = null;
    viewer.profile = null;
    renderSignedOut();
    return;
  }

  viewer.phase = 'loading';
  renderLoading();

  try {
    // Do not trust legacy localStorage records such as sanna_current_user.
    const user = await getVerifiedUser();
    if (sequence !== refreshSequence) return;

    if (!user) {
      viewer.phase = 'guest';
      viewer.user = null;
      viewer.profile = null;
      renderSignedOut();
      return;
    }

    viewer.user = user;

    // No profile means OAuth/email authentication succeeded,
    // but SANNA onboarding has NOT been completed yet.
    const profile = await getMyProfile(user.id);
    if (sequence !== refreshSequence) return;

    viewer.phase = profile ? 'ready' : 'onboarding';
    viewer.user = user;
    viewer.profile = profile;
    renderSignedIn(user, profile);

  } catch (error) {
    if (sequence !== refreshSequence) return;

    // Fail closed: a temporary profile error must NEVER grant member access.
    viewer.phase = 'error';
    viewer.profile = null;
    renderSignedIn(viewer.user, null, true);
    console.error('SANNA 회원 상태 조회 실패:', error);
  }
}

/* =========================================================
   4. Member-only archive link gating
   ========================================================= */

function accessMessage() {
  if (viewer.phase === 'loading') {
    return {
      title: '회원정보 확인 중',
      message: '로그인 및 정회원 승인 상태를 확인하고 있습니다. 잠시 후 다시 시도해 주세요.',
      link: 'login.html',
      action: '로그인 페이지로 이동'
    };
  }

  if (viewer.phase === 'unconfigured' || viewer.phase === 'error') {
    return {
      title: '인증 확인 불가',
      message: '현재 회원 인증 서버 설정 또는 회원정보 조회에 문제가 있습니다. 설정을 확인한 뒤 다시 시도해 주세요.',
      link: 'login.html',
      action: '로그인 페이지로 이동'
    };
  }

  if (viewer.phase === 'guest') {
    return {
      title: '산나 정회원 전용 콘텐츠',
      message: '정기 공지는 로그인 후 관리자 승인을 받은 SANNA 정회원만 열람할 수 있습니다. 먼저 로그인하거나 회원가입해 주세요.',
      link: 'login.html',
      action: '로그인 / 회원가입'
    };
  }

  if (viewer.phase === 'onboarding') {
    return {
      title: 'SANNA 회원가입 미완료',
      message: '계정 인증은 완료되었지만 SANNA 가입정보를 아직 제출하지 않았습니다. 회원가입을 마무리해 주세요.',
      link: 'login.html',
      action: '회원가입 완료하기'
    };
  }

  const status = viewer.profile?.membership_status;

  if (status === 'pending') {
    return {
      title: '정회원 승인 대기',
      message: '정회원 신청이 접수되어 관리자 승인을 기다리고 있습니다. 승인 후 정기 공지를 이용할 수 있습니다.',
      link: 'account.html',
      action: '내 계정에서 상태 확인'
    };
  }

  if (status === 'rejected') {
    return {
      title: '정회원 신청 미승인',
      message: '정회원 신청이 승인되지 않았습니다. 실제 SANNA 멤버라면 내 계정에서 다시 신청할 수 있습니다.',
      link: 'account.html',
      action: '내 계정으로 이동'
    };
  }

  if (status === 'revoked') {
    return {
      title: '정회원 권한 회수',
      message: '현재 정회원 권한이 없습니다. 다시 SANNA 멤버가 되었다면 정회원 승인을 재신청할 수 있습니다.',
      link: 'account.html',
      action: '정회원 재신청'
    };
  }

  return {
    title: '산나 정회원 전용 콘텐츠',
    message: '정기 공지는 관리자 승인을 받은 정회원만 이용할 수 있습니다. 실제 SANNA 멤버라면 승인을 신청해 주세요.',
    link: 'account.html',
    action: '정회원 승인 신청'
  };
}

function openModal(details) {
  const overlay = $('access-modal');
  if (!overlay) return;

  previousFocus = document.activeElement;
  $('modal-heading').textContent = details.title;
  $('modal-message').textContent = details.message;
  $('modal-action').textContent = details.action;
  $('modal-action').href = page(details.link);

  overlay.classList.add('open');
  $('close-modal').focus();
}

function closeModal() {
  $('access-modal').classList.remove('open');
  if (previousFocus && typeof previousFocus.focus === 'function') {
    previousFocus.focus();
  }
  previousFocus = null;
}

// The home page uses links with data-requires-archive.
// This interception is for UX only; Supabase RLS protects the actual data.
document.addEventListener('click', (event) => {
  if (!(event.target instanceof Element)) return;

  const link = event.target.closest('a[data-requires-archive]');
  if (!link) return;

  if (viewer.phase === 'ready' && canReadArchive(viewer.profile)) {
    return; // Allow normal navigation for approved members / admins.
  }

  event.preventDefault();
  openModal(accessMessage());
}, true);

$('close-modal').addEventListener('click', closeModal);

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && $('access-modal').classList.contains('open')) {
    closeModal();
  }
});

/* =========================================================
   5. Logout
   ========================================================= */

async function handleLogout(button) {
  if (button.disabled || !db) return;

  button.disabled = true;
  button.textContent = '로그아웃 중...';

  try {
    const { error } = await db.auth.signOut();
    if (error) throw error;

    // Invalidate any in-flight profile request.
    ++refreshSequence;
    viewer.phase = 'guest';
    viewer.user = null;
    viewer.profile = null;
    window.location.replace(page('index.html'));

  } catch (error) {
    button.disabled = false;
    button.textContent = 'LOGOUT';
    openModal({
      title: '로그아웃 오류',
      message: explainError(error),
      link: 'account.html',
      action: '내 계정으로 이동'
    });
  }
}

/* =========================================================
   6. Startup / returning to the tab
   ========================================================= */

void refreshViewer();

// Reflect membership updates when an already-open tab becomes active again.
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) void refreshViewer();
});
