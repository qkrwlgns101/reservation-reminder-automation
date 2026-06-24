/**
 * 예약·리마인더 자동화 데모용 Apps Script
 *
 * 사용 방법:
 * 1. Google Sheets > 확장 프로그램 > Apps Script
 * 2. 이 파일 내용을 붙여 넣고 저장
 * 3. 시트를 새로고침한 뒤 "예약 자동화" 메뉴 사용
 *
 * 주의:
 * - 실제 문자/카카오 발송은 하지 않습니다.
 * - 직원이 확인 후 발송할 문구를 Send_Queue에 생성하는 데모 코드입니다.
 * - 민감정보, 진료정보, 질병명, 검사결과는 저장하지 않는 운영을 권장합니다.
 */

const SHEETS = {
  SETTINGS: 'Settings',
  CUSTOMERS: 'Customers',
  APPOINTMENTS: 'Appointments',
  TEMPLATES: 'Message_Templates',
  QUEUE: 'Send_Queue',
  WEEKLY: 'Weekly_Report',
  ERRORS: 'Validation_Errors',
  AUDIT: 'Audit_Log',
  SECURITY: 'Security_Audit',
  MASKED: 'Masked_View',
};

const HEADER_ROWS = {
  APPOINTMENTS: 4,
  TEMPLATES: 4,
  QUEUE: 4,
  WEEKLY: 4,
};

const REQUIRED_HEADERS = {
  [SHEETS.APPOINTMENTS]: ['appointment_id', '고객명', '연락처', '예약일', '예약시간', '서비스명', '상태', '수신동의'],
  [SHEETS.TEMPLATES]: ['template_key', '업종', '메시지종류', '본문'],
  [SHEETS.QUEUE]: ['queue_id', 'appointment_id', '발송예정일', '메시지종류', '고객명', '연락처', '메시지본문', '발송상태'],
  [SHEETS.WEEKLY]: ['week_start', 'week_end', '전체예약', '완료', '취소', '미방문', '미방문율', '발송대기'],
};

const VALID_STATUSES = ['예약됨', '변경', '완료', '취소', '미방문', '보류'];
const VALID_CONSENT_VALUES = ['TRUE', 'FALSE'];
const DEFAULT_RETENTION_DAYS = 365;
const SENSITIVE_PATTERNS = [
  { code: 'resident_registration_number', label: '주민등록번호 의심', regex: /\d{6}-?[1-4]\d{6}/ },
  { code: 'card_number', label: '카드번호 의심', regex: /\b(?:\d[ -]*?){13,16}\b/ },
  { code: 'account_number', label: '계좌번호 의심', regex: /계좌|은행|입금|환불계좌/ },
  { code: 'diagnosis_info', label: '진료/질병 정보 의심', regex: /진단|질병|병명|처방|복용|검사결과|혈액검사|수술|증상|통증|알레르기|임신|정신과|우울|공황/ },
  { code: 'secret_info', label: '비밀번호/인증정보 의심', regex: /비밀번호|패스워드|인증번호|OTP|api[_ -]?key|secret|token/i },
];

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('예약 자동화')
    .addItem('사전 점검 실행', 'validateWorkbook')
    .addItem('보안 점검 실행', 'runSecurityAudit')
    .addItem('보호 설정 적용', 'applySecurityProtections')
    .addItem('마스킹 뷰 생성', 'createMaskedView')
    .addItem('백업 스냅샷 생성', 'createBackupSnapshot')
    .addSeparator()
    .addItem('발송 대기함 갱신', 'refreshSendQueue')
    .addItem('주간 리포트 갱신', 'refreshWeeklyReport')
    .addSeparator()
    .addItem('선택 행 발송완료 처리', 'markSelectedQueueRowsSent')
    .addItem('매일 오전 트리거 설치', 'installDailyTrigger')
    .addToUi();
}

function refreshAll() {
  runWithLock_('전체 자동 갱신', () => {
    refreshSendQueue_();
    refreshWeeklyReport_();
    return '전체 자동 갱신 완료';
  });
}

