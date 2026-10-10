
/* =========================================================
   SANNA OFFICIAL WEBSITE
   archive.js - Member Archive & Admin Notice Editor

   archive.html / auth-core.js / Supabase schema.sql 호환
   실제 데이터 읽기·쓰기 권한은 Supabase RLS에서 최종 검증합니다.
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

const $ = (id) => document.getElementById(id);
const YEARS = [2026, 2025, 2024];
const EMPTY_NOTICE = '아직 작성된 공지가 없습니다.';

let currentYear = 2026;
let currentMonth = null;
let profile = null;
let currentBody = '';
let noticeLoaded = false;
let editing = false;
let saving = false;
let requestSequence = 0;

/* =========================================================
   1. 상태 메시지와 접근 제한
   ========================================================= */

function showStatus(text, linkFile = '', linkText = '') {
  const status = $('status');
  status.textContent = text;

  if (linkFile && linkText) {
    status.append(document.createTextNode(' '));

    const link = document.createElement('a');
    link.href = page(linkFile);
    link.textContent = linkText;
    link.style.textDecoration = 'underline';
    link.style.fontWeight = '700';

    status.append(link);
  }

  status.classList.remove('hidden');
}

function hideStatus() {
  $('status').classList.add('hidden');
}

function lockArchive(message, linkFile, linkText) {
  ++requestSequence;

  noticeLoaded = false;
  currentMonth = null;
  editing = false;

  $('protected').classList.add('hidden');
  $('edit-area').classList.add('hidden');
  $('content-body').textContent = '';
  $('toggle-edit').classList.add('hidden');

  showStatus(message, linkFile, linkText);
}

function handleNoAccess(user, memberProfile) {

  if (!user) {
    lockArchive(
      '정기 공지는 로그인한 산나 정회원만 볼 수 있습니다.',
      'login.html',
      '로그인 / 회원가입 →'
    );

  } else if (!memberProfile) {
    lockArchive(
      'SANNA 회원가입이 완료되지 않았습니다. 회원정보를 입력해 주세요.',
      'login.html',
      '회원가입 마무리 →'
    );

  } else if (memberProfile.membership_status === 'pending') {
    lockArchive(
      '현재 산나 정회원 승인 대기 중입니다. 관리자 승인 후 열람할 수 있습니다.',
      'account.html',
      '내 계정에서 상태 확인 →'
    );

  } else {
    lockArchive(
      '정기 공지는 승인된 산나 정회원만 볼 수 있습니다. 정회원 승인을 신청해 주세요.',
      'account.html',
      '내 계정으로 이동 →'
    );
  }
}

/* =========================================================
   2. 서버에서 회원 권한 확인
   ========================================================= */

// 실제 Supabase 인증 및 프로필 확인
// 데이터베이스 RLS도 별도로 접근 권한을 검사합니다.

async function verifyMember() {
  const user = await getVerifiedUser();

  if (!user) {
    handleNoAccess(null, null);
    return false;
  }

  const latestProfile = await getMyProfile(user.id);

  if (!latestProfile || !canReadArchive(latestProfile)) {
    handleNoAccess(user, latestProfile);
    return false;
  }

  profile = latestProfile;
  return true;
}

/* =========================================================
   3. 페이지 주소 및 화면 전환
   ========================================================= */

function updateAddress(month = null) {
  const url = new URL(window.location.href);

  url.searchParams.set('year', String(currentYear));

  if (Number.isInteger(month)) {
    url.searchParams.set('month', String(month));
  } else {
    url.searchParams.delete('month');
  }

  window.history.replaceState(null, '', url.href);
}

function displayNotice(text) {
  $('content-body').textContent = text || EMPTY_NOTICE;
}

function exitEdit() {
  editing = false;

  $('edit-area').classList.add('hidden');
  $('content-body').classList.remove('hidden');

  $('toggle-edit').classList.toggle(
    'hidden',
    !noticeLoaded || !isAdmin(profile)
  );
}

