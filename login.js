
/* =========================================================
   SANNA OFFICIAL WEBSITE
   login.js - Authentication & Registration
   Supabase 기반 실제 회원 인증
   ========================================================= */

import {
  db,
  requireConfig,
  getVerifiedUser,
  getMyProfile,
  explainError,
  page
} from './auth-core.js';


/* =========================================================
   1. 기본 변수 및 공통 함수
   ========================================================= */

const $ = (id) => document.getElementById(id);

let mode = 'login';
let onboardingUser = null;
let passwordRecovery = false;


// 안내 메시지 표시
function show(text, type = 'info') {
  $('message').textContent = text;
  $('message').className = 'feedback show ' + type;
}


// 안내 메시지 초기화
function clear() {
  $('message').className = 'feedback';
  $('message').textContent = '';
}


/* =========================================================
   2. 로그인 / 회원가입 화면 전환
   ========================================================= */

function setMode(next) {

  mode = next;
  clear();

  const signup = next === 'signup';
  const onboarding = next === 'onboarding';
  const password = next === 'password';

  $('auth-area').classList.toggle(
    'hidden',
    onboarding || password
  );

  $('onboarding').classList.toggle(
    'hidden',
    !onboarding
  );

  $('new-password').classList.toggle(
    'hidden',
    !password
  );

  // 화면 제목
  $('heading').textContent = onboarding
    ? 'SANNA 회원가입 마무리'
    : password
      ? '비밀번호 재설정'
      : signup
        ? 'SANNA 회원가입'
        : 'SANNA 로그인';

  $('subheading').textContent = onboarding
    ? '인증을 마쳤습니다. SANNA 가입정보를 입력해 주세요.'
    : '기록을 함께하는 산나 커뮤니티';

  // 로그인 / 회원가입 탭
  $('tab-login').classList.toggle('active', !signup);
  $('tab-register').classList.toggle('active', signup);

  // 회원가입 전용 항목
  $('confirm-wrap').classList.toggle('hidden', !signup);
  $('signup-note').classList.toggle('hidden', !signup);

  $('confirm').required = signup;

  // 비밀번호 찾기
  $('reset-password').classList.toggle('hidden', signup);

  // 제출 버튼
  $('email-submit').textContent = signup
    ? '이메일 가입 신청'
    : '로그인';

  $('password').autocomplete = signup
    ? 'new-password'
    : 'current-password';
}


// 로그인 탭
$('tab-login').addEventListener('click', () => {
  setMode('login');
});


// 회원가입 탭
$('tab-register').addEventListener('click', () => {
  setMode('signup');
});


/* =========================================================
   3. 이메일 회원가입 및 로그인
   ========================================================= */

$('email-form').addEventListener('submit', async (event) => {

  event.preventDefault();
  clear();

  const btn = $('email-submit');
  btn.disabled = true;

  try {

    const client = requireConfig();

    const email = $('email').value.trim();
    const password = $('password').value;

    // 입력값 검증
    if (!email.includes('@') || password.length < 8) {
      throw new Error(
        '올바른 이메일과 8자 이상의 비밀번호를 입력해 주세요.'
      );
    }


    /* -----------------------------------------------------
       3-1. 신규 이메일 회원가입
       ----------------------------------------------------- */

    if (mode === 'signup') {

      if (password !== $('confirm').value) {
        throw new Error(
          '비밀번호 확인이 일치하지 않습니다.'
        );
      }

      const { data, error } = await client.auth.signUp({
        email: email,
        password: password,
        options: {
          emailRedirectTo: page('login.html')
        }
      });

      if (error) {
        throw error;
      }

      // Supabase 이메일 확인 설정이 꺼진 경우에도
      // 자동 로그인하지 않도록 세션 종료
      if (data.session) {
        await client.auth.signOut();
      }

      setMode('login');

      show(
        '이메일 가입 요청을 처리했습니다.\n' +
        '인증 메일이 도착하면 이메일 인증을 완료해 주세요.\n' +
        '이후 로그인하여 SANNA 회원정보를 입력해야 가입이 완료됩니다.',
        'ok'
      );

      return;
    }


    /* -----------------------------------------------------
       3-2. 기존 이메일 계정 로그인
       ----------------------------------------------------- */

    const { error } = await client.auth.signInWithPassword({
      email: email,
      password: password
    });

    if (error) {
      throw error;
    }

    // 로그인 후 SANNA 회원가입 완료 여부 확인
    await routeUser();

  } catch (err) {

    show(explainError(err), 'error');

  } finally {

    btn.disabled = false;

  }

});


/* =========================================================
   4. 카카오 / 네이버 / Google 간편로그인
   ========================================================= */

