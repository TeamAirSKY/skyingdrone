# Firestore 이전

회원·비밀번호·접수·건의·운영 설정·멤버 목록·인증 기록을 Firestore로 이전합니다.
사이트와 API는 기존 Vercel에서 실행하며 사진은 GitHub `assets` 경로를 유지합니다.
Firebase Storage 또는 Firebase 유료 Functions를 새로 만들지 않습니다.
기존 ADMIN_PIN, ADMIN_SESSION_SECRET, ADMIN_AUDIT_SECRET을 변경하지 마세요.
특히 세션 비밀키를 바꾸면 기존 비밀번호 해시와 암호화된 번호를 사용할 수 없습니다.

## 먼저 필요한 연결

1. Firebase 콘솔에서 프로젝트와 Firestore의 `(default)` 데이터베이스를 생성합니다.
   프로덕션 모드로 생성하고 `firebase/firestore.rules`의 서버 전용 규칙을 적용합니다.
2. 프로젝트 전용 서버 서비스 계정에 Firestore 데이터 접근 권한
   (`roles/datastore.user`)을 부여합니다. 서비스 계정 JSON은 채팅이나 저장소에 넣지 않습니다.
3. Vercel **Production** 환경 변수에 다음을 준비합니다.
   - `FIREBASE_PROJECT_ID`: Firebase 프로젝트 ID (Config)
   - `FIREBASE_SERVICE_ACCOUNT_JSON`: 서비스 계정 JSON 전체 (Secret)
   - `AIRSKY_STORAGE_BACKEND`: 아직 설정하지 않음. 검증 전에는 Blob을 유지합니다.
4. 신뢰하는 로컬 작업 환경에서는 Google ADC 또는
   `GOOGLE_APPLICATION_CREDENTIALS` 파일 경로로 실행할 수 있습니다.
   운영 비밀키를 로컬에 복사할 필요는 없습니다. 키를 생성했다면 안전하게 보관합니다.

## 원본 접근이 복구된 후

Blob의 `limits-exceeded-suspended` 상태에서는 원본을 내보낼 수 없습니다.
사용량 초기화·한도 해제 또는 이미 확보한 백업이 먼저 필요합니다.
데이터를 비우거나 새 회원을 만드는 방식으로 장애를 우회하지 않습니다.

1. 기존 운영 배포에 `AIRSKY_MIGRATION_READ_ONLY=1`을 적용하고 재배포합니다.
   이 설정은 신청·비밀번호 변경뿐 아니라 감사 기록·카운터·정리 작업도 멈춥니다.
   다른 운영/미리보기 배포에서 같은 원본 저장소로 쓰지 않도록 막습니다.
   기존 진행 중인 요청이 모두 끝난 뒤 내보냅니다.
2. 원본 Blob 접근 자격증명이 설정된 신뢰하는 환경에서 실행합니다.
   ```sh
   mkdir -p backups
   node scripts/migrate-firestore.cjs export backups/airsky-before-firestore.json
   ```
   백업에는 개인정보·비밀번호 해시·암호화된 번호가 있습니다. 비공개로 보관하세요.
   도구는 기존 백업 파일을 덮어쓰지 않습니다.
3. 대상 Firebase 접근 자격증명이 설정된 환경에서 검증합니다.
   ```sh
   node scripts/migrate-firestore.cjs import backups/airsky-before-firestore.json
   ```
   기본은 dry-run이며 아무것도 쓰지 않습니다.
4. 프로젝트 ID를 확인한 뒤 실제 복사합니다.
   ```sh
   node scripts/migrate-firestore.cjs import backups/airsky-before-firestore.json --write
   node scripts/migrate-firestore.cjs verify backups/airsky-before-firestore.json
   ```
   모든 값과 만료 시간을 읽어 다시 비교합니다. 인증 기록 서명은 원문 그대로 복사합니다.
   최종 검증 후에만 `airsky_meta/migration`에 `status=verified`를 기록합니다.
   중간 실패는 같은 백업으로 재시도할 수 있습니다. 다른 백업이나 이미 운영 전환한 DB는
   덮어쓰지 않습니다. 이미 데이터가 있는 대상에는 새 마이그레이션을 시작하지 않습니다.
5. Vercel Production에 `AIRSKY_STORAGE_BACKEND=firestore`를 설정하고
   `AIRSKY_MIGRATION_READ_ONLY`를 해제한 뒤 재배포합니다.
   이 단계 전에는 코드만 배포해도 기존 저장소가 바뀌지 않습니다.
   Firestore를 선택하면 Blob으로 자동 폴백하지 않습니다.
6. 실제 회원 로그인, 이름·역할, 인증 기록, 비밀번호 변경, 신청 조회·수정을 점검합니다.
   사진 경로와 접수번호도 확인합니다. 원본과 백업은 확인 완료 전 삭제하지 않습니다.

## 롤백

전환 후 쓰기가 아직 없다면 `AIRSKY_STORAGE_BACKEND`를 제거하고 원본 Blob이
접근 가능한 상태인지 확인한 뒤 재배포할 수 있습니다.
전환 후 새 데이터가 생겼다면 먼저 쓰기를 멈추고 데이터를 대조하세요.
그 상태에서 단순히 Blob으로 전환하면 새 신청·변경 비밀번호가 유실됩니다.

## 사용량

문서 읽기·쓰기 횟수에 무료 한도가 있습니다. 비용이 없는 무제한 서버가 아닙니다.
쿼리는 필요한 목록 문서만 읽고, MGET은 한 번에 읽으며, 동시 수정은 트랜잭션으로 처리합니다.
인증 기록은 영구 보존하며 매일 정리 작업에서도 제외합니다.
신청/건의/지원의 기존 만료 시간은 유지합니다. 자동 TTL 유료 기능에 의존하지 않습니다.

## 검증

```sh
npm test
npm exec --yes --package=firebase-tools -- firebase emulators:exec --project demo-airsky --only firestore 'node --test tests/firestore.integration.cjs'
```

에뮬레이터 테스트는 `demo-airsky`만 사용하며 실제 회원 데이터는 읽거나 쓰지 않습니다.

## 긴급 새 데이터 복구 (기존 Blob 보존)

사용자가 기존 데이터 없이 새로 시작하도록 승인한 경우에만 사용합니다.
`AIRSKY_STORAGE_BACKEND=firestore`와 `AIRSKY_FIRESTORE_FRESH_START=1`을 Production에 설정하고 재배포합니다.
첫 저장소 접근 시 트랜잭션으로 빈 데이터베이스를 확인한 뒤 기본 크루 소개와 빈 개인 관리자 목록을 생성합니다.
기존 `ADMIN_PIN`의 마스터 관리자 로그인을 유지하며 개인 계정은 관리자가 다시 등록합니다.
이미 데이터 또는 미완료 이전 표시가 있는 대상은 초기화하지 않습니다. 검증된 대상은 재시작해도 기존 데이터를 보존합니다.
복구 후 `AIRSKY_FIRESTORE_FRESH_START`를 제거하고 다시 배포합니다.
기존 Blob 원본을 삭제하지 마세요. 추후 가져올 때에는 새 Firestore 데이터를 덮어쓰지 않도록 별도 병합이 필요합니다.
