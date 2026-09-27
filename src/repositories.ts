import type { SurveySubmission, SubmissionResult } from './types/survey'

export interface SurveyRepository {
  healthcheck(): Promise<boolean>
  saveCheckpoint(payload: SurveySubmission): Promise<void>
  submit(payload: SurveySubmission): Promise<SubmissionResult>
}

const MOCK_KEY = 'piko-mock-submissions-v1'
export class MockSurveyRepository implements SurveyRepository {
  async healthcheck() { return true }
  async saveCheckpoint() { return }
  async submit(payload: SurveySubmission) { const rows = JSON.parse(localStorage.getItem(MOCK_KEY) ?? '[]'); if (!rows.some((row: SurveySubmission) => row.respondent.respondentId === payload.respondent.respondentId)) { rows.push(payload); localStorage.setItem(MOCK_KEY, JSON.stringify(rows)) }; return { respondentId: payload.respondent.respondentId, savedAt: new Date().toISOString() } }
}

export class GoogleSheetsSurveyRepository implements SurveyRepository {
  private readonly url: string
  constructor(url: string) { this.url = url }
  async healthcheck() { const response = await fetch(this.url); return response.ok }
  async saveCheckpoint(payload: SurveySubmission) { await this.send('checkpoint', payload) }
  async submit(payload: SurveySubmission) {
    const response = await this.send('submit', payload)
    if (response.type === 'opaque') return { respondentId: payload.respondent.respondentId, savedAt: new Date().toISOString() }
    const result = await response.json() as { ok?: boolean; error?: string; duplicate?: boolean; respondent_id?: string; saved_at?: string }
    if (!response.ok || result.ok !== true) throw new Error(result.error ?? 'Apps Script가 응답을 저장하지 못했습니다.')
    if (!result.respondent_id && !result.duplicate) throw new Error('Apps Script 배포 응답이 올바르지 않습니다. 배포 버전을 확인해주세요.')
    return { respondentId: result.respondent_id ?? payload.respondent.respondentId, savedAt: result.saved_at ?? new Date().toISOString() }
  }
  private send(action: string, payload: SurveySubmission) { return fetch(this.url, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' }, body: new URLSearchParams({ action, payload: JSON.stringify(payload) }) }) }
}

export function createRepository(): SurveyRepository { const url = import.meta.env.VITE_APPS_SCRIPT_URL; return import.meta.env.VITE_USE_MOCK_API !== 'false' || !url ? new MockSurveyRepository() : new GoogleSheetsSurveyRepository(url) }
