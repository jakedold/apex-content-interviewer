import { createRemoteJWKSet, importPKCS8, jwtVerify, SignJWT } from 'jose';

type AdminEnv = Env & {
  GOOGLE_SERVICE_ACCOUNT_JSON?: string;
  ADMIN_ACTION_EMAILS?: string;
  ADMIN_COMMAND_SECRET?: string;
  ADMIN_COMMAND_PATH?: string;
};

type AccessClaims = { email?: string; sub?: string };
type ServiceAccount = { client_email: string; private_key: string; token_uri?: string };
type BigQueryQueryResponse = {
  jobComplete?: boolean;
  rows?: Array<{ f?: Array<{ v?: string | null }> }>;
  errors?: Array<{ message?: string }>;
  error?: { message?: string };
};

const GOOGLE_SCOPE = 'https://www.googleapis.com/auth/bigquery.readonly';

function configurationMissing(env: AdminEnv): string[] {
  const missing: string[] = [];
  if (!env.ADMIN_ACCESS_TEAM_DOMAIN || env.ADMIN_ACCESS_TEAM_DOMAIN.startsWith('REPLACE_')) missing.push('ADMIN_ACCESS_TEAM_DOMAIN');
  if (!env.ADMIN_ACCESS_AUD || env.ADMIN_ACCESS_AUD.startsWith('REPLACE_')) missing.push('ADMIN_ACCESS_AUD');
  if (!env.BQ_PROJECT_ID) missing.push('BQ_PROJECT_ID');
  if (!env.BQ_DATASET) missing.push('BQ_DATASET');
  if (!env.GOOGLE_SERVICE_ACCOUNT_JSON) missing.push('GOOGLE_SERVICE_ACCOUNT_JSON');
  return missing;
}

function isSafeIdentifier(value: string): boolean {
  return /^[A-Za-z0-9_-]+$/.test(value);
}

async function authenticateAdmin(request: Request, env: AdminEnv): Promise<AccessClaims> {
  const assertion = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!assertion) throw new Error('ACCESS_TOKEN_MISSING');
  const issuer = `https://${env.ADMIN_ACCESS_TEAM_DOMAIN}`;
  const keySet = createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`));
  const { payload } = await jwtVerify(assertion, keySet, { audience: env.ADMIN_ACCESS_AUD, issuer });
  return { email: typeof payload.email === 'string' ? payload.email.toLowerCase() : undefined, sub: payload.sub };
}

function parseServiceAccount(value: string): ServiceAccount {
  const parsed: unknown = JSON.parse(value);
  if (!parsed || typeof parsed !== 'object') throw new Error('Invalid Google service account JSON.');
  const candidate = parsed as Partial<ServiceAccount>;
  if (!candidate.client_email || !candidate.private_key) throw new Error('Google service account JSON is incomplete.');
  return { client_email: candidate.client_email, private_key: candidate.private_key, token_uri: candidate.token_uri };
}

async function getGoogleAccessToken(serviceAccount: ServiceAccount): Promise<string> {
  const tokenUri = serviceAccount.token_uri ?? 'https://oauth2.googleapis.com/token';
  const now = Math.floor(Date.now() / 1000);
  const key = await importPKCS8(serviceAccount.private_key, 'RS256');
  const assertion = await new SignJWT({ scope: GOOGLE_SCOPE })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(serviceAccount.client_email)
    .setSubject(serviceAccount.client_email)
    .setAudience(tokenUri)
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(key);
  const response = await fetch(tokenUri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  });
  const body: unknown = await response.json();
  if (!response.ok || !body || typeof body !== 'object' || !('access_token' in body)) {
    const message = body && typeof body === 'object' && 'error_description' in body ? String(body.error_description) : `Google OAuth returned ${response.status}`;
    throw new Error(message);
  }
  return String(body.access_token);
}

async function queryJson(env: AdminEnv, query: string, namedParameters: Array<Record<string, unknown>> = [], maximumBytesBilled = '250000000'): Promise<unknown> {
  if (!isSafeIdentifier(env.BQ_PROJECT_ID) || !isSafeIdentifier(env.BQ_DATASET)) throw new Error('BigQuery project or dataset identifier is invalid.');
  const accessToken = await getGoogleAccessToken(parseServiceAccount(env.GOOGLE_SERVICE_ACCOUNT_JSON ?? ''));
  const endpoint = `https://bigquery.googleapis.com/bigquery/v2/projects/${encodeURIComponent(env.BQ_PROJECT_ID)}/queries`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, useLegacySql: false, location: env.BQ_LOCATION || 'US', timeoutMs: 15000, maxResults: 1, maximumBytesBilled,
      parameterMode: namedParameters.length ? 'NAMED' : undefined, queryParameters: namedParameters }),
  });
  const result = await response.json<BigQueryQueryResponse>();
  if (!response.ok || result.error || result.errors?.length) throw new Error(result.error?.message ?? result.errors?.[0]?.message ?? `BigQuery returned ${response.status}`);
  if (!result.jobComplete) throw new Error('BigQuery did not finish the dashboard query within 15 seconds.');
  const payload = result.rows?.[0]?.f?.[0]?.v;
  if (!payload) throw new Error('BigQuery returned no dashboard payload.');
  return JSON.parse(payload);
}

