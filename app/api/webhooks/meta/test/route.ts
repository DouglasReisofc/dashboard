import { NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "lib/auth";
import { getMetaApiVersion } from "lib/meta";
import { getWebhookRowForUser } from "lib/webhooks";

const MAX_VERIFY_TOKEN = 128;
const MAX_APP_ID = 64;
const MAX_BUSINESS_ACCOUNT_ID = 64;
const MAX_PHONE_NUMBER_ID = 64;
const MAX_ACCESS_TOKEN = 4096;

const sanitizeString = (value: unknown, maxLength: number) => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed;
};

const buildMissingFieldsMessage = (fields: string[]) => {
  if (fields.length === 0) {
    return "";
  }

  if (fields.length === 1) {
    return `Preencha o campo ${fields[0]} antes de executar o teste.`;
  }

  const last = fields.at(-1);
  const rest = fields.slice(0, -1).join(", ");
  return `Preencha os campos ${rest} e ${last} antes de executar o teste.`;
};

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ message: "Não autenticado." }, { status: 401 });
    }

    const payload = await request.json().catch(() => null);
    const webhook = await getWebhookRowForUser(user.id);

    if (!webhook) {
      return NextResponse.json({ message: "Webhook não encontrado." }, { status: 404 });
    }

    const verifyToken =
      sanitizeString(payload?.verifyToken, MAX_VERIFY_TOKEN) ??
      sanitizeString(webhook.verify_token, MAX_VERIFY_TOKEN);
    const appId =
      sanitizeString(payload?.appId, MAX_APP_ID) ??
      sanitizeString(webhook.app_id, MAX_APP_ID);
    const businessAccountId =
      sanitizeString(payload?.businessAccountId, MAX_BUSINESS_ACCOUNT_ID) ??
      sanitizeString(webhook.business_account_id, MAX_BUSINESS_ACCOUNT_ID);
    const phoneNumberId =
      sanitizeString(payload?.phoneNumberId, MAX_PHONE_NUMBER_ID) ??
      sanitizeString(webhook.phone_number_id, MAX_PHONE_NUMBER_ID);
    const accessToken =
      sanitizeString(payload?.accessToken, MAX_ACCESS_TOKEN) ??
      sanitizeString(webhook.access_token, MAX_ACCESS_TOKEN);

    const missingFields: string[] = [];

    if (!verifyToken) {
      missingFields.push("Verify Token");
    }

    if (!appId) {
      missingFields.push("App ID");
    }

    if (!businessAccountId) {
      missingFields.push("WhatsApp Business Account ID");
    }

    if (!phoneNumberId) {
      missingFields.push("Phone Number ID");
    }

    if (!accessToken) {
      missingFields.push("Access Token");
    }

    if (missingFields.length) {
      return NextResponse.json(
        {
          message: buildMissingFieldsMessage(missingFields),
          missingFields,
        },
        { status: 400 },
      );
    }

    const version = getMetaApiVersion();
    const url = new URL(`https://graph.facebook.com/${version}/${phoneNumberId}`);
    url.searchParams.set("fields", "id,display_phone_number,verified_name");

    try {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const textPayload = await response.text().catch(() => "");
      let data: unknown = null;

      if (textPayload) {
        try {
          data = JSON.parse(textPayload);
        } catch (parseError) {
          console.error("Failed to parse Meta response during webhook test", parseError);
        }
      }

      if (!response.ok) {
        const errorMessage =
          typeof data === "object" && data && "error" in data
            ? (data as { error?: { message?: string } }).error?.message ?? null
            : null;

        return NextResponse.json(
          {
            message:
              errorMessage
                ? `A Meta retornou um erro ao validar a comunicação: ${errorMessage}`
                : "Não foi possível validar a comunicação com a Meta. Verifique os dados configurados.",
            details: data,
          },
          { status: response.status === 401 ? 401 : 502 },
        );
      }

      const displayNumber =
        typeof data === "object" && data && "display_phone_number" in data
          ? (data as { display_phone_number?: string | null }).display_phone_number ?? null
          : null;
      const verifiedName =
        typeof data === "object" && data && "verified_name" in data
          ? (data as { verified_name?: string | null }).verified_name ?? null
          : null;

      const messageParts = ["Comunicação validada com sucesso com a Meta Cloud API."];

      if (displayNumber) {
        messageParts.push(`Número configurado: ${displayNumber}.`);
      }

      if (verifiedName) {
        messageParts.push(`Nome verificado: ${verifiedName}.`);
      }

      let profilePictureUrl: string | null = null;
      let profileAbout: string | null = null;
      let profileEmail: string | null = null;
      let profileWebsite: string | null = null;
      let profileVertical: string | null = null;

      try {
        const profileUrl = new URL(
          `https://graph.facebook.com/${version}/${phoneNumberId}/profile`,
        );
        profileUrl.searchParams.set(
          "fields",
          "about,description,email,profile_picture_url,websites,vertical",
        );

        const profileResponse = await fetch(profileUrl, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (profileResponse.ok) {
          const profilePayload = await profileResponse.json().catch(() => null);

          const profileData = (() => {
            if (!profilePayload || typeof profilePayload !== "object") {
              return null;
            }

            if (Array.isArray((profilePayload as { data?: unknown }).data)) {
              const [first] = (profilePayload as { data?: unknown[] }).data ?? [];
              return typeof first === "object" && first ? first : null;
            }

            return profilePayload;
          })();

          if (profileData && typeof profileData === "object") {
            profilePictureUrl =
              "profile_picture_url" in profileData
                ? ((profileData as { profile_picture_url?: string | null }).profile_picture_url ?? null)
                : null;
            profileAbout =
              "about" in profileData
                ? ((profileData as { about?: string | null }).about ?? null)
                : "description" in profileData
                  ? ((profileData as { description?: string | null }).description ?? null)
                  : null;
            profileEmail =
              "email" in profileData
                ? ((profileData as { email?: string | null }).email ?? null)
                : null;

            if (
              "websites" in profileData &&
              Array.isArray((profileData as { websites?: unknown }).websites)
            ) {
              const [firstWebsite] = ((profileData as { websites?: unknown[] }).websites ?? []).filter(
                (value): value is string => typeof value === "string" && value.trim().length > 0,
              );
              profileWebsite = firstWebsite ?? null;
            }

            profileVertical =
              "vertical" in profileData
                ? ((profileData as { vertical?: string | null }).vertical ?? null)
                : null;
          }
        }
      } catch (profileError) {
        console.warn("Failed to fetch WhatsApp profile details during webhook test", profileError);
      }

      return NextResponse.json({
        message: messageParts.join(" "),
        phoneNumberId,
        businessAccountId,
        displayPhoneNumber: displayNumber,
        verifiedName,
        profile: {
          about: profileAbout,
          email: profileEmail,
          website: profileWebsite,
          vertical: profileVertical,
          profilePictureUrl,
        },
      });
    } catch (error) {
      console.error("Failed to validate webhook configuration", error);
      return NextResponse.json(
        {
          message: "Não foi possível conectar-se à Meta para validar o webhook.",
        },
        { status: 502 },
      );
    }
  } catch (error) {
    console.error("Failed to execute webhook test", error);
    return NextResponse.json(
      { message: "Não foi possível executar o teste do webhook." },
      { status: 500 },
    );
  }
}
