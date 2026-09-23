-- Initial non-sending, non-publishing mapping from the Authoritative Blog Article Distribution workbook.
-- Source tabs: Locations and Wordpress Sites, read 2026-09-23. Reconcile with the workbook before reuse.
-- All inserted practices remain inactive, with no publishing credential or publisher type.
CREATE TEMP TABLE source_mappings AS
SELECT
  location_code,
  CONCAT('practice_', LOWER(REPLACE(location_code, '-', '_'))) AS practice_id,
  practice_name,
  public_website_url,
  wordpress_base_url
FROM UNNEST([
  STRUCT('AZ-01' AS location_code, 'Aquila Dental' AS practice_name, 'https://aquiladental.com/' AS public_website_url, 'https://apexparent.hostmanpowered.com/az-01/' AS wordpress_base_url),
  STRUCT('CO-01' AS location_code, 'Colorado Family Dentistry' AS practice_name, 'https://cofamilydentistry.com/' AS public_website_url, 'https://apexparent.hostmanpowered.com/co-01/' AS wordpress_base_url),
  STRUCT('CO-02' AS location_code, 'Columbine Family Dental' AS practice_name, 'https://columbinefamilydental.com/' AS public_website_url, 'https://apexparent.hostmanpowered.com/co-02/' AS wordpress_base_url),
  STRUCT('CO-03' AS location_code, 'Colorado Springs Dental' AS practice_name, 'https://coloradospringsdental.com/' AS public_website_url, 'https://apexparent.hostmanpowered.com/co-03/' AS wordpress_base_url),
  STRUCT('CO-04' AS location_code, 'Audubon Dental' AS practice_name, 'https://audubondentalcare.com/' AS public_website_url, 'https://apexparent.hostmanpowered.com/co-04/' AS wordpress_base_url),
  STRUCT('CO-05' AS location_code, 'Associates in Family Dentistry' AS practice_name, 'https://AIFDentistry.com/' AS public_website_url, 'https://apexparent.hostmanpowered.com/co-05/' AS wordpress_base_url),
  STRUCT('CO-06' AS location_code, 'Mountain View Dental Care' AS practice_name, 'https://mountainviewdc.com/' AS public_website_url, 'https://apexparent.hostmanpowered.com/co-06/' AS wordpress_base_url),
  STRUCT('CO-07' AS location_code, 'Northglenn Dental' AS practice_name, 'https://northglenndental.com/' AS public_website_url, 'https://apexparent.hostmanpowered.com/co-07/' AS wordpress_base_url),
  STRUCT('CO-08' AS location_code, 'Alpine Taft Hill' AS practice_name, 'https://alpinedentalhealth.com/' AS public_website_url, 'https://apexparent.hostmanpowered.com/co-08/' AS wordpress_base_url),
  STRUCT('CO-09' AS location_code, 'Alpine Drake' AS practice_name, 'https://alpinedentalhealth.com/' AS public_website_url, 'https://apexparent.hostmanpowered.com/co-08/' AS wordpress_base_url),
  STRUCT('CO-10' AS location_code, 'Alpine Stuart' AS practice_name, 'https://alpinedentalhealth.com/' AS public_website_url, 'https://apexparent.hostmanpowered.com/co-08/' AS wordpress_base_url),
  STRUCT('CO-11' AS location_code, 'Alpine Windsor' AS practice_name, 'https://alpinedentalhealth.com/' AS public_website_url, 'https://apexparent.hostmanpowered.com/co-08/' AS wordpress_base_url),
  STRUCT('CO-12' AS location_code, 'Alpine Boulder' AS practice_name, 'https://alpinedentalhealth.com/' AS public_website_url, 'https://apexparent.hostmanpowered.com/co-08/' AS wordpress_base_url),
  STRUCT('CTX-01' AS location_code, 'Dental Care of San Antonio' AS practice_name, 'https://dentalcareofsa.com/' AS public_website_url, 'https://apexparent.hostmanpowered.com/ctx-01/' AS wordpress_base_url),
  STRUCT('CTX-02' AS location_code, 'Leander Dental Care' AS practice_name, 'https://leanderdental.com/' AS public_website_url, 'https://apexparent.hostmanpowered.com/ctx-02/' AS wordpress_base_url),
  STRUCT('CTX-04' AS location_code, 'Avery Ranch Dental' AS practice_name, 'https://averyranchdental.com/' AS public_website_url, 'https://apexparent.hostmanpowered.com/ctx-04/' AS wordpress_base_url),
  STRUCT('CTX-05' AS location_code, 'Rose Dental Group - Round Rock' AS practice_name, 'https://rosedental.com/' AS public_website_url, 'https://apexparent.hostmanpowered.com/ctx-05/' AS wordpress_base_url),
  STRUCT('CTX-06' AS location_code, 'Rose Dental Group - Angus Road' AS practice_name, 'https://rosedental.com/' AS public_website_url, 'https://apexparent.hostmanpowered.com/ctx-05/' AS wordpress_base_url),
  STRUCT('CTX-07' AS location_code, 'Rose Dental Group - Metric Blvd' AS practice_name, 'https://rosedental.com/' AS public_website_url, 'https://apexparent.hostmanpowered.com/ctx-05/' AS wordpress_base_url),
  STRUCT('CTX-08' AS location_code, 'Rose Dental Group - William Cannon' AS practice_name, 'https://rosedental.com/' AS public_website_url, 'https://apexparent.hostmanpowered.com/ctx-05/' AS wordpress_base_url),
  STRUCT('DFW-03' AS location_code, 'Prestonwood Family Dentistry' AS practice_name, 'https://prestonwooddentistry.com/' AS public_website_url, 'https://apexparent.hostmanpowered.com/dfw-03/' AS wordpress_base_url),
  STRUCT('DFW-05' AS location_code, 'Renfro Family Dental' AS practice_name, 'https://renfrodental.com/' AS public_website_url, 'https://apexparent.hostmanpowered.com/dfw-05/' AS wordpress_base_url),
  STRUCT('DFW-06' AS location_code, 'Stone Ranch Dental Group' AS practice_name, 'https://stoneranchdental.com/' AS public_website_url, 'https://apexparent.hostmanpowered.com/dfw-06/' AS wordpress_base_url),
  STRUCT('DFW-07' AS location_code, 'Williams Square Dental' AS practice_name, 'https://williamssquaredental.com/' AS public_website_url, 'https://apexparent.hostmanpowered.com/dfw-07/' AS wordpress_base_url),
  STRUCT('DFW-08' AS location_code, 'Turtle Creek Dental Associates' AS practice_name, 'https://turtlecreekdental.com/' AS public_website_url, 'https://apexparent.hostmanpowered.com/dfw-08/' AS wordpress_base_url),
  STRUCT('DFW-09' AS location_code, 'Heritage Dental Group' AS practice_name, 'https://heritagedentalmansfield.com/' AS public_website_url, 'https://apexparent.hostmanpowered.com/dfw-09/' AS wordpress_base_url),
  STRUCT('DFW-10' AS location_code, 'White Rock Dental Group' AS practice_name, 'https://whiterockdentalgroup.com/' AS public_website_url, 'https://apexparent.hostmanpowered.com/dfw-10/' AS wordpress_base_url),
  STRUCT('DFW-13' AS location_code, 'Lake Meadow Dental Group' AS practice_name, 'https://lakemeadowdental.com/' AS public_website_url, 'https://apexparent.hostmanpowered.com/dfw-13/' AS wordpress_base_url),
  STRUCT('DFW-14' AS location_code, 'Edwards Ranch Dental Group' AS practice_name, 'https://edwardsranchdental.com/' AS public_website_url, 'https://apexparent.hostmanpowered.com/dfw-14/' AS wordpress_base_url),
  STRUCT('DFW-16' AS location_code, 'Richardson Heights Dental' AS practice_name, 'https://richardsonheightsdental.com/' AS public_website_url, 'https://apexparent.hostmanpowered.com/dfw-16/' AS wordpress_base_url),
  STRUCT('DFW-17' AS location_code, 'Denton Dental Group' AS practice_name, 'https://dentondentalgroup.com/' AS public_website_url, 'https://apexparent.hostmanpowered.com/dfw-17/' AS wordpress_base_url),
  STRUCT('DFW-18' AS location_code, 'Rockwall Dental Associates - South' AS practice_name, 'https://rockwalldental.com/' AS public_website_url, 'https://apexparent.hostmanpowered.com/dfw-18/' AS wordpress_base_url),
  STRUCT('DFW-19' AS location_code, 'Westpark Dental Associates' AS practice_name, 'https://westparkdental.com/' AS public_website_url, 'https://apexparent.hostmanpowered.com/dfw-19/' AS wordpress_base_url),
  STRUCT('DFW-20' AS location_code, 'Colleyville Dentistry' AS practice_name, 'https://colleyvilledentistry.com/' AS public_website_url, 'https://apexparent.hostmanpowered.com/dfw-20/' AS wordpress_base_url),
  STRUCT('DFW-22' AS location_code, 'Rockwall Dental Associates - North' AS practice_name, 'https://genuinedentistryrockwall.com/' AS public_website_url, 'https://apexparent.hostmanpowered.com/dfw-22/' AS wordpress_base_url),
  STRUCT('DFW-23' AS location_code, 'Westview Dentistry' AS practice_name, 'https://westviewdentistry.com/' AS public_website_url, 'https://apexparent.hostmanpowered.com/dfw-23/' AS wordpress_base_url),
  STRUCT('DFW-C2' AS location_code, 'Dallas Dental Group' AS practice_name, 'https://dallasdental.com/' AS public_website_url, 'https://apexparent.hostmanpowered.com/dfw-c2-1/' AS wordpress_base_url),
  STRUCT('DFW-C4' AS location_code, 'Las Colinas Dental Group' AS practice_name, 'https://lascolinasdental.com/' AS public_website_url, 'https://apexparent.hostmanpowered.com/dfw-c4/' AS wordpress_base_url),
  STRUCT('HOU-01' AS location_code, 'Meyerwood Dentistry' AS practice_name, 'https://meyerwooddentistry.com/' AS public_website_url, 'https://apexparent.hostmanpowered.com/hou-01/' AS wordpress_base_url),
  STRUCT('HOU-02' AS location_code, 'The Dentists at Grand Parkway' AS practice_name, 'https://thedentistsatgrandparkway.com/' AS public_website_url, 'https://apexparent.hostmanpowered.com/hou-02/' AS wordpress_base_url),
  STRUCT('HOU-03' AS location_code, 'The Dentists at Town & Country Village' AS practice_name, 'https://dentistsattcv.com/' AS public_website_url, 'https://apexparent.hostmanpowered.com/hou-03/' AS wordpress_base_url),
  STRUCT('HOU-04' AS location_code, 'Greatwood Family Dental' AS practice_name, 'https://greatwooddental.com/' AS public_website_url, 'https://apexparent.hostmanpowered.com/hou-04/' AS wordpress_base_url),
  STRUCT('HOU-05' AS location_code, 'Hillwood Family Dental - Magnolia West' AS practice_name, 'https://hillwooddental.com/' AS public_website_url, 'https://apexparent.hostmanpowered.com/hou-05/' AS wordpress_base_url),
  STRUCT('HOU-06' AS location_code, 'Hillwood Family Dental - Magnolia East' AS practice_name, 'https://hillwooddental.com/' AS public_website_url, 'https://apexparent.hostmanpowered.com/hou-05/' AS wordpress_base_url),
  STRUCT('HOU-07' AS location_code, 'Hillwood Family Dental - Tomball' AS practice_name, 'https://hillwooddental.com/' AS public_website_url, 'https://apexparent.hostmanpowered.com/hou-05/' AS wordpress_base_url),
  STRUCT('HOU-08' AS location_code, 'Copeland Family Dentistry' AS practice_name, 'https://copelandsmiles.com/' AS public_website_url, 'https://apexparent.hostmanpowered.com/hou-08/' AS wordpress_base_url),
  STRUCT('HOU-10' AS location_code, 'Sagewood Dental Group' AS practice_name, 'https://sagewooddental.com/' AS public_website_url, 'https://apexparent.hostmanpowered.com/hou-10/' AS wordpress_base_url),
  STRUCT('OK-01' AS location_code, 'Bethany Family Dentistry' AS practice_name, 'https://bethanydentistry.com/' AS public_website_url, 'https://apexparent.hostmanpowered.com/ok-01/' AS wordpress_base_url),
  STRUCT('OK-03' AS location_code, 'Kenosha Breeze Family Dental' AS practice_name, 'https://kenoshabreezefamilydental.com/' AS public_website_url, 'https://apexparent.hostmanpowered.com/ok-03/' AS wordpress_base_url),
  STRUCT('OK-04' AS location_code, 'Stone Creek Dental' AS practice_name, 'https://stonecreekdental.com/' AS public_website_url, 'https://apexparent.hostmanpowered.com/ok-04/' AS wordpress_base_url),
  STRUCT('OK-08' AS location_code, 'Progressive Dental Care of Tulsa' AS practice_name, 'https://dentalcareoftulsa.com/' AS public_website_url, 'https://apexparent.hostmanpowered.com/ok-08/' AS wordpress_base_url),
  STRUCT('OK-C2' AS location_code, 'Parkway Dental Group' AS practice_name, 'https://parkwaydentalokc.com/' AS public_website_url, 'https://apexparent.hostmanpowered.com/ok-c2/' AS wordpress_base_url),
  STRUCT('OK-C5' AS location_code, 'Bixby Family Dentistry' AS practice_name, 'https://bixbyfamilydentistry.com/' AS public_website_url, 'https://apexparent.hostmanpowered.com/ok-c5/' AS wordpress_base_url),
  STRUCT('MO-01' AS location_code, 'Shoal Creek Dental Care' AS practice_name, 'https://shoalcreekdentalcare.com/' AS public_website_url, 'https://apexparent.hostmanpowered.com/mo-01/' AS wordpress_base_url),
  STRUCT('MO-02' AS location_code, 'Terrace Family Dentistry' AS practice_name, 'https://terracedentistry.com/' AS public_website_url, 'https://apexparent.hostmanpowered.com/mo-02/' AS wordpress_base_url),
  STRUCT('MW-01' AS location_code, 'Millard Family Dentistry' AS practice_name, 'https://millarddentistry.com/' AS public_website_url, 'https://apexparent.hostmanpowered.com/mw-01/' AS wordpress_base_url),
  STRUCT('MW-02' AS location_code, 'Omni Dental Center' AS practice_name, 'https://omnidentalcenter.com/' AS public_website_url, 'https://apexparent.hostmanpowered.com/mw-02/' AS wordpress_base_url),
  STRUCT('TN-02' AS location_code, 'Dental Excellence of Memphis' AS practice_name, 'https://dentalexcellencememphis.com/' AS public_website_url, 'https://apexparent.hostmanpowered.com/tn-02/' AS wordpress_base_url)
]);

