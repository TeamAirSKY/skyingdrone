# AIR SKY 촬영 신청 운영 설정

Vercel의 이 저장소에 연결된 프로젝트에서 Settings → Environment Variables에 아래 값을 Production용으로 등록하고 재배포합니다. 비밀 값은 채팅, 소스 코드, Git에 넣지 않습니다.

| 이름 | 값 |
| --- | --- |
| `ADMIN_PIN` | 운영자가 정한 숫자 6자리 |
| `ADMIN_SESSION_SECRET` | 암호학적으로 생성한 32자 이상 비밀 값 |
| `KV_REST_API_URL` | Upstash Redis 데이터베이스의 HTTPS REST URL |
| `KV_REST_API_TOKEN` | 해당 데이터베이스의 REST 쓰기 토큰 |

Vercel Marketplace의 Upstash Redis 연동 또는 Upstash Console에서 데이터베이스를 생성합니다. 연동이 `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`으로 값을 제공하는 경우 코드가 이 이름도 지원합니다. 로컬 파일이나 브라우저 저장소에 신청을 저장하지 않습니다.

관리자 세션은 1시간 유효한 서명된 HttpOnly/Secure/SameSite=Strict 쿠키입니다. 서버가 6자리 PIN을 확인합니다. 로그인과 신청 접수에는 IP별 속도 제한이 있습니다. 신청 레코드는 접수부터 180일 후 만료됩니다. 원본 IP는 저장하지 않습니다. 외부 주소 검색은 Daum 우편번호 서비스를 이용하며 주소가 경기도인지 클라이언트와 서버에서 확인합니다. 지도 확인은 Kakao Map의 주소 검색 화면을 엽니다.

설정 전에는 신청 API가 503과 준비 중 안내를 반환하며 접수 성공을 표시하지 않습니다. 관리자 목록은 인증 없이 읽을 수 없습니다. `/api` 서버 함수 실행이 가능한 Vercel에 배포해야 하며 GitHub Pages에서는 접수 기능을 사용할 수 없습니다.

배포 후 확인:

1. `/request.html`에서 경기도 주소로 테스트 신청, 접수 번호 확인.
2. `/admin.html`에서 설정한 PIN으로 로그인하고 신청의 닉네임·주소·요청사항 확인.
3. 수락/반려 처리 후 새로고침하여 상태가 저장되는지 확인.
4. 로그아웃 후 `/api/filming-requests`가 401을 반환하는지 확인.

소개 페이지의 영상 5개·조회수 1,674회·구독자 11명은 기존 고정값이며 YouTube 자동 연동은 아직 구현하지 않았습니다.

인스타그램 아이디는 별도 선택 동의 후 저장합니다. 관리자가 촬영 종료 후 반드시 촬영 완료 상태로 처리해야 아이디가 즉시 삭제됩니다. 반려 처리 시에도 삭제되며, 그 외에는 기존 180일 레코드 만료가 적용됩니다. DM 발송은 관리자가 Instagram에서 직접 진행합니다.
