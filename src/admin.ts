import './admin.css';
import { labelShortcodesInHtml } from './shortcodes';

type Campaign = {
  campaign_id: string;
  campaign_name: string;
  campaign_month: string;
  status: string;
  require_marketing_approval: boolean;
  preview_only: boolean;
  created_at: string;
  launched_at: string | null;
  invitation_send_at: string | null;
  interview_deadline: string | null;
  first_invitation_sent_at: string | null;
  archived_at: string | null;
  doctor_count: number | string;
  interview_count: number | string;
  article_count: number | string;
  published_count: number | string;
  issue_count: number | string;
};

type CampaignTemplateTopic = {
  topic_title: string;
  featured_image_source_url: string | null;
  featured_image_alt_text: string | null;
  wordpress_slug?: string | null;
  topic_sort_order: number | string;
};

type CampaignTemplateRecipient = {
  doctor_id: string;
  doctor_name: string;
  email: string | null;
  practice_id: string | null;
};

type CampaignTemplate = {
  campaign_id: string;
  campaign_name: string;
  campaign_month: string;
  audience: 'Linked doctors' | 'Presentation preview';
  practice_id: string | null;
  training_resource_url: string | null;
  send_doctor_review_reminders: boolean | null;
  topics: CampaignTemplateTopic[];
  recipients: CampaignTemplateRecipient[];
};

type CampaignTemplateResponse = {
  viewer: { email: string | null };
  template: CampaignTemplate;
};

type WorkItem = {
  work_item_id: string;
  campaign_id: string;
  campaign_name: string;
  doctor_id: string;
  doctor_name: string;
  credentials: string | null;
  practice_name: string | null;
  article_id: string;
  topic_title: string;
  status: string;
  published_url: string;
  // Marked live on the website (pushed through Headless Hostman) in the last 30 days.
  live_on_website?: boolean;
  updated_at: string | null;
  urgency: 'error' | 'attention' | 'complete' | 'active';
  current_version?: number | null;
  require_marketing_approval?: boolean;
  marketing_auto_approved?: boolean;
  doctor_auto_approved?: boolean;
  archived?: boolean;
  archive_reason?: string | null;
  do_not_use?: boolean;
  interview_id?: string;
};

type WorkflowEvent = {
  event_id: string;
  entity_type: string;
  entity_id: string;
  event_type: string;
  event_timestamp: string;
  source_system: string | null;
  workflow_execution_id: string | null;
  severity: 'error' | 'success' | 'info';
};

type CommunicationFailure = {
  communication_id: string;
  doctor_id: string;
  article_id: string | null;
  campaign_id: string | null;
  communication_type: string;
  channel: string;
  recipient: string | null;
  status: string;
  sent_at: string | null;
};

type CampaignLaunchPractice = {
  practice_id: string;
  practice_name: string;
  website_domain: string | null;
  publisher_type: string | null;
};

type CampaignLaunchDoctor = {
  doctor_id: string;
  doctor_name: string;
  credentials: string | null;
  email: string | null;
  practice_id: string;
  practice_name: string;
  website_domain: string | null;
  publishing_ready: boolean;
};

type Overview = {
  generated_at: string;
  campaign_launch_options: {
    practices: CampaignLaunchPractice[];
    doctors: CampaignLaunchDoctor[];
  };
  summary: {
    active_campaigns: number | string;
    open_work_items: number | string;
    errors_24h: number | string;
    published_30d: number | string;
  };
  campaigns: Campaign[];
  work_queue: WorkItem[];
  recent_events: WorkflowEvent[];
  communication_failures: CommunicationFailure[];
};

type AdminResponse = {
  viewer: { email: string | null };
  capabilities: {
    readOnly: boolean;
    actionsEnabled: boolean;
    actionApiVersion: string;
    role: 'administrator' | 'viewer';
    enabledActions: string[];
  };
  access: {
    signInProvider: string;
    signInManagementUrl: string | null;
    roleManagementUrl: string | null;
    actionAdministrators: string[];
  };
  overview: Overview;
};

type WorkItemDetail = {
  topics?: Array<{ topic_id: string; topic_title: string; topic_sort_order: number; approved: boolean }>;
  item: {
    campaign_id: string;
    campaign_name: string;
    campaign_month: string;
    require_marketing_approval: boolean;
    doctor_id: string;
    doctor_name: string;
    credentials: string | null;
    email: string | null;
    practice_id: string | null;
    practice_name: string | null;
    website_domain: string | null;
    publisher_type: string | null;
    campaign_doctor_status: string;
    invited_at: string | null;
    interview_id: string | null;
    topic_id: string | null;
    interview_status: string | null;
    started_at: string | null;
    completed_at: string | null;
    topic_title: string | null;
    topic_description: string | null;
    article_id: string | null;
    article_status: string | null;
    current_version: number | null;
    article_created_at: string | null;
    doctor_review_deadline: string | null;
    doctor_approved_at: string | null;
    marketing_approved_at: string | null;
    published_at: string | null;
    published_url: string | null;
    version_type: string | null;
    version_created_at: string | null;
  };
  transcript: string | null;
  article_content: string | null;
  versions: Array<{ version_number: number; version_type: string; revision_instruction: string | null; created_at: string; created_by: string }>;
  approvals: Array<{ approval_id: string; approval_type: string; status: string; requested_at: string; deadline: string | null; responded_at: string | null; response: string | null }>;
  communications: Array<{ communication_id: string; communication_type: string; channel: string; recipient: string | null; status: string; sent_at: string | null; delivered_at: string | null }>;
  events: WorkflowEvent[];
};

type WorkItemDetailResponse = Pick<AdminResponse, 'viewer' | 'capabilities'> & { detail: WorkItemDetail };

type ApiError = {
  error?: string;
  message?: string;
  missing?: string[];
};

const appElement = document.querySelector<HTMLDivElement>('#app');
if (!appElement) throw new Error('App container not found.');
const app = appElement;

let adminData: AdminResponse | null = null;
let queueFilter = 'active';
let queueCampaign = 'all';
let queuePage = 0;
let queueSearch = '';
// Work items selected in the queue for a bulk action (next step, archive, do not use, restore).
const selectedWorkItems = new Set<string>();
let campaignArchiveFilter: 'active' | 'archived' = 'active';
let campaignSort: 'month_desc' | 'month_asc' | 'name_asc' = 'month_desc';

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function numberValue(value: number | string | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatDate(value: string | null | undefined, includeTime = false): string {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    ...(includeTime ? { hour: 'numeric', minute: '2-digit' } : {}),
  }).format(date);
}

function campaignSendLabel(campaign: Campaign): string {
  if (campaign.first_invitation_sent_at) {
    return `Sent ${formatDate(campaign.first_invitation_sent_at, true)}`;
  }
  if (campaign.invitation_send_at) {
    return `Scheduled ${formatDate(campaign.invitation_send_at, true)}`;
  }
  return 'Invitations not sent';
}

