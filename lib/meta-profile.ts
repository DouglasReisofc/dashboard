import { getMetaApiVersion } from "./meta";
import { normalizeMetaProfileVertical } from "./meta-profile-verticals";
import type { UserWebhookRow } from "./db";
import type { MetaBusinessProfile } from "types/meta";

const PROFILE_FIELDS = [
  "about",
  "address",
  "description",
  "email",
  "profile_picture_url",
  "vertical",
  "websites",
] as const;

export const fetchMetaBusinessProfile = async (
  webhook: UserWebhookRow | null,
): Promise<MetaBusinessProfile | null> => {
  if (!webhook?.access_token || !webhook.phone_number_id) {
    return null;
  }

  const version = getMetaApiVersion();
  const url = new URL(
    `https://graph.facebook.com/${version}/${webhook.phone_number_id}/whatsapp_business_profile`,
  );
  url.searchParams.set("fields", PROFILE_FIELDS.join(","));

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${webhook.access_token}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      console.error(
        `[Meta Profile] Failed to fetch profile: ${response.status} ${response.statusText}`,
        errorText,
      );
      return null;
    }

    const payload = (await response.json().catch(() => null)) as
      | {
          data?: Array<Record<string, unknown>>;
          whatsapp_business_profile?: Record<string, unknown> | null;
        }
      | (Record<string, unknown> & { data?: unknown; whatsapp_business_profile?: unknown })
      | null;

    if (!payload || typeof payload !== "object") {
      return null;
    }

    let data: Record<string, unknown> | null = null;

    if (
      "whatsapp_business_profile" in payload &&
      payload.whatsapp_business_profile &&
      typeof payload.whatsapp_business_profile === "object"
    ) {
      data = payload.whatsapp_business_profile as Record<string, unknown>;
    } else if (Array.isArray(payload.data) && payload.data.length > 0) {
      data = payload.data[0] ?? null;
    } else if (!("data" in payload) && !("whatsapp_business_profile" in payload)) {
      data = payload as Record<string, unknown>;
    }

    if (!data) {
      return null;
    }

    const toNullableString = (value: unknown): string | null => {
      if (typeof value !== "string") {
        return null;
      }

      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    };

    const websites = Array.isArray(data.websites)
      ? data.websites
          .filter((item): item is string => typeof item === "string")
          .map((item) => item.trim())
          .filter((item) => item.length > 0)
      : [];

    return {
      about: toNullableString(data.about),
      address: toNullableString(data.address),
      description: toNullableString(data.description),
      email: toNullableString(data.email),
      profilePictureUrl: toNullableString(data.profile_picture_url),
      vertical: normalizeMetaProfileVertical(data.vertical) ?? null,
      websites,
    } satisfies MetaBusinessProfile;
  } catch (error) {
    console.error("[Meta Profile] Unexpected error while fetching profile", error);
    return null;
  }
};

export const updateMetaBusinessProfile = async (
  webhook: UserWebhookRow,
  payload: {
    about?: string;
    address?: string;
    description?: string;
    email?: string;
    vertical?: string;
    websites?: string[];
  },
): Promise<boolean> => {
  if (!webhook.access_token || !webhook.phone_number_id) {
    return false;
  }

  const version = getMetaApiVersion();
  const url = `https://graph.facebook.com/${version}/${webhook.phone_number_id}/whatsapp_business_profile`;

  const body: Record<string, unknown> = {
    messaging_product: "whatsapp",
  };

  if (typeof payload.about === "string") {
    body.about = payload.about;
  }

  if (typeof payload.address === "string") {
    body.address = payload.address;
  }

  if (typeof payload.description === "string") {
    body.description = payload.description;
  }

  if (typeof payload.email === "string") {
    body.email = payload.email;
  }

  if (typeof payload.vertical === "string") {
    body.vertical = payload.vertical;
  }

  if (Array.isArray(payload.websites)) {
    body.websites = payload.websites;
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${webhook.access_token}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      console.error(
        `[Meta Profile] Failed to update profile: ${response.status} ${response.statusText}`,
        errorText,
      );
      return false;
    }

    return true;
  } catch (error) {
    console.error("[Meta Profile] Unexpected error while updating profile", error);
    return false;
  }
};