/* =========================================================
   4. 수정 중 다른 화면 이동 확인
   ========================================================= */

function canLeaveEditor() {

  if (saving) {
    showStatus(
      '공지를 저장하는 중입니다. 저장이 끝난 후 이동해 주세요.'
    );
    return false;
  }

  if (editing && $('edit-input').value !== currentBody) {
    return window.confirm(
      '저장하지 않은 수정 내용이 있습니다. 이동하시겠습니까?'
    );
  }

  return true;
}

function closeDetail() {

  if (!canLeaveEditor()) return;

  ++requestSequence;

  currentMonth = null;
  noticeLoaded = false;

  exitEdit();

  $('detail-view').classList.add('hidden');
  $('month-grid-view').classList.remove('hidden');

  updateAddress();
  hideStatus();
}

function changeYear(year) {

  if (!YEARS.includes(year) || !canLeaveEditor()) {
    return;
  }

  ++requestSequence;

  currentYear = year;
  currentMonth = null;
  noticeLoaded = false;

  exitEdit();

  $('detail-view').classList.add('hidden');
  $('month-grid-view').classList.remove('hidden');

  renderYears();
  renderGrid();

  updateAddress();
  hideStatus();
}

/* =========================================================
   5. 연도 버튼 생성
   ========================================================= */

function renderYears() {
  const list = $('year-list');

  list.replaceChildren();

  for (const year of YEARS) {
    const button = document.createElement('button');

    button.type = 'button';
    button.className = 'year-item';
    button.textContent = String(year);

    button.classList.toggle(
      'active',
      year === currentYear
    );

    button.setAttribute(
      'aria-pressed',
      String(year === currentYear)
    );

    button.addEventListener('click', () => {
      changeYear(year);
    });

    list.append(button);
  }
}

/* =========================================================
   6. 월별 버튼 생성
   ========================================================= */

function renderGrid() {
  $('selected-year').textContent = String(currentYear);

  const grid = $('month-grid');
  grid.replaceChildren();

  for (let month = 1; month <= 12; month++) {
    const button = document.createElement('button');

    button.type = 'button';
    button.className = 'month-btn';

    button.textContent =
      `${String(month).padStart(2, '0')}월`;

    button.setAttribute(
      'aria-label',
      `${currentYear}년 ${month}월 정기 공지`
    );

    button.addEventListener('click', () => {
      showDetail(month);
    });

    grid.append(button);
  }
}

/* =========================================================
   7. 월별 공지 불러오기
   ========================================================= */

async function showDetail(month) {

  if (
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12
  ) {
    return;
  }

  if (!canLeaveEditor()) return;

  const sequence = ++requestSequence;

  currentMonth = month;
  currentBody = '';
  noticeLoaded = false;

  exitEdit();

  $('content-title').textContent =
    `${currentYear}년 ${month}월 정기 공지`;

  $('content-body').textContent =
    '공지 내용을 불러오는 중입니다.';

  $('month-grid-view').classList.add('hidden');
  $('detail-view').classList.remove('hidden');

  updateAddress(month);

  showStatus('공지 내용을 확인하고 있습니다.');

  window.scrollTo(0, 0);

  try {

    // 정회원 권한을 다시 확인합니다.
    if (!(await verifyMember())) {
      return;
    }

    if (sequence !== requestSequence) {
      return;
    }

    const client = requireConfig();

    // 해당 연도와 월의 공지만 서버에서 조회합니다.
    const { data, error } = await client
      .from('notices')
      .select('body')
      .eq('year', currentYear)
      .eq('month', month)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (sequence !== requestSequence) {
      return;
    }

    // 아직 작성된 공지가 없는 월도 정상 표시
    currentBody = data?.body ?? '';
    noticeLoaded = true;

    displayNotice(currentBody);
    exitEdit();
    hideStatus();

  } catch (error) {

    if (sequence !== requestSequence) {
      return;
    }

    $('content-body').textContent =
      '공지 내용을 불러오지 못했습니다.';

    showStatus(
      '공지 조회 실패: ' + explainError(error)
    );
  }
}