function campaignMonthLabel(value: string): string {
  const date = new Date(`${value.slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date);
}

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .replaceAll('_', ' ')
    .replaceAll('.', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusTone(status: string): string {
  const normalized = status.toUpperCase();
  if (/(FAILED|ERROR|REJECTED|ABANDONED)/.test(normalized)) return 'danger';
  if (/(REVIEW|REVISION|HOLD|PENDING)/.test(normalized)) return 'warning';
  if (/(PUBLISHED|APPROVED|COMPLETED|SENT|DELIVERED|LIVE_ON_WEBSITE)/.test(normalized)) return 'success';
  return 'info';
}

function statusPill(status: string): string {
  return `<span class="admin-status admin-status-${statusTone(status)}">${escapeHtml(titleCase(status))}</span>`;
}

function renderLoading(): void {
  document.title = 'Content Operations | Apex Dental Partners';
  app.innerHTML = `
    <main class="admin-loading">
      <img src="/brand/color_landscape.svg" alt="Apex Dental Partners" />
      <div class="admin-spinner" aria-hidden="true"></div>
      <h1>Loading content operations</h1>
      <p>Reading the latest campaign and workflow state from BigQuery.</p>
    </main>`;
}

function renderConfiguration(error: ApiError): void {
  const fields = (error.missing ?? []).map((field) => `<li><code>${escapeHtml(field)}</code></li>`).join('');
  app.innerHTML = `
    <main class="admin-setup-page">
      <section class="admin-setup-card">
        <img src="/brand/color_landscape.svg" alt="Apex Dental Partners" />
        <span class="admin-kicker">Content operations</span>
        <h1>The dashboard foundation is ready.</h1>
        <p>${escapeHtml(error.message ?? 'Protected data access still needs to be configured.')}</p>
        <div class="admin-setup-list">
          <h2>Configuration still needed</h2>
          <ul>${fields}</ul>
        </div>
        <p class="admin-muted">No alternate database or sample production data has been created. Once these values are supplied, this page reads directly from the existing BigQuery system of record.</p>
      </section>
    </main>`;
}

function renderFailure(error: ApiError, status: number): void {
  const authFailure = status === 401 || error.error === 'UNAUTHORIZED';
  app.innerHTML = `
    <main class="admin-setup-page">
      <section class="admin-setup-card">
        <img src="/brand/color_landscape.svg" alt="Apex Dental Partners" />
        <span class="admin-kicker">${authFailure ? 'Protected dashboard' : 'Data connection issue'}</span>
        <h1>${authFailure ? 'Sign-in is required.' : 'The dashboard could not load.'}</h1>
        <p>${escapeHtml(error.message ?? 'Please try again in a moment.')}</p>
        <button class="admin-primary-button" id="retry-admin" type="button">Try again</button>
      </section>
    </main>`;
  document.querySelector<HTMLButtonElement>('#retry-admin')?.addEventListener('click', () => void initializeAdmin());
}

function renderSummary(data: AdminResponse): string {
  const summary = data.overview.summary;
  return `
    <section class="admin-summary-grid" aria-label="Content operations summary">
      <article class="admin-summary-card">
        <span>Active campaigns</span><strong>${numberValue(summary.active_campaigns)}</strong>
        <small>Ready, launched, or active</small>
      </article>
      <article class="admin-summary-card">
        <span>Open work items</span><strong>${numberValue(summary.open_work_items)}</strong>
        <small>Across every workflow stage</small>
      </article>
      <article class="admin-summary-card ${numberValue(summary.errors_24h) ? 'admin-summary-alert' : ''}">
        <span>Errors in 24 hours</span><strong>${numberValue(summary.errors_24h)}</strong>
        <small>Workflow and delivery failures</small>
      </article>
      <article class="admin-summary-card">
        <span>Published in 30 days</span><strong>${numberValue(summary.published_30d)}</strong>
        <small>Confirmed publication records</small>
      </article>
    </section>`;
}

// An article that is on WordPress and waiting for the team to push it live through Headless Hostman.
function isReadyToPush(item: WorkItem): boolean {
  return item.status === 'PUBLISHED' && Boolean(item.article_id) && !item.archived && !item.live_on_website;
}

type QueueStage = 'invited' | 'interview' | 'drafting' | 'doctor_review' | 'marketing_review' | 'sending' | 'ready_to_push' | 'published' | 'errors';

// Where a work item sits in the Apex process, from its current status. Every status maps to one stage.
function queueStage(item: WorkItem): QueueStage {
  const status = String(item.status || '').toUpperCase();
  if (item.urgency === 'error' || /(FAILED|ERROR|UNAVAILABLE)/.test(status)) return 'errors';
  if (status === 'PUBLISHED') return item.live_on_website ? 'published' : 'ready_to_push';
  if (/^(MARKETING_APPROVED|PUBLISHING)$/.test(status)) return 'sending';
  if (/^(DOCTOR_APPROVED|DOCTOR_AUTO_APPROVED|MARKETING_REVIEW|MARKETING_CHANGES_REQUESTED)$/.test(status)) return 'marketing_review';
  if (item.article_id || /(DOCTOR_REVIEW|DOCTOR_CHANGES|REVISION|ARTICLE_DRAFTED)/.test(status)) return 'doctor_review';
  if (/COMPLETED/.test(status)) return 'drafting';
  if (/(STARTED|IN_PROGRESS)/.test(status)) return 'interview';
  return 'invited';
}

// Filters follow the stages the team works in. Quick in-between steps (interview in progress, drafting, sending to
// WordPress) are grouped with the stage around them; if one gets stuck it shows under "Needs attention".
const QUEUE_FILTERS: Array<[string, string, (item: WorkItem) => boolean]> = [
  // In progress: leaves out doctors who have not responded to their invitation yet, and finished (published) items.
  ['active', 'Active', (item) => !item.archived && !['invited', 'published'].includes(queueStage(item))],
  ['awaiting', 'Awaiting interview', (item) => !item.archived && ['invited', 'interview'].includes(queueStage(item))],
  ['doctor_review', 'Doctor review', (item) => !item.archived && ['drafting', 'doctor_review'].includes(queueStage(item))],
  ['marketing_review', 'Marketing review', (item) => !item.archived && queueStage(item) === 'marketing_review'],
  ['ready', 'Ready to push', (item) => !item.archived && ['sending', 'ready_to_push'].includes(queueStage(item))],
  // Approved automatically because nobody responded in time: give these a closer look before they are pushed live.
  ['auto_approved', 'Auto-approved', (item) => !item.archived && !item.live_on_website && Boolean(item.doctor_auto_approved || item.marketing_auto_approved)],
  ['published', 'Published', (item) => !item.archived && queueStage(item) === 'published'],
  ['attention', 'Needs attention', (item) => !item.archived && (queueStage(item) === 'errors' || Boolean(stalledReason(item)))],
  ['archived', 'Archived', (item) => Boolean(item.archived)],
  ['all', 'All', () => true],
];
const QUEUE_PAGE_SIZE = 50;

// An item that has sat at one step longer than expected, so it does not get stuck silently.
function stalledReason(item: WorkItem): string {
  if (item.archived || !item.updated_at) return '';
  const hours = (Date.now() - new Date(item.updated_at).getTime()) / 3_600_000;
  if (!Number.isFinite(hours)) return '';
  const stage = queueStage(item);
  const status = String(item.status || '').toUpperCase();
  if (stage === 'drafting' && hours > 1) return 'no draft after 1 hour';
  if (/(CHANGES_REQUESTED|REVISION)/.test(status) && hours > 2) return 'rewrite not finished after 2 hours';
  if (stage === 'doctor_review' && hours > 24 * 6) return 'in doctor review over 6 days';
  if (stage === 'marketing_review' && hours > 48) return 'waiting for marketing over 2 days';
  if (stage === 'sending' && hours > 2) return 'not on WordPress after 2 hours';
  return '';
}

function campaignScopedQueue(): WorkItem[] {
  const items = adminData?.overview.work_queue ?? [];
  return queueCampaign === 'all' ? items : items.filter((item) => item.campaign_id === queueCampaign);
}

function filteredQueue(): WorkItem[] {
  const matches = (QUEUE_FILTERS.find(([key]) => key === queueFilter) ?? QUEUE_FILTERS[0])[2];
  const needle = queueSearch.trim().toLowerCase();
  return campaignScopedQueue().filter((item) => {
    const haystack = [item.doctor_name, item.practice_name, item.topic_title, item.campaign_name, item.status]
      .filter(Boolean).join(' ').toLowerCase();
    return matches(item) && (!needle || haystack.includes(needle));
  });
}

type QueueStep = 'generate_article' | 'approve_for_doctor' | 'approve_for_marketing' | 'mark_live_on_website';
const queueStepLabels: Record<QueueStep, { verb: string; done: string }> = {
  generate_article: { verb: 'write the article draft', done: 'draft started' },
  approve_for_doctor: { verb: 'approve on the doctor’s behalf', done: 'approved for the doctor' },
  approve_for_marketing: { verb: 'approve and send to WordPress', done: 'approved and sent to WordPress' },
  mark_live_on_website: { verb: 'mark as published', done: 'marked as published' },
};

function canAct(action: string): boolean {
  return Boolean(adminData?.capabilities.enabledActions.includes(action));
}

// The next step a work item can be moved to from the queue, if the viewer is allowed to take it.
function queueNextStep(item: WorkItem): QueueStep | null {
  let step: QueueStep | null = null;
  if (item.archived) step = null;
  else if (!item.article_id && item.interview_id && queueStage(item) === 'drafting') step = 'generate_article';
  else if (!item.article_id || !item.current_version) step = null;
  else if (item.status === 'DOCTOR_REVIEW_PENDING') step = 'approve_for_doctor';
  else if (item.require_marketing_approval && /^(DOCTOR_APPROVED|DOCTOR_AUTO_APPROVED|MARKETING_REVIEW)$/.test(item.status)) step = 'approve_for_marketing';
  else if (isReadyToPush(item)) step = 'mark_live_on_website';
  return step && canAct(step) ? step : null;
}

function canSelect(item: WorkItem): boolean {
  return Boolean(queueNextStep(item)) || canAct(item.archived ? 'restore_work_item' : 'archive_work_item');
}

function autoApprovalFlag(item: { marketing_auto_approved?: boolean; doctor_auto_approved?: boolean }): string {
  const who = [item.doctor_auto_approved ? 'doctor' : '', item.marketing_auto_approved ? 'marketing' : ''].filter(Boolean);
  if (!who.length) return '';
  return `<span class="admin-flag" title="Approved automatically because nobody responded in time. Give it extra attention before pushing live.">Auto-approved (${escapeHtml(who.join(' and '))}) · check carefully</span>`;
}

function stalledFlag(item: WorkItem): string {
  const reason = stalledReason(item);
  return reason ? `<span class="admin-flag admin-flag-stalled" title="This item has not moved for a while. Open it to see what it is waiting for.">Stalled: ${escapeHtml(reason)}</span>` : '';
}

function archiveFlag(item: WorkItem): string {
  if (!item.archived) return '';
  const label = item.do_not_use ? 'Do not use' : 'Archived';
  return `<span class="admin-flag admin-flag-muted"${item.archive_reason ? ` title="${escapeHtml(item.archive_reason)}"` : ''}>${label}${item.archive_reason ? `: ${escapeHtml(item.archive_reason.slice(0, 60))}` : ''}</span>`;
}

function workItemRow(item: WorkItem): string {
  const doctor = [item.doctor_name, item.credentials].filter(Boolean).join(', ');
  const step = queueNextStep(item);
  return `
    <tr data-work-item="${escapeHtml(item.work_item_id)}" class="${item.archived ? 'is-archived' : ''}">
      <td class="admin-select-cell">${canSelect(item) ? `<input type="checkbox" data-item-select="${escapeHtml(item.work_item_id)}" aria-label="Select ${escapeHtml(doctor)}" ${selectedWorkItems.has(item.work_item_id) ? 'checked' : ''} />` : ''}</td>
      <td><strong>${escapeHtml(doctor)}</strong><small>${escapeHtml(item.practice_name || 'Practice not assigned')}</small></td>
      <td><strong>${escapeHtml(item.topic_title)}</strong><small>${escapeHtml(item.campaign_name)}</small></td>
      <td>${statusPill(isReadyToPush(item) ? 'READY_TO_PUSH' : item.status)}${archiveFlag(item)}${stalledFlag(item)}${autoApprovalFlag(item)}${step ? `<small class="admin-next-step">Next: ${escapeHtml(queueStepLabels[step].verb)}</small>` : ''}</td>
      <td><time datetime="${escapeHtml(item.updated_at)}">${escapeHtml(formatDate(item.updated_at, true))}</time></td>
      <td><button class="admin-text-button" type="button" data-view-item="${escapeHtml(item.work_item_id)}">View</button></td>
    </tr>`;
}

function renderQueueFilters(): void {
  const group = document.querySelector<HTMLElement>('#admin-queue-filters');
  if (!group) return;
  const scoped = campaignScopedQueue();
  group.innerHTML = QUEUE_FILTERS.map(([key, label, matches]) =>
    `<button class="admin-filter ${key === queueFilter ? 'is-active' : ''}" type="button" data-queue-filter="${key}">${label} <span>${scoped.filter(matches).length}</span></button>`).join('');
  for (const button of group.querySelectorAll<HTMLButtonElement>('[data-queue-filter]')) {
    button.addEventListener('click', () => {
      queueFilter = button.dataset.queueFilter ?? 'active';
      queuePage = 0;
      renderQueueRows();
    });
  }
}

function renderQueueRows(): void {
  const body = document.querySelector<HTMLTableSectionElement>('#admin-queue-body');
  const count = document.querySelector<HTMLElement>('#admin-queue-count');
  if (!body || !count) return;
  renderQueueFilters();
  const items = filteredQueue();
  const pages = Math.max(1, Math.ceil(items.length / QUEUE_PAGE_SIZE));
  queuePage = Math.min(queuePage, pages - 1);
  const pageItems = items.slice(queuePage * QUEUE_PAGE_SIZE, (queuePage + 1) * QUEUE_PAGE_SIZE);
  count.textContent = `${items.length} item${items.length === 1 ? '' : 's'}`;
  body.innerHTML = pageItems.length
    ? pageItems.map(workItemRow).join('')
    : '<tr><td colspan="6"><div class="admin-empty">No work items match this view.</div></td></tr>';
  const pager = document.querySelector<HTMLElement>('#admin-queue-pager');
  if (pager) {
    pager.hidden = items.length <= QUEUE_PAGE_SIZE;
    pager.innerHTML = `<span>Showing ${items.length ? queuePage * QUEUE_PAGE_SIZE + 1 : 0}–${queuePage * QUEUE_PAGE_SIZE + pageItems.length} of ${items.length}</span>
      <button class="admin-text-button" type="button" data-queue-page="-1" ${queuePage === 0 ? 'disabled' : ''}>Previous</button>
      <button class="admin-text-button" type="button" data-queue-page="1" ${queuePage >= pages - 1 ? 'disabled' : ''}>Next</button>`;
    for (const button of pager.querySelectorAll<HTMLButtonElement>('[data-queue-page]')) {
      button.addEventListener('click', () => { queuePage += Number(button.dataset.queuePage); renderQueueRows(); });
    }
  }
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-view-item]')) {
    button.addEventListener('click', () => openWorkItem(button.dataset.viewItem ?? ''));
  }
  for (const checkbox of document.querySelectorAll<HTMLInputElement>('[data-item-select]')) {
    checkbox.addEventListener('change', () => {
      const id = checkbox.dataset.itemSelect ?? '';
      if (checkbox.checked) selectedWorkItems.add(id); else selectedWorkItems.delete(id);
      updateBulkBar();
    });
  }
  const selectAll = document.querySelector<HTMLInputElement>('#admin-item-select-all');
  if (selectAll) {
    const shown = pageItems.filter(canSelect);
    selectAll.disabled = !shown.length;
    selectAll.checked = shown.length > 0 && shown.every((item) => selectedWorkItems.has(item.work_item_id));
    selectAll.onchange = () => {
      for (const item of shown) {
        if (selectAll.checked) selectedWorkItems.add(item.work_item_id); else selectedWorkItems.delete(item.work_item_id);
      }
      renderQueueRows();
    };
  }
  updateBulkBar();
}

function selectedQueueItems(): WorkItem[] {
  return (adminData?.overview.work_queue ?? []).filter((item) => selectedWorkItems.has(item.work_item_id) && canSelect(item));
}

type BulkAction = 'next' | 'archive' | 'do_not_use' | 'restore';

// Which selected items each bulk button would act on.
function bulkTargets(action: BulkAction, selected = selectedQueueItems()): WorkItem[] {
  if (action === 'next') return selected.filter((item) => queueNextStep(item));
  if (action === 'archive') return canAct('archive_work_item') ? selected.filter((item) => !item.archived) : [];
  if (action === 'do_not_use') return canAct('archive_work_item') ? selected.filter((item) => !item.do_not_use) : [];
  return canAct('restore_work_item') ? selected.filter((item) => item.archived) : [];
}

function updateBulkBar(): void {
  const bar = document.querySelector<HTMLFormElement>('#admin-bulk-step');
  if (!bar) return;
  const selected = selectedQueueItems();
  const keep = new Set(selected.map((item) => item.work_item_id));
  for (const id of [...selectedWorkItems]) if (!keep.has(id)) selectedWorkItems.delete(id);
  bar.hidden = selected.length === 0;
  const counts = new Map<QueueStep, number>();
  for (const item of selected) {
    const step = queueNextStep(item);
    if (step) counts.set(step, (counts.get(step) ?? 0) + 1);
  }
  const label = bar.querySelector<HTMLElement>('[data-bulk-count]');
  if (label) {
    label.textContent = `${selected.length} selected` + (counts.size ? ' · next steps: ' + [...counts].map(([step, number]) => `${number} to ${queueStepLabels[step].verb}`).join(' · ') : '');
  }
  for (const button of bar.querySelectorAll<HTMLButtonElement>('button[data-bulk-action]')) {
    const targets = bulkTargets(button.dataset.bulkAction as BulkAction, selected);
    button.hidden = targets.length === 0;
    const base = button.dataset.label ?? '';
    button.textContent = `${base} (${targets.length})`;
  }
}

async function submitBulkStep(event: SubmitEvent): Promise<void> {
  event.preventDefault();
  const form = event.currentTarget as HTMLFormElement;
  const action = ((event.submitter as HTMLButtonElement | null)?.dataset.bulkAction ?? 'next') as BulkAction;
  const message = form.querySelector<HTMLElement>('#admin-bulk-step-message');
  const confirmed = form.querySelector<HTMLInputElement>('input[name="confirmation"]')?.checked;
  const reason = String(new FormData(form).get('reason') ?? '').trim();
  const targets = bulkTargets(action);
  if (!targets.length) return;
  if (!confirmed) { if (message) message.textContent = 'Tick the confirmation box first.'; return; }
  if (action === 'next' && targets.some((item) => /^approve_for_/.test(queueNextStep(item) ?? '')) && reason.length < 12) {
    if (message) message.textContent = 'Add a reason (at least 12 characters) for the approvals.'; return;
  }
  if (action === 'do_not_use' && reason.length < 4) { if (message) message.textContent = 'Add a short reason for "Do not use".'; return; }
  const buttons = [...form.querySelectorAll<HTMLButtonElement>('button[data-bulk-action]')];
  buttons.forEach((button) => { button.disabled = true; });
  const failures: string[] = [];
  let done = 0;
  // One audited command per article, sent one at a time so each gets its own record and result.
  for (const item of targets) {
    if (message) message.textContent = `Working on ${done + failures.length + 1} of ${targets.length}…`;
    const step = queueNextStep(item);
    const command = action === 'next'
      ? step === 'generate_article'
        ? { action: step, interview_id: item.interview_id }
        : { action: step, article_id: item.article_id, expected_status: item.status, expected_version: item.current_version }
      : { action: action === 'restore' ? 'restore_work_item' : 'archive_work_item', do_not_use: action === 'do_not_use', interview_id: item.interview_id || '' };
    try {
      await postAdminCommand({ ...command, campaign_id: item.campaign_id, doctor_id: item.doctor_id, reason });
      done += 1;
      selectedWorkItems.delete(item.work_item_id);
    } catch (error) {
      failures.push(`${[item.doctor_name, item.credentials].filter(Boolean).join(', ')}: ${friendlyCommandError(error)}`);
    }
  }
  if (!failures.length) {
    if (message) message.textContent = `Done for ${done} article${done === 1 ? '' : 's'}.`;
    await initializeAdmin();
    return;
  }
  if (message) message.textContent = `Done for ${done} of ${targets.length}. Not done: ${failures.join(' · ')}`;
  buttons.forEach((button) => { button.disabled = false; });
  if (done) renderQueueRows();
}

function renderQueue(data: AdminResponse): string {
  const campaigns = [...new Map(data.overview.work_queue.map((item) => [item.campaign_id, item.campaign_name])).entries()]
    .sort((a, b) => a[1].localeCompare(b[1]));
  return `
    <section class="admin-panel" id="work-queue">
      <div class="admin-panel-heading">
        <div><span class="admin-kicker">Needs visibility</span><h2>Work queue</h2></div>
        <span class="admin-count" id="admin-queue-count"></span>
      </div>
      <div class="admin-toolbar admin-queue-toolbar">
        <div class="admin-filter-group" id="admin-queue-filters" role="group" aria-label="Filter work queue by stage"></div>
        <div class="admin-queue-scope">
          <label class="admin-select"><span class="sr-only">Campaign</span><select id="admin-queue-campaign">
            <option value="all">All campaigns</option>
            ${campaigns.map(([id, name]) => `<option value="${escapeHtml(id)}" ${id === queueCampaign ? 'selected' : ''}>${escapeHtml(name)}</option>`).join('')}
          </select></label>
          <label class="admin-search"><span class="sr-only">Search work queue</span><input id="admin-queue-search" type="search" placeholder="Search doctor, practice, topic…" value="${escapeHtml(queueSearch)}" /></label>
        </div>
      </div>
      <form class="admin-bulk-publish" id="admin-bulk-step" hidden novalidate>
        <strong data-bulk-count></strong>
        <label class="admin-bulk-note"><span class="sr-only">Reason or note</span><textarea name="reason" rows="2" maxlength="2000" placeholder="Reason or note. Required for approvals and for “Do not use”; optional for marking published or archiving."></textarea></label>
        <label class="admin-confirm-check"><input name="confirmation" type="checkbox" /> I confirm the action for the selected articles.</label>
        <div class="admin-bulk-actions">
          <button class="admin-primary-button" type="submit" data-bulk-action="next" data-label="Move to next step">Move to next step</button>
          <button class="admin-secondary-button" type="submit" data-bulk-action="archive" data-label="Archive" title="Hides the item from active views. Automation continues.">Archive</button>
          <button class="admin-secondary-button" type="submit" data-bulk-action="do_not_use" data-label="Do not use" title="Stops all automation for the article (reviews, auto-approval, WordPress) and archives it.">Do not use</button>
          <button class="admin-secondary-button" type="submit" data-bulk-action="restore" data-label="Restore">Restore</button>
        </div>
        <p class="admin-bulk-help">Archive only hides an item. “Do not use” also stops every automatic step for that article, so it is never auto-approved or sent to WordPress. Both can be undone with Restore.</p>
        <p class="admin-form-message" id="admin-bulk-step-message" role="status"></p>
      </form>
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead><tr><th class="admin-select-cell"><input type="checkbox" id="admin-item-select-all" aria-label="Select all items on this page" /></th><th>Doctor</th><th>Topic and campaign</th><th>Status</th><th>Last movement</th><th><span class="sr-only">Details</span></th></tr></thead>
          <tbody id="admin-queue-body"></tbody>
        </table>
      </div>
      <div class="admin-queue-pager" id="admin-queue-pager" hidden></div>
    </section>`;
}

function campaignCard(campaign: Campaign): string {
  const doctors = numberValue(campaign.doctor_count);
  const published = numberValue(campaign.published_count);
  const progress = doctors ? Math.round((published / doctors) * 100) : 0;
  const archived = Boolean(campaign.archived_at);
  const archiveAction = archived ? 'restore_campaign' : 'archive_campaign';
  const canArchive = adminData?.capabilities.enabledActions.includes(archiveAction) ?? false;
  return `
    <article class="admin-campaign-card">
      <div class="admin-campaign-topline">
        <span>${escapeHtml(campaignSendLabel(campaign))}${archived ? ` · Archived ${escapeHtml(formatDate(campaign.archived_at))}` : ''}</span>
        ${statusPill(campaign.status)}
      </div>
      <div class="admin-campaign-title-row">
        <h3>${escapeHtml(campaign.campaign_name)}</h3>
        <div class="admin-campaign-actions">
          <button class="admin-text-button" type="button" data-export-campaign="${escapeHtml(campaign.campaign_id)}">Download status CSV</button>
          <button class="admin-text-button" type="button" data-duplicate-campaign="${escapeHtml(campaign.campaign_id)}">Duplicate</button>
          <button class="admin-text-button" type="button" data-campaign-action="${archiveAction}" data-campaign-id="${escapeHtml(campaign.campaign_id)}" ${canArchive ? '' : 'disabled'}>${archived ? 'Restore' : 'Archive'}</button>
        </div>
      </div>
      <p class="admin-campaign-month">${escapeHtml(campaignMonthLabel(campaign.campaign_month))}</p>
      <div class="admin-progress" aria-label="${progress}% published"><span style="width:${progress}%"></span></div>
      <div class="admin-campaign-stats">
        <span><strong>${doctors}</strong> doctors</span>
        <span><strong>${numberValue(campaign.interview_count)}</strong> interviews</span>
        <span><strong>${numberValue(campaign.article_count)}</strong> articles</span>
        <span><strong>${published}</strong> published</span>
      </div>
      <footer>
        <span>${campaign.preview_only ? 'Presentation preview · transcript only' : campaign.require_marketing_approval ? 'Marketing approval required' : 'Direct publishing path'}</span>
        ${numberValue(campaign.issue_count) ? `<strong class="admin-issue-count">${numberValue(campaign.issue_count)} issue${numberValue(campaign.issue_count) === 1 ? '' : 's'}</strong>` : '<strong class="admin-clear">No current issues</strong>'}
      </footer>
    </article>`;
}

function renderCampaigns(data: AdminResponse): string {
  return `
    <section class="admin-panel" id="campaigns">
      <div class="admin-panel-heading">
        <div><span class="admin-kicker">Campaign history</span><h2>Monthly campaigns</h2></div>
        <span class="admin-count" id="admin-campaign-count"></span>
      </div>
      <div class="admin-campaign-toolbar">
        <div class="admin-filter-group" role="group" aria-label="Filter campaigns">
          <button class="admin-filter is-active" type="button" data-campaign-filter="active">Current and unarchived</button>
          <button class="admin-filter" type="button" data-campaign-filter="archived">Archived</button>
        </div>
        <label class="admin-campaign-sort">Sort campaigns
          <select id="admin-campaign-sort">
            <option value="month_desc">Month, newest first</option>
            <option value="month_asc">Month, oldest first</option>
            <option value="name_asc">Campaign name, A–Z</option>
          </select>
        </label>
      </div>
      <p class="admin-campaign-message" id="admin-campaign-message" role="status"></p>
      <div class="admin-campaign-grid" id="admin-campaign-grid">
        ${data.overview.campaigns.length ? data.overview.campaigns.map(campaignCard).join('') : '<div class="admin-empty">No campaigns are recorded yet.</div>'}
      </div>
    </section>`;
}

function renderCampaignCards(): void {
  const grid = document.querySelector<HTMLElement>('#admin-campaign-grid');
  const count = document.querySelector<HTMLElement>('#admin-campaign-count');
  if (!grid || !count || !adminData) return;
  const campaigns = adminData.overview.campaigns
    .filter((campaign) => Boolean(campaign.archived_at) === (campaignArchiveFilter === 'archived'))
    .sort((a, b) => {
      if (campaignSort === 'name_asc') return a.campaign_name.localeCompare(b.campaign_name, undefined, { sensitivity: 'base' });
      const monthOrder = String(a.campaign_month).localeCompare(String(b.campaign_month));
      return campaignSort === 'month_asc' ? monthOrder : -monthOrder;
    });
  count.textContent = `${campaigns.length} shown · ${adminData.overview.campaigns.length} loaded`;
  grid.innerHTML = campaigns.length
    ? campaigns.map(campaignCard).join('')
    : `<div class="admin-empty">No ${campaignArchiveFilter === 'archived' ? 'archived' : 'unarchived'} campaigns in this view.</div>`;
  attachCampaignCardActions();
}

function setCampaignMessage(message: string): void {
  const element = document.querySelector<HTMLElement>('#admin-campaign-message');
  if (element) element.textContent = message;
}

function attachCampaignCardActions(): void {
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-export-campaign]')) {
    button.addEventListener('click', () => void downloadCampaignStatusCsv(button));
  }
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-campaign-action]')) {
    button.addEventListener('click', () => void updateCampaignArchive(button));
  }
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-duplicate-campaign]')) {
    button.addEventListener('click', () => void duplicateCampaign(button.dataset.duplicateCampaign ?? ''));
  }
}

async function downloadCampaignStatusCsv(button: HTMLButtonElement): Promise<void> {
  const campaignId = button.dataset.exportCampaign ?? '';
  if (!campaignId) return;
  const originalText = button.textContent || 'Download status CSV';
  button.disabled = true;
  button.textContent = 'Preparing CSV…';
  setCampaignMessage('');
  try {
    const response = await fetch(`/api/admin/campaigns/${encodeURIComponent(campaignId)}/status.csv`, { headers: { Accept: 'text/csv' } });
    if (!response.ok) {
      const raw = await response.text();
      let message = 'The campaign status CSV could not be downloaded.';
      try {
        const body = JSON.parse(raw) as ApiError;
        message = body.message || message;
      } catch {
        if (raw.trim()) message = raw.slice(0, 400);
      }
      throw new Error(message);
    }
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = `aac-campaign-status-${campaignId.replace(/[^A-Za-z0-9_-]/g, '_')}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    setCampaignMessage('Campaign status CSV downloaded.');
  } catch (error) {
    setCampaignMessage(error instanceof Error ? error.message : 'The campaign status CSV could not be downloaded.');
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

async function updateCampaignArchive(button: HTMLButtonElement): Promise<void> {
  const campaignId = button.dataset.campaignId ?? '';
  const action = button.dataset.campaignAction;
  if (!campaignId || (action !== 'archive_campaign' && action !== 'restore_campaign')) return;
  const archiving = action === 'archive_campaign';
  const confirmed = window.confirm(archiving
    ? 'Archive this campaign in the dashboard history? This only changes the dashboard view; it does not stop invitations, interviews, reviews, or publishing. You can restore it later.'
    : 'Restore this campaign to the unarchived dashboard history?');
  if (!confirmed) return;
  button.disabled = true;
  setCampaignMessage(archiving ? 'Archiving campaign…' : 'Restoring campaign…');
  try {
    await postAdminCommand({ action, campaign_id: campaignId });
    setCampaignMessage(archiving ? 'Campaign archived. Its workflow and article records are unchanged.' : 'Campaign restored.');
    await initializeAdmin();
  } catch (error) {
    setCampaignMessage(error instanceof Error ? error.message : 'The campaign archive state could not be changed.');
    button.disabled = false;
  }
}

function eventRow(event: WorkflowEvent): string {
  return `
    <li class="admin-event admin-event-${escapeHtml(event.severity)}">
      <span class="admin-event-dot" aria-hidden="true"></span>
      <div>
        <strong>${escapeHtml(titleCase(event.event_type))}</strong>
        <p>${escapeHtml(titleCase(event.entity_type))} · ${escapeHtml(event.entity_id)}</p>
        <small>${escapeHtml(event.source_system || 'Unknown source')} · ${escapeHtml(formatDate(event.event_timestamp, true))}</small>
      </div>
    </li>`;
}

function renderDiagnostics(data: AdminResponse): string {
  const errors = data.overview.recent_events.filter((event) => event.severity === 'error');
  const failures = data.overview.communication_failures;
  return `
    <div class="admin-diagnostic-grid">
      <section class="admin-panel" id="errors">
        <div class="admin-panel-heading">
          <div><span class="admin-kicker">Diagnostics</span><h2>Error surfaces</h2></div>
          <span class="admin-count">${errors.length + failures.length} recent</span>
        </div>
        <div class="admin-error-list">
          ${errors.slice(0, 8).map((event) => `
            <article class="admin-error-card">
              ${statusPill('Workflow failed')}
              <h3>${escapeHtml(titleCase(event.event_type))}</h3>
              <p>${escapeHtml(titleCase(event.entity_type))} · ${escapeHtml(event.entity_id)}</p>
              <time>${escapeHtml(formatDate(event.event_timestamp, true))}</time>
            </article>`).join('')}
          ${failures.slice(0, 8).map((failure) => `
            <article class="admin-error-card">
              ${statusPill('Communication failed')}
              <h3>${escapeHtml(titleCase(failure.communication_type))}</h3>
              <p>${escapeHtml(titleCase(failure.channel))} · ${escapeHtml(failure.recipient || failure.doctor_id)}</p>
              <time>${escapeHtml(formatDate(failure.sent_at, true))}</time>
            </article>`).join('')}
          ${errors.length || failures.length ? '' : '<div class="admin-empty admin-empty-good">No recent workflow or communication errors.</div>'}
        </div>
      </section>
      <section class="admin-panel" id="timeline">
        <div class="admin-panel-heading">
          <div><span class="admin-kicker">Audit trail</span><h2>Workflow timeline</h2></div>
          <span class="admin-count">Latest 150</span>
        </div>
        <ol class="admin-event-list">
          ${data.overview.recent_events.length ? data.overview.recent_events.slice(0, 40).map(eventRow).join('') : '<li class="admin-empty">No workflow events are recorded yet.</li>'}
        </ol>
      </section>
    </div>`;
}

function renderAdminControls(data: AdminResponse): string {
  const enabled = data.capabilities.actionsEnabled;
  return `
    <section class="admin-control-grid" id="controls">
      <article class="admin-control-card admin-control-primary">
        <span class="admin-kicker">New work</span>
        <h2>Start an article campaign</h2>
        <p>Create one monthly campaign with three topics — one shared theme or three unique topics — and a selected doctor list. Launching is handed to n8n and recorded in BigQuery.</p>
        <button class="admin-primary-button" id="open-campaign-builder" type="button" ${enabled ? '' : 'disabled'}>New campaign</button>
        ${enabled ? '' : '<small>The form is ready; activation is waiting for the audited command workflow and an assigned administrator.</small>'}
      </article>
      <article class="admin-control-card" id="admins">
        <span class="admin-kicker">Access</span>
        <h2>Users and permissions</h2>
        <div class="admin-current-user"><span>${escapeHtml(data.viewer.email || 'Workspace user')}</span>${statusPill(data.capabilities.role)}</div>
        <ul class="admin-permission-list">
          <li><strong>Viewer</strong><span>Campaigns, content, timelines, and diagnostics</span></li>
          <li><strong>Administrator</strong><span>Viewer access plus audited approvals and campaign launch</span></li>
        </ul>
        <p class="admin-control-note">Cloudflare controls who may sign in. Administrator privileges are maintained separately so dashboard viewers cannot change workflow state.</p>
        <a class="admin-secondary-link" href="/admin/access">View and manage users</a>
      </article>
    </section>`;
}

function renderAccess(data: AdminResponse): string {
  const canManage = data.capabilities.role === 'administrator';
  const administratorList = data.access.actionAdministrators.length
    ? `<ul class="admin-access-user-list">${data.access.actionAdministrators.map((email) => `<li><span>${escapeHtml(email)}</span>${statusPill('administrator')}</li>`).join('')}</ul>`
    : '<div class="admin-empty">Administrator email details are visible only to an administrator.</div>';
  return `
    <section class="admin-panel admin-access-panel" id="access">
      <div class="admin-panel-heading">
        <div><span class="admin-kicker">Security</span><h2>Access and users</h2></div>
        <span class="admin-count">${escapeHtml(data.access.signInProvider)}</span>
      </div>
      <div class="admin-access-grid">
        <article class="admin-access-card">
          <span class="admin-access-step">1</span>
          <h3>Dashboard sign-in</h3>
          <p>Cloudflare Access policies decide who can open the dashboard. Use the policy tester to check a person before saving a change.</p>
          ${canManage && data.access.signInManagementUrl
            ? `<a class="admin-primary-button admin-link-button" href="${escapeHtml(data.access.signInManagementUrl)}" target="_blank" rel="noreferrer">Manage sign-in access</a>`
            : '<small>Only an administrator can open the access-management console.</small>'}
        </article>
        <article class="admin-access-card">
          <span class="admin-access-step">2</span>
          <h3>Administrator privileges</h3>
          <p>These users can launch campaigns and record audited approvals. Everyone else who passes Cloudflare Access remains a viewer.</p>
          ${administratorList}
          ${canManage && data.access.roleManagementUrl
            ? `<a class="admin-secondary-link" href="${escapeHtml(data.access.roleManagementUrl)}" target="_blank" rel="noreferrer">Edit administrator list</a>`
            : ''}
        </article>
      </div>
      <div class="admin-access-guidance">
        <strong>To add someone</strong>
        <span>First include their Apex account in the Cloudflare Access policy. Then add their email to <code>ADMIN_ACTION_EMAILS</code> only if they should be an administrator. Separate multiple administrator emails with commas and deploy the Worker setting.</span>
      </div>
    </section>`;
}

async function fetchCampaignTemplate(campaignId: string): Promise<CampaignTemplate> {
  const response = await fetch(`/api/admin/campaigns/${encodeURIComponent(campaignId)}/template`, {
    headers: { Accept: 'application/json' },
  });
  const raw = await response.text();
  let body: unknown = {};
  if (raw.trim()) {
    try { body = JSON.parse(raw); }
    catch { body = { message: raw.slice(0, 500) }; }
  }
  if (!response.ok) {
    throw new Error(body && typeof body === 'object' && 'message' in body ? String(body.message) : 'The campaign could not be duplicated.');
  }
  const result = body as CampaignTemplateResponse;
  if (!result.template) throw new Error('The campaign template was empty.');
  return result.template;
}

function setCampaignField(form: HTMLFormElement, name: string, value: string): void {
  const field = form.elements.namedItem(name);
  if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement) {
    field.value = value;
  }
}

async function duplicateCampaign(campaignId: string): Promise<void> {
  const dialog = document.querySelector<HTMLDialogElement>('#admin-campaign-dialog');
  const form = document.querySelector<HTMLFormElement>('#admin-campaign-form');
  const message = document.querySelector<HTMLElement>('#campaign-form-message');
  if (!dialog || !form) return;

  if (message) message.textContent = 'Loading campaign…';
  dialog.showModal();

  try {
    const template = await fetchCampaignTemplate(campaignId);
    form.reset();

    setCampaignField(form, 'campaign_name', `${template.campaign_name} Copy`);
    setCampaignField(form, 'campaign_month', template.campaign_month.slice(0, 7));
    setCampaignField(form, 'send_mode', 'now');
    setCampaignField(form, 'scheduled_send_local', '');
    setCampaignField(form, 'interview_deadline', '');
    setCampaignField(form, 'training_resource_url', template.training_resource_url ?? '');
    setCampaignField(form, 'launch_confirmation', '');
    const reminderCheckbox = form.elements.namedItem('send_doctor_review_reminders');
    if (reminderCheckbox instanceof HTMLInputElement) reminderCheckbox.checked = template.send_doctor_review_reminders !== false;

    const audience = form.elements.namedItem('audience') as HTMLSelectElement | null;
    if (audience) {
      audience.value = template.audience;
      audience.dispatchEvent(new Event('change'));
    }

    const sendMode = form.elements.namedItem('send_mode') as HTMLSelectElement | null;
    sendMode?.dispatchEvent(new Event('change'));

    const topics = [...template.topics].sort((a, b) => Number(a.topic_sort_order) - Number(b.topic_sort_order));
    const sharesTopicOneDetails = (topic: CampaignTemplateTopic | undefined) => Boolean(topic && topics[0]) &&
      CAMPAIGN_TOPIC_SHARED_FIELDS.every((field) => (topic?.[field] ?? '') === (topics[0]?.[field] ?? ''));
    const sharedTheme = sharesTopicOneDetails(topics[1]) && sharesTopicOneDetails(topics[2]);
    setCampaignField(form, 'topic_layout', sharedTheme ? 'shared_theme' : 'unique');
    for (let index = 0; index < 3; index += 1) {
      const number = index + 1;
      const topic = topics[index];
      setCampaignField(form, `topic_${number}`, topic?.topic_title ?? '');
      setCampaignField(form, `topic_${number}_wordpress_slug`, topic?.wordpress_slug ?? '');
      setCampaignField(form, `topic_${number}_featured_image_source_url`, topic?.featured_image_source_url ?? '');
      setCampaignField(form, `topic_${number}_featured_image_alt_text`, topic?.featured_image_alt_text ?? '');
    }

    const recipientIds = new Set(template.recipients.map((recipient) => recipient.doctor_id));
    form.querySelectorAll<HTMLInputElement>('input[name="doctor_ids"]').forEach((checkbox) => {
      checkbox.checked = recipientIds.has(checkbox.value);
    });
    form.querySelector<HTMLInputElement>('#campaign-doctor-search')?.dispatchEvent(new Event('input'));
    syncCampaignTopicImages(form);

    const missingAssetFields = topics.some((topic) =>
      !topic?.featured_image_source_url ||
      !topic?.featured_image_alt_text
    );
    if (message) {
      message.textContent = missingAssetFields
        ? 'Campaign duplicated. This older campaign is missing one or more image fields; complete those before launch.'
        : 'Campaign duplicated. Review the new name, month, recipients, and send timing before launch.';
    }
  } catch (error) {
    if (message) message.textContent = error instanceof Error ? error.message : 'The campaign could not be duplicated.';
  }
}

/** With one monthly theme, Topics 2 and 3 reuse these Topic 1 values. */
const CAMPAIGN_TOPIC_SHARED_FIELDS = [
  'wordpress_slug',
  'featured_image_source_url',
  'featured_image_alt_text',
] as const;

const WORDPRESS_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const WORDPRESS_SLUG_MAX_LENGTH = 100;

function suggestWordPressSlug(title: string): string {
  return title
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, WORDPRESS_SLUG_MAX_LENGTH)
    .replace(/-+$/g, '');
}

