export type Answer = string | number | boolean | string[]

export type SurveyEventName = 'view_screen' | 'select_option' | 'card_select' | 'heatmap_day_select' | 'toggle_change' | 'filter_change' | 'open_reason' | 'request_another' | 'navigate_back' | 'navigate_next' | 'submit'

export type SurveyEvent = { respondentId: string; sessionId: string; screenId: string; eventName: SurveyEventName; targetId?: string; variantId?: string; value?: Answer; timestamp: string; elapsedMs: number }
export type SurveyResponse = { respondentId: string; sessionId: string; questionId: string; screenId: string; answer: Answer; variantId?: string; answeredAt: string; responseTimeMs: number }
export type ParticipantData = { respondentId: string; sessionId: string; nameOrNickname: string; consent: boolean; startedAt: string; completionStatus: 'in_progress' | 'completed'; viewingFrequency: string; viewingTimeSlots: string[]; viewingCompany: string; explorationScore: number; decisionFactors: string[]; contextFactor: string; variantOrderJson: string }
export type SurveySubmission = { schemaVersion: '1.0'; respondent: ParticipantData; responses: SurveyResponse[]; events: SurveyEvent[]; metadata: { submittedAt: string; userAgent: string; viewport: { width: number; height: number } } }
export type SubmissionResult = { respondentId: string; savedAt: string }
export type SurveySession = { version: 1; respondentId: string; sessionId: string; startedAt: string; currentStep: number; answers: Record<string, Answer>; events: SurveyEvent[]; variantOrder: string[]; submitted: boolean }
