export type AdminUserSummary = {
  id: number;
  name: string;
  email: string;
  role: "admin" | "user";
  isActive: boolean;
  balance: number;
  whatsappNumber: string | null;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
  activeSessions: number;
  lastSessionAt: string | null;
};

export type UserMetrics = {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  activeSessions: number;
};
