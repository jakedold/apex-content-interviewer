import './admin.css';

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
  first_invitation_sent_at: string | null;
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
  featured_image_source_type: string | null;
  featured_image_rights_reference: string | null;
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
  updated_at: string | null;
  urgency: 'error' | 'attention' | 'complete' | 'active';
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
let queueFilter = 'all';
let queueSearch = '';

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
  if (/(PUBLISHED|APPROVED|COMPLETED|SENT)/.test(normalized)) return 'success';
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

function filteredQueue(): WorkItem[] {
  const items = adminData?.overview.work_queue ?? [];
  const needle = queueSearch.trim().toLowerCase();
  return items.filter((item) => {
    const matchesFilter = queueFilter === 'all' || item.urgency === queueFilter;
    const haystack = [item.doctor_name, item.practice_name, item.topic_title, item.campaign_name, item.status]
      .filter(Boolean).join(' ').toLowerCase();
    return matchesFilter && (!needle || haystack.includes(needle));
  });
}

function workItemRow(item: WorkItem): string {
  const doctor = [item.doctor_name, item.credentials].filter(Boolean).join(', ');
  return `
    <tr data-work-item="${escapeHtml(item.work_item_id)}">
      <td><strong>${escapeHtml(doctor)}</strong><small>${escapeHtml(item.practice_name || 'Practice not assigned')}</small></td>
      <td><strong>${escapeHtml(item.topic_title)}</strong><small>${escapeHtml(item.campaign_name)}</small></td>
      <td>${statusPill(item.status)}</td>
      <td><time datetime="${escapeHtml(item.updated_at)}">${escapeHtml(formatDate(item.updated_at, true))}</time></td>
      <td><button class="admin-text-button" type="button" data-view-item="${escapeHtml(item.work_item_id)}">View</button></td>
    </tr>`;
}

function renderQueueRows(): void {
  const body = document.querySelector<HTMLTableSectionElement>('#admin-queue-body');
  const count = document.querySelector<HTMLElement>('#admin-queue-count');
  if (!body || !count) return;
  const items = filteredQueue();
  count.textContent = `${items.length} item${items.length === 1 ? '' : 's'}`;
  body.innerHTML = items.length
    ? items.map(workItemRow).join('')
    : '<tr><td colspan="5"><div class="admin-empty">No work items match this view.</div></td></tr>';
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-view-item]')) {
    button.addEventListener('click', () => openWorkItem(button.dataset.viewItem ?? ''));
  }
}

function renderQueue(data: AdminResponse): string {
  const counts = data.overview.work_queue.reduce<Record<string, number>>((result, item) => {
    result[item.urgency] = (result[item.urgency] ?? 0) + 1;
    return result;
  }, {});
  return `
    <section class="admin-panel" id="work-queue">
      <div class="admin-panel-heading">
        <div><span class="admin-kicker">Needs visibility</span><h2>Work queue</h2></div>
        <span class="admin-count" id="admin-queue-count"></span>
      </div>
      <div class="admin-toolbar">
        <div class="admin-filter-group" role="group" aria-label="Filter work queue">
          ${[
            ['all', 'All', data.overview.work_queue.length],
            ['error', 'Errors', counts.error ?? 0],
            ['attention', 'Review', counts.attention ?? 0],
            ['active', 'In progress', counts.active ?? 0],
          ].map(([value, label, count]) => `<button class="admin-filter ${value === queueFilter ? 'is-active' : ''}" type="button" data-queue-filter="${value}">${label} <span>${count}</span></button>`).join('')}
        </div>
        <label class="admin-search"><span class="sr-only">Search work queue</span><input id="admin-queue-search" type="search" placeholder="Search doctor, practice, topic…" value="${escapeHtml(queueSearch)}" /></label>
      </div>
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead><tr><th>Doctor</th><th>Topic and campaign</th><th>Status</th><th>Last movement</th><th><span class="sr-only">Details</span></th></tr></thead>
          <tbody id="admin-queue-body"></tbody>
        </table>
      </div>
    </section>`;
}

