import { supabase } from "../supabaseClient";

/**
 * Upload a File object to the given Supabase Storage bucket.
 * Returns the public URL of the uploaded file.
 *
 * Requires two buckets created in Supabase dashboard → Storage:
 *   "submissions" — student work uploads  (Public)
 *   "materials"   — teacher attachments   (Public)
 */
export async function uploadFileToStorage(bucket, storagePath, file) {
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(storagePath, file, {
      upsert:      true,
      contentType: file.type || "application/octet-stream",
    });
  if (error) throw new Error(error.message);
  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path);
  return urlData.publicUrl;
}
