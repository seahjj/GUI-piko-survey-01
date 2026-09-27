# iOS 27 영감형 PIKO 설문 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 설문 기능을 보존하면서 모든 화면을 iOS 27 영감형 Liquid Glass 반응형 웹 UI로 전환한다.

**Architecture:** 기존 `App.tsx`의 화면 전환과 상태 관리에는 손대지 않고, 공통 토큰과 화면별 재정의 CSS를 새 테마 스타일시트에 분리한다. 필요한 표현용 클래스만 기존 마크업에 추가해 유리 표면, 선택 상태, 진행 상태를 일관되게 적용한다.

**Tech Stack:** React 19, TypeScript, Vite, CSS, Vitest, Testing Library

**Spec:** `docs/superpowers/specs/2026-09-27-ios27-inspired-survey-design.md`

## Global Constraints

- `SurveySession`, repository, 질문 ID, 이벤트 이름 및 제출 흐름을 수정하지 않는다.
- Apple 로고, SF Symbols, 정적 에셋과 네이티브 iOS 화면을 복제하지 않는다.
- 시스템 글꼴(`-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, sans-serif)을 우선 사용한다.
- 파랑은 주요 행동과 선택 상태, 초록은 성공·여유도·히트맵 단계에만 사용한다.
- 720px 이하에서 모든 다열 레이아웃은 한 열로 전환한다.
- 기존 ARIA 레이블과 버튼 semantics를 보존하고 `:focus-visible` 포커스 표시를 제공한다.
- 이 작업공간은 Git 저장소가 아니므로 커밋 단계는 수행하지 않는다.

## Review Focus

- 키보드 포커스로 카드·칩·점수 버튼을 순회할 때 선택 상태가 시각적으로 식별되어야 한다.
- 비활성화된 다음 버튼은 유리 표면 위에서도 활성 버튼과 명확히 구분되어야 한다.
- 한 열 모바일 화면에서 헤더의 브랜드와 진행 단계가 사라지지 않아야 한다.
- 히트맵의 가장 옅은 단계와 선택 테두리는 밝은 패널에서도 구별되어야 한다.
- 홈 프로토타입 안의 밝은 텍스트·포스터·추천 사유가 새 앱 배경과 충돌하지 않아야 한다.

---

## File Structure

- Create: `src/ios-theme.css` — iOS 27 영감형 공통 토큰, 유리 표면, 컨트롤, 화면별 오버라이드와 반응형 규칙
- Modify: `src/App.tsx` — 새 테마 import 및 유리 표면/선택 표식에 필요한 표현용 클래스 추가
- Modify: `src/App.test.tsx` — 선택 가능한 화면의 기존 접근성·상호작용 회귀 테스트 확장
- Modify: `src/heatmap.css` — 주간 히트맵을 공통 유리 표면과 조화시키는 색상·포커스 상태 조정

### Task 1: Theme foundation and shell

**Files:**
- Create: `src/ios-theme.css`
- Modify: `src/App.tsx:1-3, 192-241`
- Test: `src/App.test.tsx`

**Interfaces:**
- Consumes: existing `App`, `SurveyApp`, and `Layout` markup
- Produces: `ios-theme.css` classes `glass-shell`, `glass-header`, `glass-card`, and CSS custom properties consumed by later task styles; a test-only `renderSurveyAtStep(step: number): void` helper that seeds the existing localStorage session before rendering `App`

- [x] **Step 1: Write the failing test**

```tsx
function renderSurveyAtStep(step: number) {
  localStorage.setItem("piko-survey-session-v1", JSON.stringify({
    version: 1, respondentId: "test-respondent", sessionId: "test-session",
    startedAt: "2026-09-21T00:00:00.000Z", currentStep: step,
    answers: {}, events: [],
    variantOrder: ["judgement-a", "judgement-b", "judgement-c"], submitted: false,
  }));
  render(<App />);
}

it("keeps the current progress visible in the glass survey shell", () => {
  renderSurveyAtStep(3);
  expect(screen.getByText("3 / 6")).toBeTruthy();
  expect(screen.getByRole("main").className).toContain("glass-shell");
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npm test -- src/App.test.tsx`

Expected: FAIL because `glass-shell` is not present.

- [x] **Step 3: Implement the global visual foundations**

Create `src/ios-theme.css` with light blue-gray background, translucent white surfaces, system font stack, blue action tokens, green semantic tokens, shadows, `backdrop-filter`, and visible focus rings. Import it in `App.tsx`, and add `glass-shell` to the main app shell plus `glass-header` to the header. Do not change state, routes, copy, or event handlers.

- [x] **Step 4: Run test to verify it passes**

Run: `npm test -- src/App.test.tsx`

Expected: PASS.

- [x] **Step 5: Verify the shell visually at desktop and mobile widths**

Run: `npm run dev`

Expected: translucent header, readable progress, and no horizontal overflow at 720px or below.

### Task 2: Form controls, cards, and selection states

**Files:**
- Modify: `src/ios-theme.css`
- Modify: `src/App.tsx:289-714, 932-1143, 1352-1425`
- Test: `src/App.test.tsx`

**Interfaces:**
- Consumes: Task 1 `glass-card` and color custom properties
- Produces: `selection-card` and `selection-indicator` classes for selected interactive controls

- [x] **Step 1: Write the failing test**

```tsx
import { fireEvent } from "@testing-library/react";

it("announces the selected heatmap day", () => {
  renderSurveyAtStep(3);
  const monday = screen.getAllByRole("button", { name: "9월 21일 월요일 선택" })[0];
  fireEvent.click(monday);
  expect(screen.getByRole("button", { name: "9월 21일 월요일 선택됨" })).toBeTruthy();
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npm test -- src/App.test.tsx`

Expected: FAIL because the selected button keeps the unselected accessible label.

- [x] **Step 3: Apply glass cards and controls across survey screens**

Update the new theme stylesheet so form fields, text areas, choice chips, score buttons, film cards, collection cards, review cards, primary/secondary buttons and completion state use consistent rounded glass surfaces. Add only the presentation classes needed for selected cards to display a blue border and CSS-drawn check indicator. Change selected heatmap button labels from `선택` to `선택됨` while preserving each existing `onClick`, `disabled`, and ARIA behavior.

- [x] **Step 4: Run test to verify it passes**

Run: `npm test -- src/App.test.tsx`

Expected: PASS, with the clicked day announced as selected.

- [x] **Step 5: Verify representative screen states**

Run: `npm run dev`

Expected: one unselected and one selected card, a disabled next button, a focused input, and the completion state remain readable.

### Task 3: Calendar, prototype, and responsive polish

**Files:**
- Modify: `src/ios-theme.css`
- Modify: `src/heatmap.css`
- Test: `src/App.test.tsx`

**Interfaces:**
- Consumes: Tasks 1-2 color tokens and selected state classes
- Produces: final responsive theme for calendar comparison and the home prototype

- [x] **Step 1: Write the failing test**

```tsx
it("renders both weekly heatmap panels as glass cards", () => {
  renderSurveyAtStep(3);
  expect(document.querySelectorAll(".heatmap-panel.glass-card")).toHaveLength(2);
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npm test -- src/App.test.tsx`

Expected: FAIL because the heatmap panels do not yet use the shared glass-card surface.

- [x] **Step 3: Refine the calendar and prototype surfaces**

Add `glass-card` to each `heatmap-panel`, then adjust `heatmap.css` and the theme overrides so the weekly heatmap uses the green semantic scale on a translucent light panel and keeps its selected outline visible. Restyle the embedded home prototype with the same neutral surfaces, blue actions, green availability indicator, and readable poster/tooltip contrast. Add the specified one-column mobile overrides without modifying its data or interactions.

- [x] **Step 4: Run test to verify it passes**

Run: `npm test -- src/App.test.tsx`

Expected: PASS, with two shared glass-card heatmap panels.

- [x] **Step 5: Run final verification**

Run: `npm test`

Expected: PASS with no failed test files.

Run: `npm run lint`

Expected: exit code 0.

Run: `npm run build`

Expected: exit code 0 and a production bundle in `dist/`.
