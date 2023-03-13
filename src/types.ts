export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  name?: string // should match /^[a-zA-Z0-9_-]{1,64}$/
  content: string
}
