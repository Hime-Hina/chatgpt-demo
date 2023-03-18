import { encoding_for_model, init } from '@dqbd/tiktoken/init'
import {
  Show,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
  splitProps,
} from 'solid-js'
import type { Component } from 'solid-js'
import type { ChatMessage } from '@/types'
import type { Tiktoken, TiktokenModel } from '@dqbd/tiktoken'

const model: TiktokenModel
  = import.meta.env.OPENAI_API_MODEL || 'gpt-3.5-turbo'

// The code how to count tokens is from
// https://github.com/openai/openai-cookbook/blob/main/examples/How_to_count_tokens_with_tiktoken.ipynb
// Just rewrote it in TypeScript. The result of this function may be only a approximation in the future.
// also refer to https://github.com/openai/openai-python/blob/main/chatml.md
const countTokensSingleMessage = (
  tiktoken: Tiktoken,
  message?: ChatMessage,
) => {
  if (message === undefined) return 0

  let num = 0
  // every message follows <im_start>{role/name}\n{content}<im_end>\n
  // That is, there are always 4 tokens <im_start>, \n, <im_end>, \n.
  num += 4
  num += 1 // tiktoken.encode(message.role).length === 1, role is always required and always 1 token
  num += tiktoken.encode(message.content).length
  if (message.name !== undefined) {
    num += tiktoken.encode(message.name).length
    num -= 1 // if there's a name, the role is omitted.
  }

  return num
}

const getTokensUsage = (tiktoken: Tiktoken, messages: ChatMessage[]) => {
  if (messages.length === 0)
    return { completion_tokens: 0, prompt_tokens: 0, total_tokens: 0 }

  const isCompleted = messages[messages.length - 1].role === 'assistant'
  const completion = isCompleted ? messages.slice(-1)[0] : undefined
  const prompts = isCompleted ? messages.slice(0, -1) : messages

  const countTokens: (message?: ChatMessage) => number
    = countTokensSingleMessage.bind(null, tiktoken)
  // sum the number of tokens in each prompt.
  // every prompt is primed with a extra <im_start>assistant, so we add 2.
  const prompt_num = prompts.map(countTokens).reduce((a, b) => a + b, 0) + 2
  // countTokens always adds 4 for <im_start>, \n, <im_end>, \n and adds 1 for the role.
  // But <im_start>assistant is not part of the completion,
  // and it seems that <im_end>\n is not part of the completion either.
  // Somtimes the first \n is considered as part of the completion content, sometimes not,
  // So we subtract 4 for those tokens: <im_start>, assistant, <im_end>, the last \n.
  // The tokens of the completion seems equal to the number of tokens in the completion content.
  const completion_num = countTokens(completion) - (isCompleted ? 4 : 0)

  return {
    completion_tokens: completion_num,
    prompt_tokens: prompt_num,
    total_tokens: completion_num + prompt_num,
  }
}

export const TokensUsage: Component<{
  currentSystemRoleSettings: string
  messageList: ChatMessage[]
  textAreaValue: string
  currentAssistantMessage: string
}> = (props) => {
  const [local] = splitProps(props, [
    'currentSystemRoleSettings',
    'messageList',
    'textAreaValue',
    'currentAssistantMessage',
  ])
  const [isTiktokenReady, setIsTiktokenReady] = createSignal(false)
  let tiktoken: Tiktoken

  onMount(() => {
    init(imports =>
      WebAssembly.instantiateStreaming(fetch('/tiktoken_bg.wasm'), imports),
    ).then(() => {
      tiktoken = encoding_for_model(model)
      setIsTiktokenReady(true)
      // console.log('tiktoken initialized.')
    })
  })

  onCleanup(() => {
    tiktoken.free()
    // console.log('tiktoken freed.')
  })

  const getTokensUsageMemo = createMemo(() => {
    if (!isTiktokenReady())
      return { completion_tokens: 0, prompt_tokens: 0, total_tokens: 0 }

    const messages: ChatMessage[] = []
    if (local.currentSystemRoleSettings) {
      messages.push({
        role: 'system',
        content: local.currentSystemRoleSettings,
      })
    }
    messages.push(...local.messageList)
    if (local.textAreaValue) {
      messages.push({
        role: 'user',
        content: local.textAreaValue,
      })
    }
    if (local.currentAssistantMessage) {
      messages.push({
        role: 'assistant',
        content: local.currentAssistantMessage,
      })
    }
    const tokensUsage = getTokensUsage(tiktoken, messages)
    if (!local.textAreaValue && !local.currentAssistantMessage) {
      // eslint-disable-next-line no-console
      console.log(messages.map(m => ({
        role: m.role,
        content: m.content,
        encoded: {
          role: tiktoken.encode(m.role),
          content: tiktoken.encode(m.content),
        },
      })), tokensUsage)
    }
    return tokensUsage
  })

  return (
    <Show when={model.startsWith('gpt-3.5-turbo')}>
      <div class="fc gap-3 font-extrabold">
        <span>{getTokensUsageMemo().total_tokens} tokens</span>
        <span>=</span>
        <span>{getTokensUsageMemo().prompt_tokens} prompt</span>
        <span>+</span>
        <span>{getTokensUsageMemo().completion_tokens} completion</span>
      </div>
    </Show>
  )
}
