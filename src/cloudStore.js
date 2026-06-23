import { getSupabase } from './supabase.js';
import { normalizeState } from './store.js';

const HOUSEHOLD_SLUG = 'family-default';
const STATE_KIND = 'state';

let householdId = null;
let stateRecordId = null;
let cloudEnabled = false;
let saveTimer = null;

const cloneForCloud = state => JSON.parse(JSON.stringify(state));

async function ensureHousehold(client) {
  if (householdId) return householdId;

  const existing = await client
    .from('households')
    .select('id')
    .eq('slug', HOUSEHOLD_SLUG)
    .maybeSingle();

  if (existing.error) throw existing.error;
  if (existing.data?.id) {
    householdId = existing.data.id;
    return householdId;
  }

  const created = await client
    .from('households')
    .insert({ name: '我的家庭', slug: HOUSEHOLD_SLUG })
    .select('id')
    .single();

  if (created.error) throw created.error;
  householdId = created.data.id;
  return householdId;
}

async function getLatestStateRecord(client) {
  const id = await ensureHousehold(client);
  const result = await client
    .from('app_records')
    .select('id,payload,updated_at')
    .eq('household_id', id)
    .eq('kind', STATE_KIND)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (result.error) throw result.error;
  if (result.data?.id) stateRecordId = result.data.id;
  return result.data || null;
}

export async function loadCloudState(localState) {
  const client = await getSupabase();
  if (!client) return { enabled: false, state: localState };

  try {
    const record = await getLatestStateRecord(client);
    cloudEnabled = true;

    if (record?.payload) {
      return { enabled: true, loaded: true, state: normalizeState(record.payload) };
    }

    await saveCloudState(localState);
    return { enabled: true, loaded: false, state: localState };
  } catch (error) {
    console.warn('[cloud-sync] Supabase sync disabled:', error);
    cloudEnabled = false;
    return { enabled: false, error, state: localState };
  }
}

export async function saveCloudState(state) {
  const client = await getSupabase();
  if (!client) return false;

  const payload = cloneForCloud(normalizeState(state));
  const id = await ensureHousehold(client);
  const row = {
    household_id: id,
    kind: STATE_KIND,
    payload,
    updated_at: new Date().toISOString()
  };

  if (stateRecordId) {
    const updated = await client
      .from('app_records')
      .update(row)
      .eq('id', stateRecordId);
    if (updated.error) throw updated.error;
    return true;
  }

  const existing = await getLatestStateRecord(client);
  if (existing?.id) {
    stateRecordId = existing.id;
    return saveCloudState(state);
  }

  const inserted = await client
    .from('app_records')
    .insert(row)
    .select('id')
    .single();
  if (inserted.error) throw inserted.error;
  stateRecordId = inserted.data.id;
  return true;
}

export function queueCloudSave(state) {
  if (!cloudEnabled) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try { await saveCloudState(state); }
    catch (error) { console.warn('[cloud-sync] Failed to save:', error); }
  }, 500);
}
