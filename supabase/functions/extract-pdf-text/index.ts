/**
 * AOMS: PDF Text Extraction Edge Function
 *
 * Extracts text from PDFs in Supabase Storage and stores page-by-page
 * in pdf_text_pages for full-text search.
 *
 * DEPLOYMENT:
 *   supabase functions deploy extract-pdf-text
 *
 * USAGE:
 *   POST /functions/v1/extract-pdf-text
 *   Body: { "fileName": "DAFI13-213.pdf" }   — single file
 *   Body: {} or { "extractAll": true }         — batch all unprocessed
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import pdfParse from "https://esm.sh/pdf-parse@1.1.1";

const BUCKET_NAME = "regulation-pdfs";

Deno.serve(async (req: Request) => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let fileNames: string[] = [];
    const body = await req.json().catch(() => ({}));

    if (body.fileName) {
      fileNames = [body.fileName];
    } else if (body.record?.name && body.record?.bucket_id === BUCKET_NAME) {
      fileNames = [body.record.name];
    } else {
      const { data: files } = await supabase.storage
        .from(BUCKET_NAME)
        .list("", { limit: 500, sortBy: { column: "name", order: "asc" } });

      if (files) {
        const pdfFiles = files
          .filter((f: { name?: string }) => f.name?.toLowerCase().endsWith(".pdf"))
          .map((f: { name: string }) => f.name);

        const { data: existing } = await supabase
          .from("pdf_extraction_status")
          .select("file_name")
          .eq("status", "complete");

        const done = new Set((existing || []).map((e: { file_name: string }) => e.file_name));
        fileNames = pdfFiles.filter((name: string) => !done.has(name));
      }
    }

    if (fileNames.length === 0) {
      return new Response(
        JSON.stringify({ message: "No files to process" }),
        { headers: { "Content-Type": "application/json" } },
      );
    }

    const results = [];

    for (const fileName of fileNames) {
      console.log(`Processing: ${fileName}`);

      await supabase.from("pdf_extraction_status").upsert({
        file_name: fileName,
        status: "extracting",
        error_message: null,
      });

      try {
        const { data: blob, error: dlError } = await supabase.storage
          .from(BUCKET_NAME)
          .download(fileName);

        if (dlError) throw new Error(`Download failed: ${dlError.message}`);

        const buffer = Buffer.from(await blob.arrayBuffer());
        const parsed = await pdfParse(buffer);

        const pageTexts: { page: number; text: string }[] = [];
        const rawPages = parsed.text.split("\f");

        if (rawPages.length > 1) {
          rawPages.forEach((text: string, i: number) => {
            if (text.trim()) {
              pageTexts.push({ page: i + 1, text: text.trim() });
            }
          });
        } else {
          pageTexts.push({ page: 1, text: parsed.text.trim() });
        }

        await supabase
          .from("pdf_text_pages")
          .delete()
          .eq("file_name", fileName);

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

        await supabase.from("pdf_extraction_status").upsert({
          file_name: fileName,
          total_pages: pageTexts.length,
          status: "complete",
          extracted_at: new Date().toISOString(),
          file_size: buffer.length,
          error_message: null,
        });

        results.push({ file: fileName, status: "complete", pages: pageTexts.length });
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
      JSON.stringify({ processed: results.length, results }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Function error:", msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
