import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL  = 'https://ouhbvofuveketqavidll.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im91aGJ2b2Z1dmVrZXRxYXZpZGxsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyMTU5NzcsImV4cCI6MjA4ODc5MTk3N30.etPr5ig0hkqDtTmpZX8_qiGDCgQrlX9GLtxnlLEnRhM';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);