function tableFactory(project: string, dataset: string): (name: string) => string {
  return (name: string): string => `\`${project}.${dataset}.${name}\``;
}

function adminOverviewQuery(project: string, dataset: string): string {
  const table = tableFactory(project, dataset);
  return `
WITH latest_interviews AS (
  SELECT * EXCEPT(row_number) FROM (
    SELECT i.*, ROW_NUMBER() OVER (PARTITION BY campaign_id, doctor_id ORDER BY COALESCE(completed_at, started_at) DESC) AS row_number
    FROM ${table('interviews')} i
  ) WHERE row_number = 1
),
latest_articles AS (
  SELECT * EXCEPT(row_number) FROM (
    SELECT a.*, ROW_NUMBER() OVER (PARTITION BY campaign_id, doctor_id ORDER BY created_at DESC) AS row_number
    FROM ${table('articles')} a
  ) WHERE row_number = 1
),
campaign_rows AS (
  SELECT c.campaign_id, c.campaign_name, CAST(c.campaign_month AS STRING) AS campaign_month,
    c.status, c.require_marketing_approval, c.created_at, c.launched_at,
    COUNT(DISTINCT cd.doctor_id) AS doctor_count,
    COUNT(DISTINCT IF(i.interview_id IS NOT NULL, cd.doctor_id, NULL)) AS interview_count,
    COUNT(DISTINCT a.article_id) AS article_count,
    COUNT(DISTINCT IF(a.status = 'PUBLISHED', a.article_id, NULL)) AS published_count,
    COUNT(DISTINCT IF(COALESCE(a.status, i.status, cd.status) IN ('INTERVIEW_ABANDONED','GENERATION_FAILED','ARTICLE_GENERATION_FAILED','COMMUNICATION_FAILED','PUBLISH_FAILED','ON_HOLD','REJECTED'), cd.doctor_id, NULL)) AS issue_count
  FROM ${table('campaigns')} c
  LEFT JOIN ${table('campaign_doctors')} cd USING (campaign_id)
  LEFT JOIN latest_interviews i ON i.campaign_id = cd.campaign_id AND i.doctor_id = cd.doctor_id
  LEFT JOIN latest_articles a ON a.campaign_id = cd.campaign_id AND a.doctor_id = cd.doctor_id
  GROUP BY c.campaign_id, c.campaign_name, c.campaign_month, c.status, c.require_marketing_approval, c.created_at, c.launched_at
),
queue_rows AS (
  SELECT CONCAT(cd.campaign_id, ':', cd.doctor_id) AS work_item_id,
    cd.campaign_id, c.campaign_name, cd.doctor_id, d.doctor_name, d.credentials,
    p.practice_name, COALESCE(a.article_id, '') AS article_id,
    COALESCE(t.topic_title, 'Topic not selected') AS topic_title,
    COALESCE(a.status, i.status, cd.status) AS status,
    COALESCE(a.published_url, '') AS published_url,
    COALESCE(a.doctor_review_deadline, i.completed_at, i.started_at, cd.updated_at, cd.invited_at, c.launched_at) AS updated_at,
    CASE WHEN COALESCE(a.status, i.status, cd.status) IN ('GENERATION_FAILED','ARTICLE_GENERATION_FAILED','COMMUNICATION_FAILED','PUBLISH_FAILED') THEN 'error'
      WHEN COALESCE(a.status, i.status, cd.status) IN ('DOCTOR_REVIEW_PENDING','DOCTOR_REVIEW','REVISION_REQUESTED','DOCTOR_CHANGES_REQUESTED','MARKETING_REVIEW','MARKETING_CHANGES_REQUESTED','ON_HOLD') THEN 'attention'
      WHEN COALESCE(a.status, i.status, cd.status) = 'PUBLISHED' THEN 'complete' ELSE 'active' END AS urgency
  FROM ${table('campaign_doctors')} cd
  JOIN ${table('campaigns')} c USING (campaign_id)
  JOIN ${table('doctors')} d USING (doctor_id)
  LEFT JOIN ${table('practices')} p ON p.practice_id = d.practice_id
  LEFT JOIN latest_interviews i ON i.campaign_id = cd.campaign_id AND i.doctor_id = cd.doctor_id
  LEFT JOIN ${table('campaign_topics')} t ON t.topic_id = i.topic_id
  LEFT JOIN latest_articles a ON a.campaign_id = cd.campaign_id AND a.doctor_id = cd.doctor_id
  WHERE COALESCE(a.status, i.status, cd.status) != 'PUBLISHED'
),
event_rows AS (
  SELECT event_id, entity_type, entity_id, event_type, event_timestamp, source_system, workflow_execution_id,
    CASE WHEN REGEXP_CONTAINS(LOWER(event_type), r'(failed|error)') THEN 'error'
      WHEN REGEXP_CONTAINS(LOWER(event_type), r'(approved|published|completed)') THEN 'success' ELSE 'info' END AS severity
  FROM ${table('workflow_events')} WHERE event_timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 90 DAY)
),
communication_failures AS (
  SELECT communication_id, doctor_id, article_id, campaign_id, communication_type, channel, recipient, status, sent_at
  FROM ${table('communications')} WHERE status = 'FAILED'
),
campaign_launch_practices AS (
  SELECT practice_id, practice_name, website_domain, publisher_type
  FROM ${table('practices')}
  WHERE active = TRUE AND practice_id = 'practice_test_001'
),
campaign_launch_doctors AS (
  SELECT d.doctor_id, d.doctor_name, d.email, d.practice_id
  FROM ${table('doctors')} d
  JOIN campaign_launch_practices p USING (practice_id)
  WHERE d.active = TRUE
)
SELECT TO_JSON_STRING(STRUCT(
  CURRENT_TIMESTAMP() AS generated_at,
  STRUCT(
    ARRAY(SELECT AS STRUCT * FROM campaign_launch_practices ORDER BY practice_name) AS practices,
    ARRAY(SELECT AS STRUCT * FROM campaign_launch_doctors ORDER BY doctor_name) AS doctors
  ) AS campaign_launch_options,
  STRUCT(
    (SELECT COUNT(*) FROM campaign_rows WHERE status IN ('SCHEDULED','READY','LAUNCHED','ACTIVE')) AS active_campaigns,
    (SELECT COUNT(*) FROM queue_rows WHERE urgency != 'complete') AS open_work_items,
    (SELECT COUNT(*) FROM event_rows WHERE severity = 'error' AND event_timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 24 HOUR))
      + (SELECT COUNT(*) FROM communication_failures WHERE sent_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 24 HOUR)) AS errors_24h,
    (SELECT COUNT(*) FROM ${table('articles')} WHERE status = 'PUBLISHED' AND published_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)) AS published_30d
  ) AS summary,
  ARRAY(SELECT AS STRUCT * FROM campaign_rows ORDER BY COALESCE(launched_at, created_at) DESC LIMIT 50) AS campaigns,
  ARRAY(SELECT AS STRUCT * FROM queue_rows ORDER BY CASE urgency WHEN 'error' THEN 0 WHEN 'attention' THEN 1 ELSE 2 END, updated_at ASC LIMIT 250) AS work_queue,
  ARRAY(SELECT AS STRUCT * FROM event_rows ORDER BY event_timestamp DESC LIMIT 150) AS recent_events,
  ARRAY(SELECT AS STRUCT * FROM communication_failures ORDER BY sent_at DESC LIMIT 50) AS communication_failures
)) AS payload;`;
}