const resolveProfileUploadFilename = (file: File) => {
  const rawName = file.name?.trim();
  const extensionFromType = file.type?.split("/")[1]?.replace(/[^a-zA-Z0-9]/g, "");
  const defaultExtension = extensionFromType ? `.${extensionFromType}` : ".jpg";

  if (rawName) {
    const parts = rawName.split(".");
    const base = parts.slice(0, -1).join(".") || parts[0];
    const rawExtension = parts.length > 1 ? parts.at(-1) ?? "" : "";
    const sanitizedExtension = rawExtension.replace(/[^a-zA-Z0-9]/g, "");
    const extension = sanitizedExtension ? `.${sanitizedExtension}` : defaultExtension;

    const sanitizedBase = base.replace(/[^a-zA-Z0-9_-]/g, "");

    if (sanitizedBase.length > 0) {
      return `${sanitizedBase}${extension}`;
    }
  }

  return `profile-${Date.now()}${defaultExtension}`;
};

export const uploadMetaProfilePicture = async (
  webhook: UserWebhookRow,
  file: File,
): Promise<string | null> => {
  if (!webhook.access_token || !webhook.phone_number_id) {
    return null;
  }

  const version = getMetaApiVersion();
  const url = `https://graph.facebook.com/${version}/${webhook.phone_number_id}/media`;

  try {
    const arrayBuffer = await file.arrayBuffer();
    const contentType = file.type?.trim() || "image/jpeg";
    const filename = resolveProfileUploadFilename(file);
    const formData = new FormData();
    const blob = new Blob([arrayBuffer], { type: contentType });

    formData.append("file", blob, filename);
    formData.append("type", contentType);
    formData.append("messaging_product", "whatsapp");

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${webhook.access_token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      console.error(
        `[Meta Profile] Failed to upload profile picture: ${response.status} ${response.statusText}`,
        errorText,
      );
      return null;
    }

    const data = (await response.json().catch(() => null)) as
      | { id?: unknown }
      | null;

    const handle = typeof data?.id === "string" ? data.id.trim() : "";

    if (!handle) {
      console.error("[Meta Profile] Invalid upload response", data);
      return null;
    }

    return handle;
  } catch (error) {
    console.error("[Meta Profile] Unexpected error while uploading profile picture", error);
    return null;
  }
};

export const updateMetaProfilePictureHandle = async (
  webhook: UserWebhookRow,
  profilePictureHandle: string,
): Promise<boolean> => {
  if (!webhook.access_token || !webhook.phone_number_id) {
    return false;
  }

  const trimmedHandle = profilePictureHandle.trim();

  if (!trimmedHandle) {
    return false;
  }

  const version = getMetaApiVersion();
  const url = `https://graph.facebook.com/${version}/${webhook.phone_number_id}/whatsapp_business_profile`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${webhook.access_token}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        profile_picture_handle: trimmedHandle,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      console.error(
        `[Meta Profile] Failed to set profile picture: ${response.status} ${response.statusText}`,
        errorText,
      );
      return false;
    }

    return true;
  } catch (error) {
    console.error("[Meta Profile] Unexpected error while setting profile picture", error);
    return false;
  }
};

export const removeMetaProfilePicture = async (
  webhook: UserWebhookRow,
): Promise<boolean> => {
  if (!webhook.access_token || !webhook.phone_number_id) {
    return false;
  }

  const version = getMetaApiVersion();
  const url = new URL(
    `https://graph.facebook.com/${version}/${webhook.phone_number_id}/whatsapp_business_profile/photo`,
  );
  url.searchParams.set("messaging_product", "whatsapp");

  try {
    const response = await fetch(url, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${webhook.access_token}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      console.error(
        `[Meta Profile] Failed to delete profile picture: ${response.status} ${response.statusText}`,
        errorText,
      );
      return false;
    }

    return true;
  } catch (error) {
    console.error("[Meta Profile] Unexpected error while deleting profile picture", error);
    return false;
  }
};
