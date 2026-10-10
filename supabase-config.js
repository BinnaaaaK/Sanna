
/* =========================================================
   SANNA OFFICIAL WEBSITE
   supabase-config.js

   Supabase 프로젝트 연결 및 소셜 인증 설정

   주의:
   이 파일은 GitHub Pages에 공개됩니다.
   Secret Key, service_role Key, OAuth Client Secret 등
   비밀정보를 절대 입력하지 마세요.
   ========================================================= */


window.SANNA_CONFIG = {

  /* =====================================================
     1. Supabase 프로젝트 주소

     Supabase Dashboard
     → Project Settings
     → API / Connect

     프로젝트 생성 후 실제 주소로 교체하세요.
     ===================================================== */

  url: "https://YOUR_PROJECT_REF.supabase.co",


  /* =====================================================
     2. Supabase 공개용 API 키

     Supabase Dashboard
     → Project Settings
     → API Keys

     Publishable Key 권장
     (기존 anon public key도 사용 가능)

     Secret Key 또는 service_role Key는 사용 금지
     ===================================================== */

  publishableKey: "YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY",


  /* =====================================================
     3. 간편로그인 활성화 설정

     각 소셜 인증 제공자를 실제로 연결한 다음
     해당 값을 true로 변경하세요.

     false = 버튼 클릭 시 미연결 안내
     true  = 실제 OAuth 인증 요청
     ===================================================== */

  enabledProviders: {

    // 카카오 로그인
    kakao: false,

    // 네이버 로그인 (커스텀 OIDC 연동 필요)
    naver: false,

    // Google 로그인
    google: false

  }

};


/* =========================================================
   4. 설정 파일 안내

   회원가입 및 로그인 처리는 login.js가 담당합니다.

   인증 상태와 회원 권한 확인은
   auth-core.js가 담당합니다.

   정회원 승인 권한은 Supabase 데이터베이스에서
   확인하며 이 파일에서 부여하지 않습니다.
   ========================================================= */
