# Apps Script 설정

1. Google Spreadsheet를 새로 만들고 URL의 ID를 복사합니다.
2. Extensions > Apps Script에서 `Code.gs` 내용을 붙여넣습니다.
3. 프로젝트 설정 > 스크립트 속성에 `SPREADSHEET_ID`를 추가하고 Spreadsheet ID를 값으로 저장합니다.
4. 함수 선택에서 `setupSheets`를 실행해 권한을 승인합니다.
5. 배포 > 새 배포 > 웹 앱을 선택합니다.
6. 실행 사용자: 나, 액세스 권한: 모든 사용자로 설정합니다. 설문 링크를 아는 사람에게 응답 데이터가 보이지 않도록 Spreadsheet 자체는 공유하지 마세요.
7. 배포 URL을 웹 앱의 `.env.local`에 입력합니다.

Apps Script는 `participants`, `responses`, `events`, `summary` 탭을 만들고, 제출 1건을 한 번에 기록합니다. `respondent_id`가 같은 완료 응답은 다시 쌓지 않습니다.