function refreshSendQueue() {
  runWithLock_('발송 대기함 갱신', refreshSendQueue_);
}

function refreshWeeklyReport() {
  runWithLock_('주간 리포트 갱신', refreshWeeklyReport_);
}

function validateWorkbook() {
  const ss = getSpreadsheet_();
  const errors = runValidation_(ss);
  notify_(`사전 점검 완료: 오류 ${errors.length}건`);
}

function runSecurityAudit() {
  const ss = getSpreadsheet_();
  const issues = runSecurityAudit_(ss);
  notify_(`보안 점검 완료: 점검 결과 ${issues.length}건`);
}

function applySecurityProtections() {
  runWithLock_('보호 설정 적용', applySecurityProtections_);
}

function createMaskedView() {
  runWithLock_('마스킹 뷰 생성', createMaskedView_);
}

function createBackupSnapshot() {
  runWithLock_('백업 스냅샷 생성', createBackupSnapshot_);
}

function refreshSendQueue_() {
  const ss = getSpreadsheet_();
  const validationErrors = runValidation_(ss);
  if (hasBlockingErrors_(validationErrors)) {
    throw new Error('중복 예약 ID, 필수 헤더 누락, 잘못된 날짜 등 차단 오류가 있습니다. Validation_Errors 시트를 먼저 확인하세요.');
  }

  const settings = readSettings_(ss);
  const appointmentsSheet = ss.getSheetByName(SHEETS.APPOINTMENTS);
  const templatesSheet = ss.getSheetByName(SHEETS.TEMPLATES);
  const queueSheet = ss.getSheetByName(SHEETS.QUEUE);

  assertSheet_(appointmentsSheet, SHEETS.APPOINTMENTS);
  assertSheet_(templatesSheet, SHEETS.TEMPLATES);
  assertSheet_(queueSheet, SHEETS.QUEUE);

  const appointments = readTable_(appointmentsSheet, HEADER_ROWS.APPOINTMENTS);
  const templates = readTemplates_(templatesSheet);
  const existingKeys = readExistingQueueKeys_(queueSheet);
  const today = startOfDay_(settings.baseDate || new Date());
  const rowsToAppend = [];

  appointments.forEach((appointment) => {
    if (!appointment.appointment_id || !appointment['예약일']) return;

    const appointmentDate = startOfDay_(appointment['예약일']);
    const status = String(appointment['상태'] || '').trim();
    const consent = String(appointment['수신동의'] || '').toUpperCase() === 'TRUE';

    const rules = [];

    if (status === '예약됨') {
      if (sameDay_(appointmentDate, today)) {
        rules.push({ type: '당일안내', sendDate: today });
      }

      const dayBefore = addDays_(appointmentDate, -Number(settings.dayBefore || 1));
      if (sameDay_(dayBefore, today)) {
        rules.push({ type: '전날안내', sendDate: today });
      }
    }

    if (status === '미방문') {
      rules.push({ type: '미방문안내', sendDate: today });
    }

    if (status === '완료' && settings.reviewEnabled) {
      rules.push({ type: '리뷰요청', sendDate: today });
    }

    rules.forEach((rule) => {
      const uniqueKey = `${appointment.appointment_id}|${rule.type}|${formatDate_(rule.sendDate)}`;
      if (existingKeys[uniqueKey]) return;

      const templateKey = `${settings.industry}|${rule.type}`;
      const fallbackKey = `범용|${rule.type}`;
      const template = templates[templateKey] || templates[fallbackKey];
      const message = template
        ? renderTemplate_(template, appointment, settings)
        : `템플릿 없음: ${templateKey}`;

      rowsToAppend.push([
        nextQueueId_(queueSheet, rowsToAppend.length),
        appointment.appointment_id,
        rule.sendDate,
        rule.type,
        appointment['고객명'] || '',
        appointment['연락처'] || '',
        appointmentDate,
        appointment['예약시간'] || '',
        appointment['서비스명'] || '',
        message,
        consent ? '대기' : '보류',
        '',
        '',
        consent ? '' : '수신동의 확인',
      ]);
    });
  });

  if (rowsToAppend.length > 0) {
    const startRow = findFirstBlankRow_(queueSheet, HEADER_ROWS.QUEUE + 1, 1);
    ensureRows_(queueSheet, startRow + rowsToAppend.length - 1);
    queueSheet.getRange(startRow, 1, rowsToAppend.length, rowsToAppend[0].length).setValues(rowsToAppend);
  }

  return `발송 대기함 갱신 완료: ${rowsToAppend.length}건 추가`;
}

