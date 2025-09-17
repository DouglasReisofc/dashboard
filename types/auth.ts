export type SessionUser = {
  id: number;
  name: string;
  email: string;
  role: "admin" | "user";
  isActive: boolean;
};
