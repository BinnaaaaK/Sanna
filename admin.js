
/* =========================================================
   SANNA OFFICIAL WEBSITE
   admin.js - Member Management

   admin.html + auth-core.js + Supabase schema.sql 호환
   관리자만 승인·거절·권한 회수 가능
   ========================================================= */

import {
  requireConfig,
  getVerifiedUser,
  getMyProfile,
  isAdmin,
  explainError,
  page
} from './auth-core.js';

const $ = (id) => document.getElementById(id);

let members = [];
let selectedStatus = 'all';
let busy = false;

const STATUS_LABELS = {
  not_requested: '일반 회원',
  pending: '승인 대기',
  approved: '승인 완료',
  rejected: '신청 거절',
  revoked: '권한 회수'
};

const ACTION_LABELS = {
  approve: '정회원 승인',
  reject: '신청 거절',
  revoke: '정회원 권한 회수'
};

/* 1. 공통 화면 함수 */

function showMessage(text, type = 'info') {
  $('admin-message').textContent = text;
  $('admin-message').className = 'admin-message';

  if (type === 'error' || type === 'success') {
    $('admin-message').classList.add(type);
  }
}

function hideAdminPanel() {
  $('admin-panel').classList.add('hidden');
  $('member-list').replaceChildren();
  members = [];
}

function setBusy(next) {
  busy = next;

  $('refresh-btn').disabled = next;
  $('logout-btn').disabled = next;

  $('member-list').querySelectorAll('button').forEach((button) => {
    button.disabled = next;
  });
}

function makeElement(tag, className, text) {
  const element = document.createElement(tag);

  if (className) element.className = className;

  if (text !== undefined) {
    element.textContent = String(text);
  }

  return element;
}

function formatDate(dateText) {
  if (!dateText) return '-';

  const date = new Date(dateText);

  if (Number.isNaN(date.getTime())) return '-';

  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

function memberStatus(member) {
  if (member.role === 'admin') return '관리자';

  if (
    member.role === 'member' &&
    member.membership_status === 'approved'
  ) {
    return '산나 정회원 (_sanna)';
  }

  return STATUS_LABELS[member.membership_status] || '상태 확인 필요';
}

/* 2. 관리자 인증 확인 */

async function verifyAdmin() {
  const client = requireConfig();

  const user = await getVerifiedUser();

  if (!user) {
    hideAdminPanel();
    window.location.replace(page('login.html'));
    return null;
  }

  const profile = await getMyProfile(user.id);

  if (!isAdmin(profile)) {
    hideAdminPanel();

    throw new Error(
      '관리자 계정만 회원관리 페이지를 이용할 수 있습니다.'
    );
  }

  return client;
}

/* 3. 통계 및 필터 */

function renderStatistics() {
  $('stat-total').textContent = String(members.length);

  $('stat-approved').textContent = String(
    members.filter((member) =>
      member.role === 'member' &&
      member.membership_status === 'approved'
    ).length
  );

  $('stat-pending').textContent = String(
    members.filter((member) =>
      member.membership_status === 'pending'
    ).length
  );

  $('stat-revoked').textContent = String(
    members.filter((member) =>
      member.membership_status === 'revoked'
    ).length
  );
}

function matchesFilter(member) {
  if (selectedStatus === 'all') return true;

  if (selectedStatus === 'approved') {
    return (
      member.role === 'member' &&
      member.membership_status === 'approved'
    );
  }

  return (
    member.membership_status === selectedStatus &&
    member.role !== 'admin'
  );
}

function matchesSearch(member, searchText) {
  if (!searchText) return true;

  const haystack = [
    member.display_name,
    member.email,
    member.member_alias
  ]
    .filter(Boolean)
    .join(' ')
    .toLocaleLowerCase('ko-KR');

  return haystack.includes(searchText);
}

/* 4. 회원 카드와 관리자 버튼 생성 */

function createActionButton(member, action) {
  const button = makeElement(
    'button',
    action === 'approve' ? 'approve' : '',
    ACTION_LABELS[action]
  );

  button.type = 'button';
  button.disabled = busy;

  button.addEventListener('click', () => {
    changeMembership(member, action);
  });

  return button;
}

function createMemberRow(member) {
  const article = makeElement('article', 'admin-member-row');

  const info = makeElement('div', 'admin-member-info');

  const name = makeElement(
    'div',
    'admin-member-name',
    member.display_name || '이름 미등록'
  );

  const email = makeElement(
    'p',
    'admin-member-meta',
    '이메일: ' + (member.email || '미제공')
  );

  const alias = makeElement(
    'p',
    'admin-member-meta',
    '활동명: ' + (member.member_alias || '-')
  );

  const note = makeElement(
    'p',
    'admin-member-meta',
    '확인정보: ' + (member.reference_note || '-')
  );

  const applied = makeElement(
    'p',
    'admin-member-meta',
    '신청일: ' + formatDate(member.applied_at)
  );

  const badge = makeElement(
    'span',
    'admin-status-badge',
    memberStatus(member)
  );

  // 회원이 입력한 정보를 HTML로 실행하지 않고 안전하게 표시
  info.append(name, email, alias, note, applied, badge);

  article.append(info);

  const actions = makeElement('div', 'admin-member-actions');

  // 관리자 계정은 회원관리 버튼으로 수정할 수 없음
  if (member.role !== 'admin') {

    // 승인 대기 회원
    if (member.membership_status === 'pending') {
      actions.append(
        createActionButton(member, 'approve'),
        createActionButton(member, 'reject')
      );
    }

    // 현재 정회원
    else if (
      member.role === 'member' &&
      member.membership_status === 'approved'
    ) {
      actions.append(
        createActionButton(member, 'revoke')
      );
    }
  }

  if (actions.childElementCount > 0) {
    article.append(actions);
  }

  return article;
}

function renderMembers() {
  const query = $('member-search')
    .value
    .trim()
    .toLocaleLowerCase('ko-KR');

  const visible = members.filter((member) =>
    matchesFilter(member) && matchesSearch(member, query)
  );

  const fragment = document.createDocumentFragment();

  for (const member of visible) {
    fragment.append(createMemberRow(member));
  }

  if (visible.length === 0) {
    fragment.append(
      makeElement(
        'div',
        'admin-empty',
        '조건에 맞는 회원이 없습니다.'
      )
    );
  }

  $('member-list').replaceChildren(fragment);

  $('result-count').textContent =
    `검색 결과 ${visible.length}명 / 전체 ${members.length}명`;
}

/* 5. 실제 서버 회원정보 조회 */

async function loadMembers() {
  const client = await verifyAdmin();

  if (!client) return false;

  // 30명 미만 운영 기준, 최대 500명 조회
  const { data, error } = await client
    .from('profiles')
    .select(
      'id,email,display_name,member_alias,reference_note,' +
      'requested_membership,role,membership_status,' +
      'created_at,applied_at'
    )
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) throw error;

  members = data || [];

  renderStatistics();
  renderMembers();

  $('admin-panel').classList.remove('hidden');

  return true;
}

