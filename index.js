import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  'https://lrzfzeitcjhygmyzvkqy.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxyemZ6ZWl0Y2poeWdteXp2a3F5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgzMDMxOTUsImV4cCI6MjEwMzg3OTE5NX0.qo33ZN5UpJeN6PC0P5VPVp5eqOqZZQuXXsFnoiDmrnY'
);

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

      // Updated model reference as suggested by the API response
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
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
  }
}

runOutreachPipeline();