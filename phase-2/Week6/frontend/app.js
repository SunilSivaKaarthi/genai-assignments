const form = document.querySelector('#moderationForm');
const contentInput = document.querySelector('#content');
const classificationInput = document.querySelector('#classification');
const moderationEnabled = document.querySelector('#moderationEnabled');
const toggleText = document.querySelector('#toggleText');
const decisionHint = document.querySelector('#decisionHint');
const runButton = document.querySelector('#runButton');
const characterCount = document.querySelector('#characterCount');
const emptyState = document.querySelector('#emptyState');
const resultState = document.querySelector('#resultState');
const errorState = document.querySelector('#errorState');
const errorMessage = document.querySelector('#errorMessage');
const serviceStatus = document.querySelector('#serviceStatus');
const serviceDot = document.querySelector('#serviceDot');
const responseTime = document.querySelector('#responseTime');
const lastRun = document.querySelector('#lastRun');

document.querySelector('#apiBase').value = window.location.protocol === 'http:' || window.location.protocol === 'https:'
  ? window.location.origin
  : 'http://localhost:3000';

const detectorPaths = { CII: 'cii', PII: 'pii', SECRETS: 'secrets' };

function updateCharacterCount() {
  characterCount.textContent = `${contentInput.value.length.toLocaleString()} characters`;
}

function setServiceStatus(online) {
  serviceStatus.textContent = online ? 'API READY' : 'API UNAVAILABLE';
  serviceDot.classList.toggle('offline', !online);
}

function showError(message) {
  emptyState.hidden = true;
  resultState.hidden = true;
  errorState.hidden = false;
  errorMessage.textContent = message;
  setServiceStatus(false);
}