/* 6. 정회원 승인 · 거절 · 권한 회수 */

async function changeMembership(member, action) {
  if (busy) return;

  if (!Object.hasOwn(ACTION_LABELS, action)) return;

  if (member.role === 'admin') return;

  const description =
    `${member.display_name || '해당 회원'}님의 계정을 ` +
    `'${ACTION_LABELS[action]}' 처리하시겠습니까?`;

  if (!window.confirm(description)) return;

  setBusy(true);

  showMessage(
    '관리자 권한과 현재 신청 상태를 확인하고 있습니다.'
  );

  try {
    const client = await verifyAdmin();

    if (!client) return;

    // 실제 권한 변경은 Supabase 서버 함수에서 수행
    // 관리자 권한과 회원 상태를 서버에서 다시 검증

    const { error } = await client.rpc(
      'admin_change_membership',
      {
        p_user_id: member.id,
        p_action: action
      }
    );

    if (error) throw error;

    // 권한 변경 후 회원 목록 다시 조회
    try {
      await loadMembers();

      showMessage(
        `${member.display_name || '회원'}님의 ` +
        `${ACTION_LABELS[action]} 처리가 완료되었습니다.`,
        'success'
      );

    } catch (reloadError) {
      showMessage(
        `${ACTION_LABELS[action]} 처리는 완료되었으나 ` +
        `목록을 다시 불러오지 못했습니다. 새로고침해 주세요.\n` +
        explainError(reloadError),
        'error'
      );
    }

  } catch (error) {
    showMessage(
      '권한 변경에 실패했습니다.\n' +
      explainError(error),
      'error'
    );

  } finally {
    setBusy(false);
  }
}

/* 7. 검색 · 필터 · 새로고침 */

// 이름, 이메일, 활동명 검색
$('member-search').addEventListener('input', renderMembers);

// 회원 상태별 필터
for (
  const button of document.querySelectorAll(
    '#filters [data-status]'
  )
) {
  button.addEventListener('click', () => {
    selectedStatus = button.dataset.status || 'all';

    document
      .querySelectorAll('#filters [data-status]')
      .forEach((item) => {

        const active = item === button;

        item.classList.toggle('active', active);
        item.setAttribute('aria-pressed', String(active));
      });

    renderMembers();
  });
}

// 회원 목록 새로고침
$('refresh-btn').addEventListener('click', async () => {
  if (busy) return;

  setBusy(true);
  showMessage('최신 회원정보를 불러오고 있습니다.');

  try {
    if (await loadMembers()) {
      showMessage('최신 회원정보를 불러왔습니다.');
    }

  } catch (error) {
    showMessage(
      '회원정보 새로고침에 실패했습니다.\n' +
      explainError(error),
      'error'
    );

  } finally {
    setBusy(false);
  }
});

/* 8. 로그아웃 */

$('logout-btn').addEventListener('click', async () => {
  if (busy) return;

  setBusy(true);

  try {
    const client = requireConfig();

    const { error } = await client.auth.signOut();

    if (error) throw error;

    hideAdminPanel();

    window.location.replace(page('index.html'));

  } catch (error) {
    showMessage(
      '로그아웃에 실패했습니다.\n' +
      explainError(error),
      'error'
    );

    setBusy(false);
  }
});

/* 9. 관리자 화면 시작 */

async function initAdmin() {
  hideAdminPanel();

  setBusy(true);

  showMessage('관리자 권한을 확인하고 있습니다.');

  try {
    if (await loadMembers()) {
      showMessage('회원정보를 정상적으로 불러왔습니다.');
    }

  } catch (error) {
    hideAdminPanel();

    showMessage(
      '관리자 페이지에 접근할 수 없습니다.\n' +
      explainError(error),
      'error'
    );

  } finally {
    setBusy(false);
  }
}

// 관리자 페이지 실행
initAdmin();