function refreshWeeklyReport_() {
  const ss = getSpreadsheet_();
  const settings = readSettings_(ss);
  const appointmentsSheet = ss.getSheetByName(SHEETS.APPOINTMENTS);
  const queueSheet = ss.getSheetByName(SHEETS.QUEUE);
  const weeklySheet = ss.getSheetByName(SHEETS.WEEKLY);

  assertSheet_(appointmentsSheet, SHEETS.APPOINTMENTS);
  assertSheet_(queueSheet, SHEETS.QUEUE);
  assertSheet_(weeklySheet, SHEETS.WEEKLY);

  const appointments = readTable_(appointmentsSheet, HEADER_ROWS.APPOINTMENTS);
  const queueRows = readTable_(queueSheet, HEADER_ROWS.QUEUE);
  const baseDate = startOfDay_(settings.baseDate || new Date());
  const weekStart = addDays_(baseDate, -(baseDate.getDay() + 6) % 7);

  const reportRows = [];

  for (let i = 0; i < 4; i++) {
    const start = addDays_(weekStart, i * 7);
    const end = addDays_(start, 6);
    const inWeek = appointments.filter((row) => {
      const date = row['예약일'];
      return date instanceof Date && startOfDay_(date) >= start && startOfDay_(date) <= end;
    });

    const total = inWeek.length;
    const completed = countByStatus_(inWeek, '완료');
    const cancelled = countByStatus_(inWeek, '취소');
    const noShow = countByStatus_(inWeek, '미방문');
    const pending = queueRows.filter((row) => {
      const date = row['발송예정일'];
      return date instanceof Date && startOfDay_(date) >= start && startOfDay_(date) <= end && row['발송상태'] === '대기';
    }).length;
    const noShowRate = total ? noShow / total : 0;
    const memo = noShow > 0 ? '미방문 후속 필요' : '정상';
    const summary = `${formatDate_(start)} 주간 예약 ${total}건, 완료 ${completed}건, 미방문 ${noShow}건입니다.`;

    reportRows.push([start, end, total, completed, cancelled, noShow, noShowRate, pending, memo, summary]);
  }

  const startRow = HEADER_ROWS.WEEKLY + 1;
  weeklySheet.getRange(startRow, 1, 20, 10).clearContent();
  weeklySheet.getRange(startRow, 1, reportRows.length, reportRows[0].length).setValues(reportRows);
  weeklySheet.getRange(startRow, 1, reportRows.length, 2).setNumberFormat('yyyy-mm-dd');
  weeklySheet.getRange(startRow, 7, reportRows.length, 1).setNumberFormat('0.0%');

  return '주간 리포트 갱신 완료';
}

function markSelectedQueueRowsSent() {
  const sheet = SpreadsheetApp.getActiveSheet();
  if (sheet.getName() !== SHEETS.QUEUE) {
    SpreadsheetApp.getUi().alert('Send_Queue 시트에서 처리할 행을 선택해주세요.');
    return;
  }

  const range = sheet.getActiveRange();
  const startRow = range.getRow();
  const numRows = range.getNumRows();
  const statusCol = 11;
  const checkedByCol = 12;
  const sentAtCol = 13;
  const user = Session.getActiveUser().getEmail() || '직원';
  const now = new Date();

  for (let i = 0; i < numRows; i++) {
    const row = startRow + i;
    if (row <= HEADER_ROWS.QUEUE) continue;
    sheet.getRange(row, statusCol).setValue('발송완료');
    sheet.getRange(row, checkedByCol).setValue(user);
    sheet.getRange(row, sentAtCol).setValue(now);
  }

  appendAuditLog_(getSpreadsheet_(), '선택 행 발송완료 처리', 'SUCCESS', `${numRows}개 행 처리`);
}