function campaignTemplateQuery(project: string, dataset: string): string {
  const table = tableFactory(project, dataset);
  return `
WITH campaign AS (
  SELECT campaign_id, campaign_name, CAST(campaign_month AS STRING) AS campaign_month
  FROM ${table('campaigns')}
  WHERE campaign_id = @campaign_id
),
topics AS (
  SELECT
    topic_title,
    featured_image_source_url,
    featured_image_alt_text,
    featured_image_source_type,
    featured_image_rights_reference,
    topic_sort_order
  FROM ${table('campaign_topics')}
  WHERE campaign_id = @campaign_id
  ORDER BY topic_sort_order
),
recipients AS (
  SELECT d.doctor_id, d.doctor_name, d.email, d.practice_id
  FROM ${table('campaign_doctors')} cd
  JOIN ${table('doctors')} d USING (doctor_id)
  WHERE cd.campaign_id = @campaign_id
  ORDER BY d.doctor_name
)
SELECT TO_JSON_STRING(STRUCT(
  (SELECT campaign_id FROM campaign LIMIT 1) AS campaign_id,
  (SELECT campaign_name FROM campaign LIMIT 1) AS campaign_name,
  (SELECT campaign_month FROM campaign LIMIT 1) AS campaign_month,
  CASE
    WHEN (SELECT COUNT(*) FROM recipients) > 0
      AND (SELECT COUNTIF(STARTS_WITH(doctor_id, 'doctor_demo_')) FROM recipients) = (SELECT COUNT(*) FROM recipients)
      THEN 'Presentation demo recipients'
    ELSE 'Test users only'
  END AS audience,
  CASE
    WHEN (SELECT COUNT(DISTINCT practice_id) FROM recipients) = 1
      THEN (SELECT ANY_VALUE(practice_id) FROM recipients)
    ELSE NULL
  END AS practice_id,
  ARRAY(SELECT AS STRUCT * FROM topics) AS topics,
  ARRAY(SELECT AS STRUCT * FROM recipients) AS recipients
)) AS payload
FROM campaign
LIMIT 1;`;
}

