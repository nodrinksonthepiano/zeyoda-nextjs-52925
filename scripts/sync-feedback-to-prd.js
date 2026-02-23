#!/usr/bin/env node
/**
 * Sync admin feedback from Supabase to PRD.json
 *
 * Reads feedback where source='admin' and status='open',
 * adds each as a new item in PRD.json (low section),
 * marks feedback status as 'in_progress'.
 *
 * Run: npm run sync-feedback
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load env (prefer .env.local, fallback .env)
require('dotenv').config({ path: '.env.local' });
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  require('dotenv').config({ path: '.env' });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing env: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const PRD_PATH = path.join(process.cwd(), 'PRD.json');

function findItemByFeedbackId(prd, feedbackId) {
  for (const section of prd.sections || []) {
    const found = (section.items || []).find((item) => item.feedbackId === feedbackId);
    if (found) return found;
  }
  return null;
}

function getLowSection(prd) {
  return (prd.sections || []).find((s) => s.id === 'low') || prd.sections?.[prd.sections.length - 1];
}

async function main() {
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Fetch open admin feedback
  const { data: feedbackRows, error: fetchError } = await supabase
    .from('feedback')
    .select('id, message, artist_id, created_at')
    .eq('source', 'admin')
    .eq('status', 'open')
    .order('created_at', { ascending: true });

  if (fetchError) {
    console.error('❌ Supabase fetch error:', fetchError.message);
    process.exit(1);
  }

  if (!feedbackRows || feedbackRows.length === 0) {
    console.log('✅ No open admin feedback to sync.');
    process.exit(0);
  }

  // Read PRD
  let prd;
  try {
    const raw = fs.readFileSync(PRD_PATH, 'utf8');
    prd = JSON.parse(raw);
  } catch (err) {
    console.error('❌ Failed to read PRD.json:', err.message);
    process.exit(1);
  }

  if (!prd.sections || !Array.isArray(prd.sections)) {
    console.error('❌ PRD.json invalid: missing sections array');
    process.exit(1);
  }

  const lowSection = getLowSection(prd);
  if (!lowSection) {
    console.error('❌ PRD.json invalid: no low section');
    process.exit(1);
  }

  if (!Array.isArray(lowSection.items)) {
    lowSection.items = [];
  }

  let synced = 0;

  for (const row of feedbackRows) {
    if (findItemByFeedbackId(prd, row.id)) {
      console.log(`⏭️  Skipping feedback ${row.id.slice(0, 8)} (already in PRD)`);
      continue;
    }

    const item = {
      id: `FB-${row.id.slice(0, 8)}`,
      title: row.message.slice(0, 200),
      description: row.message,
      location: row.artist_id ? `?artist=${row.artist_id}` : null,
      status: 'todo',
      feedbackId: row.id,
      createdAt: row.created_at || new Date().toISOString(),
    };

    lowSection.items.push(item);
    synced++;

    // Mark feedback as in_progress
    const { error: updateError } = await supabase
      .from('feedback')
      .update({ status: 'in_progress', updated_at: new Date().toISOString() })
      .eq('id', row.id);

    if (updateError) {
      console.error(`❌ Failed to update feedback ${row.id}:`, updateError.message);
    }
  }

  // Write PRD
  prd.updatedAt = new Date().toISOString();

  try {
    fs.writeFileSync(PRD_PATH, JSON.stringify(prd, null, 2), 'utf8');
  } catch (err) {
    console.error('❌ Failed to write PRD.json:', err.message);
    process.exit(1);
  }

  console.log(`✅ Synced ${synced} feedback item(s) to PRD.json`);
}

main().catch((err) => {
  console.error('❌ Unexpected error:', err);
  process.exit(1);
});
