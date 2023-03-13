import type { ChatMessage } from "@/types";
import type { APIRoute } from "astro";
import type { Tiktoken } from "@dqbd/tiktoken";
import { encoding_for_model } from "@dqbd/tiktoken";

// Code origined from https://github.com/openai/openai-cookbook/blob/main/examples/How_to_count_tokens_with_tiktoken.ipynb.
// Just rewrote it in TypeScript. The result of this function may be only a approximation in the future.
// also refer to https://github.com/openai/openai-python/blob/main/chatml.md
function countNumTokensMessage(tiktoken: Tiktoken, message: ChatMessage) {
  let num = 0;
  num += 4; // every message follows <im_start>{role/name}\n{content}<im_end>\n
  num += tiktoken.encode(message.role).length;
  num += tiktoken.encode(message.content).length;
  if (message.name !== undefined) {
    num += tiktoken.encode(message.name).length;
    num -= 1; // if there's a name, the role is omitted. role is always required and always 1 token
  }
  return num;
}

function getUsage(tiktoken: Tiktoken, messages: ChatMessage[]) {
  let completion = messages.slice(-1)[0];
  let completion_num = countNumTokensMessage(tiktoken, completion) - 2; // -2 for <im_start>assistant

  let prompt_num = 0;
  const prompt = 
    messages[messages.length - 1].role === 'assistant'
    ? messages.slice(0, -1)
    : messages;

  for (let message of prompt) {
    prompt_num += countNumTokensMessage(tiktoken, message);
  }
  prompt_num += 2; // every reply is primed with <im_start>assistant

  return {
    completion_tokens: completion_num,
    prompt_tokens: prompt_num,
    total_tokens: completion_num + prompt_num,
  };
}

export const post: APIRoute = async (context) => {
  const body = await context.request.json();
  const { messages }: { messages: ChatMessage[] } = body;
  const enc = encoding_for_model("gpt-3.5-turbo");

  const response = new Response(
    JSON.stringify(getUsage(enc, messages))
  );

  enc.free();

  return response;
};