function renderCampaignTopicFields(number: number): string {
  const canShare = number > 1;
  return `
          <fieldset class="admin-topic-assets" data-campaign-topic="${number}"><legend>Topic ${number}</legend>
            <label>Topic ${number}<input name="topic_${number}" required /></label>
            <div class="admin-topic-image-fields" data-topic-shared-fields="${number}">
            <label>Topic ${number} WordPress URL slug (optional)
              <span class="admin-slug-row">
                <input name="topic_${number}_wordpress_slug" maxlength="${WORDPRESS_SLUG_MAX_LENGTH}" pattern="[a-z0-9]+(-[a-z0-9]+)*" autocomplete="off" spellcheck="false" placeholder="Example: why-brushing-before-bed-matters" />
                <button class="admin-text-button" type="button" data-suggest-slug="${number}">Suggest from topic</button>
              </span>
              <small>Lowercase letters, numbers, and hyphens. Every article written on this topic uses this slug on its practice website. Leave blank to use the slug the article writer recommends.</small>
            </label>
              <label>Topic ${number} featured image central source URL<input name="topic_${number}_featured_image_source_url" type="url" required placeholder="https://apexparent.hostmanpowered.com/wp-content/uploads/..." /></label>
              <label>Topic ${number} featured image alt text<input name="topic_${number}_featured_image_alt_text" required minlength="8" /></label>
            </div>
            ${canShare ? `<p class="admin-muted admin-topic-image-note" data-topic-shared-note="${number}">One monthly theme: this topic uses the WordPress URL slug, featured image, and alt text entered under Topic 1.</p>` : ''}
          </fieldset>`;
}

