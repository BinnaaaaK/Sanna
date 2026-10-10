
/* =========================================================
   SANNA OFFICIAL WEBSITE
   account.js - My Account & Membership Application

   이 파일은 account.html의 화면과 동작을 연결합니다.
   실제 회원 권한 변경은 Supabase 서버의 RPC / RLS가 처리합니다.
   ========================================================= */

import {
  requireConfig,
  getVerifiedUser,
  getMyProfile,
  canReadArchive,
  isAdmin,
  explainError,
  page
} from './auth-core.js';


/* =========================================================
   1. 공통 요소와 상태
   ========================================================= */

const $ = (id) => document.getElementById(id);

let currentUser = null;
let currentProfile = null;

// 정회원 신청 버튼을 보여 줄 수 있는 상태
const applicableStatuses = new Set([
  'not_requested',
  'rejected',
  'revoked'
]);

function showMessage(message, type = 'info') {
  const element = $('message');
  element.textContent = message;
  element.className = `account-message ${type}`;
}

function showLoading(message) {
  showMessage(message, 'info');
}


/* =========================================================
   2. 회원 등급 표시 문구
   ========================================================= */

function membershipView(profile) {

  if (isAdmin(profile)) {
    return {
      title: 'SANNA 관리자',
      help: '관리자 계정입니다. 정회원 콘텐츠를 이용할 수 있으며, 관리자 페이지에서 회원 승인과 권한 회수를 처리할 수 있습니다.'
    };
  }

  if (canReadArchive(profile)) {
    return {
      title: '산나 정회원 (_sanna)',
      help: '정회원 승인이 완료되었습니다. 정기 공지와 회원 전용 아카이브를 이용할 수 있습니다.'
    };
  }

  switch (profile.membership_status) {

    case 'not_requested':
      return {
        title: '일반 회원',
        help: '현재 일반 회원입니다. 실제 산나 멤버라면 아래에서 정회원 승인을 신청해 주세요.'
      };

    case 'pending':
      return {
        title: '정회원 승인 대기',
        help: '정회원 신청이 접수되었습니다. 관리자가 실제 산나 멤버인지 확인하는 중입니다. 승인 전에는 회원 전용 콘텐츠에 접근할 수 없습니다.'
      };

    case 'rejected':
      return {
        title: '정회원 신청 거절',
        help: '이전 신청이 승인되지 않았습니다. 산나 멤버임을 확인할 수 있다면 아래에서 다시 신청할 수 있습니다.'
      };

    case 'revoked':
      return {
        title: '정회원 권한 회수',
        help: '이전 정회원 권한이 회수되었습니다. 다시 활동하게 되었다면 아래에서 승인을 재신청할 수 있습니다.'
      };

    default:
      return {
        title: '회원 상태 확인 필요',
        help: '회원정보가 예상한 상태와 다릅니다. 관리자에게 문의해 주세요.'
      };
  }
}


/* =========================================================
   3. 마이페이지 내용 표시
   ========================================================= */

function renderProfile(user, profile) {

  const view = membershipView(profile);

  // 사용자 입력을 HTML로 삽입하지 않고 안전하게 표시합니다.
  $('display-name').textContent = profile.display_name || '-';

  $('email').textContent =
    profile.email || user.email || '연결된 소셜 계정 (이메일 미제공)';

  $('membership').textContent = view.title;
  $('membership-help').textContent = view.help;

  // 관리자 승인 전에는 정회원 권한이 없습니다.
  $('archive-link').classList.toggle(
    'hidden',
    !canReadArchive(profile)
  );

  // 일반 회원, 신청 거절, 권한 회수 상태일 때만 신청할 수 있습니다.
  const canApply =
    profile.role === 'guest' &&
    applicableStatuses.has(profile.membership_status);

  $('apply-form').classList.toggle('hidden', !canApply);

  if (canApply) {
    $('member-alias').value = profile.member_alias || '';
  }

  $('profile-panel').classList.remove('hidden');

  if (profile.membership_status === 'pending') {

    showMessage(
      '정회원 신청이 접수되어 승인 대기 중입니다. 관리자가 확인한 뒤 회원 등급이 변경됩니다.',
      'info'
    );

  } else {

    showMessage(
      '회원정보를 정상적으로 불러왔습니다. 표시된 회원 등급은 Supabase에서 확인한 현재 상태입니다.',
      'info'
    );

  }
}


