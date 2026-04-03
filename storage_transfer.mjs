import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

// Old DB Credentials (from .env)
const OLD_URL = "https://hyvxwlwttzxzrkfolivo.supabase.co";
const OLD_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh5dnh3bHd0dHp4enJrZm9saXZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc0OTY5ODIsImV4cCI6MjA4MzA3Mjk4Mn0.hNQmGCpoO_SUfzWRJ4PMLnAc11zEYUyAJGISjWOkahQ";

// New DB Credentials
const NEW_URL = "https://lysjdtyanhdfphqyijsr.supabase.co";
const NEW_SERVICE_ROLE = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx5c2pkdHlhbmhkZnBocXlpanNyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mjg1NTEwNiwiZXhwIjoyMDg4NDMxMTA2fQ.68R5Yiz8wOyWvtDy5bt263C-d6pSykMkDC2YAt0Og_E";

const OLD_JWT = "eyJhbGciOiJFUzI1NiIsImtpZCI6IjM5ZjllMmIyLWNkNjYtNDYzNi1iYmIyLTg1NTk0OWQwOTMwOSIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL2h5dnh3bHd0dHp4enJrZm9saXZvLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiIwNjA0YjZmNS1hZTIyLTQ0NGMtYjgzMy01MTkxOTIxMDU3OTkiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzc1MTE3NzI0LCJpYXQiOjE3NzUxMTQxMjQsImVtYWlsIjoiYXNyYmVrQGhhbmd1ay5sb2NhbCIsInBob25lIjoiIiwiYXBwX21ldGFkYXRhIjp7InByb3ZpZGVyIjoiZW1haWwiLCJwcm92aWRlcnMiOlsiZW1haWwiXX0sInVzZXJfbWV0YWRhdGEiOnsiZW1haWwiOiJhc3JiZWtAaGFuZ3VrLmxvY2FsIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsImZ1bGxfbmFtZSI6IkFzcmJlayIsInBob25lX3ZlcmlmaWVkIjpmYWxzZSwicHJlZmVycmVkX2xhbmd1YWdlIjoidXoiLCJzdWIiOiIwNjA0YjZmNS1hZTIyLTQ0NGMtYjgzMy01MTkxOTIxMDU3OTkiLCJ1c2VybmFtZSI6ImFzcmJlayJ9LCJyb2xlIjoiYXV0aGVudGljYXRlZCIsImFhbCI6ImFhbDEiLCJhbXIiOlt7Im1ldGhvZCI6InBhc3N3b3JkIiwidGltZXN0YW1wIjoxNzc1MTEwNjA4fV0sInNlc3Npb25faWQiOiI3OTY1NTAxMy04MmE1LTQ2NmItYTNjZi1hZjc0ZTQ3MDUyNmMiLCJpc19hbm9ueW1vdXMiOmZhbHNlfQ.PjOpf97brOo_6xW4blYNj1MRoIrr7nx3m1kNPRP8tP5X73IQXxnygYd6wiXXu3H6uPI2l5L6ASiA5PDTnI0uRA";

async function run() {
  console.log("Initializing Supabase Clients...");
  const oldClient = createClient(OLD_URL, OLD_ANON, { global: { headers: { Authorization: `Bearer ${OLD_JWT}` } } });
  const newClient = createClient(NEW_URL, NEW_SERVICE_ROLE);

  try {
    console.log("Using live JWT token for Old Database to bypass Storage RLS...");

    // Try to ensure the bucket exists on the new side.
    const { data: listData } = await newClient.storage.listBuckets();
    const hasBucket = listData?.some(b => b.name === 'student-documents');
    if (!hasBucket) {
      console.log("Creating 'student-documents' bucket on new database...");
      await newClient.storage.createBucket('student-documents', { public: false });
    }

    console.log("Reading legacy export data...");
    const data = JSON.parse(fs.readFileSync('legacy_export_v2.json', 'utf8'));
    const documents = data.documents || [];
    
    console.log(`Found ${documents.length} database document rows to process.`);
    
    let success = 0;
    let failed = 0;

    for (let i = 0; i < documents.length; i++) {
        const filePath = documents[i].file_path;
        if (!filePath) continue;
        
        console.log(`[${i+1}/${documents.length}] Transferring: ${filePath}`);
        
        try {
            // Download from Old
            const { data: fileData, error: dlError } = await oldClient.storage.from('student-documents').download(filePath);
            
            if (dlError || !fileData) {
                console.error(`  -> Failed to download ${filePath}: `, dlError?.message || 'No data');
                failed++;
                continue;
            }

            // Convert blob to arrayBuffer to pass into upload correctly
            const arrayBuffer = await fileData.arrayBuffer();
            
            // Upload to New
            const { error: ulError } = await newClient.storage.from('student-documents').upload(filePath, arrayBuffer, {
                contentType: documents[i].file_type || fileData.type,
                upsert: true
            });

            if (ulError) {
                console.error(`  -> Failed to upload ${filePath}: `, ulError.message);
                failed++;
            } else {
                success++;
            }

        } catch (e) {
            console.error(`  -> Exception on ${filePath}: `, e.message);
            failed++;
        }
    }

    console.log(`\nSTORAGE TRANSFER COMPLETE! Successfully migrated ${success} files. Failed: ${failed}.`);

  } catch (err) {
    console.error("Critical Failure:", err);
  }
}

run();