function campaignUsesSharedTheme(form: HTMLFormElement): boolean {
  const layout = form.elements.namedItem('topic_layout') as HTMLSelectElement | null;
  return (layout?.value ?? 'shared_theme') === 'shared_theme';
}

/** With one monthly theme, hides Topics 2 and 3's slug and image fields because they reuse Topic 1's. */
function syncCampaignTopicImages(form: HTMLFormElement): void {
  const sharedTheme = campaignUsesSharedTheme(form);
  for (const number of [2, 3]) {
    const fields = form.querySelector<HTMLElement>(`[data-topic-shared-fields="${number}"]`);
    const note = form.querySelector<HTMLElement>(`[data-topic-shared-note="${number}"]`);
    if (fields) {
      fields.hidden = sharedTheme;
      fields.querySelectorAll('input, select, button').forEach((field) => { (field as HTMLInputElement | HTMLSelectElement | HTMLButtonElement).disabled = sharedTheme; });
    }
    if (note) note.hidden = !sharedTheme;
  }
}

function bindCampaignTopicFields(form: HTMLFormElement): void {
  const layout = form.querySelector('#campaign-topic-layout') as HTMLSelectElement | null;
  layout?.addEventListener('change', () => syncCampaignTopicImages(form));
  form.querySelectorAll<HTMLButtonElement>('[data-suggest-slug]').forEach((button) => {
    button.addEventListener('click', () => {
      const number = button.dataset.suggestSlug;
      const title = String((form.elements.namedItem(`topic_${number}`) as HTMLInputElement | null)?.value ?? '');
      const slugField = form.elements.namedItem(`topic_${number}_wordpress_slug`) as HTMLInputElement | null;
      if (slugField) slugField.value = suggestWordPressSlug(title);
    });
  });
  // form.reset() restores the default layout before the browser updates field values.
  form.addEventListener('reset', () => window.setTimeout(() => syncCampaignTopicImages(form), 0));
  syncCampaignTopicImages(form);
}

