import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://xontsuisatdwulcfytro.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhvbnRzdWlzYXRkd3VsY2Z5dHJvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTk3NjczNCwiZXhwIjoyMDk1NTUyNzM0fQ.U5_xAQCufV4p5OQ3UEDslvSBjCbYsiiEBAQJMaDrBHY';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  console.log('Buscando usuario ativo...');
  const { data: profiles, error: profileError } = await supabase.from('profiles').select('id').limit(1);
  
  if (profileError || !profiles || profiles.length === 0) {
    console.error('Erro ao buscar usuario:', profileError);
    return;
  }
  
  const userId = profiles[0].id;
  const igUserId = '17841401666623403';
  const igUsername = 'hericksonmaia';
  const token = 'EAALjkEiDZA4kBRub6pwGtVa1138gIUdzJ0ZAlqQdNitxjQbKBBqDQCaUrTdeFoKZByWZBlyZAW9OxVMvcg2JfScsRuKkdWoWsLyCSjj48pMtMhB5dldDOCQyMWaeTHDoWDDr88BFxAqmUGRRqQ7Fas9ZAbS3HqZCxXs9Fo69dMGjtED5h0t6a8mMWjWcqbqrPYscFg3v3sw5gCaXa0zGZBxJnaF0JVOde6HgeHMF8gc3agXzNZCFQgqixtuwjRKyZB7ZCpuWdfyGZB3U93DdiyR3';

  console.log('Injetando token para o usuario:', userId);

  const { data, error } = await supabase.from('instagram_connections').upsert({
    user_id: userId,
    ig_user_id: igUserId,
    ig_username: igUsername,
    access_token: token,
    account_type: 'BUSINESS'
  }, { onConflict: 'user_id,ig_user_id' });

  if (error) {
    console.error('Erro ao injetar:', error);
  } else {
    console.log('Token injetado com sucesso! Mineração liberada.');
  }
}

run();
