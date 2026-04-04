#!/usr/bin/env node
/**
 * Sync feedback ↔ PRD.json (bidirectional)
 *
 * Forward: feedback (source='admin', status='open') → PRD.json (low section)
 * Reverse: PRD items with feedbackId null → feedback table (prd_item_id)
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

function getPrdItemsWithoutFeedbackId(prd) {
  const items = [];
  for (const section of prd.sections || []) {
    for (const item of section.items || []) {
      if (item.feedbackId == null) items.push(item);
    }
  }
  return items;
}

function parseArtistFromLocation(location) {
  if (!location || typeof location !== 'string') return null;
  const match = location.match(/\?artist=([^&]+)/);
  return match ? match[1] : null;
}

function prdStatusToFeedbackStatus(prdStatus) {
  const map = { todo: 'open', in_progress: 'in_progress', done: 'done' };
  return map[prdStatus] || 'open';
}

async function main() {
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Read PRD first (needed for both syncs)
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

  // --- Forward sync: feedback → PRD ---
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

  let forwardSynced = 0;
  if (feedbackRows && feedbackRows.length > 0) {
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
      forwardSynced++;

      const { error: updateError } = await supabase
        .from('feedback')
        .update({ status: 'in_progress', updated_at: new Date().toISOString() })
        .eq('id', row.id);

      if (updateError) {
        console.error(`❌ Failed to update feedback ${row.id}:`, updateError.message);
      }
    }

    prd.updatedAt = new Date().toISOString();
    fs.writeFileSync(PRD_PATH, JSON.stringify(prd, null, 2), 'utf8');
    console.log(`✅ Forward: synced ${forwardSynced} feedback item(s) to PRD.json`);
  } else {
    console.log('✅ Forward: no open admin feedback to sync.');
  }

  // --- Reverse sync: PRD → feedback ---
  const itemsWithoutFeedback = getPrdItemsWithoutFeedbackId(prd);
  let reverseSynced = 0;

  for (const item of itemsWithoutFeedback) {
    const { data: existing } = await supabase
      .from('feedback')
      .select('id')
      .eq('prd_item_id', item.id)
      .maybeSingle();

    if (existing) {
      continue; // already in feedback, skip
    }

    const artistId = parseArtistFromLocation(item.location);
    const feedbackStatus = prdStatusToFeedbackStatus(item.status);
    const message = (item.title || item.description || '').slice(0, 500);

    const { error: insertError } = await supabase.from('feedback').insert({
      message,
      submitted_by: 'system@prd-sync',
      source: 'admin',
      status: feedbackStatus,
      artist_id: artistId,
      prd_item_id: item.id,
    });

    if (insertError) {
      console.error(`❌ Failed to insert feedback for ${item.id}:`, insertError.message);
    } else {
      reverseSynced++;
    }
  }

  if (reverseSynced > 0) {
    console.log(`✅ Reverse: synced ${reverseSynced} PRD item(s) to feedback.`);
  } else if (itemsWithoutFeedback.length > 0) {
    console.log('✅ Reverse: all PRD items already in feedback.');
  } else {
    console.log('✅ Reverse: no PRD items to sync.');
  }
}

main().catch((err) => {
  console.error('❌ Unexpected error:', err);
  process.exit(1);
});