function installDailyTrigger() {
  ScriptApp.getProjectTriggers()
    .filter((trigger) => trigger.getHandlerFunction() === 'refreshAll')
    .forEach((trigger) => ScriptApp.deleteTrigger(trigger));

  ScriptApp.newTrigger('refreshAll')
    .timeBased()
    .everyDays(1)
    .atHour(8)
    .create();

  SpreadsheetApp.getUi().alert('매일 오전 자동 갱신 트리거를 설치했습니다.');
}

function runWithLock_(taskName, task) {
  const ss = getSpreadsheet_();
  const lock = LockService.getDocumentLock();

  if (!lock.tryLock(30000)) {
    const message = `${taskName} 실행 중단: 다른 사용자가 자동화를 실행 중입니다. 잠시 후 다시 시도하세요.`;
    appendAuditLog_(ss, taskName, 'LOCKED', message);
    notify_(message);
    return;
  }

  try {
    appendAuditLog_(ss, taskName, 'STARTED', '실행 시작');
    const message = task();
    appendAuditLog_(ss, taskName, 'SUCCESS', message || '실행 완료');
    notify_(message || `${taskName} 완료`);
  } catch (error) {
    const message = error && error.message ? error.message : String(error);
    appendAuditLog_(ss, taskName, 'ERROR', message);
    writeSystemError_(ss, taskName, message);
    notify_(`${taskName} 실패: ${message}`);
    throw error;
  } finally {
    lock.releaseLock();
  }
}

function getSpreadsheet_() {
  return SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.getActive();
}

function notify_(message) {
  try {
    getSpreadsheet_().toast(message, '예약 자동화', 5);
  } catch (error) {
    Logger.log(message);
  }
}

function createBackupSnapshot_() {
  const ss = getSpreadsheet_();
  const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd_HHmmss');
  const targets = [SHEETS.SETTINGS, SHEETS.APPOINTMENTS, SHEETS.TEMPLATES, SHEETS.QUEUE, SHEETS.WEEKLY];
  const created = [];

  targets.forEach((name) => {
    const sheet = ss.getSheetByName(name);
    if (!sheet) return;
    const backupName = trimSheetName_(`${name}_backup_${timestamp}`);
    const copied = sheet.copyTo(ss).setName(backupName);
    copied.hideSheet();
    created.push(backupName);
  });

  return `백업 스냅샷 생성 완료: ${created.length}개 시트`;
}

