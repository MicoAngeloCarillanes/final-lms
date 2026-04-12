import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ouhbvofuveketqavidll.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im91aGJ2b2Z1dmVrZXRxYXZpZGxsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyMTU5NzcsImV4cCI6MjA4ODc5MTk3N30.etPr5ig0hkqDtTmpZX8_qiGDCgQrlX9GLtxnlLEnRhM';
// IMPORTANT: Add this to your .env file
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im91aGJ2b2Z1dmVrZXRxYXZpZGxsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzIxNTk3NywiZXhwIjoyMDg4NzkxOTc3fQ.ixbzr1Pl_ZKup9vAyhnd26XktvruU-9Lee4N7CzPP2A';

// Regular client for normal user operations
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Admin client strictly for bypassing RLS (e.g., Invitations)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});