function workItemDetailQuery(project: string, dataset: string): string {
  const table = tableFactory(project, dataset);
  return `
WITH latest_interview AS (
  SELECT * EXCEPT(row_number) FROM (
    SELECT i.*, ROW_NUMBER() OVER (ORDER BY COALESCE(i.completed_at, i.started_at) DESC) row_number
    FROM ${table('interviews')} i WHERE i.campaign_id = @campaign_id AND i.doctor_id = @doctor_id
  ) WHERE row_number = 1
), latest_article AS (
  SELECT * EXCEPT(row_number) FROM (
    SELECT a.*, ROW_NUMBER() OVER (ORDER BY a.created_at DESC) row_number
    FROM ${table('articles')} a WHERE a.campaign_id = @campaign_id AND a.doctor_id = @doctor_id
  ) WHERE row_number = 1
), item AS (
  SELECT cd.campaign_id, c.campaign_name, CAST(c.campaign_month AS STRING) campaign_month,
    c.require_marketing_approval, cd.doctor_id, d.doctor_name, d.credentials, d.email,
    p.practice_id, p.practice_name, p.website_domain, p.publisher_type,
    cd.status campaign_doctor_status, cd.invited_at,
    i.interview_id, i.topic_id, i.status interview_status, i.started_at, i.completed_at, i.transcript,
    t.topic_title, t.topic_description,
    a.article_id, a.status article_status, a.current_version, a.created_at article_created_at,
    a.doctor_review_deadline, a.doctor_approved_at, a.marketing_approved_at, a.published_at, a.published_url,
    v.version_type, v.content article_content, v.created_at version_created_at
  FROM ${table('campaign_doctors')} cd
  JOIN ${table('campaigns')} c USING (campaign_id)
  JOIN ${table('doctors')} d USING (doctor_id)
  LEFT JOIN ${table('practices')} p ON p.practice_id = d.practice_id
  LEFT JOIN latest_interview i ON TRUE
  LEFT JOIN ${table('campaign_topics')} t ON t.topic_id = i.topic_id
  LEFT JOIN latest_article a ON TRUE
  LEFT JOIN ${table('article_versions')} v ON v.article_id = a.article_id AND v.version_number = a.current_version
  WHERE cd.campaign_id = @campaign_id AND cd.doctor_id = @doctor_id
)
SELECT TO_JSON_STRING(STRUCT(
  (SELECT AS STRUCT * EXCEPT(transcript, article_content) FROM item LIMIT 1) AS item,
  (SELECT transcript FROM item LIMIT 1) AS transcript,
  (SELECT article_content FROM item LIMIT 1) AS article_content,
  ARRAY(SELECT AS STRUCT version_number, version_type, revision_instruction, created_at, created_by
    FROM ${table('article_versions')} WHERE article_id = (SELECT article_id FROM item LIMIT 1) ORDER BY version_number DESC) AS versions,
  ARRAY(SELECT AS STRUCT approval_id, approval_type, status, requested_at, deadline, responded_at, response
    FROM ${table('approvals')} WHERE article_id = (SELECT article_id FROM item LIMIT 1) ORDER BY requested_at DESC) AS approvals,
  ARRAY(SELECT AS STRUCT communication_id, communication_type, channel, recipient, status, sent_at, delivered_at
    FROM ${table('communications')} WHERE campaign_id = @campaign_id AND doctor_id = @doctor_id ORDER BY sent_at DESC LIMIT 50) AS communications,
  ARRAY(SELECT AS STRUCT event_id, entity_type, entity_id, event_type, event_timestamp, source_system, workflow_execution_id, TO_JSON_STRING(payload) payload
    FROM ${table('workflow_events')} WHERE entity_id IN (@campaign_id, @doctor_id, COALESCE((SELECT interview_id FROM item LIMIT 1), ''), COALESCE((SELECT article_id FROM item LIMIT 1), ''))
    ORDER BY event_timestamp DESC LIMIT 100) AS events
)) AS payload FROM item LIMIT 1;`;
}

