"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { compressImage } from "@/lib/tinify";

export interface ProfileUpdateResult {
  error: string | null;
  avatarUrl?: string | null;
  fullName?: string | null;
}

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB input limit before compression

/**
 * Updates the user's display / full name in their profile.
 */
export async function updateProfileName(fullName: string): Promise<ProfileUpdateResult> {
  const trimmed = fullName.trim();
  if (!trimmed) {
    return { error: "Please enter your full name." };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in to update your profile." };
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ full_name: trimmed })
    .eq("id", user.id);

  if (profileError) {
    console.error("Failed to update profile name:", profileError.message);
    return { error: profileError.message };
  }

  // Also keep user metadata in sync
  await supabase.auth.updateUser({ data: { full_name: trimmed } });

  revalidatePath("/", "layout");
  revalidatePath("/profile");
  return { error: null, fullName: trimmed };
}

/**
 * Compresses an uploaded avatar image with Tinify and stores it in Supabase Storage.
 */
export async function uploadAvatar(formData: FormData): Promise<ProfileUpdateResult> {
  const file = formData.get("file") as File | null;
  if (!file) {
    return { error: "No image file provided." };
  }

  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return { error: "Unsupported image format. Please upload a JPEG, PNG, or WebP." };
  }

  if (file.size > MAX_FILE_SIZE) {
    return { error: "File exceeds 10MB limit. Please choose a smaller image." };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in to upload a profile photo." };
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const originalBuffer = Buffer.from(arrayBuffer);

    // Compress with Tinify
    const { buffer: compressedBuffer } = await compressImage(originalBuffer, file.type);

    const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const filePath = `${user.id}/avatar-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(filePath, compressedBuffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error("Failed to upload avatar to Supabase Storage:", uploadError.message);
      return { error: uploadError.message };
    }

    const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(filePath);

    // Save avatar URL in public.profiles
    const { error: dbError } = await supabase
      .from("profiles")
      .update({ avatar_url: publicUrl })
      .eq("id", user.id);

    if (dbError) {
      console.error("Failed to save avatar URL to profile:", dbError.message);
      return { error: dbError.message };
    }

    // Keep user_metadata synchronized
    await supabase.auth.updateUser({ data: { avatar_url: publicUrl } });

    revalidatePath("/", "layout");
    revalidatePath("/profile");
    return { error: null, avatarUrl: publicUrl };
  } catch (err: unknown) {
    console.error("Avatar upload error:", err);
    const msg = err instanceof Error ? err.message : "Failed to process and upload image";
    return { error: msg };
  }
}
