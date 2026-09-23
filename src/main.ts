import './style.css';
import { renderVoicePrompt } from './voicePrompt';
import {
  RealtimeAgent,
  RealtimeSession,
  type RealtimeItem,
} from '@openai/agents/realtime';

type InterviewContext = {
  valid: boolean | string;
  validation_status: string;
  link_id: string | null;
  campaign_id: string | null;
  campaign_name: string | null;
  doctor_id: string | null;
  doctor_name: string | null;
  credentials: string | null;
  practice_id: string | null;
  practice_name: string | null;
  topic_id: string | null;
  topic_title: string | null;
  topic_description: string | null;
  interview_guidance: string | null;
  expires_at: string | null;
};

type StartSessionResponse = { value?: string; error?: string; };
type CompletionResponse = {
  valid: boolean | string;
  status?: string;
  interview_id?: string | null;
  error?: string;
};

type ReviewContext = {
  valid: boolean | string;
  validation_status: string;
  review_link_id: string | null;
  article_id: string | null;
  doctor_name: string | null;
  credentials: string | null;
  practice_name: string | null;
  article_title: string | null;
  article_html: string | null;
  doctor_review_deadline: string | null;
  review_status: string | null;
  current_version: number | string | null;
};

type ReviewResponse = {
  valid: boolean | string;
  status?: string;
  article_id?: string | null;
  error?: string;
};

type ReviewKind = 'doctor' | 'marketing';

const appElement = document.querySelector<HTMLDivElement>('#app');
if (!appElement) throw new Error('App container not found.');
const app: HTMLDivElement = appElement;

function renderBrand(): string {
  return '<div class="brand"><img src="/brand/color_landscape.svg" alt="Apex Dental Partners" /></div>';
}

let liveSession: RealtimeSession | null = null;
let connected = false;
let paused = false;
let interviewStartedAt: string | null = null;

function getPathToken(route: 'interview' | 'review' | 'marketing-review'): string {
  const match = window.location.pathname.match(new RegExp(`^/${route}/([^/]+)/?$`));
  if (match?.[1]) return decodeURIComponent(match[1]);
  return new URLSearchParams(window.location.search).get('token') ?? '';
}

function escapeHtml(value: string | null | undefined): string {
  return (value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

async function postJson<T>(url: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data: unknown = await response.json();
  if (!response.ok) {
    const errorData = data && typeof data === 'object'
      ? data as { error?: string; message?: string }
      : {};
    throw new Error(errorData.error || errorData.message || `Request failed with status ${response.status}`);
  }
  return data as T;
}

function renderLoading(label = 'interview', description = 'One moment while we load your topic.'): void {
  app.innerHTML = `
    <main class="page"><section class="card">
      ${renderBrand()}
      <div class="activity activity-large" aria-hidden="true"><span class="spinner"></span></div>
      <h1>Preparing your ${escapeHtml(label)}</h1>
      <p class="description">${escapeHtml(description)}</p>
    </section></main>`;
}

function renderInvalid(message: string, label = 'interview'): void {
  app.innerHTML = `
    <main class="page"><section class="card">
      ${renderBrand()}
      <div class="eyebrow">Content ${escapeHtml(label)}</div>
      <h1>This ${escapeHtml(label)} link isn't available.</h1>
      <p class="description">${escapeHtml(message)}</p>
    </section></main>`;
}

function sanitizeArticleHtml(html: string): string {
  const allowedTags = new Set([
    'A', 'BLOCKQUOTE', 'BR', 'EM', 'H1', 'H2', 'H3', 'LI', 'OL', 'P', 'STRONG', 'UL',
  ]);
  const document = new DOMParser().parseFromString(html, 'text/html');

  for (const element of Array.from(document.body.querySelectorAll('*'))) {
    if (!allowedTags.has(element.tagName)) {
      element.replaceWith(document.createTextNode(element.textContent ?? ''));
      continue;
    }

    for (const attribute of Array.from(element.attributes)) {
      if (element.tagName !== 'A' || attribute.name !== 'href') {
        element.removeAttribute(attribute.name);
      }
    }

    if (element.tagName === 'A') {
      const href = element.getAttribute('href');
      if (!href) continue;
      try {
        const link = new URL(href, window.location.origin);
        if (link.protocol !== 'https:') element.removeAttribute('href');
      } catch {
        element.removeAttribute('href');
      }
      if (element.hasAttribute('href')) element.setAttribute('rel', 'noopener noreferrer');
    }
  }

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_COMMENT);
  const comments: Comment[] = [];
  while (walker.nextNode()) comments.push(walker.currentNode as Comment);
  for (const comment of comments) comment.remove();

  return document.body.innerHTML;
}

function formatDeadline(value: string | null): string {
  if (!value) return 'the review deadline';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', {
    month: 'long', day: 'numeric', year: 'numeric', timeZoneName: 'short',
  }).format(date);
}