function runValidation_(ss) {
  const errors = [];

  Object.keys(REQUIRED_HEADERS).forEach((sheetName) => {
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      errors.push(errorRow_('BLOCKER', sheetName, '', 'missing_sheet', `필수 시트가 없습니다: ${sheetName}`));
      return;
    }

    const headerRow = HEADER_ROWS[sheetName.split('_')[0]] || headerRowForSheet_(sheetName);
    const headers = getHeaders_(sheet, headerRow);
    REQUIRED_HEADERS[sheetName].forEach((header) => {
      if (!headers.includes(header)) {
        errors.push(errorRow_('BLOCKER', sheetName, '', 'missing_header', `필수 헤더가 없습니다: ${header}`));
      }
    });
  });

  const appointmentsSheet = ss.getSheetByName(SHEETS.APPOINTMENTS);
  if (appointmentsSheet) {
    const rows = readTable_(appointmentsSheet, HEADER_ROWS.APPOINTMENTS);
    const seen = {};

    rows.forEach((row, index) => {
      const rowNumber = HEADER_ROWS.APPOINTMENTS + 1 + index;
      const id = String(row.appointment_id || '').trim();
      const status = String(row['상태'] || '').trim();
      const consent = String(row['수신동의'] || '').toUpperCase();

      if (!id) errors.push(errorRow_('BLOCKER', SHEETS.APPOINTMENTS, rowNumber, 'missing_appointment_id', '예약 ID가 비어 있습니다.'));
      if (id && seen[id]) errors.push(errorRow_('BLOCKER', SHEETS.APPOINTMENTS, rowNumber, 'duplicate_appointment_id', `예약 ID가 중복됩니다: ${id}`));
      if (id) seen[id] = true;

      if (!row['고객명']) errors.push(errorRow_('WARN', SHEETS.APPOINTMENTS, rowNumber, 'missing_name', '고객명이 비어 있습니다.'));
      if (!row['연락처']) errors.push(errorRow_('WARN', SHEETS.APPOINTMENTS, rowNumber, 'missing_phone', '연락처가 비어 있습니다.'));
      if (!(row['예약일'] instanceof Date)) errors.push(errorRow_('BLOCKER', SHEETS.APPOINTMENTS, rowNumber, 'invalid_date', '예약일이 날짜 형식이 아닙니다.'));
      if (status && !VALID_STATUSES.includes(status)) errors.push(errorRow_('BLOCKER', SHEETS.APPOINTMENTS, rowNumber, 'invalid_status', `상태값이 잘못되었습니다: ${status}`));
      if (consent && !VALID_CONSENT_VALUES.includes(consent)) errors.push(errorRow_('WARN', SHEETS.APPOINTMENTS, rowNumber, 'invalid_consent', `수신동의 값은 TRUE 또는 FALSE여야 합니다: ${consent}`));
    });
  }

  const queueSheet = ss.getSheetByName(SHEETS.QUEUE);
  if (queueSheet) {
    const rows = readTable_(queueSheet, HEADER_ROWS.QUEUE);
    const seen = {};

    rows.forEach((row, index) => {
      const rowNumber = HEADER_ROWS.QUEUE + 1 + index;
      if (!row.appointment_id || !row['메시지종류'] || !row['발송예정일']) return;
      const key = `${row.appointment_id}|${row['메시지종류']}|${formatDateSafe_(row['발송예정일'])}`;
      if (seen[key]) {
        errors.push(errorRow_('WARN', SHEETS.QUEUE, rowNumber, 'duplicate_queue', `발송 대기 항목이 중복됩니다: ${key}`));
      }
      seen[key] = true;
    });
  }

  writeValidationErrors_(ss, errors);
  return errors;
}

function hasBlockingErrors_(errors) {
  return errors.some((row) => row[1] === 'BLOCKER');
}

function writeValidationErrors_(ss, errors) {
  const sheet = getOrCreateSheet_(ss, SHEETS.ERRORS, ['checked_at', 'severity', 'sheet', 'row', 'code', 'message']);
  sheet.clearContents();
  sheet.getRange(1, 1, 1, 6).setValues([['checked_at', 'severity', 'sheet', 'row', 'code', 'message']]);

  if (errors.length > 0) {
    sheet.getRange(2, 1, errors.length, 6).setValues(errors);
  }

  sheet.autoResizeColumns(1, 6);
}

function writeSystemError_(ss, taskName, message) {
  const row = errorRow_('BLOCKER', 'SYSTEM', '', 'script_error', `${taskName}: ${message}`);
  const sheet = getOrCreateSheet_(ss, SHEETS.ERRORS, ['checked_at', 'severity', 'sheet', 'row', 'code', 'message']);
  sheet.appendRow(row);
}

