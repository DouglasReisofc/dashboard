export type PhoneCountry = {
  code: string;
  label: string;
  dialCode: string;
};

export const PHONE_COUNTRIES: PhoneCountry[] = [
  { code: "BR", label: "Brasil", dialCode: "+55" },
  { code: "PT", label: "Portugal", dialCode: "+351" },
  { code: "US", label: "Estados Unidos", dialCode: "+1" },
  { code: "ES", label: "Espanha", dialCode: "+34" },
  { code: "MX", label: "México", dialCode: "+52" },
  { code: "AR", label: "Argentina", dialCode: "+54" },
];

export const findCountryByDialCode = (dialCode: string): PhoneCountry | null => {
  const normalized = dialCode.trim();
  if (!normalized) {
    return null;
  }
  return PHONE_COUNTRIES.find((country) => country.dialCode === normalized) ?? null;
};
