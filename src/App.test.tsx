// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup } from "@testing-library/react";
import App from "./App";

function renderSurveyAtStep(step: number) {
  localStorage.setItem(
    "piko-survey-session-v1",
    JSON.stringify({
      version: 1,
      respondentId: "test-respondent",
      sessionId: "test-session",
      startedAt: "2026-09-21T00:00:00.000Z",
      currentStep: step,
      answers: {},
      events: [],
      variantOrder: ["judgement-a", "judgement-b", "judgement-c"],
      submitted: false,
    }),
  );

  render(<App />);
}

function renderSubmittedSurvey() {
  localStorage.setItem(
    "piko-survey-session-v1",
    JSON.stringify({
      version: 1,
      respondentId: "test-respondent",
      sessionId: "test-session",
      startedAt: "2026-09-21T00:00:00.000Z",
      currentStep: 6,
      answers: {},
      events: [],
      variantOrder: ["judgement-a", "judgement-b", "judgement-c"],
      submitted: true,
    }),
  );

  render(<App />);
}

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("calendar heatmap", () => {
  it("keeps the current progress visible in the glass survey shell", () => {
    renderSurveyAtStep(3);

    expect(screen.getByText("3 / 6")).toBeTruthy();
    expect(screen.getByRole("main").className).toContain("glass-shell");
  });

  it("shows a Monday-first compact calendar for the selected week", () => {
    localStorage.setItem(
      "piko-survey-session-v1",
      JSON.stringify({
        version: 1,
        respondentId: "test-respondent",
        sessionId: "test-session",
        startedAt: "2026-09-21T00:00:00.000Z",
        currentStep: 3,
        answers: {},
        events: [],
        variantOrder: ["judgement-a", "judgement-b", "judgement-c"],
        submitted: false,
      }),
    );

    render(<App />);

    expect(screen.getByText("9월 넷째 주 · 월요일 시작")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /요일 선택/ })).toHaveLength(14);
  });

  it("announces the selected heatmap day", () => {
    renderSurveyAtStep(3);
    const monday = screen.getAllByRole("button", {
      name: "9월 21일 월요일 선택",
    })[0];

    fireEvent.click(monday);

    expect(
      screen.getByRole("button", { name: "9월 21일 월요일 선택됨" }),
    ).toBeTruthy();
  });

  it("renders both weekly heatmap panels as glass cards", () => {
    renderSurveyAtStep(3);

    expect(document.querySelectorAll(".heatmap-panel.glass-card")).toHaveLength(
      2,
    );
  });

  it("keeps the completion screen in the glass survey shell", () => {
    renderSubmittedSurvey();

    expect(screen.getByRole("main").className).toContain("glass-shell");
  });

  it("exposes a selected confidence score", () => {
    renderSurveyAtStep(3);
    const score = screen.getByRole("button", { name: "3" });

    fireEvent.click(score);

    expect(score.getAttribute("aria-pressed")).toBe("true");
  });

  it("uses the responsive heatmap comparison class without an inline grid", () => {
    renderSurveyAtStep(3);

    expect(document.querySelector(".heatmap-comparison")?.getAttribute("style")).toBeNull();
  });
});