function renderReviewComplete(context: ReviewContext, requestedChanges: boolean, kind: ReviewKind): void {
  const message = requestedChanges
    ? 'Your requested changes have been recorded. We’ll prepare a revised version and send a new review link.'
    : kind === 'marketing'
      ? 'Marketing approval has been recorded, and WordPress publishing has started. The live static site is not changed by this step.'
      : 'Your approval has been recorded. The article will now move to the next review step.';
  const heading = kind === 'marketing'
    ? 'Thank you.'
    : `Thank you, ${escapeHtml(context.doctor_name)}.`;
  app.innerHTML = `
    <main class="page"><section class="card completion-card">
      ${renderBrand()}
      <div class="completion-check" aria-hidden="true">✓</div>
      <div class="eyebrow">Article review complete</div>
      <h1>${heading}</h1>
      <p class="description">${escapeHtml(message)}</p>
    </section></main>`;
}

function renderReview(context: ReviewContext, token: string, kind: ReviewKind): void {
  const priorStatus = context.review_status ?? '';
  if (priorStatus === 'APPROVED' || priorStatus === 'CHANGES_REQUESTED') {
    renderReviewComplete(context, priorStatus === 'CHANGES_REQUESTED', kind);
    return;
  }

  const doctorDisplay = [context.doctor_name, context.credentials].filter(Boolean).join(', ');
  const articleHtml = sanitizeArticleHtml(context.article_html ?? '');
  app.innerHTML = `
    <main class="review-page">
      <header class="review-header">
        ${renderBrand()}
        <div class="eyebrow">${kind === 'marketing' ? 'Marketing Review' : 'Article Review'}</div>
        <h1>${escapeHtml(context.article_title || 'Your article draft')}</h1>
        <p class="review-byline">${kind === 'marketing'
          ? `Final quality-control review for ${escapeHtml(doctorDisplay)} at ${escapeHtml(context.practice_name)}`
          : `Prepared for ${escapeHtml(doctorDisplay)} at ${escapeHtml(context.practice_name)}`}</p>
        ${kind === 'marketing'
          ? '<p class="review-deadline">Confirm that the final article is ready to publish, or request the specific changes needed before publication.</p>'
          : `<p class="review-deadline">Please respond by <strong>${escapeHtml(formatDeadline(context.doctor_review_deadline))}</strong>. If we do not hear from you, the article will automatically move forward as approved.</p>`}
      </header>
      <article class="article-preview">${articleHtml}</article>
      <section class="review-actions" aria-labelledby="review-actions-heading">
        <div>
          <div class="eyebrow">Your decision</div>
          <h2 id="review-actions-heading">Is this article ready to move forward?</h2>
          <p>Approve it as written, or tell us what you would like changed.</p>
        </div>
        <div class="review-buttons">
          <button id="approve-button" class="primary-button" type="button">${kind === 'marketing' ? 'Approve and Publish' : 'Approve Article'}</button>
          <button id="changes-button" class="secondary-button" type="button">Request Changes</button>
        </div>
        <form id="changes-form" class="changes-form" hidden>
          <label for="feedback">Tell us what you’d like changed.</label>
          <textarea id="feedback" name="feedback" rows="6" maxlength="4000" required></textarea>
          <div class="form-buttons">
            <button class="primary-button" type="submit">Submit Changes</button>
            <button id="cancel-changes" class="secondary-button" type="button">Cancel</button>
          </div>
        </form>
        <div id="review-status" class="status" aria-live="polite"></div>
      </section>
    </main>`;

  const approveButton = document.querySelector<HTMLButtonElement>('#approve-button');
  const changesButton = document.querySelector<HTMLButtonElement>('#changes-button');
  const changesForm = document.querySelector<HTMLFormElement>('#changes-form');
  const feedback = document.querySelector<HTMLTextAreaElement>('#feedback');
  const cancelChanges = document.querySelector<HTMLButtonElement>('#cancel-changes');
  const status = document.querySelector<HTMLDivElement>('#review-status');
  if (!approveButton || !changesButton || !changesForm || !feedback || !cancelChanges || !status) {
    throw new Error('Article review controls not found.');
  }

  const setSubmitting = (submitting: boolean): void => {
    approveButton.disabled = submitting;
    changesButton.disabled = submitting;
    feedback.disabled = submitting;
    cancelChanges.disabled = submitting;
  };

  const submitDecision = async (action: 'approve' | 'request_changes', response = ''): Promise<void> => {
    setSubmitting(true);
    status.innerHTML = `<span class="spinner spinner-small" aria-hidden="true"></span> Saving your response...`;
    try {
      const endpoint = kind === 'marketing' ? '/api/marketing-review/respond' : '/api/review/respond';
      const result = await postJson<ReviewResponse>(endpoint, { token, action, response });
      const saved = result.valid === true || result.valid === 'true';
      if (!saved) throw new Error(result.error || 'Your response could not be saved.');
      renderReviewComplete(context, action === 'request_changes', kind);
    } catch (error) {
      console.error(error);
      status.textContent = error instanceof Error ? error.message : 'Unable to save your response.';
      setSubmitting(false);
    }
  };

  approveButton.addEventListener('click', () => void submitDecision('approve'));
  changesButton.addEventListener('click', () => {
    changesForm.hidden = false;
    changesButton.hidden = true;
    feedback.focus();
  });
  cancelChanges.addEventListener('click', () => {
    changesForm.hidden = true;
    changesButton.hidden = false;
    feedback.value = '';
  });
  changesForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const response = feedback.value.trim();
    if (!response) {
      status.textContent = 'Please describe the change you would like us to make.';
      return;
    }
    void submitDecision('request_changes', response);
  });
}