ASSERT (SELECT COUNT(*) FROM source_mappings) = 58 AS 'Expected 58 eligible general-dentist mappings.';
ASSERT (SELECT COUNT(DISTINCT location_code) FROM source_mappings) = 58 AS 'Duplicate location code in mapping source.';
ASSERT NOT EXISTS (
  SELECT 1 FROM source_mappings
  WHERE NOT STARTS_WITH(public_website_url, 'https://')
     OR NOT STARTS_WITH(wordpress_base_url, 'https://apexparent.hostmanpowered.com/')
) AS 'Unexpected website URL in mapping source.';
ASSERT NOT EXISTS (
  SELECT 1 FROM `apex-marketing-n8n.automated_article_creation.practices` p
  JOIN source_mappings s USING (practice_id)
  WHERE p.active = TRUE OR p.publisher_type IS NOT NULL
) AS 'An existing practice ID is already active or configured for publishing.';

MERGE `apex-marketing-n8n.automated_article_creation.practices` AS p
USING source_mappings AS s
ON p.practice_id = s.practice_id
WHEN NOT MATCHED THEN INSERT
  (practice_id, practice_name, website_domain, publisher_type,
   publisher_config_reference, active, created_at, updated_at)
VALUES
  (s.practice_id, s.practice_name, s.public_website_url, NULL,
   TO_JSON_STRING(STRUCT(s.location_code AS location_code,
     s.wordpress_base_url AS wordpress_base_url,
     'UNVERIFIED' AS mapping_status)),
   FALSE, CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP());

SELECT COUNT(*) AS mapped_practices,
       COUNTIF(active) AS active_practices,
       COUNTIF(publisher_type IS NOT NULL) AS publishing_configured_practices,
       COUNT(DISTINCT JSON_VALUE(publisher_config_reference, '$.wordpress_base_url')) AS wordpress_subsites
FROM `apex-marketing-n8n.automated_article_creation.practices`
WHERE practice_id IN (SELECT practice_id FROM source_mappings);