function renderDashboard(data: AdminResponse): void {
  const generated = formatDate(data.overview.generated_at, true);
  app.innerHTML = `
    <div class="admin-shell">
      <aside class="admin-sidebar">
        <img src="/brand/colormark_landscape.svg" alt="Apex Dental Partners" />
        <nav aria-label="Admin navigation">
          <a href="#overview" class="is-active">Overview</a>
          <a href="#controls">Actions</a>
          <a href="#work-queue">Work queue</a>
          <a href="#campaigns">Campaigns</a>
          <a href="/admin/access">Access</a>
          <a href="#errors">Diagnostics</a>
          <a href="#timeline">Timeline</a>
        </nav>
        <div class="admin-readonly-note"><strong>${data.capabilities.actionsEnabled ? 'Administrator' : 'Read-only access'}</strong><span>${data.capabilities.actionsEnabled ? 'Every action is routed through n8n and written to the audit history.' : 'Viewing is live. Workflow changes remain disabled until an administrator is assigned.'}</span></div>
      </aside>
      <main class="admin-main" id="overview">
        <header class="admin-header">
          <div><span class="admin-kicker">Apex content platform</span><h1>Content operations</h1><p>Campaigns, clinicians, articles, and workflow health in one view.</p></div>
          <div class="admin-user-area">
            <span>${escapeHtml(data.viewer.email || 'Workspace user')}</span>
            <button class="admin-refresh" id="refresh-admin" type="button">Refresh data</button>
            <small>Updated ${escapeHtml(generated)}</small>
          </div>
        </header>
        ${renderSummary(data)}
        ${renderAdminControls(data)}
        ${renderAccess(data)}
        ${renderQueue(data)}
        ${renderCampaigns(data)}
        ${renderDiagnostics(data)}
        <footer class="admin-footer"><span></span>BigQuery is the system of record · n8n remains the orchestration layer · ${data.capabilities.actionsEnabled ? 'Actions are audited' : 'Actions await secure workflow activation'}<strong>PRIVATE PRACTICE REIMAGINED®</strong></footer>
      </main>
      <dialog class="admin-detail-dialog" id="admin-detail-dialog"><div id="admin-detail-content"></div><button class="admin-dialog-close" id="admin-dialog-close" type="button" aria-label="Close details">×</button></dialog>
      <dialog class="admin-campaign-dialog" id="admin-campaign-dialog">
        <button class="admin-dialog-close" id="campaign-dialog-close" type="button" aria-label="Close campaign builder">×</button>
        <span class="admin-kicker">New campaign</span><h2>Start an article campaign</h2>
        <p>Select doctors from the linked directory so each article keeps the correct practice and publishing-site relationship. Presentation previews save the transcript but do not create or publish an article.</p>

        <div class="admin-campaign-instructions">
          <strong>Before you start</strong>
          <ol>
            <li>Create or obtain one approved featured image for the month's theme, or one for each topic if the three topics are unrelated.</li>
            <li><a href="https://apexparent.hostmanpowered.com/wp-admin/upload.php?mlo-category=all-files" target="_blank" rel="noreferrer">Upload each image once to the Apex Parent Media Library</a>.</li>
            <li>For each image, copy the <strong>direct file URL</strong>. It must begin with <code>https://apexparent.hostmanpowered.com/wp-content/uploads/</code>. Do not paste the Media Library page URL.</li>
            <li>Have useful alt text ready for each image.</li>
            <li>Optionally, choose the WordPress URL slug for each topic, such as <code>why-brushing-before-bed-matters</code>.</li>
            <li>If you schedule the invitations, choose the local date/time and the timezone where you want the send to occur. The dispatcher checks every minute, so delivery begins shortly after the scheduled time.</li>
          </ol>
        </div>

        <form id="admin-campaign-form" class="admin-campaign-form">
          <label>Audience
            <select name="audience" id="campaign-audience" required>
              <option value="Linked doctors">Linked doctors — full article workflow</option>
              <option value="Presentation preview">Presentation preview — transcript only</option>
            </select>
            <small>The doctor directory is reconciled hourly from the authoritative Doctor Census sheet. Existing campaign history is preserved when roster details change.</small>
          </label>

          <label>Campaign name<input name="campaign_name" required placeholder="October 2026 presentation demo" /></label>
          <label>Campaign month<input name="campaign_month" required type="month" /></label>

          <fieldset class="admin-send-options"><legend>Doctor communications</legend>
            <label>Interview completion deadline (optional)<input name="interview_deadline" type="date" /><small>Topic links expire at 11:59 PM Central on this date. If blank, links expire 30 days after the invitation. This deadline applies to completing the interview.</small></label>
            <label>Training link or video (optional)<input name="training_resource_url" type="url" placeholder="https://…" /><small>This link is included in the invitation email.</small></label>
            <label class="admin-toggle"><input name="send_doctor_review_reminders" type="checkbox" checked /><span>Send one reminder 48 hours before the doctor review deadline.</span></label>
          </fieldset>

          <fieldset class="admin-send-options"><legend>Invitation timing</legend>
            <label>Send
              <select name="send_mode" id="campaign-send-mode" required>
                <option value="now">As soon as the campaign launches</option>
                <option value="in_10">In about 10 minutes</option>
                <option value="scheduled">Schedule for a specific time</option>
              </select>
            </label>
            <div id="campaign-schedule-fields" hidden>
              <label>Scheduled local date and time<input name="scheduled_send_local" id="campaign-scheduled-local" type="datetime-local" /></label>
              <label>Timezone
                <select name="scheduled_send_timezone" id="campaign-timezone">
                  <option value="America/Chicago">Central US — America/Chicago</option>
                  <option value="America/Mexico_City">Central Mexico — America/Mexico_City</option>
                  <option value="America/Cancun">Cancún / Quintana Roo — America/Cancun</option>
                  <option value="America/Mazatlan">Mazatlán / Sinaloa — America/Mazatlan</option>
                  <option value="America/Tijuana">Tijuana / Baja California — America/Tijuana</option>
                </select>
              </label>
              <small>Scheduled campaigns stay parked until the selected time. The active dispatcher then releases and sends the invitations.</small>
            </div>
          </fieldset>

          <fieldset class="admin-send-options"><legend>Campaign layout</legend>
            <label>How are this month's three articles organized?
              <select name="topic_layout" id="campaign-topic-layout">
                <option value="shared_theme">One monthly theme — the three articles share one WordPress URL slug and featured image</option>
                <option value="unique">Three unique topics — each article has its own WordPress URL slug and featured image</option>
              </select>
              <small>With a monthly theme, enter the WordPress URL slug and image details once under Topic 1. Topics 2 and 3 use the same ones automatically. Choose “Three unique topics” to give each topic its own. Put the monthly theme in the campaign name.</small>
            </label>
          </fieldset>

          ${[1, 2, 3].map(renderCampaignTopicFields).join('')}

          <fieldset class="admin-recipient-options" id="existing-recipient-section"><legend>Doctors to invite</legend>
            <p class="admin-muted" id="campaign-doctor-guidance">Search the current Doctor Census roster, then select doctors individually. Each selection retains its own primary-practice and website mapping.</p>
            <label class="admin-doctor-search"><span>Search doctors</span><input id="campaign-doctor-search" type="search" placeholder="Search by doctor or practice…" autocomplete="off" /></label>
            <div class="admin-doctor-tools">
              <label class="admin-campaign-sort">Arrange doctors
                <select id="campaign-doctor-sort">
                  <option value="last_name">Last name, A–Z</option>
                  <option value="practice">Practice, then last name</option>
                  <option value="first_name">First name, A–Z</option>
                </select>
              </label>
              <div class="admin-doctor-bulk-actions">
                <button class="admin-text-button" id="select-visible-doctors" type="button">Select all shown</button>
                <button class="admin-text-button" id="clear-doctors" type="button">Deselect all</button>
              </div>
            </div>
            <div class="admin-doctor-selection-summary"><strong id="campaign-doctor-selected-count">0 selected</strong><span id="campaign-doctor-visible-count">${data.overview.campaign_launch_options.doctors.length} shown</span></div>
            <p class="admin-campaign-message" id="campaign-doctor-selection-message" role="status"></p>
            <div id="campaign-doctor-options" class="admin-doctor-scroll-list">
              ${data.overview.campaign_launch_options.doctors.length
                ? data.overview.campaign_launch_options.doctors.map((doctor) => `
                    <label class="admin-recipient-option" data-doctor-search="${escapeHtml(`${doctor.doctor_name} ${doctor.practice_name} ${doctor.email || ''}`.toLowerCase())}" data-doctor-name="${escapeHtml(doctor.doctor_name)}" data-doctor-practice="${escapeHtml(doctor.practice_name)}" data-publishing-ready="${doctor.publishing_ready ? 'true' : 'false'}">
                      <input type="checkbox" name="doctor_ids" value="${escapeHtml(doctor.doctor_id)}" />
                      <span><strong>${escapeHtml([doctor.doctor_name, doctor.credentials].filter(Boolean).join(', '))}</strong><small>${escapeHtml(doctor.practice_name)} · ${escapeHtml(doctor.email || doctor.doctor_id)}</small>${doctor.publishing_ready ? '' : '<em>Presentation preview only until this site is verified</em>'}</span>
                    </label>`).join('')
                : '<div class="admin-empty">No doctors are available yet. Run the Doctor Census sync and refresh the dashboard.</div>'}
            </div>
          </fieldset>

          <label>Type <strong>SEND INVITATIONS</strong> to confirm
            <input name="launch_confirmation" required autocomplete="off" placeholder="SEND INVITATIONS" />
          </label>

          <div class="admin-form-actions"><button type="button" id="cancel-campaign">Cancel</button><button class="admin-primary-button" type="submit">Launch campaign</button></div>
          <p class="admin-form-message" id="campaign-form-message" role="status"></p>
        </form>
      </dialog>
    </div>`;

  document.querySelector<HTMLButtonElement>('#refresh-admin')?.addEventListener('click', () => void initializeAdmin());
  document.querySelector<HTMLButtonElement>('#admin-dialog-close')?.addEventListener('click', () => {
    document.querySelector<HTMLDialogElement>('#admin-detail-dialog')?.close();
  });
  const campaignDialog = document.querySelector<HTMLDialogElement>('#admin-campaign-dialog');
  document.querySelector<HTMLButtonElement>('#open-campaign-builder')?.addEventListener('click', () => campaignDialog?.showModal());
  document.querySelector<HTMLButtonElement>('#campaign-dialog-close')?.addEventListener('click', () => campaignDialog?.close());
  document.querySelector<HTMLButtonElement>('#cancel-campaign')?.addEventListener('click', () => campaignDialog?.close());

  const campaignAudience = document.querySelector('#campaign-audience') as HTMLSelectElement | null;
  const campaignDoctorSearch = document.querySelector<HTMLInputElement>('#campaign-doctor-search');
  const selectedDoctorCount = document.querySelector<HTMLElement>('#campaign-doctor-selected-count');
  const visibleDoctorCount = document.querySelector<HTMLElement>('#campaign-doctor-visible-count');
  const campaignDoctorGuidance = document.querySelector<HTMLElement>('#campaign-doctor-guidance');
  const campaignSendMode = document.querySelector('#campaign-send-mode') as HTMLSelectElement | null;
  const scheduleFields = document.querySelector<HTMLElement>('#campaign-schedule-fields');
  const scheduledLocal = document.querySelector<HTMLInputElement>('#campaign-scheduled-local');
  const campaignTimezone = document.querySelector('#campaign-timezone') as HTMLSelectElement | null;
  const campaignDoctorSort = document.querySelector('#campaign-doctor-sort') as HTMLSelectElement | null;
  const doctorOptionList = document.querySelector<HTMLElement>('#campaign-doctor-options');
  const doctorSelectionMessage = document.querySelector<HTMLElement>('#campaign-doctor-selection-message');

  const lastNameKey = (name: string): string => {
    if (name.includes(',')) return name.split(',', 1)[0].trim().toLowerCase();
    const parts = name.trim().split(/\s+/).filter(Boolean);
    const last = (parts.pop() ?? '').toLowerCase();
    if (['jr', 'jr.', 'sr', 'sr.', 'ii', 'iii', 'iv'].includes(last) && parts.length) return (parts.pop() ?? '').toLowerCase();
    return last;
  };
  const firstNameKey = (name: string): string => name.includes(',')
    ? (name.split(',').slice(1).join(',').trim().split(/\s+/)[0] ?? '').toLowerCase()
    : (name.trim().split(/\s+/)[0] ?? '').toLowerCase();
  const sortDoctorOptions = (): void => {
    if (!doctorOptionList || !campaignDoctorSort) return;
    const options = Array.from(doctorOptionList.querySelectorAll<HTMLElement>('[data-doctor-search]'));
    options.sort((a, b) => {
      const nameA = a.dataset.doctorName ?? '';
      const nameB = b.dataset.doctorName ?? '';
      const practiceA = a.dataset.doctorPractice ?? '';
      const practiceB = b.dataset.doctorPractice ?? '';
      if (campaignDoctorSort.value === 'practice') {
        const practiceOrder = practiceA.localeCompare(practiceB, undefined, { sensitivity: 'base' });
        if (practiceOrder) return practiceOrder;
      }
      if (campaignDoctorSort.value === 'first_name') {
        const firstNameOrder = firstNameKey(nameA).localeCompare(firstNameKey(nameB), undefined, { sensitivity: 'base' });
        return firstNameOrder || nameA.localeCompare(nameB, undefined, { sensitivity: 'base' });
      }
      const lastNameOrder = lastNameKey(nameA).localeCompare(lastNameKey(nameB), undefined, { sensitivity: 'base' });
      return lastNameOrder || nameA.localeCompare(nameB, undefined, { sensitivity: 'base' });
    });
    options.forEach((option) => doctorOptionList.appendChild(option));
  };

  const syncCampaignRecipients = (): void => {
    const needle = campaignDoctorSearch?.value.trim().toLowerCase() ?? '';
    const fullWorkflow = campaignAudience?.value === 'Linked doctors';
    let visibleCount = 0;
    let selectedCount = 0;
    let unavailableCount = 0;
    document.querySelectorAll<HTMLElement>('[data-doctor-search]').forEach((option) => {
      const checkbox = option.querySelector<HTMLInputElement>('input[type="checkbox"]');
      const eligible = !fullWorkflow || option.dataset.publishingReady === 'true';
      const matches = !needle || (option.dataset.doctorSearch ?? '').includes(needle);
      option.hidden = !matches;
      option.classList.toggle('is-unavailable', !eligible);
      if (checkbox) {
        checkbox.disabled = !eligible;
        if (!eligible) checkbox.checked = false;
      }
      if (matches) {
        visibleCount += 1;
        if (!eligible) unavailableCount += 1;
      }
      if (checkbox?.checked) selectedCount += 1;
    });
    if (visibleDoctorCount) {
      visibleDoctorCount.textContent = fullWorkflow && unavailableCount
        ? `${visibleCount} shown · ${unavailableCount} require setup`
        : `${visibleCount} shown`;
    }
    if (selectedDoctorCount) selectedDoctorCount.textContent = `${selectedCount} selected`;
    if (campaignDoctorGuidance) {
      campaignDoctorGuidance.textContent = fullWorkflow
        ? 'All current Doctor Census records are shown. Doctors whose practice publishing setup has not been verified remain visible but cannot be selected for the full article workflow yet.'
        : 'Search the current Doctor Census roster, then select doctors individually. Presentation previews capture the interview transcript but do not create or publish an article.';
    }
  };

  const syncSendMode = (): void => {
    const scheduled = campaignSendMode?.value === 'scheduled';
    if (scheduleFields) scheduleFields.hidden = !scheduled;
    if (scheduledLocal) scheduledLocal.required = scheduled;
    if (campaignTimezone) campaignTimezone.required = scheduled;
  };

  const browserZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (campaignTimezone && browserZone && !Array.from(campaignTimezone.options).some((option) => option.value === browserZone)) {
    campaignTimezone.add(new Option(`Current browser timezone — ${browserZone}`, browserZone, true, true));
  } else if (campaignTimezone && browserZone) {
    campaignTimezone.value = browserZone;
  }

  campaignAudience?.addEventListener('change', syncCampaignRecipients);
  campaignDoctorSearch?.addEventListener('input', syncCampaignRecipients);
  document.querySelector('#campaign-doctor-options')?.addEventListener('change', syncCampaignRecipients);
  campaignDoctorSort?.addEventListener('change', () => {
    sortDoctorOptions();
    syncCampaignRecipients();
  });
  document.querySelector<HTMLButtonElement>('#select-visible-doctors')?.addEventListener('click', () => {
    const visibleOptions = Array.from(document.querySelectorAll<HTMLElement>('[data-doctor-search]')).filter((option) => !option.hidden && !option.querySelector<HTMLInputElement>('input[type="checkbox"]')?.disabled);
    const selectedCount = document.querySelectorAll<HTMLInputElement>('#campaign-doctor-options input[name="doctor_ids"]:checked').length;
    const newSelectionCount = visibleOptions.filter((option) => !option.querySelector<HTMLInputElement>('input[type="checkbox"]')?.checked).length;
    if (selectedCount + newSelectionCount > 200) {
      if (doctorSelectionMessage) doctorSelectionMessage.textContent = 'Campaigns are limited to 200 doctors. Refine the search or deselect doctors first.';
      return;
    }
    if (doctorSelectionMessage) doctorSelectionMessage.textContent = '';
    visibleOptions.forEach((option) => {
      const checkbox = option.querySelector<HTMLInputElement>('input[type="checkbox"]');
      if (checkbox) checkbox.checked = true;
    });
    syncCampaignRecipients();
  });
  document.querySelector<HTMLButtonElement>('#clear-doctors')?.addEventListener('click', () => {
    document.querySelectorAll<HTMLInputElement>('#campaign-doctor-options input[name="doctor_ids"]:checked').forEach((checkbox) => { checkbox.checked = false; });
    if (doctorSelectionMessage) doctorSelectionMessage.textContent = '';
    syncCampaignRecipients();
  });
  campaignSendMode?.addEventListener('change', syncSendMode);
  sortDoctorOptions();
  syncCampaignRecipients();
  syncSendMode();

  document.querySelectorAll<HTMLButtonElement>('[data-campaign-filter]').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.campaignFilter === campaignArchiveFilter);
    button.addEventListener('click', () => {
      campaignArchiveFilter = button.dataset.campaignFilter === 'archived' ? 'archived' : 'active';
      document.querySelectorAll('[data-campaign-filter]').forEach((candidate) => candidate.classList.toggle('is-active', (candidate as HTMLButtonElement).dataset.campaignFilter === campaignArchiveFilter));
      renderCampaignCards();
    });
  });
  const campaignSortSelect = document.querySelector('#admin-campaign-sort') as HTMLSelectElement | null;
  if (campaignSortSelect) campaignSortSelect.value = campaignSort;
  campaignSortSelect?.addEventListener('change', () => {
    campaignSort = campaignSortSelect.value as typeof campaignSort;
    renderCampaignCards();
  });
  renderCampaignCards();

  const campaignForm = document.querySelector<HTMLFormElement>('#admin-campaign-form');
  campaignForm?.addEventListener('submit', (event) => void submitCampaign(event));
  if (campaignForm) bindCampaignTopicFields(campaignForm);
  document.getElementById('admin-queue-campaign')?.addEventListener('change', (event) => {
    queueCampaign = (event.currentTarget as unknown as { value: string }).value;
    queuePage = 0;
    renderQueueRows();
  });
  document.querySelector<HTMLFormElement>('#admin-bulk-step')?.addEventListener('submit', (event) => void submitBulkStep(event));
  document.querySelector<HTMLInputElement>('#admin-queue-search')?.addEventListener('input', (event) => {
    queueSearch = (event.currentTarget as HTMLInputElement).value;
    queuePage = 0;
    renderQueueRows();
  });
  renderQueueRows();
  if (window.location.pathname === '/admin/access') {
    document.querySelector('#access')?.scrollIntoView({ block: 'start' });
  }
}