/* =========================================================
   4. 로그인 확인 및 최초 데이터 조회
   ========================================================= */

async function initAccount() {

  showLoading('회원정보를 확인하고 있습니다.');
  $('profile-panel').classList.add('hidden');

  try {

    requireConfig();

    // Supabase Auth 서버에 현재 로그인 계정을 확인합니다.
    const user = await getVerifiedUser();

    if (!user) {
      window.location.replace(page('login.html'));
      return;
    }

    // 프로필이 없으면 SANNA 추가 회원가입이 완료되지 않은 계정입니다.
    const profile = await getMyProfile(user.id);

    if (!profile) {
      window.location.replace(page('login.html'));
      return;
    }

    currentUser = user;
    currentProfile = profile;

    renderProfile(user, profile);

  } catch (error) {

    showMessage(
      '회원정보를 불러오지 못했습니다.\n' + explainError(error),
      'error'
    );

  }
}


/* =========================================================
   5. 정회원 승인 신청 / 재신청
   ========================================================= */

$('apply-form').addEventListener('submit', async (event) => {

  event.preventDefault();

  const button = $('apply-submit');

  if (button.disabled) return;

  button.disabled = true;
  button.textContent = '신청 처리 중...';

  try {

    const client = requireConfig();
    const user = await getVerifiedUser();

    if (!user || user.id !== currentUser?.id) {
      throw new Error(
        '로그인 상태가 변경되었습니다. 다시 로그인해 주세요.'
      );
    }

    // 화면 상태와 상관없이 서버가 다시 신청 가능 여부를 확인합니다.
    const alias = $('member-alias').value.trim();
    const reference = $('reference-note').value.trim();

    if (alias.length > 40 || reference.length > 160) {
      throw new Error(
        '활동명 또는 참고사항의 글자 수를 확인해 주세요.'
      );
    }

    // Supabase 서버 함수 호출
    const { error } = await client.rpc('apply_sanna_membership', {
      p_member_alias: alias || null,
      p_reference_note: reference || null
    });

    if (error) {
      throw error;
    }

    // 신청 성공 후 서버 데이터를 다시 조회합니다.
    // 조회가 실패해도 이미 접수된 신청을 실패로 표시하지 않습니다.
    let updatedProfile = null;

    try {
      updatedProfile = await getMyProfile(user.id);
    } catch (_) {
      // 신청 자체의 성공 여부와 상태 재조회 오류를 분리합니다.
    }

    if (updatedProfile) {

      currentProfile = updatedProfile;
      renderProfile(user, updatedProfile);

    } else {

      $('apply-form').classList.add('hidden');

      $('membership').textContent =
        '정회원 신청 접수 (새로고침하여 상태 확인)';

    }

    showMessage(
      '정회원 승인 신청이 접수되었습니다.\n' +
      '관리자가 산나 멤버 여부를 확인한 후 승인 또는 거절합니다.\n' +
      '승인 결과는 이 페이지를 새로고침하여 확인할 수 있습니다.',
      'success'
    );

  } catch (error) {

    showMessage(
      '정회원 신청을 처리하지 못했습니다.\n' +
      explainError(error) + '\n' +
      '이미 신청했거나 회원 상태가 변경되었다면 페이지를 새로고침해 주세요.',
      'error'
    );

  } finally {

    button.disabled = false;
    button.textContent = '정회원 승인 요청';

  }

});


/* =========================================================
   6. 로그아웃
   ========================================================= */

$('logout-btn').addEventListener('click', async () => {

  const button = $('logout-btn');

  if (button.disabled) return;

  button.disabled = true;
  button.textContent = '로그아웃 중...';

  try {

    const client = requireConfig();

    const { error } = await client.auth.signOut();

    if (error) {
      throw error;
    }

    currentUser = null;
    currentProfile = null;

    window.location.replace(page('index.html'));

  } catch (error) {

    showMessage(
      '로그아웃에 실패했습니다.\n' + explainError(error),
      'error'
    );

    button.disabled = false;
    button.textContent = '로그아웃';

  }

});


/* =========================================================
   7. 실행
   ========================================================= */

initAccount();
