import fs from 'node:fs';

const path = new URL('../n8n/24-admin-command-router.json', import.meta.url);
const workflow = JSON.parse(fs.readFileSync(path, 'utf8'));
const validation = workflow.nodes.find((node) => node.id === 'validate-admin-command');
const campaign = workflow.nodes.find((node) => node.id === 'launch-admin-campaign');

validation.parameters.jsCode = validation.parameters.jsCode
  .replace("\n  const practiceId = required('practice_id');\n  if (!/^[A-Za-z0-9_-]{3,100}$/.test(practiceId)) throw new Error('Invalid linked practice.');\n", '')
  .replace('    practice_id: practiceId,\n', '');

const oldAssertions = `ASSERT (
  SELECT COUNT(*)
  FROM \`apex-marketing-n8n.automated_article_creation.practices\`
  WHERE practice_id = @practice_id
    AND active = TRUE
    AND UPPER(COALESCE(publisher_type, '')) = 'WORDPRESS'
    AND NULLIF(TRIM(JSON_VALUE(SAFE.PARSE_JSON(publisher_config_reference), '$.wordpress_base_url')), '') IS NOT NULL
    AND NULLIF(TRIM(JSON_VALUE(SAFE.PARSE_JSON(publisher_config_reference), '$.credential_name')), '') IS NOT NULL
    AND (
      practice_id = 'practice_test_001'
      OR UPPER(COALESCE(JSON_VALUE(SAFE.PARSE_JSON(publisher_config_reference), '$.mapping_status'), '')) = 'VERIFIED'
    )
) = 1 AS 'The selected practice does not have an active, verified WordPress publishing configuration.';

ASSERT (
  SELECT COUNT(*)
  FROM \`apex-marketing-n8n.automated_article_creation.doctors\`
  WHERE doctor_id IN UNNEST(JSON_VALUE_ARRAY(PARSE_JSON(@doctor_ids_json)))
    AND practice_id = @practice_id
    AND active = TRUE
    AND NULLIF(TRIM(email), '') IS NOT NULL
) = ARRAY_LENGTH(JSON_VALUE_ARRAY(PARSE_JSON(@doctor_ids_json)))
AS 'Every selected doctor must be active, have an email address, and remain linked to the selected practice.';`;
const newAssertions = `ASSERT (
  SELECT COUNT(*)
  FROM \`apex-marketing-n8n.automated_article_creation.doctors\` d
  JOIN \`apex-marketing-n8n.automated_article_creation.practices\` p USING (practice_id)
  WHERE d.doctor_id IN UNNEST(JSON_VALUE_ARRAY(PARSE_JSON(@doctor_ids_json)))
    AND d.active = TRUE
    AND NULLIF(TRIM(d.email), '') IS NOT NULL
    AND (
      @audience = 'Presentation preview'
      OR (
        p.active = TRUE
        AND UPPER(COALESCE(p.publisher_type, '')) = 'WORDPRESS'
        AND NULLIF(TRIM(JSON_VALUE(SAFE.PARSE_JSON(p.publisher_config_reference), '$.wordpress_base_url')), '') IS NOT NULL
        AND NULLIF(TRIM(JSON_VALUE(SAFE.PARSE_JSON(p.publisher_config_reference), '$.credential_name')), '') IS NOT NULL
        AND (
          p.practice_id = 'practice_test_001'
          OR UPPER(COALESCE(JSON_VALUE(SAFE.PARSE_JSON(p.publisher_config_reference), '$.mapping_status'), '')) = 'VERIFIED'
        )
      )
    )
) = ARRAY_LENGTH(JSON_VALUE_ARRAY(PARSE_JSON(@doctor_ids_json)))
AS 'Every selected doctor must be active and linked to a practice. Full article campaigns also require a verified publishing site.';`;
if (!campaign.parameters.sqlQuery.includes(oldAssertions)) throw new Error('Expected campaign assertions were not found.');
campaign.parameters.sqlQuery = campaign.parameters.sqlQuery
  .replace(oldAssertions, newAssertions)
  .replace('    @practice_id AS practice_id,\n', "    (SELECT COUNT(DISTINCT practice_id) FROM `apex-marketing-n8n.automated_article_creation.doctors` WHERE doctor_id IN UNNEST(JSON_VALUE_ARRAY(PARSE_JSON(@doctor_ids_json)))) AS practice_count,\n")
  .replace('    @practice_id AS practice_id,\n', "    (SELECT COUNT(DISTINCT practice_id) FROM `apex-marketing-n8n.automated_article_creation.doctors` WHERE doctor_id IN UNNEST(JSON_VALUE_ARRAY(PARSE_JSON(@doctor_ids_json)))) AS practice_count,\n");
campaign.parameters.options.queryParameters.namedParameters = campaign.parameters.options.queryParameters.namedParameters
  .filter((parameter) => parameter.name !== 'practice_id');

fs.writeFileSync(path, `${JSON.stringify(workflow, null, 2)}\n`);