function renderComplete(context: InterviewContext): void {
  app.innerHTML = `
    <main class="page"><section class="card completion-card">
      ${renderBrand()}
      <div class="completion-check" aria-hidden="true">✓</div>
      <div class="eyebrow">Interview complete</div>
      <h1>Thank you, ${escapeHtml(context.doctor_name)}.</h1>
      <p class="description">
        Your conversation about ${escapeHtml(context.topic_title)} has been saved.
        We'll use it to prepare your article draft.
      </p>
    </section></main>`;
}

function contentText(content: unknown): string {
  if (!content || typeof content !== 'object') return '';
  const c = content as { type?: string; text?: string; transcript?: string | null; };
  if (c.type === 'input_text' || c.type === 'output_text') return c.text ?? '';
  if (c.type === 'input_audio' || c.type === 'output_audio') return c.transcript ?? '';
  return '';
}

function historyToTranscript(history: RealtimeItem[]): string {
  const lines: string[] = [];
  for (const item of history) {
    if (!item || item.type !== 'message') continue;
    if (item.role !== 'user' && item.role !== 'assistant') continue;
    const parts = Array.isArray(item.content) ? item.content.map(contentText).filter(Boolean) : [];
    const text = parts.join(' ').trim();
    if (!text) continue;
    lines.push(`${item.role === 'user' ? 'Doctor' : 'Interviewer'}: ${text}`);
  }
  return lines.join('\n\n');
}

async function waitForTranscriptSettle(session: RealtimeSession, maxWaitMs = 2500): Promise<RealtimeItem[]> {
  const start = Date.now();
  let lastSnapshot = JSON.stringify(session.history);
  let stableSince = Date.now();

  while (Date.now() - start < maxWaitMs) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    const current = JSON.stringify(session.history);
    if (current === lastSnapshot) {
      if (Date.now() - stableSince >= 750) break;
    } else {
      lastSnapshot = current;
      stableSince = Date.now();
    }
  }
  return session.history;
}

