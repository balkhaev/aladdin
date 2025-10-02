export interface Tweet {
  text: string
  datetime: string | null
  url: string | null
  id: string | null
  username: string | null
  displayName: string | null
  replies: number
  retweets: number
  likes: number
}
