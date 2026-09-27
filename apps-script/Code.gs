const SHEETS = {
  participants: ['respondent_id', 'session_id', 'name_or_nickname', 'consent', 'started_at', 'completed_at', 'completion_status', 'viewing_frequency', 'viewing_time_slots', 'viewing_company', 'exploration_score', 'decision_factors', 'context_factor', 'user_agent', 'viewport_width', 'viewport_height', 'variant_order_json'],
  responses: ['respondent_id', 'session_id', 'question_id', 'screen_id', 'answer_json', 'variant_id', 'option_order_json', 'answered_at', 'response_time_ms'],
  events: ['respondent_id', 'session_id', 'screen_id', 'event_name', 'target_id', 'variant_id', 'value_json', 'timestamp', 'elapsed_ms'],
  summary: ['metric', 'value']
}

function doGet() { return json({ ok: true, service: 'piko-survey', timestamp: new Date().toISOString() }) }
function doPost(e) {
  const lock = LockService.getScriptLock()
  try {
    lock.waitLock(15000)
    const raw = e && e.postData && e.postData.contents ? e.postData.contents : ''
    const body = e && e.parameter && e.parameter.payload ? JSON.parse(e.parameter.payload) : (raw ? JSON.parse(raw) : {})
    const action = e.parameter.action || body.action
    if (!['checkpoint', 'submit', 'healthcheck'].includes(action)) throw new Error('Unsupported action')
    if (action === 'healthcheck') return json({ ok: true })
    validate(body)
    const spreadsheet = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID'))
    setupSpreadsheet(spreadsheet)
    if (action === 'checkpoint') return json({ ok: true, respondent_id: body.respondent.respondentId })
    const existing = spreadsheet.getSheetByName('participants').getDataRange().getValues().slice(1).some(row => row[0] === body.respondent.respondentId && row[6] === 'completed')
    if (existing) return json({ ok: true, duplicate: true, respondent_id: body.respondent.respondentId })
    saveSubmission(spreadsheet, body)
    return json({ ok: true, respondent_id: body.respondent.respondentId, saved_at: new Date().toISOString() })
  } catch (error) {
    recordDiagnosticError(error)
    return json({ ok: false, error: String(error.message || error) })
  } finally { try { lock.releaseLock() } catch (_) {} }
}

function recordDiagnosticError(error) {
  try {
    const spreadsheetId = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID')
    if (!spreadsheetId) return
    const spreadsheet = SpreadsheetApp.openById(spreadsheetId)
    let sheet = spreadsheet.getSheetByName('summary')
    if (!sheet) sheet = spreadsheet.insertSheet('summary')
    sheet.appendRow(['ERROR', String(error.message || error), new Date().toISOString()])
  } catch (_) {}
}
function setupSheets() { setupSpreadsheet(SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID'))) }

function testSubmit() {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID')
  const spreadsheet = SpreadsheetApp.openById(spreadsheetId)
  setupSpreadsheet(spreadsheet)
  const now = new Date().toISOString()
  saveSubmission(spreadsheet, {
    respondent: {
      respondentId: 'manual-test-' + Date.now(),
      sessionId: 'manual-session',
      nameOrNickname: '수동 테스트',
      consent: true,
      startedAt: now,
      completionStatus: 'completed',
      viewingFrequency: '테스트',
      viewingTimeSlots: [],
      viewingCompany: '테스트',
      explorationScore: 3,
      decisionFactors: [],
      contextFactor: '테스트',
      variantOrderJson: '[]'
    },
    responses: [],
    events: [],
    metadata: { userAgent: 'Apps Script manual test', viewport: { width: 0, height: 0 } }
  })
}
function setupSpreadsheet(spreadsheet) { Object.keys(SHEETS).forEach(name => { let sheet = spreadsheet.getSheetByName(name); if (!sheet) sheet = spreadsheet.insertSheet(name); if (sheet.getLastRow() === 0) sheet.getRange(1, 1, 1, SHEETS[name].length).setValues([SHEETS[name]]) }) }
function validate(body) { if (!body || body.schemaVersion !== '1.0' || !body.respondent || !body.respondent.respondentId || !Array.isArray(body.responses) || !Array.isArray(body.events)) throw new Error('Invalid payload') }
function saveSubmission(spreadsheet, body) {
  const p = body.respondent; const metadata = body.metadata || {}; const participants = spreadsheet.getSheetByName('participants'); const responses = spreadsheet.getSheetByName('responses'); const events = spreadsheet.getSheetByName('events'); const savedAt = new Date().toISOString()
  participants.getRange(participants.getLastRow() + 1, 1, 1, SHEETS.participants.length).setValues([[safe(p.respondentId), safe(p.sessionId), safe(p.nameOrNickname), p.consent === true, safe(p.startedAt), savedAt, safe(p.completionStatus), safe(p.viewingFrequency), safeJson(p.viewingTimeSlots), safe(p.viewingCompany), p.explorationScore, safeJson(p.decisionFactors), safe(p.contextFactor), safe(metadata.userAgent), metadata.viewport && metadata.viewport.width, metadata.viewport && metadata.viewport.height, safe(p.variantOrderJson)]])
  if (body.responses.length) responses.getRange(responses.getLastRow() + 1, 1, body.responses.length, SHEETS.responses.length).setValues(body.responses.map(r => [safe(r.respondentId), safe(r.sessionId), safe(r.questionId), safe(r.screenId), safeJson(r.answer), safe(r.variantId), safeJson(r.optionOrder), safe(r.answeredAt), r.responseTimeMs]))
  if (body.events.length) events.getRange(events.getLastRow() + 1, 1, body.events.length, SHEETS.events.length).setValues(body.events.map(r => [safe(r.respondentId), safe(r.sessionId), safe(r.screenId), safe(r.eventName), safe(r.targetId), safe(r.variantId), safeJson(r.value), safe(r.timestamp), r.elapsedMs]))
}
function safe(value) { const text = value == null ? '' : String(value); return /^[=+\-@]/.test(text) ? "'" + text : text }
function safeJson(value) { return safe(JSON.stringify(value == null ? '' : value)) }
function json(value) { return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON) }
