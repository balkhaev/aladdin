/**
 * Reddit Types
 */

export type RedditPost = {
  id: string;
  title: string;
  text: string;
  author: string;
  subreddit: string;
  score: number; // upvotes - downvotes
  upvoteRatio: number; // 0-1
  numComments: number;
  created: number; // Unix timestamp
  url: string;
  flair?: string | null;
  isStickied: boolean;
  isLocked: boolean;
};

export type RedditComment = {
  id: string;
  author: string;
  text: string;
  score: number;
  created: number; // Unix timestamp
  postId: string;
  parentId?: string | null;
  isSubmitter: boolean;
  depth: number;
};

export type RedditSearchResult = {
  posts: RedditPost[];
  totalFound: number;
  searchQuery: string;
  timestamp: number;
};

export type RedditSubredditConfig = {
  name: string;
  enabled: boolean;
  cryptoRelevance: number; // 0-1, насколько релевантен для крипто-контента
  weight: number; // Вес для sentiment aggregation
};

