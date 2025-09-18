export interface AdminSiteSettings {
  siteName: string;
  tagline: string | null;
  supportEmail: string | null;
  supportPhone: string | null;
  heroTitle: string | null;
  heroSubtitle: string | null;
  heroButtonLabel: string | null;
  heroButtonUrl: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  footerText: string | null;
  updatedAt: string | null;
}

export interface AdminSiteSettingsPayload {
  siteName: string;
  tagline: string | null;
  supportEmail: string | null;
  supportPhone: string | null;
  heroTitle: string | null;
  heroSubtitle: string | null;
  heroButtonLabel: string | null;
  heroButtonUrl: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  footerText: string | null;
}
