/**
 * ═══════════════════════════════════════════════════════════════
 * AOMS: PDF Text Extraction Edge Function
 * ═══════════════════════════════════════════════════════════════
 * 
 * Extracts text from a PDF in Supabase Storage and stores it
 * page-by-page in the pdf_text_pages table for full-text search.
 *
 * DEPLOYMENT:
 *   supabase functions new extract-pdf-text
 *   (copy this file to supabase/functions/extract-pdf-text/index.ts)
 *   supabase functions deploy extract-pdf-text
 *
 * TRIGGER OPTIONS:
 *   A) Manual — call from your app after upload:
 *      POST /functions/v1/extract-pdf-text
 *      Body: { "fileName": "DAFI13-213.pdf" }
 *
 *   B) Automatic — set up a Database Webhook in Supabase Dashboard:
 *      Table: storage.objects | Event: INSERT | Endpoint: this function URL
 *
 *   C) Batch — call with no body to extract ALL unprocessed PDFs
 *      POST /functions/v1/extract-pdf-text
 *      Body: {} or { "extractAll": true }
 *
 * DEPENDENCIES:
 *   This uses pdf-parse which works in Deno via npm: specifier.
 *   If pdf-parse doesn't work in your Edge Function runtime,
 *   see the alternative approach at the bottom of this file.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BUCKET_NAME = "regulations-pdf";

// pdf-parse for Deno — extracts text from PDF buffers
// If this import fails in your runtime, use the alternative at bottom
import pdfParse from "https://esm.sh/pdf-parse@1.1.1";

Deno.serve(async (req: Request) => {
  try {
    // Auth: use service role for storage + DB access
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let fileNames: string[] = [];

    // Determine which file(s) to process
    const body = await req.json().catch(() => ({}));

    if (body.fileName) {
      // Single file extraction
      fileNames = [body.fileName];
    } else if (body.record?.name && body.record?.bucket_id === BUCKET_NAME) {
      // Database webhook trigger (storage.objects INSERT)
      fileNames = [body.record.name];
    } else {
      // Batch: find all PDFs not yet extracted
      const { data: files } = await supabase.storage
        .from(BUCKET_NAME)
        .list("", { limit: 500, sortBy: { column: "name", order: "asc" } });

      if (files) {
        const pdfFiles = files
          .filter((f) => f.name?.toLowerCase().endsWith(".pdf"))
          .map((f) => f.name);

        // Check which ones are already extracted
        const { data: existing } = await supabase
          .from("pdf_extraction_status")
          .select("file_name")
          .eq("status", "complete");

        const done = new Set((existing || []).map((e) => e.file_name));
        fileNames = pdfFiles.filter((name) => !done.has(name));
      }
    }

    if (fileNames.length === 0) {
      return new Response(
        JSON.stringify({ message: "No files to process" }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    const results = [];

    for (const fileName of fileNames) {
      console.log(`Processing: ${fileName}`);

      // Mark as extracting
      await supabase.from("pdf_extraction_status").upsert({
        file_name: fileName,
        status: "extracting",
        error_message: null,
      });

      try {
        // Download PDF from storage
        const { data: blob, error: dlError } = await supabase.storage
          .from(BUCKET_NAME)
          .download(fileName);

        if (dlError) throw new Error(`Download failed: ${dlError.message}`);

        // Convert to buffer for pdf-parse
        const buffer = Buffer.from(await blob.arrayBuffer());

        // Extract text
        const parsed = await pdfParse(buffer);
        
        // pdf-parse gives us the full text but not per-page.
        // For per-page extraction, we split on form feeds or use
        // the numpages info. pdf-parse v1.1.1 provides parsed.text
        // as the full document. For page-level granularity, we use
        // the raw page data:
        
        const pageTexts: { page: number; text: string }[] = [];
        
        // pdf-parse exposes a pagerender callback, but for simplicity
        // and reliability, we'll use the raw text and split intelligently.
        // If the PDF has form feed characters (\f), those mark page breaks:
        const rawPages = parsed.text.split("\f");
        
        if (rawPages.length > 1) {
          // Form feed separated — most common for well-structured PDFs
          rawPages.forEach((text, i) => {
            if (text.trim()) {
              pageTexts.push({ page: i + 1, text: text.trim() });
            }
          });
        } else {
          // Single block — store as one page entry, still searchable
          pageTexts.push({ page: 1, text: parsed.text.trim() });
        }

        // Delete any existing rows for this file (re-extraction)
        await supabase
          .from("pdf_text_pages")
          .delete()
          .eq("file_name", fileName);

        // Insert page rows in batches of 50
        for (let i = 0; i < pageTexts.length; i += 50) {
          const batch = pageTexts.slice(i, i + 50).map((pt) => ({
            file_name: fileName,
            page_number: pt.page,
            text_content: pt.text,
          }));

          const { error: insertError } = await supabase
            .from("pdf_text_pages")
            .insert(batch);

          if (insertError) {
            console.error(`Insert batch error for ${fileName}:`, insertError);
          }
        }

        // Update status
        await supabase.from("pdf_extraction_status").upsert({
          file_name: fileName,
          total_pages: pageTexts.length,
          status: "complete",
          extracted_at: new Date().toISOString(),
          file_size: buffer.length,
          error_message: null,
        });

        results.push({
          file: fileName,
          status: "complete",
          pages: pageTexts.length,
        });

        console.log(`Done: ${fileName} — ${pageTexts.length} pages`);
      } catch (fileError) {
        const msg = fileError instanceof Error ? fileError.message : String(fileError);
        console.error(`Failed: ${fileName} — ${msg}`);

        await supabase.from("pdf_extraction_status").upsert({
          file_name: fileName,
          status: "failed",
          error_message: msg,
        });

        results.push({ file: fileName, status: "failed", error: msg });
      }
    }

    return new Response(
      JSON.stringify({
        processed: results.length,
        results,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Function error:", msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});

/**
 * ═══════════════════════════════════════════════════════════════
 * ALTERNATIVE: If pdf-parse doesn't work in Deno Edge Functions,
 * extract text client-side and POST it to a simpler function.
 * ═══════════════════════════════════════════════════════════════
 *
 * Client extracts with PDF.js (which you already have), then
 * sends the text to Supabase. This is actually a solid pattern
 * because PDF.js handles more edge cases than pdf-parse:
 *
 * // In your Next.js app:
 * async function extractAndUpload(fileName, uint8Array) {
 *   const pages = await extractAllText(uint8Array); // your existing fn
 *   await supabase.from('pdf_text_pages').upsert(
 *     pages.map(p => ({
 *       file_name: fileName,
 *       page_number: p.page,
 *       text_content: p.text,
 *     })),
 *     { onConflict: 'file_name,page_number' }
 *   );
 *   await supabase.from('pdf_extraction_status').upsert({
 *     file_name: fileName,
 *     total_pages: pages.length,
 *     status: 'complete',
 *     extracted_at: new Date().toISOString(),
 *   });
 * }
 *
 * This approach has the advantage of:
 * - Using the same PDF.js engine as your viewer (consistent results)
 * - No Edge Function dependency issues
 * - Works even if Edge Functions aren't available
 * - Per-page extraction is guaranteed accurate (vs form-feed splitting)
 *
 * The downside is it requires a client to be online to trigger it.
 */
