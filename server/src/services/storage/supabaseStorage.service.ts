import { randomUUID } from "crypto";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { env } from "../../config/env";
import { AppError } from "../../errors/AppError";

let cachedClient: SupabaseClient | null = null;

export const isObjectStorageConfigured = (): boolean =>
  Boolean(env.supabaseStorage.url && env.supabaseStorage.serviceKey && env.supabaseStorage.attachmentsBucket);

const getClient = (): SupabaseClient => {
  if (!isObjectStorageConfigured()) {
    throw new AppError(
      "Object storage is not configured. Set SUPABASE_URL, SUPABASE_SECRET_KEY and SUPABASE_ATTACHMENTS_BUCKET " +
        "on the server so new attachment uploads can be stored in Supabase Storage.",
      503
    );
  }
  if (!cachedClient) {
    // Service-role key — server-side only. Bypasses bucket RLS, so the bucket
    // itself can (and should) stay private; access is gated by our own auth checks.
    cachedClient = createClient(env.supabaseStorage.url as string, env.supabaseStorage.serviceKey as string, {
      auth: { persistSession: false },
    });
  }
  return cachedClient;
};

const getBucket = (): string => env.supabaseStorage.attachmentsBucket as string;

// Strips path separators, ".." segments, and any character outside a safe allowlist so
// a crafted fileName (e.g. "../../etc/passwd") cannot escape the task-scoped prefix
// or be interpreted as a directory traversal by the storage backend.
const sanitizeFileNameForKey = (fileName: string): string => {
  const base = fileName.split(/[\\/]/).pop() ?? fileName;
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/^\.+/, "");
  return cleaned.slice(-150) || "file";
};

const sanitizeTaskIdForKey = (taskId: string): string => taskId.replace(/[^a-zA-Z0-9_-]/g, "");

export const buildAttachmentObjectKey = (taskId: string, fileName: string): string => {
  const safeTaskId = sanitizeTaskIdForKey(taskId);
  const safeFileName = sanitizeFileNameForKey(fileName);
  return `tasks/${safeTaskId}/${randomUUID()}-${safeFileName}`;
};

export const uploadAttachmentObject = async (
  objectKey: string,
  buffer: Buffer,
  mimeType: string
): Promise<void> => {
  const client = getClient();
  const { error } = await client.storage.from(getBucket()).upload(objectKey, buffer, {
    contentType: mimeType,
    upsert: false,
  });
  if (error) {
    throw new AppError(`Failed to upload attachment to object storage: ${error.message}`, 502);
  }
};

export const downloadAttachmentObject = async (objectKey: string): Promise<Buffer> => {
  const client = getClient();
  const { data, error } = await client.storage.from(getBucket()).download(objectKey);
  if (error || !data) {
    throw new AppError(`Failed to download attachment from object storage: ${error?.message ?? "not found"}`, 502);
  }
  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
};

// Returns normally on success. Throws AppError on failure — callers must NOT delete
// the corresponding DB row when this throws, or the storage object becomes orphaned
// with nothing left pointing at it for later cleanup.
export const deleteAttachmentObject = async (objectKey: string): Promise<void> => {
  const client = getClient();
  const { error } = await client.storage.from(getBucket()).remove([objectKey]);
  if (error) {
    throw new AppError(`Failed to delete attachment from object storage: ${error.message}`, 502);
  }
};