function renderInterview(context: InterviewContext, token: string): void {
  const doctorDisplay = [context.doctor_name, context.credentials].filter(Boolean).join(', ');
  const title = context.topic_title?.trim() ?? '';
  const description = context.topic_description?.trim() ?? '';
  const showDescription = description && description.toLocaleLowerCase() !== title.toLocaleLowerCase();

  app.innerHTML = `
    <main class="page"><section class="card">
      ${renderBrand()}
      <div class="eyebrow">AI Content Interview</div>
      <h1>Hi, ${escapeHtml(doctorDisplay)}</h1>
      <p class="intro">We'll have a short conversation about:</p>
      <div class="topic-card">
        <span class="topic-label">Today's topic</span>
        <h2>${escapeHtml(title)}</h2>
        ${showDescription ? `<p>${escapeHtml(description)}</p>` : ''}
      </div>
      <div class="expectation">
        <strong>What to expect</strong>
        <p>This is a conversational voice interview. Speak naturally, just as you would if someone were interviewing you in person.</p>
        <p>Choose a quiet place before you begin. Background conversations and other noise can interrupt the voice interviewer. Headphones with a microphone may help.</p>
      </div>
      <div class="interview-controls">
        <button id="interview-button" class="primary-button" type="button">Start Interview</button>
        <button id="pause-button" class="secondary-button" type="button" hidden>Pause Interview</button>
      </div>
      <div id="status" class="status" aria-live="polite">Your microphone will be requested when you begin.</div>
    </section></main>`;

  const button = document.querySelector<HTMLButtonElement>('#interview-button');
  const pauseButton = document.querySelector<HTMLButtonElement>('#pause-button');
  const status = document.querySelector<HTMLDivElement>('#status');
  if (!button || !pauseButton || !status) throw new Error('Interview controls not found.');

  pauseButton.addEventListener('click', () => {
    if (!connected || !liveSession) return;

    if (paused) {
      liveSession.mute(false);
      paused = false;
      pauseButton.textContent = 'Pause Interview';
      status.innerHTML = `<span class="live-dot"></span> Connected. Your interviewer is listening.`;
    } else {
      liveSession.interrupt();
      liveSession.mute(true);
      paused = true;
      pauseButton.textContent = 'Resume Interview';
      status.innerHTML = `<strong>Interview paused.</strong> Your microphone is muted. Resume when you're ready.`;
    }
  });

  button.addEventListener('click', async () => {
    if (connected && liveSession) {
      button.disabled = true;
      pauseButton.disabled = true;
      button.textContent = 'Saving Interview';
      status.innerHTML = `<span class="spinner spinner-small" aria-hidden="true"></span> Finishing the transcript and saving your interview...`;

      try {
        const finalHistory = await waitForTranscriptSettle(liveSession);
        const transcript = historyToTranscript(finalHistory);
        const completedAt = new Date().toISOString();

        liveSession.close();
        connected = false;
        paused = false;

        const completion = await postJson<CompletionResponse>('/api/complete', {
          token,
          transcript,
          history_json: JSON.stringify(finalHistory),
          started_at: interviewStartedAt ?? completedAt,
          completed_at: completedAt,
        });

        const saved = completion.valid === true || completion.valid === 'true';
        if (!saved) throw new Error(completion.error || 'The interview could not be saved.');

        liveSession = null;
        renderComplete(context);
      } catch (error) {
        console.error(error);
        status.textContent = error instanceof Error ? error.message : 'Unable to save the interview.';
        button.disabled = false;
        pauseButton.disabled = false;
        button.textContent = 'Try Saving Again';
      }
      return;
    }

    button.disabled = true;
    status.innerHTML = `<span class="spinner spinner-small" aria-hidden="true"></span> Connecting to your interviewer...`;

    try {
      const startResponse = await postJson<StartSessionResponse>('/api/start', { token });
      if (!startResponse.value) {
        throw new Error('The voice session did not return a temporary credential.');
      }

      const agent = new RealtimeAgent({
        name: 'Apex Content Interviewer',
        instructions: renderVoicePrompt({
          doctorName: doctorDisplay,
          practiceName: context.practice_name,
          topicTitle: context.topic_title,
          topicDescription: context.topic_description,
          interviewGuidance: context.interview_guidance,
        }),
      });

      liveSession = new RealtimeSession(agent, { model: 'gpt-realtime-2.1' });

      liveSession.on('agent_start', () => {
        if (!paused) {
          status.innerHTML = `<span class="spinner spinner-small" aria-hidden="true"></span> Thinking...`;
        }
      });

      liveSession.on('audio_start', () => {
        if (!paused) {
          status.innerHTML = `<span class="speaking-bars" aria-hidden="true"><i></i><i></i><i></i></span> Interviewer speaking...`;
        }
      });

      liveSession.on('audio_stopped', () => {
        if (!paused) {
          status.innerHTML = `<span class="live-dot"></span> Connected. Your interviewer is listening.`;
        }
      });

      await liveSession.connect({ apiKey: startResponse.value });

      interviewStartedAt = new Date().toISOString();
      connected = true;
      paused = false;
      button.disabled = false;
      button.textContent = 'End Interview';
      pauseButton.hidden = false;
      pauseButton.disabled = false;
      pauseButton.textContent = 'Pause Interview';
      status.innerHTML = `<span class="live-dot"></span> Connected. Your interviewer is listening.`;

      liveSession.transport.sendEvent({
        type: 'response.create',
      });
    } catch (error) {
      console.error(error);
      status.textContent = error instanceof Error ? error.message : 'Unable to start the interview.';
      button.disabled = false;
      button.textContent = 'Try Again';
      liveSession?.close();
      liveSession = null;
      connected = false;
      paused = false;
      interviewStartedAt = null;
    }
  });
}