// 버튼을 눌렀다고 임의 계정을 생성하지 않습니다.
// 실제 소셜 인증을 거친 후 SANNA 가입 여부를 확인합니다.

for (const button of document.querySelectorAll('[data-provider]')) {

  button.addEventListener('click', async () => {

    clear();

    const provider = button.dataset.provider;

    const key = provider === 'custom:naver'
      ? 'naver'
      : provider;


    // 공급자 연동 설정 여부 확인
    const enabled =
      window.SANNA_CONFIG?.enabledProviders?.[key] === true;

    if (!enabled) {

      show(
        '해당 간편로그인은 아직 실제 인증 연결을 마치지 않았습니다.\n' +
        '현재는 이메일 회원가입을 이용해 주세요.',
        'info'
      );

      return;
    }

    button.disabled = true;

    try {

      const client = requireConfig();

      const { error } = await client.auth.signInWithOAuth({

        provider: provider,

        options: {
          redirectTo: page('login.html')
        }

      });

      if (error) {
        throw error;
      }

      // 인증 제공자 페이지로 이동합니다.
      // 인증 완료 후 다시 login.html로 돌아옵니다.

    } catch (err) {

      show(explainError(err), 'error');
      button.disabled = false;

    }

  });

}


/* =========================================================
   5. 인증 이후 회원 상태 확인
   ========================================================= */

async function routeUser() {

  // 실제 Supabase 서버에서 사용자 확인
  const user = await getVerifiedUser();

  if (!user) {
    throw new Error(
      '로그인 상태를 확인할 수 없습니다. 다시 로그인해 주세요.'
    );
  }

  // SANNA 프로필 확인
  const profile = await getMyProfile(user.id);


  /* -----------------------------------------------------
     5-1. SANNA 회원가입을 완료한 기존 사용자
     ----------------------------------------------------- */

  if (profile) {

    // 일반 회원, 승인 대기 회원, 정회원, 관리자 모두
    // 로그인은 가능하지만 접근 권한은 별도로 판단
    window.location.replace(page('index.html'));

    return;
  }


  /* -----------------------------------------------------
     5-2. 최초 인증 사용자
     ----------------------------------------------------- */

  // 아직 SANNA 회원가입 정보를 제출하지 않은 계정
  onboardingUser = user;

  setMode('onboarding');

  const suggestedName =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    '';

  $('display-name').value = String(suggestedName).slice(0, 30);

  show(
    '계정 인증이 완료되었습니다.\n' +
    'SANNA 회원가입 정보를 제출해야 가입이 완료됩니다.\n' +
    '정회원 권한은 관리자 승인 후 부여됩니다.',
    'info'
  );

}


/* =========================================================
   6. SANNA 추가 회원가입 처리
   ========================================================= */

$('onboarding').addEventListener('submit', async (event) => {

  event.preventDefault();
  clear();

  const btn = $('finish-submit');
  btn.disabled = true;

  try {

    const user = await getVerifiedUser();

    // 인증 계정 재확인
    if (
      !user ||
      !onboardingUser ||
      user.id !== onboardingUser.id
    ) {
      throw new Error(
        '인증 세션이 만료되었습니다. 다시 인증해 주세요.'
      );
    }


    /* -----------------------------------------------------
       6-1. 이름 검증
       ----------------------------------------------------- */

    const name = $('display-name').value.trim();

    if (name.length < 2 || name.length > 30) {
      throw new Error(
        '이름은 2~30자로 입력해 주세요.'
      );
    }


    /* -----------------------------------------------------
       6-2. 개인정보 수집 동의
       ----------------------------------------------------- */

    if (!$('data-consent').checked) {
      throw new Error(
        '회원정보 수집 및 이용 안내를 확인해 주세요.'
      );
    }


    /* -----------------------------------------------------
       6-3. 회원 유형 확인
       ----------------------------------------------------- */

    const type = document.querySelector(
      'input[name="join-type"]:checked'
    )?.value;

    if (!['guest', 'sanna'].includes(type)) {
      throw new Error(
        '회원 유형을 선택해 주세요.'
      );
    }


    /* -----------------------------------------------------
       6-4. 신청정보
       ----------------------------------------------------- */

    const memberAlias =
      $('member-alias').value.trim() || null;

    const referenceNote =
      $('reference-note').value.trim() || null;


    /* -----------------------------------------------------
       6-5. Supabase에 가입정보 저장
       ----------------------------------------------------- */

    // 서버 RPC 사용
    // 클라이언트가 정회원이나 관리자 권한을
    // 직접 부여할 수 없도록 합니다.

    const client = requireConfig();

    const { error } = await client.rpc(
      'complete_sanna_signup',
      {
        p_display_name: name,
        p_membership: type,
        p_member_alias: memberAlias,
        p_reference_note: referenceNote
      }
    );

    if (error) {
      throw error;
    }


    /* -----------------------------------------------------
       6-6. 회원가입 완료 후 로그아웃
       ----------------------------------------------------- */

    await client.auth.signOut();

    onboardingUser = null;

    setMode('login');

    if (type === 'sanna') {

      show(
        'SANNA 회원가입 및 정회원 신청이 완료되었습니다.\n' +
        '관리자가 실제 SANNA 멤버 여부를 확인한 후 승인합니다.\n' +
        '다시 로그인하면 승인 대기 상태를 확인할 수 있습니다.',
        'ok'
      );

    } else {

      show(
        'SANNA 일반 회원가입이 완료되었습니다.\n' +
        '이제 가입한 계정으로 로그인해 주세요.',
        'ok'
      );

    }

  } catch (err) {

    show(explainError(err), 'error');

  } finally {

    btn.disabled = false;

  }

});


