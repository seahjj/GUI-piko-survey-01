import { useEffect, useMemo, useState } from "react";
import { HashRouter, useNavigate } from "react-router-dom";
import "./App.css";
import "./heatmap.css";
import "./ios-theme.css";
import type {
  Answer,
  ParticipantData,
  SurveyEvent,
  SurveyResponse,
  SurveySession,
} from "./types/survey";
import { createRepository } from "./repositories";
import { seededShuffle } from "./utils/seededShuffle";

const STORAGE_KEY = "piko-survey-session-v1";
const films = [
  {
    id: "film-night-swim",
    title: "밤의 수영장",
    meta: "드라마 · 96분",
    colors: ["#b6e83d", "#18352f"],
  },
  {
    id: "film-electric-city",
    title: "전기 도시",
    meta: "SF · 88분",
    colors: ["#ff725e", "#33205e"],
  },
  {
    id: "film-blue-hour",
    title: "블루 아워",
    meta: "로맨스 · 102분",
    colors: ["#6b9dff", "#251c43"],
  },
];
const factorOptions = [
  "남은 시간",
  "시간대",
  "혼자 또는 함께 보는지",
  "현재 기분",
  "식사·휴식 등 시청 목적",
];
const reasonOptions = [
  "현재 여유 시간과의 적합성",
  "선호 배우·감독",
  "과거 완주 기록",
  "선호 분위기·감정",
  "저장한 명대사·색감",
  "비슷하게 좋아했던 작품",
];
const week = ["월", "화", "수", "목", "금", "토", "일"];

function freshSession(): SurveySession {
  const now = Date.now();
  const respondentId = crypto.randomUUID();
  const sessionId = crypto.randomUUID();
  const startedAt = new Date(now).toISOString();
  return {
    version: 1,
    respondentId,
    sessionId,
    startedAt,
    currentStep: 0,
    answers: {},
    events: [
      {
        respondentId,
        sessionId,
        screenId: "screen-0",
        eventName: "view_screen",
        timestamp: startedAt,
        elapsedMs: 0,
      },
    ],
    variantOrder: seededShuffle(
      ["judgement-a", "judgement-b", "judgement-c"],
      respondentId,
    ),
    submitted: false,
  };
}
function loadSession(): SurveySession {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    return parsed?.version === 1 ? parsed : freshSession();
  } catch {
    return freshSession();
  }
}

function App() {
  return (
    <HashRouter>
      <SurveyApp />
    </HashRouter>
  );
}

function SurveyApp() {
  const navigate = useNavigate();
  const [session, setSession] = useState<SurveySession>(loadSession);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [screenStarted, setScreenStarted] = useState(() => Date.now());
  const repository = useMemo(() => createRepository(), []);
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    navigate(`/survey/${session.currentStep}`, { replace: true });
  }, [session, navigate]);
  function logEvent(
    eventName: SurveyEvent["eventName"],
    targetId?: string,
    value?: Answer,
    variantId?: string,
  ) {
    const event: SurveyEvent = {
      respondentId: session.respondentId,
      sessionId: session.sessionId,
      screenId: `screen-${session.currentStep}`,
      eventName,
      targetId,
      variantId,
      value,
      timestamp: new Date().toISOString(),
      elapsedMs: Date.now() - screenStarted,
    };
    setSession((current) => ({
      ...current,
      events: [...current.events, event],
    }));
  }
  function setAnswer(questionId: string, value: Answer) {
    setSession((current) => ({
      ...current,
      answers: { ...current.answers, [questionId]: value },
    }));
  }
  function next() {
    logEvent("navigate_next");
    setSession((current) => ({
      ...current,
      currentStep: Math.min(current.currentStep + 1, 6),
    }));
    setScreenStarted(Date.now());
  }
  function back() {
    logEvent("navigate_back");
    setSession((current) => ({
      ...current,
      currentStep: Math.max(current.currentStep - 1, 0),
    }));
    setScreenStarted(Date.now());
  }
  async function submit() {
    setBusy(true);
    setError("");
    const responses: SurveyResponse[] = Object.entries(session.answers).map(
      ([questionId, answer]) => ({
        respondentId: session.respondentId,
        sessionId: session.sessionId,
        questionId,
        screenId: `screen-${session.currentStep}`,
        answer,
        answeredAt: new Date().toISOString(),
        responseTimeMs: Date.now() - screenStarted,
      }),
    );
    const respondent: ParticipantData = {
      respondentId: session.respondentId,
      sessionId: session.sessionId,
      nameOrNickname: String(session.answers.NAME_OR_NICKNAME ?? ""),
      consent: true,
      startedAt: session.startedAt,
      completionStatus: "completed",
      viewingFrequency: String(session.answers.PROFILE_VIEWING_FREQUENCY ?? ""),
      viewingTimeSlots: (session.answers.PROFILE_TIME_SLOTS as string[]) ?? [],
      viewingCompany: String(session.answers.PROFILE_COMPANY ?? ""),
      explorationScore: Number(session.answers.PROFILE_EXPLORATION_SCORE ?? 0),
      decisionFactors:
        (session.answers.PROFILE_DECISION_FACTORS as string[]) ?? [],
      contextFactor: String(session.answers.PROFILE_CONTEXT ?? ""),
      variantOrderJson: JSON.stringify(session.variantOrder),
    };
    try {
      await repository.submit({
        schemaVersion: "1.0",
        respondent,
        responses,
        events: session.events,
        metadata: {
          submittedAt: new Date().toISOString(),
          userAgent: navigator.userAgent,
          viewport: { width: window.innerWidth, height: window.innerHeight },
        },
      });
      setSession((current) => ({
        ...current,
        submitted: true,
        currentStep: 6,
      }));
      setBusy(false);
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "저장에 실패했습니다. 입력값은 보존되어 있으니 잠시 후 다시 제출해주세요.",
      );
      setBusy(false);
    }
  }
  if (session.submitted)
    return <Completion respondentId={session.respondentId} />;
  const common = { session, setAnswer, logEvent, next, back };
  return (
    <main className="app-shell glass-shell">
      <header className="topbar glass-header">
        <strong className="brand">
          PIKO<span>.</span>
        </strong>
        <span className="study-label">콘텐츠 선택 경험 리서치 · 약 5-7분</span>
        <span className="progress-label">
          {session.currentStep === 0 ? "START" : `${session.currentStep} / 6`}
        </span>
      </header>
      <div className="progress-track">
        <span
          style={{ width: `${Math.max((session.currentStep / 6) * 100, 3)}%` }}
        />
      </div>
      {session.currentStep === 0 && <Consent {...common} />}
      {session.currentStep === 1 && <Profile {...common} />}
      {session.currentStep === 2 && <Judgement {...common} />}
      {session.currentStep === 3 && <Heatmap {...common} />}
      {session.currentStep === 4 && <Collection {...common} />}
      {session.currentStep === 5 && <IntegratedHome {...common} />}
      {session.currentStep === 6 && (
        <Review {...common} submit={submit} busy={busy} error={error} />
      )}
    </main>
  );
}

