# 개인 전자명함

진입: `/passkey.html` 비밀번호 인증 후 인증서 아래 ‘명함’. 직접 진입은 `/card-manage.html`.
공개 페이지는 `/card.html?id=<UUID>`이며 인증이 필요 없습니다. 처음에는 비공개이고, 관리 화면에서 ‘공개 페이지 사용’을 선택하고 저장하면 공개됩니다.
기존 메인 화면·관리자 버튼·경로는 수정하지 않습니다.
Vercel Hobby의 함수 12개 제한에 맞춰 `/api/business-cards`는 기존 crew-roster 함수로 라우팅하고 독립 명함 핸들러(`lib/business-card-api.js`)로 즉시 분기합니다. 기존 crew-roster 요청 처리 방식과 외부 URL은 유지됩니다.

## 인증과 데이터

기존 인증서 unlock API와 개인 계정 ID/활성화/version 검사를 재사용합니다.
관리 전용 HttpOnly/Secure/SameSite=Strict 쿠키는 1시간 유효하며 서명에 별도 도메인을 사용합니다.
관리 인증으로 관리자 쿠키를 발급하지 않습니다. 관리 세션도 계정 중지·삭제·비밀번호 변경 시 다음 요청에서 거부됩니다.
모든 쓰기는 출처 검사와 인증을 거치며 요청의 사용자 ID/공개 UUID를 수정 권한으로 사용하지 않습니다.
명함 레코드의 revision을 검사해 다른 기기에서 먼저 저장한 내용을 덮어쓰지 않습니다.
세션이 만료되면 다시 인증하고 저장된 내용을 불러오세요. 저장 전 초안은 서버나 localStorage에 자동 저장하지 않습니다.

원본 레코드: 기존 서버 저장 어댑터의 `airsky:card:user:<account-id>`.
공개 인덱스: `airsky:card:public:<UUID>` → 계정 ID. UUID는 최초 생성 시에만 정하며 이후 정보/파일 편집으로 변경하지 않습니다.
공개 응답은 허용 항목만 새 객체로 구성하며 비공개 값, 계정 ID, 파일 저장 경로, revision은 전달하지 않습니다.
공개를 중지하거나 계정을 삭제·비활성화하면 공개 페이지와 파일 요청이 404가 됩니다.
사진·파일 응답도 매 요청 공개 여부를 검사하며 `Cache-Control: no-store`로 응답합니다.

현재 운영 설정처럼 `AIRSKY_STORAGE_BACKEND=firestore`이면 **사진과 패스도 기존 Firestore**를 사용합니다.
`airsky_card_files` 컬렉션에 최대 512KiB 바이너리 조각으로 저장하고 8개 이하씩 나눠 반영합니다. 모든 조각 저장이 완료된 뒤 명함에 연결합니다.
파일을 다시 읽을 때 길이와 SHA-256을 검증합니다. 기존 서버 전용 Firestore 규칙(IAM Admin SDK만 허용)이 그대로 적용됩니다.
Firebase Storage, 새 유료 서비스, 브라우저 DB 직접 접근은 필요하지 않습니다.
다른 저장 백엔드에서는 기존 비공개 Vercel Blob을 사용합니다. 이미 저장한 파일의 backend를 따라 읽기·삭제하므로 이후 백엔드 설정이 바뀌어도 참조를 혼동하지 않습니다.
파일 교체·삭제는 포인터를 먼저 갱신한 다음 이전 파일을 삭제합니다. 물리 삭제가 실패해도 이전 파일은 API에서 접근할 수 없습니다.
물리 삭제 실패·프로세스 중단 시 접근할 수 없는 파일 조각이 남을 수 있으므로 운영 보관 정책에 맞춰 관리해야 합니다.
명함은 접수 정보의 180일 만료/정리 대상이 아닙니다.

공개 URL의 기본 도메인은 기존 운영 도메인 `https://skying-drone.kro.kr`입니다.
다른 운영 도메인에서는 `BUSINESS_CARD_ORIGIN`에 사이트의 고정 HTTPS origin을 설정하세요(경로·끝 슬래시 제외).
도메인 설정을 바꾸면 기존 인쇄 QR이 사용하는 도메인도 유지/리디렉션해야 합니다.

## 입력과 파일

이름 필수, 나머지 선택. 링크는 http/https만 허용하고 자격증명을 포함한 URL은 거부합니다.
소개와 추가 정보는 HTML이 아닌 `textContent`로 렌더링합니다.
링크·추가 정보 각 최대 20개, 입력 길이·색상·좌표·순서를 서버에서 검증합니다.
이미지·패스 각각 최대 10MiB입니다. 인증된 512KiB 단위 업로드를 임시 저장하고 완료 시 원본을 검증해 연결합니다. 임시 조각은 30분 후 만료되며 기존 정리 작업에서 삭제됩니다. 파일 응답은 스트리밍합니다.
사진은 JPG/PNG/WebP만 허용하고 실제 디코딩·1600만 픽셀 제한·메타데이터 제거·WebP 재인코딩 후 저장합니다.
SVG/HTML/애니메이션 파일은 허용하지 않습니다.
사진·패스 업로드/교체/삭제는 즉시 저장되고, 텍스트·색상·순서·공개 설정은 저장 버튼으로 반영합니다.

## Apple Wallet