function parseArticlePackage(value: string | null): { articleHtml: string | null; reviewDocument: string | null } {
  if (!value) return { articleHtml: null, reviewDocument: null };
  try {
    const parsed = JSON.parse(value) as { article_html?: unknown; review_document_markdown?: unknown };
    return {
      articleHtml: typeof parsed.article_html === 'string' ? parsed.article_html : null,
      reviewDocument: typeof parsed.review_document_markdown === 'string' ? parsed.review_document_markdown : null,
    };
  } catch {
    return { articleHtml: null, reviewDocument: value };
  }
}

// Milestones that move an article forward. Used by the stage tracker and the "Push to the next step" panel.
function articleMilestones(detail: WorkItemDetail) {
  const item = detail.item;
  const articleStatus = String(item.article_status ?? '').toUpperCase();
  const interviewStatus = String(item.interview_status ?? '').toUpperCase();

  // Use the current article plus explicit milestone timestamps as the source of
  // truth. campaign_doctors can legitimately lag or retain a later historical
  // state in test data, so it must not mark downstream article stages complete.
  const invitationSent = Boolean(item.invited_at || detail.communications.some((entry) => entry.status === 'SENT' || entry.delivered_at));
  const interviewCompleted = Boolean(
    item.completed_at ||
    item.article_id ||
    /INTERVIEW_COMPLETED|ARTICLE_DRAFTED/.test(interviewStatus),
  );
  const articleDrafted = Boolean(item.article_id && item.current_version);
  const doctorApproved = Boolean(
    item.doctor_approved_at ||
    /^(DOCTOR_APPROVED|DOCTOR_AUTO_APPROVED|MARKETING_REVIEW|MARKETING_APPROVED|PUBLISHING|PUBLISHED)$/.test(articleStatus),
  );
  const marketingApproved = item.require_marketing_approval
    ? Boolean(
        item.marketing_approved_at ||
        /^(MARKETING_APPROVED|PUBLISHING|PUBLISHED)$/.test(articleStatus),
      )
    : doctorApproved;
  const onWordPress = Boolean(
    item.published_at ||
    item.published_url ||
    articleStatus === 'PUBLISHED',
  );
  // A re-send to WordPress updates the editing site, so the article must be pushed live again: only a
  // "marked live" record made after the latest re-send counts.
  const eventTime = (event: WorkflowEvent) => Date.parse(String(event.event_timestamp).replace(' UTC', 'Z').replace(' ', 'T')) || 0;
  const latestResend = Math.max(0, ...detail.events.filter((event) => event.event_type === 'article.resent_to_wordpress').map(eventTime));
  const liveEvent = detail.events
    .filter((event) => event.event_type === 'article.marked_live' && eventTime(event) > latestResend)
    .sort((a, b) => eventTime(b) - eventTime(a))[0];
  // Approved automatically because nobody responded in time; flagged for extra attention.
  const doctorAutoApproved = articleStatus === 'DOCTOR_AUTO_APPROVED'
    || detail.approvals.some((approval) => approval.approval_type === 'DOCTOR_REVIEW' && approval.status === 'AUTO_APPROVED')
    || detail.events.some((event) => event.event_type === 'doctor.auto_approved');
  const marketingAutoApproved = detail.approvals.some((approval) => approval.approval_type === 'MARKETING_REVIEW' && approval.status === 'AUTO_APPROVED')
    || detail.events.some((event) => event.event_type === 'marketing.auto_approved');
  return { articleStatus, invitationSent, interviewCompleted, articleDrafted, doctorApproved, marketingApproved, onWordPress, liveEvent, liveOnWebsite: Boolean(liveEvent), doctorAutoApproved, marketingAutoApproved };
}

function stageVisual(detail: WorkItemDetail): string {
  const m = articleMilestones(detail);
  // Apex process: campaign created → invitation emailed → interview completed → doctor review →
  // marketing review → on WordPress → ready to push → published by the team through Headless Hostman.
  const steps: Array<[string, boolean, string, string?]> = [
    ['Campaign created', true, ''],
    ['Invitation emailed', m.invitationSent, 'Waiting to send'],
    ['Interview completed', m.interviewCompleted, 'Waiting for the doctor'],
    ['Doctor review', m.doctorApproved, m.articleDrafted ? 'Waiting for the doctor' : 'Article being drafted', m.doctorAutoApproved ? 'Auto-approved' : ''],
    [detail.item.require_marketing_approval ? 'Marketing review' : 'Marketing review (not required)', m.marketingApproved,
      /CHANGES_REQUESTED/.test(m.articleStatus) ? 'Changes being written' : 'Waiting for marketing (auto-approves after 24 hours)', m.marketingAutoApproved ? 'Auto-approved' : ''],
    ['On WordPress', m.onWordPress, 'Sending to WordPress'],
    ['Ready to Push', m.liveOnWebsite, 'Push live in Headless Hostman'],
    ['Published', m.liveOnWebsite, ''],
  ];
  const activeIndex = steps.findIndex(([, complete]) => !complete);
  return `<ol class="admin-stage-track">${steps.map(([label, complete, waiting, flag], index) => `
    <li class="${complete ? 'is-complete' : index === activeIndex ? 'is-current' : ''}${complete && flag ? ' is-flagged' : ''}">
      <span>${complete ? '✓' : index + 1}</span><strong>${escapeHtml(label)}</strong>${!complete && index === activeIndex && waiting ? `<small>${escapeHtml(waiting)}</small>` : ''}${complete && flag ? `<small class="admin-stage-flag">${escapeHtml(flag)}</small>` : ''}
    </li>`).join('')}</ol>`;
}

type NextStepAction = {
  action: 'generate_article' | 'approve_for_doctor' | 'approve_for_marketing' | 'mark_live_on_website';
  reasonRequired?: boolean;
  title: string;
  description: string;
  reasonLabel: string;
  reasonPlaceholder: string;
  confirmation: string;
  button: string;
  pending: string;
  success: string;
};

// Picks the one manual step that applies to the article's current stage, if any.
function nextStepAction(detail: WorkItemDetail, enabledActions: string[]): { action: NextStepAction | null; message: string } {
  const item = detail.item;
  const m = articleMilestones(detail);
  const readOnly = !enabledActions.length;
  const offer = (action: NextStepAction) => readOnly || !enabledActions.includes(action.action)
    ? { action: null, message: 'Your account has read-only access. An assigned administrator can move this article to its next step.' }
    : { action, message: '' };
  if (m.liveOnWebsite) {
    const when = m.liveEvent?.event_timestamp ? formatDate(m.liveEvent.event_timestamp, true) : '';
    return { action: null, message: `This article is published on the website${when ? ` (marked ${when})` : ''}. There are no further steps.` };
  }
  if (m.onWordPress) {
    return offer({
      action: 'mark_live_on_website',
      title: 'Mark as published',
      description: 'The article is on WordPress and ready to push. After your team pushes it live through Headless Hostman, record it here so the tracker shows it as published. To mark several at once, use the “Ready to push” filter in the work queue.',
      reasonLabel: 'Note (optional)',
      reasonPlaceholder: 'Pushed live in Headless Hostman on…',
      confirmation: 'I confirm this article has been pushed live through Headless Hostman.',
      button: 'Mark as published',
      pending: 'Recording…',
      success: 'Marked as published.',
    });
  }
  if (item.article_id && m.doctorApproved && !m.marketingApproved && item.require_marketing_approval
    && /^(DOCTOR_APPROVED|DOCTOR_AUTO_APPROVED|MARKETING_REVIEW)$/.test(m.articleStatus)) {
    return offer({
      action: 'approve_for_marketing',
      title: 'Approve for marketing and send to WordPress',
      description: 'Sends this exact article version to WordPress now instead of waiting for the marketing review link. If nobody responds, it is approved automatically 24 hours after the review was requested. Your name, reason, and the time are recorded.',
      reasonLabel: 'Why is this article approved without the marketing review link?',
      reasonPlaceholder: 'Marketing reviewed this version in the dashboard and approved it to fast-track…',
      confirmation: 'I confirm this exact article version is approved to go to WordPress.',
      button: 'Approve and send to WordPress',
      pending: 'Approving and sending to WordPress…',
      success: 'Approved. The article was sent to WordPress.',
    });
  }
  if (item.article_id && m.articleStatus === 'DOCTOR_REVIEW_PENDING') {
    return offer({
      action: 'approve_for_doctor',
      title: 'Approve on the doctor’s behalf',
      description: 'Use this when the doctor approved outside the review portal, or when your team has decided this article can skip doctor review. Your name, reason, and the time are recorded, and the article moves to marketing review.',
      reasonLabel: 'How did the doctor approve, or why is doctor review being skipped?',
      reasonPlaceholder: 'Dr. Allen confirmed approval by email on… / Fast-tracking because…',
      confirmation: 'I confirm this exact article version can move forward without further doctor review.',
      button: 'Approve and continue to marketing review',
      pending: 'Recording approval…',
      success: 'Approval recorded. The article is moving to marketing review.',
    });
  }
  if (m.interviewCompleted && !m.articleDrafted && item.interview_id) {
    return offer({
      action: 'generate_article',
      title: 'Write the article draft now',
      description: 'The draft is normally written automatically within a few minutes of the interview. If that attempt failed, nothing retries it, so use this to start it again. It checks first that a draft can be written (transcript long enough, practice set up for WordPress, doctor profile complete with credentials and a short bio) and tells you if not. Writing the draft takes several minutes; refresh the dashboard afterward.',
      reasonLabel: 'Note (optional)',
      reasonPlaceholder: 'Retrying the draft for this interview…',
      confirmation: 'I confirm the article draft should be written for this interview.',
      button: 'Write the draft now',
      pending: 'Checking and starting the draft…',
      success: 'Draft started. It usually takes a few minutes; refresh the dashboard to see it.',
    });
  }
  if (!m.interviewCompleted) {
    return { action: null, message: 'Waiting for the doctor to complete the interview. There is nothing to approve yet.' };
  }
  if (/REVISION|CHANGES_REQUESTED/.test(m.articleStatus)) {
    return { action: null, message: 'A revision is being written. When the new version is ready, it will come back for review here.' };
  }
  return { action: null, message: 'There is no manual step for this article’s current stage.' };
}

function autoApprovalNotice(detail: WorkItemDetail): string {
  const m = articleMilestones(detail);
  if (m.liveOnWebsite || !(m.marketingAutoApproved || m.doctorAutoApproved)) return '';
  const who = [m.doctorAutoApproved ? 'the doctor' : '', m.marketingAutoApproved ? 'marketing' : ''].filter(Boolean).join(' and ');
  return `<div class="admin-auto-approval-notice" role="note"><strong>Auto-approved: check carefully</strong><p>Nobody from ${escapeHtml(who)} responded in time, so this article was approved automatically. Give it extra attention (wording, links, practice details) before it is pushed live.</p></div>`;
}

// While an article waits for marketing, a reviewer can describe small changes; the AI writes a new version,
// which comes back to marketing review (no doctor re-approval), like the marketing review page's "Request Changes".
function changeRequestForm(detail: WorkItemDetail, enabledActions: string[]): string {
  const item = detail.item;
  const m = articleMilestones(detail);
  if (!enabledActions.includes('request_marketing_changes') || !item.article_id || !item.require_marketing_approval
    || !/^(DOCTOR_APPROVED|DOCTOR_AUTO_APPROVED|MARKETING_REVIEW)$/.test(m.articleStatus)) return '';
  return `
    <form id="admin-change-form" class="admin-change-form">
      <strong>Or request changes</strong>
      <p>Describe what should change, for example “Reword the last paragraph to say…” or “Remove the link to…”. The AI writes a new version that keeps everything else, and it comes back here for marketing review. The doctor does not need to re-approve.</p>
      <label>What should change?<textarea name="reason" required minlength="12" maxlength="4000" rows="4" placeholder="In the last paragraph, change the wording to… / Remove the link to… because…"></textarea></label>
      <button class="admin-secondary-button" type="submit">Send change request</button>
      <p class="admin-form-message" id="change-form-message" role="status"></p>
    </form>`;
}

// For an article already on WordPress: send it again to update the same WordPress post in place (same web address,
// no duplicate), for example after a layout, color, or doctor profile change. The re-sent article returns to
// "Ready to Push" so the team pushes the updated page live again.
function resendPanel(detail: WorkItemDetail, enabledActions: string[]): string {
  const item = detail.item;
  const m = articleMilestones(detail);
  if (!enabledActions.includes('republish_to_wordpress') || !item.article_id || !m.onWordPress || m.articleStatus !== 'PUBLISHED') return '';
  return `
    <form id="admin-resend-form" class="admin-archive-panel">
      <strong>Re-send to WordPress</strong>
      <p>Updates the existing WordPress post for this article with the current page layout, site colors, and doctor profile (photo, bio, and links). It keeps the same post and web address, so no duplicate is created, and it sends the same approved article text. ${m.liveOnWebsite ? 'Because this article was already published, it moves back to “Ready to Push” so your team can push the updated page live again in Headless Hostman.' : 'It stays at “Ready to Push”.'}</p>
      <label>Note (optional)<textarea name="reason" rows="2" maxlength="2000" placeholder="Re-sending after the doctor photo was updated…"></textarea></label>
      <label class="admin-confirm-check"><input name="confirmation" type="checkbox" required /> I confirm the existing WordPress post for this article should be updated.</label>
      <button class="admin-secondary-button" type="submit">Re-send to WordPress</button>
      <p class="admin-form-message" id="resend-form-message" role="status"></p>
    </form>`;
}