type PageProps = {
  session: SurveySession;
  setAnswer: (id: string, value: Answer) => void;
  logEvent: (
    name: SurveyEvent["eventName"],
    target?: string,
    value?: Answer,
    variant?: string,
  ) => void;
  next: () => void;
  back: () => void;
};
function Layout({
  eyebrow,
  title,
  copy,
  children,
  action,
  back,
}: {
  eyebrow: string;
  title: string;
  copy: string;
  children: React.ReactNode;
  action: React.ReactNode;
  back?: () => void;
}) {
  return (
    <section className="page">
      <div className="page-heading">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="lede">{copy}</p>
      </div>
      {children}
      <div className="page-actions">
        {back && (
          <button className="text-button" onClick={back}>
            ← 이전
          </button>
        )}
        <span />
        {action}
      </div>
    </section>
  );
}
function Consent({ setAnswer, next }: PageProps) {
  const [consent, setConsent] = useState(false);
  return (
    <Layout
      eyebrow="PIKO UX RESEARCH / 01"
      title="지금, 무엇이 보고 싶은가요?"
      copy="PIKO가 당신의 ‘지금’을 더 잘 이해할 수 있도록, 화면을 직접 눌러보며 의견을 들려주세요."
      action={
        <button
          className="primary-button"
          disabled={!consent}
          onClick={() => {
            setAnswer("CONSENT", true);
            next();
          }}
        >
          조사 시작하기 <span>↗</span>
        </button>
      }
    >
      <div className="intro-grid">
        <div className="intro-poster">
          <span>PIKO</span>
          <b>
            FIND
            <br />
            YOUR
            <br />
            NOW.
          </b>
          <small>INTERACTIVE STUDY · 2026</small>
        </div>
        <div className="notice-list">
          <div>
            <b>약 5-7분</b>
            <span>실제 홈 화면을 클릭하며 답합니다.</span>
          </div>
          <div>
            <b>안전한 기록</b>
            <span>닉네임과 클릭 데이터만 저장합니다.</span>
          </div>
          <div>
            <b>연구 목적</b>
            <span>수업 프로젝트 연구 외에는 사용하지 않습니다.</span>
          </div>
          <label className="check-row">
            <input
              type="checkbox"
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
            />
            <span>안내 내용을 읽었으며 조사 참여에 동의합니다.</span>
          </label>
        </div>
      </div>
    </Layout>
  );
}
function Profile({ session, setAnswer, next, back }: PageProps) {
  const multi = (id: string, value: string, max: number) => {
    const current = (session.answers[id] as string[]) ?? [];
    const nextValue = current.includes(value)
      ? current.filter((item) => item !== value)
      : current.length < max
        ? [...current, value]
        : current;
    setAnswer(id, nextValue);
  };
  const timeSlots = ["아침", "낮", "저녁", "늦은 밤"];
  return (
    <Layout
      eyebrow="PROFILE / 02"
      title="당신의 시청 리듬을 알려주세요."
      copy="정답은 없습니다. 평소 콘텐츠를 고르는 순간을 떠올려주세요."
      back={back}
      action={
        <button
          className="primary-button"
          disabled={
            !session.answers.NAME_OR_NICKNAME ||
            !session.answers.PROFILE_VIEWING_FREQUENCY ||
            !(session.answers.PROFILE_DECISION_FACTORS as string[])?.length
          }
          onClick={next}
        >
          다음 단계 <span>→</span>
        </button>
      }
    >
      <div className="form-grid">
        <label className="field full">
          <span>
            이름 또는 닉네임 <i>필수</i>
          </span>
          <input
            value={String(session.answers.NAME_OR_NICKNAME ?? "")}
            onChange={(e) => setAnswer("NAME_OR_NICKNAME", e.target.value)}
            placeholder="예: 지니"
          />
        </label>
        <div className="field">
          <span>일주일 평균 시청 빈도</span>
          <div className="choice-row">
            {["거의 안 봄", "1-2회", "3-5회", "매일"].map((item) => (
              <button
                className={
                  session.answers.PROFILE_VIEWING_FREQUENCY === item
                    ? "choice active"
                    : "choice"
                }
                onClick={() => setAnswer("PROFILE_VIEWING_FREQUENCY", item)}
                key={item}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <span>
            주로 보는 시간대 <em>복수 선택</em>
          </span>
          <div className="choice-row">
            {timeSlots.map((item) => (
              <button
                className={
                  (
                    (session.answers.PROFILE_TIME_SLOTS as string[]) ?? []
                  ).includes(item)
                    ? "choice active"
                    : "choice"
                }
                onClick={() => multi("PROFILE_TIME_SLOTS", item, 4)}
                key={item}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <span>주로 누구와 보나요?</span>
          <div className="choice-row">
            {["혼자", "함께", "상황에 따라"].map((item) => (
              <button
                className={
                  session.answers.PROFILE_COMPANY === item
                    ? "choice active"
                    : "choice"
                }
                onClick={() => setAnswer("PROFILE_COMPANY", item)}
                key={item}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <span>익숙한 재미 ↔ 새로운 탐색</span>
          <div className="scale-row">
            {[1, 2, 3, 4, 5].map((item) => (
              <button
                className={
                  session.answers.PROFILE_EXPLORATION_SCORE === item
                    ? "scale active"
                    : "scale"
                }
                aria-pressed={session.answers.PROFILE_EXPLORATION_SCORE === item}
                onClick={() => setAnswer("PROFILE_EXPLORATION_SCORE", item)}
                key={item}
              >
                {item}
              </button>
            ))}
          </div>
          <div className="scale-caption">
            <span>실패 없는 익숙함</span>
            <span>새로운 취향 발견</span>
          </div>
        </div>
        <div className="field full">
          <span>
            작품을 결정할 때 가장 먼저 보는 정보 <em>최대 2개</em>
          </span>
          <div className="tag-grid">
            {[
              "러닝타임",
              "현재 기분과의 적합성",
              "좋아하는 배우·감독",
              "비슷하게 재미있게 본 작품",
              "줄거리·예고편",
              "평점·리뷰",
            ].map((item) => (
              <button
                className={
                  (
                    (session.answers.PROFILE_DECISION_FACTORS as string[]) ?? []
                  ).includes(item)
                    ? "tag active"
                    : "tag"
                }
                onClick={() => multi("PROFILE_DECISION_FACTORS", item, 2)}
                key={item}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
        <div className="field full">
          <span>
            작품 선택에 가장 크게 영향을 주는 요인은 무엇인가요?
            <em>하나 선택</em>
          </span>
          <div className="tag-grid">
            {factorOptions.map((item) => (
              <button
                className={
                  session.answers.PROFILE_CONTEXT === item
                    ? "tag active"
                    : "tag"
                }
                onClick={() => setAnswer("PROFILE_CONTEXT", item)}
                key={item}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
        <div className="field full">
          <span>상황에 따라 작품 선택이 얼마나 달라지나요?</span>
          <div className="choice-row">
            {["많이 달라짐", "조금 달라짐", "거의 달라지지 않음"].map(
              (item) => (
                <button
                  className={
                    session.answers.PROFILE_CONTEXT_STABILITY === item
                      ? "choice active"
                      : "choice"
                  }
                  onClick={() =>
                    setAnswer("PROFILE_CONTEXT_STABILITY", item)
                  }
                  key={item}
                >
                  {item}
                </button>
              ),
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
function FilmCard({
  film,
  reason,
  onClick,
  selected,
  variant,
}: {
  film: (typeof films)[number];
  reason: string;
  onClick: () => void;
  selected: boolean;
  variant: string;
}) {
  return (
    <button
      className={selected ? "film-card selected" : "film-card"}
      onClick={onClick}
    >
      <div
        className="film-poster"
        style={{
          background: `linear-gradient(145deg, ${film.colors[0]}, ${film.colors[1]})`,
        }}
      >
        <span>PIKO ORIGINAL</span>
        <b>{film.title}</b>
        <small>{film.meta}</small>
      </div>
      <div className="film-info">
        <strong>{film.title}</strong>
        <span>
          {reason.split("\n").map((line, index) => (
            <span key={line}>
              {index > 0 && <br />}
              {line}
            </span>
          ))}
        </span>
        <small>추천 근거 보기 ↗</small>
      </div>
      <span className="sr-only">비교 카드 {variant}</span>
    </button>
  );
}
function Judgement({ session, setAnswer, logEvent, next, back }: PageProps) {
  const order = session.variantOrder;
  const selected = String(session.answers.JUDGEMENT_FASTEST_VARIANT ?? "");
  const reasons = {
    "judgement-a": "예상 취향 일치도 87%",
    "judgement-b": "좋아하는 배우 송강호 주연",
    "judgement-c":
      "오늘의 적합도 높음\n송강호 작품 5편 중 4편 완주",
  };
  return (
    <Layout
      eyebrow="CHOICE TEST / 03"
      title="지금 볼 작품을 고른다면?"
      copy="세 카드의 정보 구성을 비교해보세요. 가장 먼저 손이 가는 카드를 선택해주세요."
      back={back}
      action={
        <button
          className="primary-button"
          disabled={
            !session.answers.JUDGEMENT_FASTEST_VARIANT ||
            !session.answers.JUDGEMENT_TRUST_VARIANT ||
            !(session.answers.JUDGEMENT_REASON as string[])?.length ||
            !session.answers.JUDGEMENT_CONFIDENCE
          }
          onClick={next}
        >
          다음 단계 <span>→</span>
        </button>
      }
    >
      <div className="test-block">
        <h2>가장 빠르게 판단할 수 있었던 카드</h2>
        <div className="film-grid">
          {order.map((variant, index) => (
            <FilmCard
              key={variant}
              film={films[index]}
              variant={variant}
              reason={reasons[variant as keyof typeof reasons]}
              selected={selected === variant}
              onClick={() => {
                setAnswer("JUDGEMENT_FASTEST_VARIANT", variant);
                logEvent("card_select", films[index].id, variant, variant);
              }}
            />
          ))}
        </div>
      </div>
      <div className="question-row">
        <div>
          <h2>가장 신뢰하게 만든 카드</h2>
          <div className="mini-choice">
            {order.map((variant, index) => (
              <button
                className={
                  session.answers.JUDGEMENT_TRUST_VARIANT === variant
                    ? "active"
                    : ""
                }
                onClick={() => {
                  setAnswer("JUDGEMENT_TRUST_VARIANT", variant);
                  logEvent(
                    "select_option",
                    "judgement-trust",
                    variant,
                    variant,
                  );
                }}
                key={variant}
              >
                {films[index].title}
              </button>
            ))}
          </div>
        </div>
        <div>
          <h2>
            보고 싶은 개인화 근거 <em>최대 2개</em>
          </h2>
          <div className="tag-grid">
            {reasonOptions.map((item) => {
              const values =
                (session.answers.JUDGEMENT_REASON as string[]) ?? [];
              return (
                <button
                  className={values.includes(item) ? "tag active" : "tag"}
                  onClick={() =>
                    setAnswer(
                      "JUDGEMENT_REASON",
                      values.includes(item)
                        ? values.filter((value) => value !== item)
                        : values.length < 2
                          ? [...values, item]
                          : values,
                    )
                  }
                  key={item}
                >
                  {item}
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <div className="field confidence">
        <span>선택 확신 정도</span>
        <div className="scale-row">
          {[1, 2, 3, 4, 5].map((item) => (
              <button
                className={
                  session.answers.JUDGEMENT_CONFIDENCE === item
                    ? "scale active"
                    : "scale"
                }
                aria-pressed={session.answers.JUDGEMENT_CONFIDENCE === item}
                onClick={() => setAnswer("JUDGEMENT_CONFIDENCE", item)}
              key={item}
            >
              {item}
            </button>
          ))}
        </div>
      </div>
    </Layout>
  );
}
function Heatmap({ session, setAnswer, logEvent, next, back }: PageProps) {
  const chosenDay = String(session.answers.HEATMAP_SELECTED_DAY ?? "");
  const weekDates = [21, 22, 23, 24, 25, 26, 27];
  const selectedVariant = String(
    session.answers.HEATMAP_SELECTED_VARIANT ?? "",
  );
  const variants = [
    {
      id: "heatmap-a",
      label: "시안 A",
      description: "일정이 바쁜 정도를 보여줍니다.",
      levels: [3, 1, 4, 2, 0, 3, 1],
      empty: false,
    },
    {
      id: "heatmap-b",
      label: "시안 B",
      description: "앞으로 감상할 여유도를 보여줍니다.",
      levels: [1, 3, 0, 2, 4, 1, 3],
      empty: false,
    },
    {
      id: "heatmap-c",
      label: "시안 C",
      description: "캘린더 없이 추천에 집중합니다.",
      levels: [],
      empty: true,
    },
  ];
  return (
    <Layout
      eyebrow="CALENDAR TEST / 04"
      title="앞으로 일주일, 언제 볼까요?"
      copy="설명 없이 먼저 살펴보고, 이 정보가 무엇처럼 느껴지는지 답해주세요."
      back={back}
      action={
        <button
          className="primary-button"
          disabled={
            !session.answers.HEATMAP_INTERPRETATION ||
            !chosenDay ||
            !selectedVariant ||
            !session.answers.HEATMAP_USEFULNESS ||
            !session.answers.HEATMAP_HOME_INFO
          }
          onClick={next}
        >
          다음 단계 <span>→</span>
        </button>
      }
    >
      <p className="heatmap-period-label">9월 넷째 주 · 월요일 시작</p>
      <div className="heatmap-comparison">
        {variants.map((variant) => (
          <div className="heatmap-option" key={variant.id}>
            <div style={{ marginBottom: "12px" }}>
              <div className="variant-heading">
                <strong>{variant.label}</strong>
                <button
                  className={
                    selectedVariant === variant.id
                      ? "variant-select active"
                      : "variant-select"
                  }
                  onClick={() => {
                    setAnswer("HEATMAP_SELECTED_VARIANT", variant.id);
                    logEvent("select_option", variant.id, variant.id);
                  }}
                >
                  {selectedVariant === variant.id ? "선택됨" : "이 시안 선택"}
                </button>
              </div>
              <p
                style={{
                  color: "var(--muted)",
                  fontSize: "12px",
                  margin: "6px 0 0",
                }}
              >
                {variant.description}
              </p>
            </div>
            {variant.empty ? (
              <div
                className="heatmap-empty"
                aria-label="캘린더 위젯 없음"
                style={{
                  minHeight: "276px",
                  display: "grid",
                  placeItems: "center",
                  border: "1px solid var(--line)",
                  background: "var(--panel)",
                  color: "var(--muted)",
                  fontSize: "13px",
                }}
              >
                <span>오늘의 추천만 보기</span>
              </div>
            ) : (
              <div className="heatmap-panel glass-card">
                <div className="heatmap-head">
                  <span>2026. 09. 21 — 27</span>
                  <span className="legend">
                    <i /> 낮음 <i /> 높음
                  </span>
                </div>
                <div className="heatmap-weekdays" aria-hidden="true">
                  {week.map((day) => (
                    <span key={day}>{day}</span>
                  ))}
                </div>
                <div className="heatmap-grid">
                  {week.map((day, index) => (
                    <button
                      aria-label={`9월 ${weekDates[index]}일 ${day}요일 ${chosenDay === day && selectedVariant === variant.id ? "선택됨" : "선택"}`}
                      className={`heat-cell level-${variant.levels[index]} ${chosenDay === day && selectedVariant === variant.id ? "active" : ""}`}
                      key={day}
                      onClick={() => {
                        setAnswer("HEATMAP_SELECTED_DAY", day);
                        setAnswer("HEATMAP_SELECTED_VARIANT", variant.id);
                        logEvent("heatmap_day_select", day, day, variant.id);
                      }}
                    >
                      <span className="sr-only">
                        9월 {weekDates[index]}일 {day}요일
                      </span>
                    </button>
                  ))}
                </div>
                <div className="heatmap-dates" aria-hidden="true">
                  {weekDates.map((date) => (
                    <span key={date}>{date}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="question-row">
        <div>
          <h2>이 히트맵은 무엇을 의미한다고 생각했나요?</h2>
          <div className="choice-column">
            {[
              "일정이 바쁜 정도",
              "콘텐츠를 볼 수 있는 여유",
              "과거에 콘텐츠에 몰입했던 정도",
              "잘 모르겠다",
            ].map((item) => (
              <button
                className={
                  session.answers.HEATMAP_INTERPRETATION === item
                    ? "active"
                    : ""
                }
                onClick={() => setAnswer("HEATMAP_INTERPRETATION", item)}
                key={item}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
        <div>
          <h2>가장 확인하고 싶은 정보는?</h2>
          <div className="choice-column">
            {[
              "일정이 바쁜 정도",
              "콘텐츠를 볼 수 있는 여유",
              "과거에 콘텐츠에 몰입했던 정도",
              "캘린더 정보가 필요하지 않음",
            ].map((item) => (
              <button
                className={
                  session.answers.HEATMAP_HOME_INFO === item ? "active" : ""
                }
                onClick={() => setAnswer("HEATMAP_HOME_INFO", item)}
                key={item}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="field confidence">
        <span>
          작품을 볼 날짜나 길이 결정에 도움이 되었나요?
          <em>도움이 되는 정도 5점 만점</em>
        </span>
        <div className="scale-row">
          {[1, 2, 3, 4, 5].map((item) => (
              <button
                className={
                  session.answers.HEATMAP_USEFULNESS === item
                    ? "scale active"
                    : "scale"
                }
                aria-pressed={session.answers.HEATMAP_USEFULNESS === item}
                onClick={() => setAnswer("HEATMAP_USEFULNESS", item)}
              key={item}
            >
              {item}
            </button>
          ))}
        </div>
      </div>
    </Layout>
  );
}
function Collection({ session, setAnswer, logEvent, next, back }: PageProps) {
  const mode = String(session.answers.COLLECTION_SELECTED_VARIANT ?? "");
  const [mood, setMood] = useState("가볍게");
  const [runtime, setRuntime] = useState("90분 이하");
  const [genre, setGenre] = useState("드라마");
  return (
    <Layout
      eyebrow="COLLECTION TEST / 05"
      title="홈 상단의 컬렉션을 조정해보세요."
      copy="PIKO 홈 상단에 놓일 ‘오늘 보기 좋은 작품’ 영역입니다. 세 가지 방식을 직접 사용해보고, 내게 맞는 조정 수준을 골라주세요."
      back={back}
      action={
        <button
          className="primary-button"
          disabled={
            !mode ||
            !session.answers.COLLECTION_CONTROL_LEVEL ||
            !session.answers.COLLECTION_EASE
          }
          onClick={next}
        >
          다음 단계 <span>→</span>
        </button>
      }
    >
      <div className="collection-grid">
        <button
          className={
            mode === "collection-a"
              ? "collection-card active"
              : "collection-card"
          }
          onClick={() => {
            setAnswer("COLLECTION_SELECTED_VARIANT", "collection-a");
            logEvent(
              "select_option",
              "collection-a",
              "collection-a",
              "collection-a",
            );
          }}
        >
          <span className="variant-label">자동 완성</span>
          <strong>
            오늘 밤<br />
            가볍게 보기 좋은 작품
          </strong>
          <small>PIKO가 지금의 상황을 읽고 문장을 완성합니다.</small>
        </button>
        <button
          className={
            mode === "collection-b"
              ? "collection-card active"
              : "collection-card"
          }
          onClick={() => {
            setAnswer("COLLECTION_SELECTED_VARIANT", "collection-b");
            logEvent("toggle_change", "collection-mood", mood, "collection-b");
          }}
        >
          <span className="variant-label">조건 하나</span>
          <strong>
            오늘 밤{" "}
            <select
              value={mood}
              onChange={(e) => {
                e.stopPropagation();
                setMood(e.target.value);
                setAnswer("COLLECTION_MOOD", e.target.value);
                logEvent(
                  "toggle_change",
                  "collection-mood",
                  e.target.value,
                  "collection-b",
                );
              }}
              aria-label="감상 분위기 선택"
            >
              <option>가볍게</option>
              <option>몰입해서</option>
              <option>편안하게</option>
            </select>
            <br />
            보기 좋은 작품
          </strong>
          <small>상황 한 가지만 바꿔볼 수 있습니다.</small>
        </button>
        <div
          className={
            mode === "collection-c"
              ? "collection-card active"
              : "collection-card"
          }
          onClick={() => {
            setAnswer("COLLECTION_SELECTED_VARIANT", "collection-c");
            logEvent(
              "filter_change",
              "collection-filter",
              "open",
              "collection-c",
            );
          }}
        >
          <span className="variant-label">직접 설정</span>
          <strong>
            원하는 조건을
            <br />
            직접 조합
          </strong>
          <div className="filter-pills">
            <label>
              <span className="sr-only">러닝타임</span>
              <select
                value={runtime}
                onChange={(event) => {
                  event.stopPropagation();
                  setRuntime(event.target.value);
                  setAnswer("COLLECTION_RUNTIME", event.target.value);
                  setAnswer("COLLECTION_SELECTED_VARIANT", "collection-c");
                  logEvent("filter_change", "collection-runtime", event.target.value, "collection-c");
                }}
                aria-label="러닝타임 필터"
              >
                <option>90분 이하</option>
                <option>120분 이하</option>
                <option>상관없음</option>
              </select>
            </label>
            <label>
              <span className="sr-only">분위기</span>
              <select
                defaultValue="잔잔한"
                onChange={(event) => {
                  event.stopPropagation();
                  setAnswer("COLLECTION_TONE", event.target.value);
                  setAnswer("COLLECTION_SELECTED_VARIANT", "collection-c");
                  logEvent("filter_change", "collection-tone", event.target.value, "collection-c");
                }}
                aria-label="분위기 필터"
              >
                <option>잔잔한</option>
                <option>긴장감 있는</option>
                <option>유쾌한</option>
              </select>
            </label>
            <label>
              <span className="sr-only">장르</span>
              <select
                value={genre}
                onChange={(event) => {
                  event.stopPropagation();
                  setGenre(event.target.value);
                  setAnswer("COLLECTION_GENRE", event.target.value);
                  setAnswer("COLLECTION_SELECTED_VARIANT", "collection-c");
                  logEvent("filter_change", "collection-genre", event.target.value, "collection-c");
                }}
                aria-label="장르 필터"
              >
                <option>드라마</option>
                <option>로맨스</option>
                <option>SF</option>
              </select>
            </label>
          </div>
          <small>시간·장르·분위기를 모두 선택합니다.</small>
        </div>
      </div>
      <div className="question-row">
        <div>
          <h2>자동 추천을 어느 정도 수정하고 싶나요?</h2>
          <div className="choice-column">
            {[
              "PIKO가 알아서 정해주길 원함",
              "상황 한 가지만 바꾸고 싶음",
              "여러 조건을 직접 설정하고 싶음",
            ].map((item) => (
              <button
                className={
                  session.answers.COLLECTION_CONTROL_LEVEL === item
                    ? "active"
                    : ""
                }
                onClick={() => setAnswer("COLLECTION_CONTROL_LEVEL", item)}
                key={item}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
        <div className="field confidence">
          <span>조작이 쉬웠나요?</span>
          <div className="scale-row">
            {[1, 2, 3, 4, 5].map((item) => (
              <button
                className={
                  session.answers.COLLECTION_EASE === item
                    ? "scale active"
                    : "scale"
                }
                aria-pressed={session.answers.COLLECTION_EASE === item}
                onClick={() => setAnswer("COLLECTION_EASE", item)}
                key={item}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}
function IntegratedHome({
  session,
  setAnswer,
  logEvent,
  next,
  back,
}: PageProps) {
  const [reasonOpen, setReasonOpen] = useState(false);
  const [selected, setSelected] = useState("");
  const selectedFilmId =
    selected || String(session.answers.FINAL_SELECTED_FILM ?? "");
  const judgementVariant = String(
    session.answers.JUDGEMENT_TRUST_VARIANT ??
      session.answers.JUDGEMENT_FASTEST_VARIANT ??
      "judgement-c",
  );
  const heatmapVariant = String(
    session.answers.HEATMAP_SELECTED_VARIANT ?? "heatmap-b",
  );
  const collectionVariant = String(
    session.answers.COLLECTION_SELECTED_VARIANT ?? "collection-a",
  );
  const collectionHeadline =
    collectionVariant === "collection-c"
      ? `${session.answers.COLLECTION_RUNTIME ?? "90분 이하"} · ${session.answers.COLLECTION_TONE ?? "잔잔한"} · ${session.answers.COLLECTION_GENRE ?? "드라마"} 작품`
      : collectionVariant === "collection-b"
        ? `오늘 밤 ${session.answers.COLLECTION_MOOD ?? "가볍게"} 보기 좋은 작품`
        : "오늘 밤 가볍게 보기 좋은 작품";
  const judgementReason =
    judgementVariant === "judgement-b"
      ? "좋아하는 배우 송강호 주연"
      : judgementVariant === "judgement-a"
        ? "예상 취향 일치도 87%"
        : "송강호 작품 5편 중 4편 완주";
  const heatmapLabel =
    heatmapVariant === "heatmap-a" ? "일정이 바쁜 정도" : "감상할 여유도";
  return (
    <Layout
      eyebrow="FINAL TASK / 06"
      title="지금, 한 편을 골라주세요."
      copy="오늘 밤 약 90분의 여유 시간이 있습니다. 지금 보고 싶은 작품 하나를 선택해주세요."
      back={back}
      action={
        <button
          className="primary-button"
          disabled={
            !selectedFilmId ||
            !session.answers.FINAL_DECISION_SPEED ||
            !session.answers.FINAL_TRUST ||
            !session.answers.FINAL_SATISFACTION
          }
          onClick={next}
        >
          선택 완료 <span>→</span>
        </button>
      }
    >
      <div className="home-prototype">
        <div className="home-topline">
          <span>THU · 21:40</span>
          <span>90 MINUTES FREE</span>
        </div>
        <div className="home-calendar">
          <span>이번 주 감상 여유</span>
          {week.map((day, index) => (
            <i className={index > 3 ? "free" : ""} key={day}>
              {day}
            </i>
          ))}
        </div>
        <div className="hero-film">
          <div>
            <p className="eyebrow">TONIGHT'S PICK</p>
            <h2>밤의 수영장</h2>
            <p>
                오늘의 적합도 <b>높음</b> · {judgementReason}
            </p>
            <button
              className="reason-button"
              onClick={() => {
                setReasonOpen(!reasonOpen);
                logEvent("open_reason", "hero-reason", !reasonOpen);
              }}
            >
              {reasonOpen ? "추천 근거 닫기" : "왜 이 작품인가요? ↗"}
            </button>
            {reasonOpen && (
              <div className="reason-popover">
                {heatmapLabel}를 반영해 오늘 보기 좋은 작품으로 골랐어요.
                <br />
                {judgementReason}인 작품이에요.
              </div>
            )}
          </div>
          <div className="hero-art" />
        </div>
        <div className="home-collection">
          <div>
            <span className="eyebrow">FOR YOUR NOW</span>
            <h3>
              {collectionHeadline}
            </h3>
          </div>
          <button
            aria-label="컬렉션 분위기 변경"
            onClick={() => {
              setAnswer("FINAL_COLLECTION_TOGGLE", "몰입해서");
              logEvent("toggle_change", "home-collection-mood", "몰입해서");
            }}
          >
            ↻
          </button>
        </div>
        <div className="home-films">
          {films.map((film) => (
            <button
              className={selectedFilmId === film.id ? "selected" : ""}
              key={film.id}
              onClick={() => {
                setSelected(film.id);
                setAnswer("FINAL_SELECTED_FILM", film.id);
                logEvent("card_select", film.id, film.id);
              }}
            >
              <span
                style={{
                  background: `linear-gradient(145deg, ${film.colors[0]}, ${film.colors[1]})`,
                }}
              />
              <b>{film.title}</b>
              <small>{film.meta}</small>
            </button>
          ))}
        </div>
        {!selectedFilmId && (
          <p className="selection-hint" role="status">
            작품 카드 중 하나를 선택해주세요.
          </p>
        )}
        <div className="home-links">
          <button onClick={() => logEvent("request_another", "another")}>
            다른 추천 요청 ↻
          </button>
          <button onClick={() => logEvent("select_option", "explore")}>
            Explore ↗
          </button>
        </div>
      </div>
      <div className="final-questions">
        <div>
          <h2>작품을 빠르게 결정할 수 있었나요?</h2>
          <div className="scale-row">
            {[1, 2, 3, 4, 5].map((item) => (
              <button
                className={
                  session.answers.FINAL_DECISION_SPEED === item
                    ? "scale active"
                    : "scale"
                }
                aria-pressed={session.answers.FINAL_DECISION_SPEED === item}
                onClick={() => setAnswer("FINAL_DECISION_SPEED", item)}
                key={item}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
        <div>
          <h2>추천을 신뢰할 수 있었나요?</h2>
          <div className="scale-row">
            {[1, 2, 3, 4, 5].map((item) => (
              <button
                className={
                  session.answers.FINAL_TRUST === item
                    ? "scale active"
                    : "scale"
                }
                aria-pressed={session.answers.FINAL_TRUST === item}
                onClick={() => setAnswer("FINAL_TRUST", item)}
                key={item}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
        <div>
          <h2>이 최종 홈 화면이 만족스러웠나요?</h2>
          <em>만족도 5점 만점</em>
          <div className="scale-row">
            {[1, 2, 3, 4, 5].map((item) => (
              <button
                className={
                  session.answers.FINAL_SATISFACTION === item
                    ? "scale active"
                    : "scale"
                }
                aria-pressed={session.answers.FINAL_SATISFACTION === item}
                onClick={() => setAnswer("FINAL_SATISFACTION", item)}
                key={item}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}
function Review({
  session,
  setAnswer,
  submit,
  busy,
  error,
  back,
}: PageProps & { submit: () => void; busy: boolean; error: string }) {
  return (
    <Layout
      eyebrow="READY TO SUBMIT / 07"
      title="마지막으로, 한마디만 남겨주세요."
      copy="선택한 답변을 저장하고 PIKO 리서치를 마칩니다."
      back={back}
      action={
        <button className="primary-button" onClick={submit} disabled={busy}>
          {busy ? "저장 중..." : "응답 제출하기"} <span>↗</span>
        </button>
      }
    >
      <div className="review-panel">
        <div>
          <span>기록된 이벤트</span>
          <strong>{session.events.length}개</strong>
        </div>
        <div>
          <span>응답자 ID</span>
          <strong>{session.respondentId.slice(0, 8)}…</strong>
        </div>
        <label className="field">
          <span>
            추가 의견 <em>선택</em>
          </span>
          <textarea
            value={String(session.answers.FINAL_COMMENT ?? "")}
            onChange={(e) => setAnswer("FINAL_COMMENT", e.target.value)}
            placeholder="화면을 사용하며 느낀 점을 자유롭게 남겨주세요."
          />
        </label>
      </div>
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
    </Layout>
  );
}
function Completion({ respondentId }: { respondentId: string }) {
  const resetSurvey = () => {
    localStorage.removeItem(STORAGE_KEY);
    window.location.href = "/";
  };

  return (
    <main className="app-shell glass-shell completion">
      <div className="completion-mark">✓</div>
      <p className="eyebrow">PIKO UX RESEARCH / COMPLETE</p>
      <h1>응답이 저장되었습니다.</h1>
      <p>
        귀한 시간을 내어주셔서 감사합니다.
        <br />
        당신의 ‘지금’이 PIKO를 더 나은 방향으로 이끕니다.
      </p>
      <div className="response-id">
        응답 ID <strong>{respondentId}</strong>
      </div>
      {import.meta.env.DEV && (
        <button className="reset-button" onClick={resetSurvey}>
          테스트 다시 시작
        </button>
      )}
    </main>
  );
}

export default App;
