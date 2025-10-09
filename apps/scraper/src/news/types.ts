export type NewsArticle = {
  id: string;
  title: string;
  content: string;
  summary?: string;
  source: string;
  author?: string;
  url: string;
  publishedAt: Date;
  scrapedAt: Date;
  symbols: string[];
  categories: string[];
  imageUrl?: string;
};

export type NewsSource = {
  name: string;
  baseUrl: string;
  enabled: boolean;
  scrape(limit: number): Promise<NewsArticle[]>;
};

export type NewsScraperConfig = {
  sources: NewsSource[];
  scrapeIntervalMs: number;
  articlesLimit: number;
};
