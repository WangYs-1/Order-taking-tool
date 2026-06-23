// 云端配置存在时初始化 Supabase；未配置时应用完整使用 localStorage。
let client = null;
export async function getSupabase() {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  if (!client) {
    const { createClient } = await import('@supabase/supabase-js');
    client = createClient(url, key);
  }
  return client;
}
