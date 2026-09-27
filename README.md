# PIKO 인터랙티브 설문

PIKO의 홈 화면 구성 요소를 실제로 클릭하며 비교하는 리서치 프로토타입입니다. 가상의 작품과 추상 포스터만 사용하며, 이름 또는 닉네임과 설문 답변·클릭 이벤트를 구조화해 저장합니다.

## 1. 로컬 실행

필요한 것: Node.js 20 이상, VS Code

```bash
npm install
npm run dev
```

브라우저에서 터미널에 표시된 로컬 주소를 엽니다. 기본값은 `http://localhost:5173`입니다.

처음에는 mock 모드로 동작합니다. `.env.local`을 만들고 아래처럼 둡니다.

```env
VITE_USE_MOCK_API=true
VITE_APPS_SCRIPT_URL=
```

mock 제출은 브라우저 `localStorage`의 `piko-mock-submissions-v1`에 저장됩니다. 테스트 초기화는 개발자 도구에서 `localStorage.removeItem('piko-survey-session-v1')`를 실행하세요.

## 2. Google Sheets 연결

1. Google Spreadsheet를 만듭니다.
2. **확장 프로그램 > Apps Script**를 엽니다.
3. [apps-script/Code.gs](apps-script/Code.gs)를 붙여넣습니다.
4. Apps Script 프로젝트 설정 > 스크립트 속성에 `SPREADSHEET_ID`를 추가합니다.
5. `setupSheets()`를 선택해 한 번 실행합니다.
6. 배포 > 새 배포 > 웹 앱을 선택합니다.
7. 실행 사용자 `나`, 액세스 권한 `모든 사용자`로 배포합니다.
8. 발급된 웹 앱 URL을 `.env.local`에 넣습니다.

```env
VITE_USE_MOCK_API=false
VITE_APPS_SCRIPT_URL=https://script.google.com/macros/s/배포ID/exec
```

Spreadsheet는 공개 공유하지 마세요. Apps Script 상세 절차는 [apps-script/README.md](apps-script/README.md)를 참고하세요.

## 3. 확인 방법

`npm run dev`로 실제 설문을 끝까지 완료하고 제출합니다. Apps Script 웹 앱 주소를 브라우저에서 열면 healthcheck JSON이 표시됩니다. Spreadsheet에는 `participants`, `responses`, `events`, `summary` 탭이 생성됩니다. 시안 비교는 `responses` 탭에서 `question_id`와 `variant_id` 기준 피벗 테이블을 만들면 됩니다.

## 4. 수정 위치

- 설문 화면과 질문: `src/App.tsx`
- 가상 작품·색상: `src/App.tsx` 상단의 `films`
- 응답·이벤트 타입: `src/types/survey.ts`
- mock/Google Sheets 전송: `src/repositories.ts`
- 화면 디자인: `src/App.css`, `src/index.css`
- Apps Script 저장 검증: `apps-script/Code.gs`

Archive는 이번 홈 기본 시안에 넣지 않았습니다. 과거 몰입도 선택지는 연구 질문으로만 수집하고, 이후 Archive 기능으로 이동할 수 있도록 데이터 구조를 열어둔 상태입니다.

## 5. 검증 명령

```bash
npm run build
npm run lint
npm run test
```

## 6. GitHub 배포

1. GitHub에서 새 저장소를 만듭니다.
2. 이 폴더를 저장소에 push합니다.
3. 저장소 Settings > Pages > Source에서 **GitHub Actions**를 선택합니다.
4. 실제 Sheets를 연결할 때만 Settings > Secrets and variables > Actions에서 `VITE_APPS_SCRIPT_URL` secret과 `VITE_USE_MOCK_API` variable(`false`)를 등록합니다.
5. `main` 브랜치에 push하면 `.github/workflows/deploy.yml`이 자동 배포합니다.

mock으로 공개 테스트하려면 별도 설정 없이 배포할 수 있습니다. 공개 설문 전에는 동의 문구, 데이터 보관 기간, 실제 수집 항목을 연구 책임자와 다시 확인하세요.