/* =========================================================
   8. 관리자 공지 수정 화면
   ========================================================= */

$('toggle-edit').addEventListener('click', () => {

  if (
    saving ||
    !noticeLoaded ||
    !isAdmin(profile)
  ) {
    return;
  }

  editing = true;

  $('edit-input').value = currentBody;

  $('content-body').classList.add('hidden');
  $('edit-area').classList.remove('hidden');
  $('toggle-edit').classList.add('hidden');

  $('edit-input').focus();
});

/* =========================================================
   9. 수정 취소 및 목록으로
   ========================================================= */

$('cancel-edit').addEventListener('click', exitEdit);

$('back-list').addEventListener('click', closeDetail);

/* =========================================================
   10. 관리자 공지 저장
   ========================================================= */

$('save-notice').addEventListener('click', async () => {

  if (
    !editing ||
    saving ||
    !noticeLoaded ||
    !isAdmin(profile)
  ) {
    return;
  }

  if (currentMonth === null) {
    return;
  }

  const yearToSave = currentYear;
  const monthToSave = currentMonth;
  const bodyToSave = $('edit-input').value;

  if (bodyToSave.length > 30000) {
    showStatus(
      '공지 내용은 최대 30,000자까지 입력할 수 있습니다.'
    );
    return;
  }

  saving = true;

  $('save-notice').disabled = true;
  $('cancel-edit').disabled = true;

  showStatus('공지 내용을 저장하고 있습니다.');

  try {

    // 저장 직전 실제 회원 및 관리자 권한 재확인
    if (
      !(await verifyMember()) ||
      !isAdmin(profile)
    ) {
      throw new Error(
        '관리자 권한이 없거나 로그인 상태가 변경되었습니다.'
      );
    }

    const client = requireConfig();

    // 해당 연도·월의 공지가 없으면 새로 생성,
    // 있으면 기존 내용을 수정합니다.
    const { data, error } = await client
      .from('notices')
      .upsert(
        {
          year: yearToSave,
          month: monthToSave,
          body: bodyToSave
        },
        {
          onConflict: 'year,month'
        }
      )
      .select('body')
      .single();

    if (error) {
      throw error;
    }

    currentBody = data.body;

    displayNotice(currentBody);
    exitEdit();

    showStatus(
      '공지 내용이 저장되었습니다. 정회원에게도 동일하게 표시됩니다.'
    );

  } catch (error) {

    showStatus(
      '공지 저장 실패: ' + explainError(error)
    );

  } finally {

    saving = false;

    $('save-notice').disabled = false;
    $('cancel-edit').disabled = false;
  }
});

/* =========================================================
   11. 최초 접속 시 인증 및 권한 확인
   ========================================================= */

async function initArchive() {

  // 권한 확인 전에는 공지 영역을 표시하지 않습니다.
  $('protected').classList.add('hidden');

  showStatus(
    '로그인 및 정회원 접근 권한을 확인하고 있습니다.'
  );

  try {

    requireConfig();

    if (!(await verifyMember())) {
      return;
    }

    // 링크에 year 또는 month가 있으면 해당 위치로 이동
    const params = new URL(
      window.location.href
    ).searchParams;

    const requestedYear = Number(
      params.get('year')
    );

    const requestedMonth = Number(
      params.get('month')
    );

    if (YEARS.includes(requestedYear)) {
      currentYear = requestedYear;
    }

    renderYears();
    renderGrid();

    $('protected').classList.remove('hidden');

    hideStatus();

    if (
      params.has('month') &&
      Number.isInteger(requestedMonth) &&
      requestedMonth >= 1 &&
      requestedMonth <= 12
    ) {
      await showDetail(requestedMonth);
    }

  } catch (error) {

    $('protected').classList.add('hidden');

    showStatus(
      '아카이브 연결 실패: ' + explainError(error)
    );
  }
}

/* =========================================================
   12. 아카이브 실행
   ========================================================= */

initArchive();