function runSecurityAudit_(ss) {
  const issues = [];
  const settings = readSettings_(ss);

  try {
    const file = DriveApp.getFileById(ss.getId());
    const access = file.getSharingAccess();
    const permission = file.getSharingPermission();
    if (access !== DriveApp.Access.PRIVATE) {
      issues.push(securityIssue_(
        'HIGH',
        'Drive sharing',
        '',
        'non_private_sharing',
        `파일 공유 상태가 제한됨이 아닙니다: ${access} / ${permission}`,
        '원본 파일은 필요한 직원에게만 개별 공유하고 링크 공유는 끄세요.'
      ));
    }
  } catch (error) {
    issues.push(securityIssue_(
      'WARN',
      'Drive sharing',
      '',
      'sharing_check_failed',
      `Drive 공유 상태를 확인하지 못했습니다: ${error.message || error}`,
      'Google Drive에서 직접 공유 설정을 확인하세요.'
    ));
  }

  const appointmentsSheet = ss.getSheetByName(SHEETS.APPOINTMENTS);
  if (appointmentsSheet) {
    const rows = readTable_(appointmentsSheet, HEADER_ROWS.APPOINTMENTS);
    const baseDate = startOfDay_(settings.baseDate || new Date());
    const retentionDays = Number(settings.retentionDays || DEFAULT_RETENTION_DAYS);
    const expiryDate = addDays_(baseDate, -retentionDays);

    rows.forEach((row, index) => {
      const rowNumber = HEADER_ROWS.APPOINTMENTS + 1 + index;
      const memoText = [row['서비스명'], row['메모']].filter(Boolean).join(' ');
      SENSITIVE_PATTERNS.forEach((pattern) => {
        if (pattern.regex.test(String(memoText))) {
          issues.push(securityIssue_(
            pattern.code === 'diagnosis_info' ? 'HIGH' : 'CRITICAL',
            SHEETS.APPOINTMENTS,
            rowNumber,
            pattern.code,
            `${pattern.label}: "${truncate_(memoText, 80)}"`,
            '예약 목적에 필요 없는 민감정보는 삭제하거나 별도 승인된 시스템에서 관리하세요.'
          ));
        }
      });

      const phone = String(row['연락처'] || '');
      if (phone && !/^01[016789]-?\d{3,4}-?\d{4}$/.test(phone)) {
        issues.push(securityIssue_(
          'WARN',
          SHEETS.APPOINTMENTS,
          rowNumber,
          'phone_format',
          `연락처 형식 확인 필요: ${phone}`,
          '국내 휴대전화 형식이 아니면 실제 발송 전에 직원이 확인하세요.'
        ));
      }

      const appointmentDate = row['예약일'];
      if (appointmentDate instanceof Date && startOfDay_(appointmentDate) < expiryDate) {
        issues.push(securityIssue_(
          'WARN',
          SHEETS.APPOINTMENTS,
          rowNumber,
          'retention_expired',
          `보관기간 ${retentionDays}일을 초과한 예약 데이터입니다.`,
          '필요하지 않은 경우 이름/연락처를 마스킹하거나 행을 삭제하세요.'
        ));
      }
    });
  }

  if (!ss.getSheetByName(SHEETS.MASKED)) {
    issues.push(securityIssue_(
      'INFO',
      SHEETS.MASKED,
      '',
      'masked_view_missing',
      '외부 공유용 마스킹 뷰가 아직 없습니다.',
      '외부 보고나 샘플 공유가 필요하면 "마스킹 뷰 생성"을 실행하세요.'
    ));
  }

  writeSecurityAudit_(ss, issues);
  return issues;
}

function applySecurityProtections_() {
  const ss = getSpreadsheet_();
  const protectedTargets = [
    'Dashboard',
    SHEETS.WEEKLY,
    SHEETS.ERRORS,
    SHEETS.AUDIT,
    SHEETS.SECURITY,
    SHEETS.MASKED,
  ];
  let count = 0;

  protectedTargets.forEach((sheetName) => {
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) return;
    const protection = sheet.protect().setDescription(`예약 자동화 보호: ${sheetName}`);
    protection.setWarningOnly(true);
    count += 1;
  });

  protectRangeWarning_(ss, SHEETS.APPOINTMENTS, 'A:A', '예약 ID 보호');
  protectRangeWarning_(ss, SHEETS.CUSTOMERS, 'A:D', '고객 기본정보 보호');
  protectRangeWarning_(ss, SHEETS.QUEUE, 'A:J', '발송 대기 원본정보 보호');

  return `보호 설정 적용 완료: ${count}개 시트 보호 경고 설정`;
}