function stringParameter(name: string, value: string): Record<string, unknown> {
  return { name, parameterType: { type: 'STRING' }, parameterValue: { value } };
}

function actionEmails(env: AdminEnv): string[] {
  return (env.ADMIN_ACTION_EMAILS ?? '').split(',').map((email) => email.trim().toLowerCase()).filter(Boolean);
}

function capabilities(viewer: AccessClaims, env: AdminEnv): Record<string, unknown> {
  const canAct = Boolean(viewer.email && actionEmails(env).includes(viewer.email) && env.ADMIN_COMMAND_SECRET && env.ADMIN_COMMAND_PATH);
  return { readOnly: !canAct, actionsEnabled: canAct, actionApiVersion: 'v1', role: canAct ? 'administrator' : 'viewer',
    enabledActions: canAct ? ['approve_for_doctor', 'launch_campaign'] : [] };
}

function unavailable(error: unknown): Response {
  return Response.json({ error: 'ADMIN_DATA_UNAVAILABLE', message: error instanceof Error ? error.message : 'The admin data source is unavailable.' }, { status: 502 });
}

export async function handleAdminOverview(request: Request, env: Env): Promise<Response> {
  const adminEnv: AdminEnv = env;
  const missing = configurationMissing(adminEnv);
  if (missing.length) return Response.json({ error: 'ADMIN_CONFIGURATION_REQUIRED', message: 'The protected dashboard data connection is not configured.', missing }, { status: 503 });
  let viewer: AccessClaims;
  try { viewer = await authenticateAdmin(request, adminEnv); }
  catch { return Response.json({ error: 'UNAUTHORIZED', message: 'Cloudflare Access authentication is required.' }, { status: 401 }); }
  try {
    const overview = await queryJson(adminEnv, adminOverviewQuery(adminEnv.BQ_PROJECT_ID, adminEnv.BQ_DATASET));
    return Response.json({ viewer: { email: viewer.email ?? null }, capabilities: capabilities(viewer, adminEnv), overview }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error(JSON.stringify({ event: 'admin_overview_failed', viewer: viewer.email ?? viewer.sub ?? 'unknown', error: error instanceof Error ? error.message : String(error) }));
    return unavailable(error);
  }
}

export async function handleAdminCampaignTemplate(request: Request, env: Env, campaignId: string): Promise<Response> {
  const adminEnv: AdminEnv = env;
  const missing = configurationMissing(adminEnv);
  if (missing.length) return Response.json({ error: 'ADMIN_CONFIGURATION_REQUIRED', message: 'The protected dashboard data connection is not configured.', missing }, { status: 503 });
  let viewer: AccessClaims;
  try { viewer = await authenticateAdmin(request, adminEnv); }
  catch { return Response.json({ error: 'UNAUTHORIZED', message: 'Cloudflare Access authentication is required.' }, { status: 401 }); }
  if (!campaignId || campaignId.length > 200) return Response.json({ error: 'INVALID_CAMPAIGN', message: 'The campaign identifier is invalid.' }, { status: 400 });
  try {
    const template = await queryJson(
      adminEnv,
      campaignTemplateQuery(adminEnv.BQ_PROJECT_ID, adminEnv.BQ_DATASET),
      [stringParameter('campaign_id', campaignId)],
    );
    return Response.json({ viewer: { email: viewer.email ?? null }, template }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error(JSON.stringify({ event: 'admin_campaign_template_failed', viewer: viewer.email ?? viewer.sub ?? 'unknown', campaignId, error: error instanceof Error ? error.message : String(error) }));
    return unavailable(error);
  }
}

export async function handleAdminWorkItem(request: Request, env: Env, campaignId: string, doctorId: string): Promise<Response> {
  const adminEnv: AdminEnv = env;
  const missing = configurationMissing(adminEnv);
  if (missing.length) return Response.json({ error: 'ADMIN_CONFIGURATION_REQUIRED', message: 'The protected dashboard data connection is not configured.', missing }, { status: 503 });
  let viewer: AccessClaims;
  try { viewer = await authenticateAdmin(request, adminEnv); }
  catch { return Response.json({ error: 'UNAUTHORIZED', message: 'Cloudflare Access authentication is required.' }, { status: 401 }); }
  if (!campaignId || !doctorId || campaignId.length > 200 || doctorId.length > 200) return Response.json({ error: 'INVALID_WORK_ITEM', message: 'The work item identifier is invalid.' }, { status: 400 });
  try {
    const detail = await queryJson(adminEnv, workItemDetailQuery(adminEnv.BQ_PROJECT_ID, adminEnv.BQ_DATASET), [stringParameter('campaign_id', campaignId), stringParameter('doctor_id', doctorId)]);
    return Response.json({ viewer: { email: viewer.email ?? null }, capabilities: capabilities(viewer, adminEnv), detail }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error(JSON.stringify({ event: 'admin_work_item_failed', viewer: viewer.email ?? viewer.sub ?? 'unknown', campaignId, doctorId, error: error instanceof Error ? error.message : String(error) }));
    return unavailable(error);
  }
}

export async function handleAdminCommand(request: Request, env: Env): Promise<Response> {
  const adminEnv: AdminEnv = env;
  let viewer: AccessClaims;
  try { viewer = await authenticateAdmin(request, adminEnv); }
  catch { return Response.json({ error: 'UNAUTHORIZED', message: 'Cloudflare Access authentication is required.' }, { status: 401 }); }
  if (!viewer.email || !actionEmails(adminEnv).includes(viewer.email)) return Response.json({ error: 'FORBIDDEN', message: 'Your account has read-only access.' }, { status: 403 });
  if (!adminEnv.ADMIN_COMMAND_SECRET || !adminEnv.ADMIN_COMMAND_PATH) return Response.json({ error: 'ADMIN_ACTIONS_NOT_CONFIGURED', message: 'The audited n8n command workflow is not connected yet.' }, { status: 503 });
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: 'INVALID_REQUEST', message: 'A JSON command body is required.' }, { status: 400 }); }
  if (!body || typeof body !== 'object') return Response.json({ error: 'INVALID_REQUEST', message: 'A JSON command body is required.' }, { status: 400 });
  const command = body as Record<string, unknown>;
  if (!['approve_for_doctor', 'launch_campaign'].includes(String(command.action))) return Response.json({ error: 'INVALID_ACTION', message: 'This administrative action is not supported.' }, { status: 400 });
  const idempotencyKey = request.headers.get('Idempotency-Key');
  if (!idempotencyKey || idempotencyKey.length > 100) return Response.json({ error: 'IDEMPOTENCY_KEY_REQUIRED', message: 'A valid idempotency key is required.' }, { status: 400 });
  try {
    const upstream = new URL(adminEnv.ADMIN_COMMAND_PATH, adminEnv.N8N_BASE_URL);
    const response = await fetch(upstream, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-AAC-Admin-Secret': adminEnv.ADMIN_COMMAND_SECRET },
      body: JSON.stringify({ ...command, actor_email: viewer.email, idempotency_key: idempotencyKey, requested_at: new Date().toISOString() }),
    });
    const raw = await response.text();
    if (!response.ok) {
      let message = `The n8n command workflow failed with HTTP ${response.status}.`;
      if (raw.trim()) {
        try {
          const parsed = JSON.parse(raw) as { message?: unknown; error?: unknown };
          message = String(parsed.message ?? parsed.error ?? message);
        } catch {
          message = raw.slice(0, 500);
        }
      }
      console.error(JSON.stringify({ event: 'admin_command_upstream_failed', viewer: viewer.email, action: command.action, status: response.status, message }));
      return Response.json({ error: 'N8N_COMMAND_FAILED', message, upstream_status: response.status }, { status: 502, headers: { 'Cache-Control': 'no-store' } });
    }
    if (!raw.trim()) {
      console.error(JSON.stringify({ event: 'admin_command_empty_response', viewer: viewer.email, action: command.action, status: response.status }));
      return Response.json({
        error: 'N8N_EMPTY_RESPONSE',
        message: 'The n8n command workflow returned an empty response. The campaign was not confirmed; check the workflow execution before retrying.',
      }, { status: 502, headers: { 'Cache-Control': 'no-store' } });
    }
    return new Response(raw, { status: response.status, statusText: response.statusText,
      headers: { 'Content-Type': response.headers.get('Content-Type') ?? 'application/json', 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error(JSON.stringify({ event: 'admin_command_failed', viewer: viewer.email, action: command.action, error: error instanceof Error ? error.message : String(error) }));
    return Response.json({ error: 'ADMIN_COMMAND_UNAVAILABLE', message: 'The workflow command service is temporarily unavailable.' }, { status: 502 });
  }
}