function showResult(data, classification, elapsed, isModerationOn) {
  const decision = isModerationOn
    ? (data.decision || (data.matched ? 'BLOCK' : 'ALLOW'))
    : 'BYPASS';
  const signal = data.matched ? 'MATCH DETECTED' : 'NO MATCH';
  const findings = data.findings || (data.matched ? [data] : []);
  const banner = document.querySelector('#decisionBanner');
  const contentResult = document.querySelector('.content-result');

  emptyState.hidden = true;
  errorState.hidden = true;
  resultState.hidden = false;
  banner.className = `decision-banner ${decision.toLowerCase()}`;
  document.querySelector('#decisionValue').textContent = decision;
  document.querySelector('#decisionDescription').textContent = isModerationOn
    ? (decision === 'BLOCK' ? 'Policy restriction triggered.' : decision === 'MASK' ? 'Sensitive content transformed.' : 'No restriction detected.')
    : 'Layer bypassed for this evaluation.';
  document.querySelector('#resultClassification').textContent = classification;
  document.querySelector('#resultSignal').textContent = isModerationOn ? signal : 'NOT EVALUATED';
  document.querySelector('#requestId').textContent = data.requestId || 'Local bypass';
  const detectorMatches = findings.flatMap(finding => finding.matches || []);
  const maskedContent = data.content ?? maskContent(contentInput.value, detectorMatches, classification);
  const isBlocked = isModerationOn && decision === 'BLOCK';
  contentResult.classList.toggle('blocked', isBlocked);
  document.querySelector('#contentStatus').textContent = isBlocked ? 'WITHHELD' : isModerationOn ? 'SANITIZED' : 'ORIGINAL';
  document.querySelector('#returnedContent').textContent = isBlocked
    ? 'Content withheld. The selected moderation criteria blocked this message.'
    : isModerationOn ? maskedContent : contentInput.value;
  document.querySelector('#findingCount').textContent = findings.length;
  document.querySelector('#findingList').innerHTML = findings.length
    ? findings.map(finding => `<div class="finding"><strong>${escapeHtml(finding.detector || classification)} - ${escapeHtml(finding.action || 'MATCH')}</strong><small>Severity: ${escapeHtml(finding.severity || 'UNKNOWN')}</small></div>`).join('')
    : '<div class="finding"><small>No findings returned.</small></div>';
  document.querySelector('#rawResponse').textContent = JSON.stringify(data, null, 2);
  responseTime.textContent = `${elapsed} MS`;
  lastRun.textContent = `Last evaluation ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  setServiceStatus(true);
}

function detectCiiDisclosure(content) {
  const patterns = [
    { name: 'COMPANY_DETAILS', pattern: /\b(?:company|organization|client|customer)\s*(?:name|details?)?\s*[:=-]\s*[A-Za-z0-9][\w&.,' -]{1,60}/i },
    { name: 'PROJECT_DETAILS', pattern: /\b(?:project|initiative|program|product)\s*(?:name|details?|code\s*name)?\s*[:=-]\s*[A-Za-z0-9][\w&.,' -]{1,60}/i },
    { name: 'INTERNAL_PROJECT', pattern: /\b(?:internal|proprietary|confidential|restricted)\s+(?:company|organization|project|initiative|program|product|details?|information)\b/i },
    { name: 'PROJECT_DISCLOSURE', pattern: /\b(?:project|initiative|program)\s+[A-Z][A-Za-z0-9-]*(?:\s+[A-Z][A-Za-z0-9-]*){0,3}\s+(?:details?|roadmap|architecture|design|specification|information)\b/ }
  ];
  return patterns.reduce((matches, rule) => {
    const match = content.match(rule.pattern);
    if (match) matches.push({ name: rule.name, ruleId: `CII-UI-${rule.name}`, match: match[0], action: 'BLOCK', severity: 'HIGH' });
    return matches;
  }, []);
}

function maskContent(content, matches, classification) {
  return matches.reduce((masked, match) => {
    const value = match.match || match.matched || match.pattern;
    if (!value) return masked;
    const name = match.name || match.ruleId || classification || 'SENSITIVE';
    return masked.split(value).join(`<${name}_MASKED>`);
  }, content);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
}

async function evaluate(event) {
  event.preventDefault();
  const content = contentInput.value.trim();
  const classification = classificationInput.value;
  const apiBase = document.querySelector('#apiBase').value.trim().replace(/\/$/, '');
  const isModerationOn = moderationEnabled.checked;

  if (!content) return;
  runButton.disabled = true;
  runButton.querySelector('span').textContent = 'Evaluating...';
  const startedAt = performance.now();

  if (!isModerationOn) {
    showResult({ content, matched: false }, classification, Math.round(performance.now() - startedAt), false);
    runButton.disabled = false;
    runButton.querySelector('span').textContent = 'Run evaluation';
    return;
  }

  const endpoint = classification === 'MASKING'
    ? `${apiBase}/api/v1/moderate`
    : `${apiBase}/api/v1/detect/${detectorPaths[classification]}`;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content })
    });
    const data = await response.json();
    if (!response.ok && response.status !== 403) throw new Error(data.error || `API returned status ${response.status}`);
    if (classification === 'CII') {
      const ciiMatches = detectCiiDisclosure(content);
      if (ciiMatches.length && !data.matched) {
        data.matched = true;
        data.action = 'BLOCK';
        data.severity = 'HIGH';
        data.findings = [{ detector: 'CII', matched: true, action: 'BLOCK', severity: 'HIGH', matches: ciiMatches }];
        data.decision = 'BLOCK';
        data.reason = 'CII_DISCLOSURE_DETECTED';
      }
    }
    showResult(data, classification, Math.round(performance.now() - startedAt), true);
  } catch (error) {
    showError(error.message.includes('Failed to fetch')
      ? 'Cannot reach the API. Start the service with npm start, then check the API base URL.'
      : error.message);
  } finally {
    runButton.disabled = false;
    runButton.querySelector('span').textContent = 'Run evaluation';
  }
}

contentInput.addEventListener('input', updateCharacterCount);
moderationEnabled.addEventListener('change', () => {
  const enabled = moderationEnabled.checked;
  toggleText.textContent = enabled ? 'MASK ON' : 'MASK OFF';
  decisionHint.textContent = enabled ? 'Sensitive matches will be masked' : 'Original content will pass through unchanged';
});
form.addEventListener('submit', evaluate);
updateCharacterCount();
