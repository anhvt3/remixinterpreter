import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ConfigPayload {
  operation: 'insert' | 'update' | 'delete';
  password: string;
  id?: string;
  type?: string;
  version_name?: string;
  content?: string;
  important_notes?: string;
  is_active?: boolean;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload: ConfigPayload = await req.json();
    const { operation, password, id, type, version_name, content, important_notes, is_active } = payload;

    // Validate password
    const configPassword = Deno.env.get('CONFIG_PASSWORD');
    if (!configPassword) {
      console.error('CONFIG_PASSWORD not set');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (password !== configPassword) {
      console.warn('Invalid password attempt for config operation:', operation);
      return new Response(
        JSON.stringify({ error: 'Invalid password' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with service role for bypassing RLS
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let result;

    switch (operation) {
      case 'insert':
        if (!type || !version_name) {
          return new Response(
            JSON.stringify({ error: 'Missing required fields: type and version_name' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        result = await supabase
          .from('config')
          .insert({
            type,
            version_name,
            content: content || null,
            important_notes: important_notes || null,
            is_active: is_active ?? true,
          })
          .select()
          .single();
        break;

      case 'update':
        if (!id) {
          return new Response(
            JSON.stringify({ error: 'Missing required field: id' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        result = await supabase
          .from('config')
          .update({
            content: content ?? undefined,
            important_notes: important_notes ?? undefined,
          })
          .eq('id', id)
          .select()
          .single();
        break;

      case 'delete':
        if (!id) {
          return new Response(
            JSON.stringify({ error: 'Missing required field: id' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        // Soft delete
        result = await supabase
          .from('config')
          .update({ is_deleted: true })
          .eq('id', id)
          .select()
          .single();
        break;

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid operation. Use: insert, update, or delete' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    if (result.error) {
      console.error('Database error:', result.error);
      return new Response(
        JSON.stringify({ error: result.error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, data: result.data }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing request:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
