import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';

// BigQuery quoted strings cannot span lines, so a quote left open on a line means a pattern or value lost characters
// (for example the "$'" at the end of a regular expression), and BigQuery rejects the whole step.
const unclosedStrings = (sql) => {
  const problems = [];
  let i = 0;
  let line = 1;
  const skipTo = (end, width) => {
    for (const character of sql.slice(i, end)) if (character === '\n') line++;
    i = end < 0 ? sql.length : end + width;
  };
  while (i < sql.length) {
    const character = sql[i];
    if (character === '\n') { line++; i++; continue; }
    if ((character === '-' && sql[i + 1] === '-') || character === '#') { while (i < sql.length && sql[i] !== '\n') i++; continue; }
    if (character === '/' && sql[i + 1] === '*') { skipTo(sql.indexOf('*/', i + 2), 2); continue; }
    if (character === '`') { skipTo(sql.indexOf('`', i + 1), 1); continue; }
    if (character === "'" || character === '"') {
      if (sql.startsWith(character.repeat(3), i)) { skipTo(sql.indexOf(character.repeat(3), i + 3), 3); continue; }
      let j = i + 1;
      for (; j < sql.length; j++) {
        if (sql[j] === '\\') { j++; continue; }
        if (sql[j] === character) break;
        if (sql[j] === '\n') { problems.push(`line ${line}: ${sql.slice(i, j).slice(0, 80)}`); break; }
      }
      i = j + 1;
      continue;
    }
    i++;
  }
  return problems;
};

test('the string check catches a regular expression that lost its closing $\'', () => {
  assert.deepEqual(unclosedStrings("SELECT REGEXP_EXTRACT(u, r'/([^/?#]+)/?$') AS slug,\n  'ok' AS x"), []);
  assert.equal(unclosedStrings("SELECT REGEXP_EXTRACT(u, r'/([^/?#]+)/?) IS NULL, '',\n  'ok' AS x").length, 1);
});

test('every BigQuery step in the n8n workflows closes its quoted strings on the same line', () => {
  for (const file of fs.readdirSync(new URL('../n8n/', import.meta.url)).filter((name) => name.endsWith('.json'))) {
    const workflow = JSON.parse(fs.readFileSync(new URL(`../n8n/${file}`, import.meta.url), 'utf8'));
    for (const node of workflow.nodes || []) {
      if (typeof node.parameters?.sqlQuery !== 'string') continue;
      assert.deepEqual(unclosedStrings(node.parameters.sqlQuery), [], `${file}: ${node.name}`);
    }
  }
});
