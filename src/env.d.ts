/// <reference types="astro/client" />

type OpenAIModel =
    | 'text-davinci-003'
    | 'text-davinci-002'
    | 'text-davinci-001'
    | 'text-curie-001'
    | 'text-babbage-001'
    | 'text-ada-001'
    | 'davinci'
    | 'curie'
    | 'babbage'
    | 'ada'
    | 'code-davinci-002'
    | 'code-davinci-001'
    | 'code-cushman-002'
    | 'code-cushman-001'
    | 'davinci-codex'
    | 'cushman-codex'
    | 'text-davinci-edit-001'
    | 'code-davinci-edit-001'
    | 'text-embedding-ada-002'
    | 'text-similarity-davinci-001'
    | 'text-similarity-curie-001'
    | 'text-similarity-babbage-001'
    | 'text-similarity-ada-001'
    | 'text-search-davinci-doc-001'
    | 'text-search-curie-doc-001'
    | 'text-search-babbage-doc-001'
    | 'text-search-ada-doc-001'
    | 'code-search-babbage-code-001'
    | 'code-search-ada-code-001'
    | 'gpt2'
    | 'gpt-4'
    | 'gpt-4-32k'
    | 'gpt-3.5-turbo'
    | 'gpt-3.5-turbo-0301'

interface ImportMetaEnv {
  readonly OPENAI_API_KEY: string
  readonly HTTPS_PROXY: string
  readonly OPENAI_API_BASE_URL: string
  readonly HEAD_SCRIPTS: string
  readonly SECRET_KEY: string
  readonly SITE_PASSWORD: string
  readonly OPENAI_API_MODEL: OpenAIModel
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