/* =========================================================
   7. 가입 취소 및 로그아웃
   ========================================================= */

$('cancel-onboarding').addEventListener('click', async () => {

  try {

    if (db) {
      await db.auth.signOut();
    }

    onboardingUser = null;

    setMode('login');

    show(
      'SANNA 회원가입을 중단했습니다.\n' +
      '다시 인증하면 회원가입을 이어서 진행할 수 있습니다.',
      'info'
    );

  } catch (err) {

    show(explainError(err), 'error');

  }

});


/* =========================================================
   8. 비밀번호 재설정 메일 요청
   ========================================================= */

$('reset-password').addEventListener('click', async () => {

  clear();

  const email = $('email').value.trim();

  if (!email) {

    show(
      '비밀번호를 재설정할 이메일을 먼저 입력해 주세요.',
      'error'
    );

    return;
  }

  try {

    const client = requireConfig();

    const { error } = await client.auth.resetPasswordForEmail(
      email,
      {
        redirectTo: page('login.html')
      }
    );

    if (error) {
      throw error;
    }

    show(
      '비밀번호 재설정 메일을 요청했습니다.\n' +
      '받은편지함을 확인해 주세요.',
      'ok'
    );

  } catch (err) {

    show(explainError(err), 'error');

  }

});


/* =========================================================
   9. 새 비밀번호 저장
   ========================================================= */

$('new-password').addEventListener('submit', async (event) => {

  event.preventDefault();
  clear();

  try {

    const password = $('replacement-password').value;

    if (password.length < 8) {
      throw new Error(
        '비밀번호는 8자 이상이어야 합니다.'
      );
    }

    const client = requireConfig();

    const { error } = await client.auth.updateUser({
      password: password
    });

    if (error) {
      throw error;
    }

    // 비밀번호 변경 후 재로그인
    await client.auth.signOut();

    passwordRecovery = false;

    setMode('login');

    show(
      '비밀번호 변경이 완료되었습니다.\n' +
      '새 비밀번호로 다시 로그인해 주세요.',
      'ok'
    );

  } catch (err) {

    show(explainError(err), 'error');

  }

});


/* =========================================================
   10. 페이지 최초 실행
   ========================================================= */

async function init() {

  // Supabase 설정 전
  if (!db) {

    show(
      '아직 Supabase 인증 서버가 연결되지 않았습니다.\n' +
      'supabase-config.js에 프로젝트 주소와 공개 키를 설정해 주세요.',
      'info'
    );

    return;
  }


  /* -----------------------------------------------------
     10-1. 인증 이벤트 확인
     ----------------------------------------------------- */

  db.auth.onAuthStateChange((event) => {

    if (event === 'PASSWORD_RECOVERY') {

      passwordRecovery = true;

      setMode('password');

    }

  });


  /* -----------------------------------------------------
     10-2. 기존 세션 또는 소셜 인증 복귀 확인
     ----------------------------------------------------- */

  try {

    const user = await getVerifiedUser();

    if (user) {

      const url = new URL(window.location.href);

      const recovery =
        passwordRecovery ||
        url.searchParams.get('type') === 'recovery' ||
        new URLSearchParams(
          url.hash.slice(1)
        ).get('type') === 'recovery';

      if (recovery) {

        setMode('password');

        return;
      }

      await routeUser();

      return;
    }


    /* ---------------------------------------------------
       10-3. OAuth 인증 오류 표시
       --------------------------------------------------- */

    const url = new URL(window.location.href);

    const hashParams = new URLSearchParams(
      url.hash.slice(1)
    );

    const authError =
      url.searchParams.get('error_description') ||
      hashParams.get('error_description');

    if (authError) {
      show(authError, 'error');
    }

  } catch (err) {

    show(explainError(err), 'error');

  }

}


// 실행
init();
