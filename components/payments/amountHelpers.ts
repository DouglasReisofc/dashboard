export const formatAmount = (value: number) =>
  value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export const parseAmountText = (value: string): number[] => {
  if (!value.trim()) {
    return [];
  }

  const tokens = value
    .split(/[\n,;]/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);

  const numbers = tokens
    .map((token) => {
      const normalized = token.replace(/[^0-9,.-]/g, "");
      const usesComma = normalized.includes(",");
      const sanitized = usesComma
        ? normalized.replace(/\./g, "").replace(/,/g, ".")
        : normalized;
      const parsed = Number.parseFloat(sanitized);
      return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : null;
    })
    .filter(
      (entry): entry is number =>
        typeof entry === "number" && Number.isFinite(entry) && entry > 0,
    );

  const unique = Array.from(new Set(numbers));
  return unique.sort((a, b) => a - b);
};
