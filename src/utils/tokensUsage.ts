// Code origined from https://github.com/openai/openai-cookbook/blob/main/examples/How_to_count_tokens_with_tiktoken.ipynb.
// Just rewrote it in TypeScript. The result of this function may be only a approximation in the future.
// also refer to https://github.com/openai/openai-python/blob/main/chatml.md
import type { ChatMessage } from "@/types";
import { Tiktoken } from "@dqbd/tiktoken";

export const countTokensSingleMessage = (
  tiktoken: Tiktoken,
  message?: ChatMessage
) => {
  if (message === undefined) return 0;

  let num = 0;
  // every message follows <im_start>{role/name}\n{content}<im_end>\n
  // That is, there are always 4 tokens <im_start>, \n, <im_end>, \n.
  num += 4;
  num += 1; // tiktoken.encode(message.role).length === 1
  num += tiktoken.encode(message.content).length;
  if (message.name !== undefined) {
    num += tiktoken.encode(message.name).length;
    num -= 1; // if there's a name, the role is omitted. role is always required and always 1 token
  }
  return num;
};

export const getTokensUsage = (tiktoken: Tiktoken, messages: ChatMessage[]) => {
  if (messages.length === 0) {
    return { completion_tokens: 0, prompt_tokens: 0, total_tokens: 0 };
  }

  const isCompleted = messages[messages.length - 1].role === "assistant";
  const completion = isCompleted ? messages.slice(-1)[0] : undefined;
  const prompts = isCompleted ? messages.slice(0, -1) : messages;

  const countTokens = countTokensSingleMessage.bind(undefined, tiktoken);
  // sum the number of tokens in each prompt.
  // every prompt is primed with a extra <im_start>assistant, so we add 2.
  const prompt_num = prompts.map(countTokens).reduce((a, b) => a + b, 0) + 2;
  // countTokens always adds 4 for <im_start>, \n, <im_end>, \n and adds 1 for the role.
  // But <im_start>assistant is not part of the completion, 
  // and the second \n is considered part of the completion content.
  // It seems that <im_end>\n is not part of the completion either.
  // So we subtract 5.
  // The completion tokens seems to be the same as the number of tokens in the completion content.
  const completion_num = countTokens(completion) - (isCompleted ? 5 : 0);

  return {
    completion_tokens: completion_num,
    prompt_tokens: prompt_num,
    total_tokens: completion_num + prompt_num,
  };
};