function createMaskedView_() {
  const ss = getSpreadsheet_();
  const appointmentsSheet = ss.getSheetByName(SHEETS.APPOINTMENTS);
  assertSheet_(appointmentsSheet, SHEETS.APPOINTMENTS);

  const rows = readTable_(appointmentsSheet, HEADER_ROWS.APPOINTMENTS);
  const sheet = getOrCreateSheet_(ss, SHEETS.MASKED, ['예약ID', '고객명', '연락처', '예약일', '예약시간', '서비스명', '상태', '담당자']);
  sheet.clearContents();
  sheet.getRange(1, 1, 1, 8).setValues([['예약ID', '고객명', '연락처', '예약일', '예약시간', '서비스명', '상태', '담당자']]);

  const output = rows.map((row) => [
    row.appointment_id || '',
    maskName_(row['고객명']),
    maskPhone_(row['연락처']),
    row['예약일'] || '',
    row['예약시간'] || '',
    row['서비스명'] || '',
    row['상태'] || '',
    row['담당자'] || '',
  ]);

  if (output.length > 0) {
    sheet.getRange(2, 1, output.length, 8).setValues(output);
    sheet.getRange(2, 4, output.length, 1).setNumberFormat('yyyy-mm-dd');
  }

  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, 8);
  const protection = sheet.protect().setDescription('외부 공유용 마스킹 뷰 보호');
  protection.setWarningOnly(true);

  return `마스킹 뷰 생성 완료: ${output.length}건`;
}

function writeSecurityAudit_(ss, issues) {
  const headers = ['checked_at', 'severity', 'area', 'row', 'code', 'message', 'recommendation'];
  const sheet = getOrCreateSheet_(ss, SHEETS.SECURITY, headers);
  sheet.clearContents();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  if (issues.length > 0) {
    sheet.getRange(2, 1, issues.length, headers.length).setValues(issues);
  }

  sheet.autoResizeColumns(1, headers.length);
}

function securityIssue_(severity, area, row, code, message, recommendation) {
  return [new Date(), severity, area, row, code, message, recommendation];
}

function protectRangeWarning_(ss, sheetName, a1Range, description) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return;
  const protection = sheet.getRange(a1Range).protect().setDescription(description);
  protection.setWarningOnly(true);
}

function maskName_(value) {
  const name = String(value || '').trim();
  if (!name) return '';
  if (name.length === 1) return '*';
  return `${name.charAt(0)}${'*'.repeat(Math.max(1, name.length - 1))}`;
}

function maskPhone_(value) {
  const phone = String(value || '').replace(/[^\d]/g, '');
  if (phone.length < 7) return value ? '***' : '';
  return `${phone.slice(0, 3)}-****-${phone.slice(-4)}`;
}