function campaignCard(campaign: Campaign): string {
  const doctors = numberValue(campaign.doctor_count);
  const published = numberValue(campaign.published_count);
  const progress = doctors ? Math.round((published / doctors) * 100) : 0;
  return `
    <article class="admin-campaign-card">
      <div class="admin-campaign-topline">
        <span>${escapeHtml(campaignSendLabel(campaign))}</span>
        ${statusPill(campaign.status)}
      </div>
      <div class="admin-campaign-title-row">
        <h3>${escapeHtml(campaign.campaign_name)}</h3>
        <button class="admin-text-button" type="button" data-duplicate-campaign="${escapeHtml(campaign.campaign_id)}">Duplicate</button>
      </div>
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
        <span class="admin-count">${data.overview.campaigns.length} shown</span>
      </div>
      <div class="admin-campaign-grid">
        ${data.overview.campaigns.length ? data.overview.campaigns.map(campaignCard).join('') : '<div class="admin-empty">No campaigns are recorded yet.</div>'}
      </div>
    </section>`;
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
        <p>Create one monthly campaign with exactly three topics and a selected doctor list. Launching is handed to n8n and recorded in BigQuery.</p>
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
    setCampaignField(form, 'launch_confirmation', '');

    const audience = form.elements.namedItem('audience') as HTMLSelectElement | null;
    if (audience) {
      audience.value = template.audience;
      audience.dispatchEvent(new Event('change'));
    }

    const sendMode = form.elements.namedItem('send_mode') as HTMLSelectElement | null;
    sendMode?.dispatchEvent(new Event('change'));

    const topics = [...template.topics].sort((a, b) => Number(a.topic_sort_order) - Number(b.topic_sort_order));
    for (let index = 0; index < 3; index += 1) {
      const number = index + 1;
      const topic = topics[index];
      setCampaignField(form, `topic_${number}`, topic?.topic_title ?? '');
      setCampaignField(form, `topic_${number}_featured_image_source_url`, topic?.featured_image_source_url ?? '');
      setCampaignField(form, `topic_${number}_featured_image_alt_text`, topic?.featured_image_alt_text ?? '');
      setCampaignField(form, `topic_${number}_featured_image_source_type`, topic?.featured_image_source_type ?? '');
      setCampaignField(form, `topic_${number}_featured_image_rights_reference`, topic?.featured_image_rights_reference ?? '');
    }

    const recipientIds = new Set(template.recipients.map((recipient) => recipient.doctor_id));
    form.querySelectorAll<HTMLInputElement>('input[name="doctor_ids"]').forEach((checkbox) => {
      checkbox.checked = recipientIds.has(checkbox.value);
    });
    form.querySelector<HTMLInputElement>('#campaign-doctor-search')?.dispatchEvent(new Event('input'));

    const missingAssetFields = topics.some((topic) =>
      !topic?.featured_image_source_url ||
      !topic?.featured_image_alt_text ||
      !topic?.featured_image_source_type ||
      !topic?.featured_image_rights_reference
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
            <li>Create or obtain one approved featured image for each of the three topics.</li>
            <li><a href="https://apexparent.hostmanpowered.com/wp-admin/upload.php?mlo-category=all-files" target="_blank" rel="noreferrer">Upload each image once to the Apex Parent Media Library</a>.</li>
            <li>For each image, copy the <strong>direct file URL</strong>. It must begin with <code>https://apexparent.hostmanpowered.com/wp-content/uploads/</code>. Do not paste the Media Library page URL.</li>
            <li>Have useful alt text plus the image source type and rights/source reference ready.</li>
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

          <fieldset class="admin-topic-assets"><legend>Topic 1</legend>
            <label>Topic 1<input name="topic_1" required /></label>
            <label>Topic 1 featured image central source URL<input name="topic_1_featured_image_source_url" type="url" required placeholder="https://apexparent.hostmanpowered.com/wp-content/uploads/..." /></label>
            <label>Topic 1 featured image alt text<input name="topic_1_featured_image_alt_text" required minlength="8" /></label>
            <label>Topic 1 featured image source type
              <select name="topic_1_featured_image_source_type" required>
                <option value="">Select an option</option>
                <option>Apex-owned or commissioned</option>
                <option>Licensed stock</option>
                <option>AI-generated with approved terms</option>
              </select>
            </label>
            <label>Topic 1 featured image rights or source reference<input name="topic_1_featured_image_rights_reference" required placeholder="Asset record, license, commission, or generation reference" /></label>
          </fieldset>

          <fieldset class="admin-topic-assets"><legend>Topic 2</legend>
            <label>Topic 2<input name="topic_2" required /></label>
            <label>Topic 2 featured image central source URL<input name="topic_2_featured_image_source_url" type="url" required placeholder="https://apexparent.hostmanpowered.com/wp-content/uploads/..." /></label>
            <label>Topic 2 featured image alt text<input name="topic_2_featured_image_alt_text" required minlength="8" /></label>
            <label>Topic 2 featured image source type
              <select name="topic_2_featured_image_source_type" required>
                <option value="">Select an option</option>
                <option>Apex-owned or commissioned</option>
                <option>Licensed stock</option>
                <option>AI-generated with approved terms</option>
              </select>
            </label>
            <label>Topic 2 featured image rights or source reference<input name="topic_2_featured_image_rights_reference" required placeholder="Asset record, license, commission, or generation reference" /></label>
          </fieldset>

          <fieldset class="admin-topic-assets"><legend>Topic 3</legend>
            <label>Topic 3<input name="topic_3" required /></label>
            <label>Topic 3 featured image central source URL<input name="topic_3_featured_image_source_url" type="url" required placeholder="https://apexparent.hostmanpowered.com/wp-content/uploads/..." /></label>
            <label>Topic 3 featured image alt text<input name="topic_3_featured_image_alt_text" required minlength="8" /></label>
            <label>Topic 3 featured image source type
              <select name="topic_3_featured_image_source_type" required>
                <option value="">Select an option</option>
                <option>Apex-owned or commissioned</option>
                <option>Licensed stock</option>
                <option>AI-generated with approved terms</option>
              </select>
            </label>
            <label>Topic 3 featured image rights or source reference<input name="topic_3_featured_image_rights_reference" required placeholder="Asset record, license, commission, or generation reference" /></label>
          </fieldset>

          <fieldset class="admin-recipient-options" id="existing-recipient-section"><legend>Doctors to invite</legend>
            <p class="admin-muted" id="campaign-doctor-guidance">Search the current Doctor Census roster, then select doctors individually. Each selection retains its own primary-practice and website mapping.</p>
            <label class="admin-doctor-search"><span>Search doctors</span><input id="campaign-doctor-search" type="search" placeholder="Search by doctor or practice…" autocomplete="off" /></label>
            <div class="admin-doctor-selection-summary"><strong id="campaign-doctor-selected-count">0 selected</strong><span id="campaign-doctor-visible-count">${data.overview.campaign_launch_options.doctors.length} shown</span></div>
            <div id="campaign-doctor-options" class="admin-doctor-scroll-list">
              ${data.overview.campaign_launch_options.doctors.length
                ? data.overview.campaign_launch_options.doctors.map((doctor) => `
                    <label class="admin-recipient-option" data-doctor-search="${escapeHtml(`${doctor.doctor_name} ${doctor.practice_name} ${doctor.email || ''}`.toLowerCase())}" data-publishing-ready="${doctor.publishing_ready ? 'true' : 'false'}">
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
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-duplicate-campaign]')) {
    button.addEventListener('click', () => void duplicateCampaign(button.dataset.duplicateCampaign ?? ''));
  }
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
  campaignSendMode?.addEventListener('change', syncSendMode);
  syncCampaignRecipients();
  syncSendMode();

  document.querySelector<HTMLFormElement>('#admin-campaign-form')?.addEventListener('submit', (event) => void submitCampaign(event));
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-queue-filter]')) {
    button.addEventListener('click', () => {
      queueFilter = button.dataset.queueFilter ?? 'all';
      document.querySelectorAll('[data-queue-filter]').forEach((candidate) => candidate.classList.toggle('is-active', candidate === button));
      renderQueueRows();
    });
  }
  document.querySelector<HTMLInputElement>('#admin-queue-search')?.addEventListener('input', (event) => {
    queueSearch = (event.currentTarget as HTMLInputElement).value;
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

function stageVisual(detail: WorkItemDetail): string {
  const item = detail.item;
  const articleStatus = String(item.article_status ?? '').toUpperCase();
  const interviewStatus = String(item.interview_status ?? '').toUpperCase();

  // Use the current article plus explicit milestone timestamps as the source of
  // truth. campaign_doctors can legitimately lag or retain a later historical
  // state in test data, so it must not mark downstream article stages complete.
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
  const published = Boolean(
    item.published_at ||
    item.published_url ||
    articleStatus === 'PUBLISHED',
  );

  const steps = [
    ['Invitation sent', Boolean(item.invited_at || detail.communications.some((entry) => entry.status === 'SENT' || entry.delivered_at))],
    ['Topic selected', Boolean(item.topic_id)],
    ['Interview completed', interviewCompleted],
    ['Article drafted', articleDrafted],
    ['Doctor approved', doctorApproved],
    ['Marketing approved', marketingApproved],
    ['Published', published],
  ] as Array<[string, boolean]>;

  const activeIndex = steps.findIndex(([, complete]) => !complete);
  return `<ol class="admin-stage-track">${steps.map(([label, complete], index) => `
    <li class="${complete ? 'is-complete' : index === activeIndex ? 'is-current' : ''}">
      <span>${complete ? '✓' : index + 1}</span><strong>${escapeHtml(label)}</strong>
    </li>`).join('')}</ol>`;
}

function detailEventRow(event: WorkflowEvent): string {
  const severity = event.severity || (/(failed|error)/i.test(event.event_type) ? 'error' : /(approved|published|completed)/i.test(event.event_type) ? 'success' : 'info');
  return eventRow({ ...event, severity });
}

async function fetchWorkItemDetail(item: WorkItem): Promise<WorkItemDetailResponse> {
  const response = await fetch(`/api/admin/work-items/${encodeURIComponent(item.campaign_id)}/${encodeURIComponent(item.doctor_id)}`, { headers: { Accept: 'application/json' } });
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
  const canApprove = response.capabilities.enabledActions.includes('approve_for_doctor') && item.article_status === 'DOCTOR_REVIEW_PENDING';
  content.innerHTML = `
    <span class="admin-kicker">${escapeHtml(item.campaign_name)}</span>
    <h2>${escapeHtml([item.doctor_name, item.credentials].filter(Boolean).join(', '))}</h2>
    <p class="admin-detail-topic">${escapeHtml(item.topic_title || 'Topic not selected')}</p>
    ${stageVisual(detail)}
    <dl class="admin-detail-list">
      <div><dt>Current status</dt><dd>${statusPill(item.article_status || item.interview_status || item.campaign_doctor_status)}</dd></div>
      <div><dt>Intended website</dt><dd>${item.website_domain ? `<a href="${escapeHtml(item.website_domain)}" target="_blank" rel="noreferrer">${escapeHtml(item.website_domain)}</a>` : 'Not configured'}</dd></div>
      <div><dt>Practice</dt><dd>${escapeHtml(item.practice_name || 'Not assigned')}</dd></div>
      <div><dt>Publishing route</dt><dd>${escapeHtml(item.publisher_type || 'Not configured')}</dd></div>
      <div><dt>Doctor review deadline</dt><dd>${escapeHtml(formatDate(item.doctor_review_deadline, true))}</dd></div>
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
    </section>
    <section class="admin-action-hook ${canApprove ? 'is-enabled' : ''}">
      <strong>Push to the next step</strong>
      ${canApprove ? `
        <p>Use this only after the doctor has clearly approved the current article outside the portal. The administrator, reason, timestamp, and prior state will be recorded.</p>
        <form id="admin-approve-form">
          <label>How did the doctor confirm approval?<textarea name="reason" required minlength="12" rows="3" placeholder="Dr. Allen confirmed approval by email on…"></textarea></label>
          <label class="admin-confirm-check"><input name="confirmation" type="checkbox" required /> I confirm the doctor approved this exact article version.</label>
          <button class="admin-primary-button" type="submit">Record doctor approval and continue</button>
          <p class="admin-form-message" id="approval-form-message" role="status"></p>
        </form>` : `<p>${item.article_status === 'DOCTOR_REVIEW_PENDING' ? 'Your account has read-only access. An assigned administrator can record an off-platform doctor approval.' : 'No safe manual-approval action applies to the current stage.'}</p>`}
    </section>`;

  const iframe = content.querySelector<HTMLIFrameElement>('.admin-article-preview');
  if (iframe && article.articleHtml) iframe.srcdoc = article.articleHtml;
  for (const tab of content.querySelectorAll<HTMLButtonElement>('[data-detail-tab]')) {
    tab.addEventListener('click', () => {
      content.querySelectorAll('[data-detail-tab]').forEach((candidate) => candidate.classList.toggle('is-active', candidate === tab));
      content.querySelectorAll('[data-detail-panel]').forEach((panel) => panel.classList.toggle('is-active', panel.getAttribute('data-detail-panel') === tab.dataset.detailTab));
    });
  }
  content.querySelector<HTMLFormElement>('#admin-approve-form')?.addEventListener('submit', (event) => void submitDoctorApproval(event, item));
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

async function submitDoctorApproval(event: SubmitEvent, item: WorkItemDetail['item']): Promise<void> {
  event.preventDefault();
  const form = event.currentTarget as HTMLFormElement;
  const message = form.querySelector<HTMLElement>('#approval-form-message');
  const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  const data = new FormData(form);
  if (submit) submit.disabled = true;
  if (message) message.textContent = 'Recording approval…';
  try {
    await postAdminCommand({ action: 'approve_for_doctor', article_id: item.article_id, campaign_id: item.campaign_id, doctor_id: item.doctor_id,
      expected_status: item.article_status, expected_version: item.current_version, reason: String(data.get('reason') ?? '') });
    if (message) message.textContent = 'Approval recorded. The workflow is moving to its next configured step.';
    await initializeAdmin();
  } catch (error) {
    if (message) message.textContent = error instanceof Error ? error.message : 'The approval could not be recorded.';
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
    if (sendMode === 'scheduled' && (!scheduledSendLocal || !scheduledSendTimezone)) {
      throw new Error('Choose the scheduled date, time, and timezone.');
    }

    const doctorIds = data.getAll('doctor_ids').map((value) => String(value).trim()).filter(Boolean);
    if (!doctorIds.length) throw new Error('Select at least one linked doctor.');
    if (doctorIds.length > 50) throw new Error('Campaigns are limited to 50 doctors.');

    const topics = [1, 2, 3].map((number) => {
      const sourceUrl = String(data.get(`topic_${number}_featured_image_source_url`) ?? '').trim();
      if (!sourceUrl.startsWith('https://apexparent.hostmanpowered.com/wp-content/uploads/')) {
        throw new Error(`Topic ${number} featured image must use the direct Apex Parent Media Library file URL.`);
      }
      const altText = String(data.get(`topic_${number}_featured_image_alt_text`) ?? '').trim();
      if (altText.length < 8) throw new Error(`Topic ${number} needs useful featured image alt text.`);
      return {
        title: String(data.get(`topic_${number}`) ?? '').trim(),
        featured_image_source_url: sourceUrl,
        featured_image_alt_text: altText,
        featured_image_source_type: String(data.get(`topic_${number}_featured_image_source_type`) ?? '').trim(),
        featured_image_rights_reference: String(data.get(`topic_${number}_featured_image_rights_reference`) ?? '').trim(),
      };
    });

    const result = await postAdminCommand({
      action: 'launch_campaign',
      audience,
      campaign_name: String(data.get('campaign_name') ?? ''),
      campaign_month: String(data.get('campaign_month') ?? ''),
      send_mode: sendMode,
      scheduled_send_local: scheduledSendLocal,
      scheduled_send_timezone: scheduledSendTimezone,
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
