
/* =========================================================
   SANNA OFFICIAL WEBSITE
   auth-core.js - Common Authentication

   Supabase 기반 공통 인증 및 회원 권한 관리
   ========================================================= */


/* =========================================================
   1. Supabase JavaScript 라이브러리
   ========================================================= */

import {
  createClient
} from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';


/* =========================================================
   2. Supabase 연결 설정 확인
   ========================================================= */

// supabase-config.js에서 설정한 연결정보를 사용합니다.

const config = window.SANNA_CONFIG || {};

export const isConfigured =
  /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(
    config.url || ''
  ) &&
  typeof config.publishableKey === 'string' &&
  config.publishableKey.length > 20 &&
  !config.publishableKey.startsWith('YOUR_');


/* =========================================================
   3. Supabase 클라이언트 생성
   ========================================================= */

export const db = isConfigured
  ? createClient(
      config.url,
      config.publishableKey,
      {
        auth: {
          flowType: 'pkce',
          detectSessionInUrl: true,
          autoRefreshToken: true,
          persistSession: true
        }
      }
    )
  : null;


/* =========================================================
   4. 기존 임시 로그인 정보 제거
   ========================================================= */

// 예전 localStorage 기반의 가짜 로그인 정보는
// 실제 사용자 인증에 사용하지 않습니다.

try {
  localStorage.removeItem('sanna_current_user');
} catch (error) {
  // 브라우저 저장소에 접근할 수 없는 경우 무시
}


/* =========================================================
   5. Supabase 연결 확인
   ========================================================= */

export function requireConfig() {

  if (!db) {
    throw new Error(
      'Supabase 연결이 설정되지 않았습니다. ' +
      'supabase-config.js를 확인해 주세요.'
    );
  }

  return db;
}


/* =========================================================
   6. 실제 로그인 사용자 확인
   ========================================================= */

// localStorage의 임의 정보가 아니라
// Supabase Auth 서버에서 사용자를 확인합니다.

export async function getVerifiedUser() {

  if (!db) {
    return null;
  }

  const { data, error } = await db.auth.getUser();

  if (error || !data?.user) {
    return null;
  }

  return data.user;
}


/* =========================================================
   7. SANNA 회원정보 조회
   ========================================================= */

// 회원의 역할 및 승인 상태를
// Supabase profiles 테이블에서 조회합니다.
//
// RLS 정책에 따라 일반 회원은 본인 정보만,
// 관리자는 허용된 회원정보를 조회할 수 있습니다.

export async function getMyProfile(userId) {

  if (!userId) {
    return null;
  }

  const client = requireConfig();

  const { data, error } = await client
    .from('profiles')
    .select(
      'id,email,display_name,member_alias,' +
      'requested_membership,role,' +
      'membership_status,applied_at'
    )
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}


/* =========================================================
   8. 정회원 아카이브 접근 가능 여부
   ========================================================= */

// 정회원 또는 관리자이면서
// membership_status가 approved일 때만 허용합니다.
//
// 주의: 이 함수는 화면 표시를 위한 확인입니다.
// 실제 데이터 접근은 Supabase RLS로 제한합니다.

export function canReadArchive(profile) {

  return Boolean(
    profile &&
    ['member', 'admin'].includes(profile.role) &&
    profile.membership_status === 'approved'
  );

}


/* =========================================================
   9. 관리자 권한 확인
   ========================================================= */

// 관리자 역할 및 승인 상태를 함께 확인합니다.

export function isAdmin(profile) {

  return (
    profile?.role === 'admin' &&
    profile.membership_status === 'approved'
  );

}


/* =========================================================
   10. 페이지 주소 생성
   ========================================================= */

// GitHub Pages의 하위 경로에서도
// 페이지 이동 주소를 올바르게 생성합니다.

export function page(name) {

  return new URL(
    name,
    window.location.href
  ).href;

}


/* =========================================================
   11. 로그아웃 처리
   ========================================================= */

export async function logOut() {

  if (db) {
    await db.auth.signOut();
  }

  window.location.replace(
    page('index.html')
  );

}


/* =========================================================
   12. 오류 메시지 한국어 변환
   ========================================================= */

export function explainError(err) {

  const raw = String(
    err?.message || err || '알 수 없는 오류'
  );

  // 로그인 정보 오류
  if (/invalid login credentials/i.test(raw)) {
    return '이메일 또는 비밀번호가 올바르지 않습니다.';
  }

  // 이메일 인증 미완료
  if (/email not confirmed/i.test(raw)) {
    return '인증 메일을 확인한 후 로그인해 주세요.';
  }

  // 이미 가입된 계정
  if (/user already registered/i.test(raw)) {
    return '이미 등록된 이메일입니다.';
  }

  // 요청 횟수 제한
  if (/rate limit/i.test(raw)) {
    return '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.';
  }

  // 소셜로그인 연동 미설정
  if (
    /provider.*(not enabled|disabled|not found)|unsupported provider/i.test(raw)
  ) {
    return '간편로그인 제공자를 Supabase에서 먼저 설정해 주세요.';
  }

  // 승인할 수 없는 회원 상태
  if (/Only pending SANNA/i.test(raw)) {
    return '승인 대기 중인 신청만 승인할 수 있습니다.';
  }

  // 정회원 재신청 불가 상태
  if (/Cannot apply in current state/i.test(raw)) {
    return '현재 회원 상태에서는 다시 신청할 수 없습니다.';
  }

  // 그 외 서버 오류
  return raw;

}