async function submitResend(event: SubmitEvent, detail: WorkItemDetail): Promise<void> {
  event.preventDefault();
  const item = detail.item;
  const form = event.currentTarget as HTMLFormElement;
  const message = form.querySelector<HTMLElement>('#resend-form-message');
  const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  const reason = String(new FormData(form).get('reason') ?? '').trim();
  if (submit) submit.disabled = true;
  if (message) message.textContent = 'Starting the re-send…';
  try {
    await postAdminCommand({ action: 'republish_to_wordpress', article_id: item.article_id, campaign_id: item.campaign_id, doctor_id: item.doctor_id,
      expected_status: 'PUBLISHED', reason });
    if (message) message.textContent = 'Re-send started. The WordPress post is usually updated within a minute; refresh the page on WordPress to check it.';
    await initializeAdmin();
  } catch (error) {
    if (message) message.textContent = friendlyCommandError(error);
    if (submit) submit.disabled = false;
  }
}

// Email the doctor interview links again (for example, they lost the invitation): every topic, or one topic. Earlier
// links keep working and nothing already written changes. If the doctor records a topic again, the new interview
// replaces that topic's earlier draft, unless the doctor already approved it (approved topics are not offered).
function resendLinksPanel(detail: WorkItemDetail, enabledActions: string[]): string {
  const item = detail.item;
  const topics = detail.topics ?? [];
  if (!enabledActions.includes('resend_interview_links') || workItemArchiveState(detail).archived || !topics.length) return '';
  const open = topics.filter((topic) => !topic.approved);
  if (!open.length) return '';
  const current = open.find((topic) => topic.topic_id === item.topic_id);
  const lastSent = detail.events
    .filter((event) => event.event_type === 'interview.links_resent')
    .sort((a, b) => String(b.event_timestamp).localeCompare(String(a.event_timestamp)))[0];
  const options = [
    `<option value="" ${current ? '' : 'selected'}>All ${open.length === topics.length ? `${topics.length} topics` : 'open topics'} (like the original invitation)</option>`,
    ...topics.map((topic) => `<option value="${escapeHtml(topic.topic_id)}" ${topic.approved ? 'disabled' : ''} ${current?.topic_id === topic.topic_id ? 'selected' : ''}>${escapeHtml(topic.topic_title)}${topic.approved ? ' (already approved)' : ''}</option>`),
  ].join('');
  return `
    <form id="admin-resend-links-form" class="admin-archive-panel">
      <strong>Resend interview link</strong>
      <p>${lastSent ? `Links were last resent on ${escapeHtml(formatDate(lastSent.event_timestamp, true))}. ` : ''}Emails the doctor a fresh interview link, for example if they lost the invitation or want to record the interview again. Earlier links keep working, and nothing already written changes. If the doctor records a topic again, the new interview replaces that topic's earlier draft, unless they already approved it. Links follow the campaign's interview deadline; for a campaign without a deadline, they do not expire.</p>
      <label>Topic<select name="topic_id">${options}</select></label>
      <label>Note (optional)<textarea name="reason" rows="2" maxlength="2000" placeholder="Dr. Carlile asked for the link again by email…"></textarea></label>
      <button class="admin-secondary-button" type="submit">Email the link</button>
      <p class="admin-form-message" id="resend-links-form-message" role="status"></p>
    </form>`;
}

async function submitResendLinks(event: SubmitEvent, detail: WorkItemDetail): Promise<void> {
  event.preventDefault();
  const item = detail.item;
  const form = event.currentTarget as HTMLFormElement;
  const message = form.querySelector<HTMLElement>('#resend-links-form-message');
  const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  const data = new FormData(form);
  if (submit) submit.disabled = true;
  if (message) message.textContent = 'Sending…';
  try {
    await postAdminCommand({ action: 'resend_interview_links', campaign_id: item.campaign_id, doctor_id: item.doctor_id,
      topic_id: String(data.get('topic_id') ?? ''), reason: String(data.get('reason') ?? '').trim() });
    if (message) message.textContent = 'Sent. The doctor will get an email with the link.';
    await initializeAdmin();
  } catch (error) {
    if (message) message.textContent = friendlyCommandError(error);
    if (submit) submit.disabled = false;
  }
}

// Latest archive/restore decision for this work item: this interview's own decision, or one made for the whole
// doctor row in this campaign (before work items were split per interview), whichever is newer.
function workItemArchiveState(detail: WorkItemDetail): { archived: boolean; doNotUse: boolean; reason: string } {
  const doctorRow = `${detail.item.campaign_id}:${detail.item.doctor_id}`;
  const entities = new Set([doctorRow, detail.item.interview_id ? `${doctorRow}:${detail.item.interview_id}` : doctorRow]);
  const latest = detail.events
    .filter((event) => event.entity_type === 'work_item' && entities.has(String(event.entity_id))
      && (event.event_type === 'work_item.archived' || event.event_type === 'work_item.restored'))
    .sort((a, b) => String(b.event_timestamp).localeCompare(String(a.event_timestamp)))[0];
  if (!latest || latest.event_type !== 'work_item.archived') return { archived: false, doNotUse: false, reason: '' };
  let payload: { do_not_use?: string; reason?: string } = {};
  try { payload = JSON.parse(String((latest as WorkflowEvent & { payload?: string }).payload ?? '{}')); } catch { payload = {}; }
  return { archived: true, doNotUse: payload.do_not_use === 'true', reason: String(payload.reason ?? '') };
}

function archivePanel(detail: WorkItemDetail, enabledActions: string[]): string {
  const state = workItemArchiveState(detail);
  const canArchive = enabledActions.includes('archive_work_item');
  const canRestore = enabledActions.includes('restore_work_item');
  if (state.archived) {
    return `
      <form id="admin-archive-form" class="admin-archive-panel">
        <strong>${state.doNotUse ? 'Marked “Do not use”' : 'Archived'}</strong>
        <p>${state.reason ? `Reason: ${escapeHtml(state.reason)}. ` : ''}${state.doNotUse ? 'All automatic steps are stopped for this article.' : 'Hidden from active views; automation continues.'}</p>
        ${canRestore ? `<button class="admin-secondary-button" type="submit" data-archive-action="restore">Restore${state.doNotUse ? ' and return the article to its previous status' : ''}</button>` : ''}
        <p class="admin-form-message" id="archive-form-message" role="status"></p>
      </form>`;
  }
  if (!canArchive) return '';
  return `
    <form id="admin-archive-form" class="admin-archive-panel">
      <strong>Archive or stop this article</strong>
      <p><b>Archive</b> only hides it from active views (for example, a test). <b>Do not use</b> also stops every automatic step, so it is never auto-approved or sent to WordPress. Both can be undone with Restore.</p>
      <label>Reason (required for “Do not use”)<textarea name="reason" rows="2" maxlength="2000" placeholder="Test article / Doctor asked not to publish / Doctor wants to redo the interview…"></textarea></label>
      <div class="admin-bulk-actions">
        <button class="admin-secondary-button" type="submit" data-archive-action="archive">Archive</button>
        <button class="admin-secondary-button" type="submit" data-archive-action="do_not_use">Do not use</button>
      </div>
      <p class="admin-form-message" id="archive-form-message" role="status"></p>
    </form>`;
}

async function submitArchive(event: SubmitEvent, detail: WorkItemDetail): Promise<void> {
  event.preventDefault();
  const form = event.currentTarget as HTMLFormElement;
  const choice = (event.submitter as HTMLButtonElement | null)?.dataset.archiveAction ?? 'archive';
  const message = form.querySelector<HTMLElement>('#archive-form-message');
  const reason = String(new FormData(form).get('reason') ?? '').trim();
  if (choice === 'do_not_use' && reason.length < 4) { if (message) message.textContent = 'Add a short reason for “Do not use”.'; return; }
  const buttons = [...form.querySelectorAll<HTMLButtonElement>('button')];
  buttons.forEach((button) => { button.disabled = true; });
  if (message) message.textContent = 'Saving…';
  try {
    await postAdminCommand({ action: choice === 'restore' ? 'restore_work_item' : 'archive_work_item', do_not_use: choice === 'do_not_use',
      interview_id: detail.item.interview_id || '',
      campaign_id: detail.item.campaign_id, doctor_id: detail.item.doctor_id, reason });
    if (message) message.textContent = choice === 'restore' ? 'Restored.' : 'Saved.';
    await initializeAdmin();
  } catch (error) {
    if (message) message.textContent = friendlyCommandError(error);
    buttons.forEach((button) => { button.disabled = false; });
  }
}

function nextStepPanel(detail: WorkItemDetail, enabledActions: string[]): string {
  const { action, message } = nextStepAction(detail, enabledActions);
  if (!action) {
    return `${autoApprovalNotice(detail)}<section class="admin-action-hook"><strong>Push to the next step</strong><p>${escapeHtml(message)}</p></section>`;
  }
  return `${autoApprovalNotice(detail)}
    <section class="admin-action-hook is-enabled">
      <strong>Push to the next step: ${escapeHtml(action.title)}</strong>
      <p>${escapeHtml(action.description)}</p>
      <form id="admin-next-step-form" data-action="${escapeHtml(action.action)}">
        <label>${escapeHtml(action.reasonLabel)}<textarea name="reason" ${/^approve_for_/.test(action.action) ? 'required minlength="12"' : ''} rows="3" placeholder="${escapeHtml(action.reasonPlaceholder)}"></textarea></label>
        <label class="admin-confirm-check"><input name="confirmation" type="checkbox" required /> ${escapeHtml(action.confirmation)}</label>
        <button class="admin-primary-button" type="submit">${escapeHtml(action.button)}</button>
        <p class="admin-form-message" id="next-step-form-message" role="status"></p>
      </form>
      ${changeRequestForm(detail, enabledActions)}
    </section>`;
}

function detailEventRow(event: WorkflowEvent): string {
  const severity = event.severity || (/(failed|error)/i.test(event.event_type) ? 'error' : /(approved|published|completed)/i.test(event.event_type) ? 'success' : 'info');
  return eventRow({ ...event, severity });
}

function detailCommunicationRow(communication: WorkItemDetail['communications'][number]): string {
  const tone = statusTone(communication.status);
  const severity = tone === 'danger' ? 'error' : tone === 'success' ? 'success' : 'info';
  const sentAt = communication.sent_at ? formatDate(communication.sent_at, true) : 'No send time recorded';
  const deliveredAt = communication.delivered_at ? ` · delivered ${formatDate(communication.delivered_at, true)}` : '';
  return `
    <li class="admin-event admin-event-${severity}">
      <span class="admin-event-dot" aria-hidden="true"></span>
      <div>
        <strong>${escapeHtml(titleCase(communication.communication_type))}</strong>
        <p>${escapeHtml(communication.recipient || 'Recipient not recorded')} · ${escapeHtml(titleCase(communication.channel))} · ${statusPill(communication.status)}</p>
        <small>Sent ${escapeHtml(sentAt)}${escapeHtml(deliveredAt)}</small>
      </div>
    </li>`;
}

async function fetchWorkItemDetail(item: WorkItem): Promise<WorkItemDetailResponse> {
  // A doctor can have several interviews in one campaign; each is its own work item.
  const interview = item.interview_id ? `?interview_id=${encodeURIComponent(item.interview_id)}` : '';
  const response = await fetch(`/api/admin/work-items/${encodeURIComponent(item.campaign_id)}/${encodeURIComponent(item.doctor_id)}${interview}`, { headers: { Accept: 'application/json' } });
  const body: unknown = await response.json();
  if (!response.ok) throw new Error(body && typeof body === 'object' && 'message' in body ? String(body.message) : 'The work item could not be loaded.');
  return body as WorkItemDetailResponse;
}

