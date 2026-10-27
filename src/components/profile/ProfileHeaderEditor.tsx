"use client";

import { useState, useTransition, useRef } from "react";
import { getInitials } from "@/lib/initials";
import { updateProfileName, uploadAvatar } from "@/lib/profile-actions";

interface ProfileHeaderEditorProps {
  initialName: string;
  initialEmail: string;
  initialPhotoUrl: string | null;
}

export function ProfileHeaderEditor({
  initialName,
  initialEmail,
  initialPhotoUrl,
}: ProfileHeaderEditorProps) {
  const [name, setName] = useState(initialName);
  const [photoUrl, setPhotoUrl] = useState(initialPhotoUrl);
  const [isEditingName, setIsEditingName] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isPendingName, startNameTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setSuccessMsg(null);
    setIsUploadingPhoto(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await uploadAvatar(formData);
      if (res.error) {
        setError(res.error);
      } else if (res.avatarUrl) {
        setPhotoUrl(res.avatarUrl);
        setSuccessMsg("Profile photo compressed and updated!");
        setTimeout(() => setSuccessMsg(null), 4000);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to upload photo");
    } finally {
      setIsUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function handleSaveName(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setError(null);
    setSuccessMsg(null);

    startNameTransition(async () => {
      const res = await updateProfileName(name.trim());
      if (res.error) {
        setError(res.error);
      } else {
        setIsEditingName(false);
        setSuccessMsg("Name updated successfully!");
        setTimeout(() => setSuccessMsg(null), 4000);
      }
    });
  }

  return (
    <div className="mb-6">
      {error && (
        <div role="alert" className="mb-4 rounded-md bg-red-50 p-3 text-xs text-red-700 border border-red-200">
          {error}
        </div>
      )}
      {successMsg && (
        <div className="mb-4 rounded-md bg-emerald-50 p-3 text-xs text-emerald-700 border border-emerald-200">
          {successMsg}
        </div>
      )}

      <div className="flex items-center gap-4">
        {/* Photo Container */}
        <div className="relative group shrink-0">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploadingPhoto}
            className="relative block rounded-full focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
            title="Click to change profile picture"
          >
            {photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photoUrl}
                alt=""
                className="h-16 w-16 rounded-full object-cover border-2 border-neutral-200"
              />
            ) : (
              <div
                aria-hidden="true"
                className="font-display flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent-2 text-lg font-bold text-white shadow-sm"
              >
                {getInitials(name)}
              </div>
            )}

            {/* Camera Overlay Icon */}
            <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition text-white">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>

            {isUploadingPhoto && (
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/60 text-white">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              </div>
            )}
          </button>
        </div>

        {/* Identity & Name Details */}
        <div className="min-w-0 flex-1">
          {isEditingName ? (
            <form onSubmit={handleSaveName} className="flex items-center gap-2">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="rounded-md border border-neutral-300 px-2.5 py-1 text-sm font-bold text-neutral-900 focus:border-accent focus:outline-none"
                placeholder="Full name"
                required
                autoFocus
              />
              <button
                type="submit"
                disabled={isPendingName}
                className="rounded bg-accent px-2.5 py-1 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                {isPendingName ? "..." : "Save"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setName(initialName);
                  setIsEditingName(false);
                }}
                className="text-xs text-neutral-500 hover:text-neutral-800"
              >
                Cancel
              </button>
            </form>
          ) : (
            <div className="flex items-center gap-2">
              <h1 className="font-display truncate text-lg font-bold text-neutral-900">{name}</h1>
              <button
                type="button"
                onClick={() => setIsEditingName(true)}
                className="text-xs font-medium text-accent hover:underline shrink-0"
              >
                Edit
              </button>
            </div>
          )}
          <p className="truncate text-sm text-neutral-500">{initialEmail}</p>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploadingPhoto}
            className="text-[11px] text-accent font-medium hover:underline block mt-0.5"
          >
            {isUploadingPhoto ? "Compressing & uploading..." : "Change photo"}
          </button>
        </div>
      </div>
    </div>
  );
}

