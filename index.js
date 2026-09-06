import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// Sanitize and trim whitespace, newlines, or accidental quotes from environment variables
const rawUrl = process.env.SUPABASE_URL || '';
const supabaseUrl = rawUrl.replace(/^["']|["']$/g, '').trim();
const supabaseKey = (process.env.SUPABASE_KEY || '').replace(/^["']|["']$/g, '').trim();

// Debug log to verify sanitized lengths
console.log("Runtime Environment Check:");
console.log("- SUPABASE_URL length:", supabaseUrl.length);
console.log("- SUPABASE_URL value preview:", supabaseUrl ? `${supabaseUrl.substring(0, 12)}...` : "UNDEFINED");
console.log("- SUPABASE_KEY present:", !!supabaseKey);
console.log("- GEMINI_API_KEY present:", !!process.env.GEMINI_API_KEY);

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Critical: SUPABASE_URL or SUPABASE_KEY is missing from the environment.");
}

const supabase = createClient(supabaseUrl, supabaseKey);

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function runOutreachPipeline() {
  try {
    console.log("Fetching pending leads via Supabase HTTPS client...");
    let { data: leads, error: fetchError } = await supabase
      .from('leads')
      .select('*')
      .eq('status', 'pending');

    if (fetchError) throw fetchError;

    if (!leads || leads.length === 0) {
      console.log("No pending leads found. Inserting a test lead...");
      const { data: inserted, error: insertError } = await supabase
        .from('leads')
        .insert([
          { 
            name: 'John Smith', 
            company: 'Apex Logistics', 
            email: 'john@apexlogistics.com', 
            pain_point: 'Manual freight tracking and delayed customer notification updates', 
            status: 'pending' 
          }
        ])
        .select();

      if (insertError) throw insertError;
      leads = inserted;
    }

    for (const lead of leads) {
      console.log(`Processing lead for ${lead.name} at ${lead.company}...`);

      const prompt = `
        You are an expert technical growth engineer for Sayi Digital, a software engineering and digital services firm specializing in custom mobile apps (React Native, .NET MAUI), backend systems (Node.js), and web hosting.
        
        Craft a short, highly personalized cold outreach email for this prospect. Hook them by addressing their specific operational pain point and briefly explain how Sayi Digital can solve it using custom software or web solutions.
        
        Prospect Name: ${lead.name}
        Company: ${lead.company}
        Identified Pain Point: ${lead.pain_point}

        Keep it concise, professional, and end with a soft call-to-action for a quick chat.
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      const aiDraft = response.text;

      const { error: updateError } = await supabase
        .from('leads')
        .update({ ai_draft: aiDraft, status: 'generated' })
        .eq('id', lead.id);

      if (updateError) throw updateError;

      console.log(`Successfully generated and saved draft for ${lead.name}!\nDraft Preview:\n${aiDraft}\n`);
    }
  } catch (err) {
    console.error("Error running outreach pipeline:", err);
    process.exit(1);
  }
}

runOutreachPipeline();
