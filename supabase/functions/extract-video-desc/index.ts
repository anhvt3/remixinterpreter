import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_SIZE_MB = 5;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { videoUrl } = await req.json();
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured");
    if (!videoUrl) throw new Error("Video URL is required");

    // Check if GDrive link - not supported
    if (videoUrl.includes('drive.google.com')) {
      return new Response(JSON.stringify({ 
        error: "Google Drive links are not supported for extraction. Please use a CDN video URL." 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Download video
    console.log("Downloading video from:", videoUrl);
    const videoResponse = await fetch(videoUrl);
    if (!videoResponse.ok) throw new Error("Failed to download video");
    
    const videoBuffer = await videoResponse.arrayBuffer();
    
    // Check file size (5MB limit)
    if (videoBuffer.byteLength > MAX_SIZE_BYTES) {
      const actualSizeMB = (videoBuffer.byteLength / (1024 * 1024)).toFixed(2);
      return new Response(JSON.stringify({ 
        error: `Video file is too large (${actualSizeMB}MB). Maximum size is ${MAX_SIZE_MB}MB.` 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Video size: ${(videoBuffer.byteLength / (1024 * 1024)).toFixed(2)}MB`);

    // Convert to base64
    const base64Video = btoa(
      new Uint8Array(videoBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
    );

    // Prepare prompt
    const prompt = `Extract the vector animation script from this video. Make sure it is as detailed as possible so it can be used to re-generate exactly the same video with JSXGraph. Remember to have 3 parts:

1) What this script recreates (scene breakdown)
2) Full JSXGraph HTML + JS (copy-paste runnable)
3) Notes on "exactness" vs JSXGraph constraints`;

    console.log("Calling Gemini API...");

    // Call Gemini API
    const geminiResponse = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:generateContent",
      {
        method: "POST",
        headers: {
          "x-goog-api-key": GEMINI_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              { inline_data: { mime_type: "video/mp4", data: base64Video } }
            ]
          }]
        }),
      }
    );

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error("Gemini API error:", geminiResponse.status, errorText);
      throw new Error(`Gemini API error: ${geminiResponse.status}`);
    }

    const result = await geminiResponse.json();
    const extractedText = result.candidates?.[0]?.content?.parts?.[0]?.text || "";

    console.log("Extraction successful, text length:", extractedText.length);

    return new Response(JSON.stringify({ description: extractedText }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
