import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { fileContent, fileName, fileUrl } = await req.json();

    console.log(`Processing file: ${fileName}`);

    // Create initial parsing log
    const { data: logData, error: logError } = await supabase
      .from('parsing_logs')
      .insert({
        file_name: fileName,
        file_url: fileUrl,
        status: 'processing'
      })
      .select()
      .single();

    if (logError) {
      console.error('Error creating parsing log:', logError);
      throw logError;
    }

    // Extract data using OpenAI
    const extractionPrompt = `
Extract shipment order information from the following document content. 
Return a JSON object with these exact fields:
- customer_name: string (required)
- address: string (required) 
- tracking_id: string (optional)
- delivery_date: string in YYYY-MM-DD format (optional)
- package_weight: number (optional, in kg)
- notes: string (optional)

Document content:
${fileContent}

Return only valid JSON, no other text.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are an expert data extraction assistant. Extract shipment information accurately and return only valid JSON.' },
          { role: 'user', content: extractionPrompt }
        ],
        temperature: 0.1,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const extractedText = aiResponse.choices[0].message.content;

    console.log('Extracted text:', extractedText);

    // Parse the JSON response
    let extractedData;
    try {
      extractedData = JSON.parse(extractedText);
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', extractedText);
      
      // Update parsing log with failure
      await supabase
        .from('parsing_logs')
        .update({
          status: 'failed',
          error_message: 'Failed to parse AI response as JSON',
          extracted_data: { raw_response: extractedText }
        })
        .eq('id', logData.id);

      throw new Error('AI response was not valid JSON');
    }

    // Validate required fields
    if (!extractedData.customer_name || !extractedData.address) {
      const error = 'Missing required fields: customer_name and address';
      
      await supabase
        .from('parsing_logs')
        .update({
          status: 'failed',
          error_message: error,
          extracted_data: extractedData
        })
        .eq('id', logData.id);

      throw new Error(error);
    }

    // Insert shipment order
    const { data: shipmentData, error: shipmentError } = await supabase
      .from('shipment_orders')
      .insert({
        customer_name: extractedData.customer_name,
        address: extractedData.address,
        tracking_id: extractedData.tracking_id || null,
        delivery_date: extractedData.delivery_date || null,
        package_weight: extractedData.package_weight || null,
        notes: extractedData.notes || null,
        original_file_url: fileUrl,
        original_file_name: fileName,
        parsed_by_ai: true,
        status: 'pending'
      })
      .select()
      .single();

    if (shipmentError) {
      console.error('Error inserting shipment order:', shipmentError);
      
      await supabase
        .from('parsing_logs')
        .update({
          status: 'failed',
          error_message: shipmentError.message,
          extracted_data: extractedData
        })
        .eq('id', logData.id);

      throw shipmentError;
    }

    // Update parsing log with success
    await supabase
      .from('parsing_logs')
      .update({
        status: 'success',
        extracted_data: extractedData
      })
      .eq('id', logData.id);

    console.log('Successfully processed shipment order:', shipmentData.id);

    return new Response(JSON.stringify({ 
      success: true, 
      shipmentOrder: shipmentData,
      extractedData: extractedData
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in extract-shipment-data function:', error);
    
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});