function truncate_(value, maxLength) {
  const text = String(value || '');
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function appendAuditLog_(ss, action, status, detail) {
  const sheet = getOrCreateSheet_(ss, SHEETS.AUDIT, ['timestamp', 'user', 'action', 'status', 'detail']);
  const user = Session.getActiveUser().getEmail() || 'unknown';
  sheet.appendRow([new Date(), user, action, status, detail || '']);
}

function getOrCreateSheet_(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function errorRow_(severity, sheet, row, code, message) {
  return [new Date(), severity, sheet, row, code, message];
}

function headerRowForSheet_(sheetName) {
  if (sheetName === SHEETS.APPOINTMENTS) return HEADER_ROWS.APPOINTMENTS;
  if (sheetName === SHEETS.TEMPLATES) return HEADER_ROWS.TEMPLATES;
  if (sheetName === SHEETS.QUEUE) return HEADER_ROWS.QUEUE;
  if (sheetName === SHEETS.WEEKLY) return HEADER_ROWS.WEEKLY;
  return 1;
}

function getHeaders_(sheet, headerRow) {
  const lastCol = sheet.getLastColumn();
  if (!lastCol) return [];
  return sheet.getRange(headerRow, 1, 1, lastCol).getValues()[0].map((h) => String(h).trim()).filter(Boolean);
}

function findFirstBlankRow_(sheet, startRow, keyCol) {
  const maxRows = Math.max(sheet.getMaxRows(), startRow);
  const values = sheet.getRange(startRow, keyCol, maxRows - startRow + 1, 1).getValues();
  for (let i = 0; i < values.length; i++) {
    if (!values[i][0]) return startRow + i;
  }
  return sheet.getLastRow() + 1;
}

function ensureRows_(sheet, requiredLastRow) {
  const maxRows = sheet.getMaxRows();
  if (requiredLastRow > maxRows) {
    sheet.insertRowsAfter(maxRows, requiredLastRow - maxRows);
  }
}

function readSettings_(ss) {
  const sheet = ss.getSheetByName(SHEETS.SETTINGS);
  assertSheet_(sheet, SHEETS.SETTINGS);

  const values = sheet.getRange('A5:B13').getValues();
  const map = {};
  values.forEach(([key, value]) => {
    map[String(key).trim()] = value;
  });

  return {
    businessName: map['사업장명'] || '사업장',
    industry: map['업종'] || '범용',
    phone: map['전화번호'] || '',
    address: map['주소'] || '',
    dayBefore: map['전날 리마인더 기준일'] || 1,
    reviewEnabled: String(map['리뷰 요청 사용']).toUpperCase() === 'TRUE',
    baseDate: map['기준일'] instanceof Date ? map['기준일'] : new Date(),
  };
}

function readTable_(sheet, headerRow) {
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow <= headerRow) return [];

  const headers = sheet.getRange(headerRow, 1, 1, lastCol).getValues()[0].map((h) => String(h).trim());
  const values = sheet.getRange(headerRow + 1, 1, lastRow - headerRow, lastCol).getValues();

  return values
    .filter((row) => row.some((cell) => cell !== '' && cell !== null))
    .map((row) => {
      const obj = {};
      headers.forEach((header, index) => {
        obj[header] = row[index];
      });
      return obj;
    });
}

function readTemplates_(sheet) {
  const rows = readTable_(sheet, HEADER_ROWS.TEMPLATES);
  const templates = {};
  rows.forEach((row) => {
    const key = row.template_key || `${row['업종']}|${row['메시지종류']}`;
    templates[key] = row['본문'];
  });
  return templates;
}

function readExistingQueueKeys_(sheet) {
  const rows = readTable_(sheet, HEADER_ROWS.QUEUE);
  const keys = {};
  rows.forEach((row) => {
    if (!row.appointment_id || !row['메시지종류'] || !row['발송예정일']) return;
    keys[`${row.appointment_id}|${row['메시지종류']}|${formatDateSafe_(row['발송예정일'])}`] = true;
  });
  return keys;
}

function renderTemplate_(template, appointment, settings) {
  return String(template)
    .replaceAll('{고객명}', appointment['고객명'] || '')
    .replaceAll('{사업장명}', settings.businessName)
    .replaceAll('{예약일}', formatKoreanDate_(appointment['예약일']))
    .replaceAll('{예약시간}', appointment['예약시간'] || '')
    .replaceAll('{서비스명}', appointment['서비스명'] || '')
    .replaceAll('{담당자명}', appointment['담당자'] || '')
    .replaceAll('{전화번호}', settings.phone)
    .replaceAll('{주소}', settings.address);
}

function nextQueueId_(sheet, offset) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= HEADER_ROWS.QUEUE) {
    return `Q-${String(offset + 1).padStart(4, '0')}`;
  }

  const values = sheet.getRange(HEADER_ROWS.QUEUE + 1, 1, lastRow - HEADER_ROWS.QUEUE, 1).getValues();
  const maxNumber = values.reduce((max, [value]) => {
    const match = String(value || '').match(/^Q-(\d+)$/);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);

  return `Q-${String(maxNumber + offset + 1).padStart(4, '0')}`;
}

function countByStatus_(rows, status) {
  return rows.filter((row) => row['상태'] === status).length;
}

function assertSheet_(sheet, name) {
  if (!sheet) {
    throw new Error(`필수 시트가 없습니다: ${name}`);
  }
}

function sameDay_(a, b) {
  return formatDate_(a) === formatDate_(b);
}

function startOfDay_(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays_(date, days) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function formatDate_(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function formatDateSafe_(date) {
  if (!(date instanceof Date)) return String(date || '');
  return formatDate_(date);
}

function formatKoreanDate_(date) {
  if (!(date instanceof Date)) return '';
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'M월 d일');
}