async function initializeInterview(): Promise<void> {
  const token = getPathToken('interview');
  if (!token) {
    renderInvalid('No interview token was found in this link.');
    return;
  }

  renderLoading();

  try {
    const context = await postJson<InterviewContext>('/api/validate', { token });
    const isValid = context.valid === true || context.valid === 'true';
    if (!isValid) {
      renderInvalid('This link may have expired or is no longer available.');
      return;
    }
    renderInterview(context, token);
  } catch (error) {
    console.error(error);
    renderInvalid(error instanceof Error ? error.message : 'We were unable to load this interview.');
  }
}

async function initializeReview(): Promise<void> {
  const token = getPathToken('review');
  if (!token) {
    renderInvalid('No review token was found in this link.', 'review');
    return;
  }

  document.title = 'Review Your Article | Apex Dental Partners';
  renderLoading('article review', 'One moment while we load your draft.');
  try {
    const context = await postJson<ReviewContext>('/api/review/validate', { token });
    const isValid = context.valid === true || context.valid === 'true';
    if (!isValid) {
      renderInvalid('This link may have expired or is no longer available.', 'review');
      return;
    }
    renderReview(context, token, 'doctor');
  } catch (error) {
    console.error(error);
    renderInvalid(error instanceof Error ? error.message : 'We were unable to load this article.', 'review');
  }
}

async function initializeMarketingReview(): Promise<void> {
  const token = getPathToken('marketing-review');
  if (!token) {
    renderInvalid('No marketing review token was found in this link.', 'review');
    return;
  }

  document.title = 'Marketing Review | Apex Dental Partners';
  renderLoading('marketing review', 'One moment while we load the final article.');
  try {
    const context = await postJson<ReviewContext>('/api/marketing-review/validate', { token });
    const isValid = context.valid === true || context.valid === 'true';
    if (!isValid) {
      renderInvalid('This link may have expired or is no longer available.', 'review');
      return;
    }
    renderReview(context, token, 'marketing');
  } catch (error) {
    console.error(error);
    renderInvalid(error instanceof Error ? error.message : 'We were unable to load this article.', 'review');
  }
}

if (/^\/marketing-review\//.test(window.location.pathname)) {
  void initializeMarketingReview();
} else if (/^\/review\//.test(window.location.pathname)) {
  void initializeReview();
} else {
  void initializeInterview();
}
