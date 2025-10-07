export type User = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  role: string;
  image?: string;
  createdAt: string;
  updatedAt: string;
  _count: {
    portfolios: number;
    orders: number;
    exchangeCredentials: number;
  };
};