function renderWorkItemDetail(response: WorkItemDetailResponse): void {
  const detail = response.detail;
  const item = detail.item;
  const content = document.querySelector<HTMLDivElement>('#admin-detail-content');
  if (!content || !item) return;
  const article = parseArticlePackage(detail.article_content);
  const milestones = articleMilestones(detail);
  const marketingApproval = detail.approvals.find((approval) => approval.approval_type === 'MARKETING_REVIEW');
  const marketingApprovalSummary = !item.require_marketing_approval
    ? 'Not required for this campaign'
    : milestones.marketingAutoApproved
      ? 'Automatically approved after 24 hours without a response. Check carefully before pushing live.'
      : marketingApproval?.status === 'APPROVED' || milestones.marketingApproved
          ? 'Approved'
          : marketingApproval?.status === 'CHANGES_REQUESTED'
            ? 'Changes requested; a new version is being written'
            : marketingApproval?.status === 'PENDING'
              ? 'Waiting for marketing (auto-approves after 24 hours)'
              : 'Not recorded';
  const doctorApproval = detail.approvals.find((approval) => approval.approval_type === 'DOCTOR_REVIEW');
  const doctorApprovalEvent = detail.events.find((event) => ['doctor.approved', 'doctor.auto_approved', 'doctor.approved_by_admin'].includes(event.event_type));
  const doctorApprovalSummary = doctorApproval?.status === 'AUTO_APPROVED' || item.article_status === 'DOCTOR_AUTO_APPROVED'
    ? 'Automatically approved after the doctor review deadline expired'
    : doctorApprovalEvent?.event_type === 'doctor.approved'
      ? 'Doctor approved through the review portal'
      : doctorApprovalEvent?.event_type === 'doctor.approved_by_admin'
        ? 'Approved by an administrator in the dashboard'
        : doctorApproval?.status === 'APPROVED'
          ? 'Approval recorded; source not available'
          : doctorApproval?.status === 'PENDING'
            ? 'Waiting for the doctor'
            : 'Not recorded';
  content.innerHTML = `
    <span class="admin-kicker">${escapeHtml(item.campaign_name)}</span>
    <h2>${escapeHtml([item.doctor_name, item.credentials].filter(Boolean).join(', '))}</h2>
    <p class="admin-detail-topic">${escapeHtml(item.topic_title || 'Topic not selected')}</p>
    ${stageVisual(detail)}
    <dl class="admin-detail-list">
      <div><dt>Current status</dt><dd>${milestones.liveOnWebsite ? statusPill('PUBLISHED') : milestones.onWordPress ? statusPill('READY_TO_PUSH') : statusPill(item.article_status || item.interview_status || item.campaign_doctor_status)}</dd></div>
      <div><dt>Intended website</dt><dd>${item.website_domain ? `<a href="${escapeHtml(item.website_domain)}" target="_blank" rel="noreferrer">${escapeHtml(item.website_domain)}</a>` : 'Not configured'}</dd></div>
      <div><dt>Practice</dt><dd>${escapeHtml(item.practice_name || 'Not assigned')}</dd></div>
      <div><dt>Publishing route</dt><dd>${escapeHtml(item.publisher_type || 'Not configured')}</dd></div>
      <div><dt>Doctor review deadline</dt><dd>${escapeHtml(formatDate(item.doctor_review_deadline, true))}</dd></div>
      <div><dt>Doctor approval</dt><dd>${escapeHtml(doctorApprovalSummary)}</dd></div>
      <div><dt>Marketing approval</dt><dd>${escapeHtml(marketingApprovalSummary)}</dd></div>
      <div><dt>Article version</dt><dd>${item.current_version ? `Version ${item.current_version} · ${escapeHtml(titleCase(item.version_type || ''))}` : 'No draft yet'}</dd></div>
    </dl>
    <div class="admin-content-tabs" role="tablist">
      <button class="is-active" type="button" data-detail-tab="transcript">Transcript</button>
      <button type="button" data-detail-tab="article">Article</button>
      <button type="button" data-detail-tab="history">History</button>
    </div>
    <section class="admin-content-panel is-active" data-detail-panel="transcript">
      <h3>Interview transcript</h3>
      ${detail.transcript ? `<pre class="admin-transcript">${escapeHtml(detail.transcript)}</pre>` : '<div class="admin-empty">No transcript has been recorded yet.</div>'}
    </section>
    <section class="admin-content-panel" data-detail-panel="article">
      <h3>Current article</h3>
      ${article.articleHtml ? '<iframe class="admin-article-preview" title="Article preview" sandbox=""></iframe>' : article.reviewDocument ? `<pre class="admin-transcript">${escapeHtml(article.reviewDocument)}</pre>` : '<div class="admin-empty">No article draft has been recorded yet.</div>'}
      ${detail.versions.length ? `<p class="admin-version-note">${detail.versions.length} saved version${detail.versions.length === 1 ? '' : 's'} · no prior version is overwritten</p>` : ''}
    </section>
    <section class="admin-content-panel" data-detail-panel="history">
      <h3>Workflow history</h3>
      <ol class="admin-event-list admin-event-list-compact">${detail.events.length ? detail.events.map(detailEventRow).join('') : '<li class="admin-empty">No linked workflow events are recorded.</li>'}</ol>
      <h3>Message activity</h3>
      <p class="admin-version-note">A sent status records the workflow’s send step; it does not confirm inbox placement.</p>
      <ol class="admin-event-list admin-event-list-compact">${detail.communications.length ? detail.communications.map(detailCommunicationRow).join('') : '<li class="admin-empty">No communication records are available for this work item.</li>'}</ol>
    </section>
    ${nextStepPanel(detail, response.capabilities.enabledActions)}
    ${resendPanel(detail, response.capabilities.enabledActions)}
    ${resendLinksPanel(detail, response.capabilities.enabledActions)}
    ${archivePanel(detail, response.capabilities.enabledActions)}`;

  const iframe = content.querySelector<HTMLIFrameElement>('.admin-article-preview');
  // Website fields show as readable labels in the preview, as on the review pages.
  if (iframe && article.articleHtml) iframe.srcdoc = labelShortcodesInHtml(article.articleHtml);
  for (const tab of content.querySelectorAll<HTMLButtonElement>('[data-detail-tab]')) {
    tab.addEventListener('click', () => {
      content.querySelectorAll('[data-detail-tab]').forEach((candidate) => candidate.classList.toggle('is-active', candidate === tab));
      content.querySelectorAll('[data-detail-panel]').forEach((panel) => panel.classList.toggle('is-active', panel.getAttribute('data-detail-panel') === tab.dataset.detailTab));
    });
  }
  content.querySelector<HTMLFormElement>('#admin-next-step-form')?.addEventListener('submit', (event) => void submitNextStep(event, detail, response.capabilities.enabledActions));
  content.querySelector<HTMLFormElement>('#admin-change-form')?.addEventListener('submit', (event) => void submitChangeRequest(event, detail));
  content.querySelector<HTMLFormElement>('#admin-resend-form')?.addEventListener('submit', (event) => void submitResend(event, detail));
  content.querySelector<HTMLFormElement>('#admin-resend-links-form')?.addEventListener('submit', (event) => void submitResendLinks(event, detail));
  content.querySelector<HTMLFormElement>('#admin-archive-form')?.addEventListener('submit', (event) => void submitArchive(event, detail));
}

async function openWorkItem(id: string): Promise<void> {
  const item = adminData?.overview.work_queue.find((candidate) => candidate.work_item_id === id);
  const dialog = document.querySelector<HTMLDialogElement>('#admin-detail-dialog');
  const content = document.querySelector<HTMLDivElement>('#admin-detail-content');
  if (!item || !dialog || !content) return;
  content.innerHTML = `
    <span class="admin-kicker">Work item</span>
    <h2>${escapeHtml([item.doctor_name, item.credentials].filter(Boolean).join(', '))}</h2>
    <p class="admin-detail-topic">${escapeHtml(item.topic_title)}</p>
    <div class="admin-detail-loading"><span class="admin-spinner"></span><p>Loading transcript, article, and workflow history…</p></div>`;
  dialog.showModal();
  try {
    renderWorkItemDetail(await fetchWorkItemDetail(item));
  } catch (error) {
    content.innerHTML = `<span class="admin-kicker">Work item</span><h2>Details unavailable</h2><p>${escapeHtml(error instanceof Error ? error.message : 'Please try again.')}</p>`;
  }
}

async function postAdminCommand(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const response = await fetch('/api/admin/commands', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify(body),
  });
  const raw = await response.text();
  let result: unknown = {};
  if (raw.trim()) {
    try {
      result = JSON.parse(raw);
    } catch {
      result = { message: raw.slice(0, 500) };
    }
  }
  if (!response.ok) {
    throw new Error(result && typeof result === 'object' && 'message' in result
      ? String(result.message)
      : `The action could not be completed (HTTP ${response.status}).`);
  }
  return result && typeof result === 'object' ? result as Record<string, unknown> : {};
}

function friendlyCommandError(error: unknown): string {
  const text = error instanceof Error ? error.message : 'The step could not be recorded.';
  return /unsupported administrative action/i.test(text)
    ? 'This step is not switched on in n8n yet. Jake needs to load the updated admin command workflow (24).'
    : text;
}

async function submitChangeRequest(event: SubmitEvent, detail: WorkItemDetail): Promise<void> {
  event.preventDefault();
  const item = detail.item;
  const form = event.currentTarget as HTMLFormElement;
  const message = form.querySelector<HTMLElement>('#change-form-message');
  const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  const reason = String(new FormData(form).get('reason') ?? '').trim();
  if (submit) submit.disabled = true;
  if (message) message.textContent = 'Sending change request…';
  try {
    await postAdminCommand({ action: 'request_marketing_changes', article_id: item.article_id, campaign_id: item.campaign_id, doctor_id: item.doctor_id,
      expected_status: item.article_status, expected_version: item.current_version, reason });
    if (message) message.textContent = 'Change request sent. The new version usually takes a few minutes, then it comes back for marketing review.';
    await initializeAdmin();
  } catch (error) {
    if (message) message.textContent = friendlyCommandError(error);
    if (submit) submit.disabled = false;
  }
}

async function submitNextStep(event: SubmitEvent, detail: WorkItemDetail, enabledActions: string[]): Promise<void> {
  event.preventDefault();
  const item = detail.item;
  const { action } = nextStepAction(detail, enabledActions);
  const form = event.currentTarget as HTMLFormElement;
  const message = form.querySelector<HTMLElement>('#next-step-form-message');
  const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  if (!action) return;
  const data = new FormData(form);
  if (submit) submit.disabled = true;
  if (message) message.textContent = action.pending;
  try {
    await postAdminCommand(action.action === 'generate_article'
      ? { action: action.action, interview_id: item.interview_id, campaign_id: item.campaign_id, doctor_id: item.doctor_id, reason: String(data.get('reason') ?? '').trim() }
      : { action: action.action, article_id: item.article_id, campaign_id: item.campaign_id, doctor_id: item.doctor_id,
        expected_status: item.article_status, expected_version: item.current_version, reason: String(data.get('reason') ?? '').trim() });
    if (message) message.textContent = action.success;
    await initializeAdmin();
  } catch (error) {
    if (message) message.textContent = friendlyCommandError(error);
    if (submit) submit.disabled = false;
  }
}

async function submitCampaign(event: SubmitEvent): Promise<void> {
  event.preventDefault();
  const form = event.currentTarget as HTMLFormElement;
  const data = new FormData(form);
  const message = form.querySelector<HTMLElement>('#campaign-form-message');
  const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  if (submit) submit.disabled = true;
  if (message) message.textContent = 'Validating campaign…';

  try {
    const audience = String(data.get('audience') ?? '').trim();
    if (!['Linked doctors', 'Presentation preview'].includes(audience)) {
      throw new Error('Choose a supported campaign audience.');
    }

    const confirmation = String(data.get('launch_confirmation') ?? '').trim();
    if (confirmation !== 'SEND INVITATIONS') throw new Error('Type SEND INVITATIONS exactly to launch.');

    const sendMode = String(data.get('send_mode') ?? '').trim();
    if (!['now', 'in_10', 'scheduled'].includes(sendMode)) throw new Error('Choose when the invitations should send.');
    const scheduledSendLocal = String(data.get('scheduled_send_local') ?? '').trim();
    const scheduledSendTimezone = String(data.get('scheduled_send_timezone') ?? '').trim();
    const interviewDeadline = String(data.get('interview_deadline') ?? '').trim();
    const trainingResourceUrl = String(data.get('training_resource_url') ?? '').trim();
    if (sendMode === 'scheduled' && (!scheduledSendLocal || !scheduledSendTimezone)) {
      throw new Error('Choose the scheduled date, time, and timezone.');
    }
    if (interviewDeadline) {
      const deadlineDate = new Date(`${interviewDeadline}T00:00:00Z`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(interviewDeadline) || !Number.isFinite(deadlineDate.getTime()) || deadlineDate.toISOString().slice(0, 10) !== interviewDeadline) {
        throw new Error('Choose a valid interview completion deadline.');
      }
    }
    if (trainingResourceUrl) {
      let parsed: URL;
      try { parsed = new URL(trainingResourceUrl); }
      catch { throw new Error('Enter a valid training link.'); }
      if (parsed.protocol !== 'https:') throw new Error('Training links must use HTTPS.');
    }

    const doctorIds = data.getAll('doctor_ids').map((value) => String(value).trim()).filter(Boolean);
    if (!doctorIds.length) throw new Error('Select at least one linked doctor.');
    if (doctorIds.length > 200) throw new Error('Campaigns are limited to 200 doctors.');

    const sharedTheme = String(data.get('topic_layout') ?? 'shared_theme') === 'shared_theme';
    const detailsTopic = (number: number) => (sharedTheme ? 1 : number);
    const topicImage = (number: number) => {
      const value = (field: string) => String(data.get(`topic_${detailsTopic(number)}_${field}`) ?? '').trim();
      return {
        featured_image_source_url: value('featured_image_source_url'),
        featured_image_alt_text: value('featured_image_alt_text'),
      };
    };
    const topics = [1, 2, 3].map((number) => {
      const image = topicImage(number);
      if (!image.featured_image_source_url.startsWith('https://apexparent.hostmanpowered.com/wp-content/uploads/')) {
        throw new Error(`Topic ${number} featured image must use the direct Apex Parent Media Library file URL.`);
      }
      if (image.featured_image_alt_text.length < 8) throw new Error(`Topic ${number} needs useful featured image alt text.`);
      const wordpressSlug = String(data.get(`topic_${detailsTopic(number)}_wordpress_slug`) ?? '').trim().toLowerCase();
      if (wordpressSlug && (wordpressSlug.length > WORDPRESS_SLUG_MAX_LENGTH || !WORDPRESS_SLUG_PATTERN.test(wordpressSlug))) {
        throw new Error(`Topic ${number} WordPress URL slug can use only lowercase letters, numbers, and single hyphens between words.`);
      }
      return {
        title: String(data.get(`topic_${number}`) ?? '').trim(),
        ...image,
        wordpress_slug: wordpressSlug,
      };
    });
    const chosenSlugs = topics.map((topic) => topic.wordpress_slug).filter(Boolean);
    if (!sharedTheme && new Set(chosenSlugs).size !== chosenSlugs.length) throw new Error('Each topic needs a different WordPress URL slug.');

    const result = await postAdminCommand({
      action: 'launch_campaign',
      audience,
      campaign_name: String(data.get('campaign_name') ?? ''),
      campaign_month: String(data.get('campaign_month') ?? ''),
      send_mode: sendMode,
      scheduled_send_local: scheduledSendLocal,
      scheduled_send_timezone: scheduledSendTimezone,
      interview_deadline: interviewDeadline,
      training_resource_url: trainingResourceUrl,
      send_doctor_review_reminders: data.has('send_doctor_review_reminders'),
      topics,
      doctor_ids: doctorIds,
    });

    const resultStatus = String(result.status ?? '').toUpperCase();
    if (message) message.textContent = resultStatus === 'SCHEDULED'
      ? 'Campaign scheduled. Invitations will be released at the selected local time and sent by the active dispatcher.'
      : 'Campaign launched. Invitations are queued for the active dispatcher.';
    form.reset();
    await initializeAdmin();
  } catch (error) {
    if (message) message.textContent = error instanceof Error ? error.message : 'The campaign could not be launched.';
    if (submit) submit.disabled = false;
  }
}

async function loadAdminData(): Promise<AdminResponse> {
  const response = await fetch('/api/admin/overview', { headers: { Accept: 'application/json' } });
  const body: unknown = await response.json();
  if (!response.ok) {
    const apiError = body && typeof body === 'object' ? body as ApiError : {};
    const error = new Error(apiError.message ?? `Request failed with status ${response.status}`);
    Object.assign(error, { apiError, status: response.status });
    throw error;
  }
  return body as AdminResponse;
}

export async function initializeAdmin(): Promise<void> {
  renderLoading();
  try {
    adminData = await loadAdminData();
    renderDashboard(adminData);
  } catch (error) {
    const structured = error as Error & { apiError?: ApiError; status?: number };
    if (structured.apiError?.error === 'ADMIN_CONFIGURATION_REQUIRED') {
      renderConfiguration(structured.apiError);
      return;
    }
    console.error(error);
    renderFailure(structured.apiError ?? { message: structured.message }, structured.status ?? 500);
  }
}