사용자가 이미 서명한 `.pkpass` 원본을 업로드해 배포합니다. 자동 생성·재서명·내부 수정은 하지 않습니다.
ZIP 항목 수(64개)·총 압축 해제 크기(6MiB)·개별 항목(4MiB)·경로·암호화·중복 이름을 검사합니다.
`pass.json`, `manifest.json`, `signature`, `icon.png`와 필수 pass 필드, 매니페스트 SHA-1을 검사합니다.
서명 파일의 존재는 검사하되 CMS 서명·Apple 인증서 체인·만료/취소를 검증하지 않으므로 **실제 Wallet 등록 성공을 보장하지 않습니다**.
패스 QR이 고유 공개 URL과 다르면 경고하며 파일을 임의로 변경하지 않습니다.
공개 설정된 패스가 있을 때 iPhone/iPod 사용자 에이전트에서만 ‘Apple Wallet에 추가’ 링크를 표시합니다.
응답은 `application/vnd.apple.pkpass`이며 사용자 기기의 Wallet 추가 화면으로 열리는 방식입니다.
Android에서는 버튼을 만들지 않습니다. 공개 패스 파일은 다운로드 가능한 배포 파일이므로 비밀 정보를 넣지 마세요.
웹 명함 수정으로 패스 내부가 업데이트되지 않습니다. 변경된 패스는 원본 편집·서명 후 다시 업로드해야 합니다.

## 검증

- `npm test`: 서버 권한, 공개 필터, revision, URL·QR 유지, 파일 제한·구조, 이미지 처리, Firestore 바이너리 저장, 기존 기능 회귀.
- `CHROMIUM_PATH=/path/to/chrome node tests/browser-business-cards.cjs`: 실제 페이지+API 핸들러를 연결한 격리 테스트 서버. 인증서 진입/직접 PIN 인증/모바일 편집/저장/독립 브라우저 조회·수정/QR 실제 해독/iPhone·Android UA/패스 MIME·원본 바이트/삭제/로그아웃 확인.
- `CHROMIUM_PATH=/path/to/chrome node tests/browser-certificate.cjs`: 기존 마우스·터치 키패드, 비밀번호 변경, 관리자 페이지 이동 회귀.

브라우저 테스트는 테스트 전용 저장소와 구조 검사 전용 패스(실제 Apple 서명 아님)를 사용합니다.
운영 개인정보를 읽거나 쓰지 않습니다. 물리적으로 다른 기기·실제 iPhone Safari에서의 패스 열기 및 Apple Wallet 등록은 별도 실기기 검증이 필요합니다.

## 소개 가져오기·QR 표시·사진 저장

관리 화면의 ‘소개 페이지 정보 가져오기’는 인증 계정과 이름/ID가 일치하는 공개 크루 프로필만 가져옵니다.
소속(AIRSKY), 역할, 소개와 저장소 내 프로필 사진을 반영하며 다른 회원을 요청 body의 ID로 선택할 수 없습니다.
기존 명함 UUID와 공개 설정은 유지됩니다. 가져오기는 즉시 서버에 저장됩니다.
사이트 내부 사진은 원래 공개 assets URL을 참조하며, 직접 업로드한 프로필 사진이 있으면 우선합니다.

명함 본문은 소개를 표시합니다. 내 명함 화면에서 QR은 별도 ‘QR 보기’ 대화상자에 표시합니다. 공개 페이지의 조작 버튼은 ‘명함 사진 저장’만 제공하며 QR 보기·Wallet·주소 복사·홈페이지 바로가기는 표시하지 않습니다.
QR 링크는 같은 고유 공개 페이지이며 비공개일 때는 관리 화면에서 공유 전 공개 저장 안내를 합니다.
공개 페이지의 ‘명함 사진 저장’은 공개 DTO만 이용해 기기 안에서 PNG를 만듭니다.
공개 사진·색상·소개·정보와 고유 URL/QR을 포함하고, HTML 실행이나 외부 이미지 변환 서비스 호출은 하지 않습니다.
다운로드 및 가능한 기기의 파일 공유 메뉴, 이미지 길게 누르기로 사진 저장을 지원합니다.
모바일 브라우저마다 사진 앱 저장 메뉴의 이름은 다를 수 있고 사용자 확인 없이 사진 보관함에 직접 쓰지는 않습니다.
매우 긴 프로필은 PNG 크기 제한에 맞게 요약하고 전체 내용은 QR로 연결합니다.

내 명함 관리 화면의 Wallet 버튼은 공개 표시 여부와 관계없이 본인의 업로드된 패스를 인증된 파일 URL로 엽니다.
아이폰과 등록 파일이 있을 때만 버튼을 표시합니다. 패스가 없으면 필요한 파일 등록 안내를 표시합니다.
공개 페이지에는 Wallet 버튼이나 등록 안내를 표시하지 않습니다. 내 명함의 Wallet 버튼과 관리자 패스 설정은 유지합니다.

## 명함 보기와 관리 분리

`card-manage.html`에 로그인하면 기본 화면에는 저장된 명함과 QR/사진 저장/사용 가능한 Wallet 동작만 표시합니다.
상단 ‘관리’를 누를 때만 기존 편집 폼·사진과 패스 업로드·공개 설정·인증 종료·주소 도구가 열립니다.
‘명함 보기’ 또는 ‘명함으로 돌아가기’로 돌아올 수 있고, 저장하지 않은 초안을 버릴 때에는 확인합니다.
명함 화면은 서버 저장값으로 구성하며 편집 미리보기의 초안을 외부 표시 화면과 구분합니다.
기존 공개 URL과 QR, 인증·저장 권한 및 모든 편집 기능은 유지합니다.

Apple Wallet setup is restricted to the administrator’s 사이트 관리 tab and the `site` permission. `/api/site-settings?wallet=1` checks the existing admin session for listing, upload, replacement, publication and deletion. Card sessions cannot change pass files or their Wallet visibility. Owners automatically receive the new permission; existing scoped administrators must be granted 사이트 관리 explicitly. On the personal card screen, iPhone owners without an available pass see an administrator registration request. The public card screen offers only image saving and never displays Wallet actions or registration guidance.
