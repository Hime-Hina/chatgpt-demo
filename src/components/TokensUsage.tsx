import type { ChatMessage } from "@/types";
import type { Tiktoken } from "@dqbd/tiktoken";
import { getTokensUsage } from "@/utils/tokensUsage";
import { init, encoding_for_model } from "@dqbd/tiktoken/init";
import {
  Component,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
  splitProps,
} from "solid-js";

export const TokensUsage: Component<{
  currentSystemRoleSettings: string;
  messageList: ChatMessage[];
  textAreaValue: string;
  currentAssistantMessage: string;
}> = (props) => {
  const [local, others] = splitProps(props, [
    "currentSystemRoleSettings",
    "messageList",
    "textAreaValue",
    "currentAssistantMessage",
  ]);
  const [isTiktokenReady, setIsTiktokenReady] = createSignal(false);
  let tiktoken: Tiktoken;

  onMount(() => {
    init((imports) =>
      WebAssembly.instantiateStreaming(fetch("/tiktoken_bg.wasm"), imports)
    ).then(() => {
      tiktoken = encoding_for_model("gpt-3.5-turbo");
      setIsTiktokenReady(true);
    });
  });

  onCleanup(() => {
    tiktoken.free();
    console.log("tiktoken freed");
  });

  const getTokensUsageMemo = createMemo(() => {
    if (!isTiktokenReady())
      return { completion_tokens: 0, prompt_tokens: 0, total_tokens: 0 };

    const messages: ChatMessage[] = [];
    if (local.currentSystemRoleSettings) {
      messages.push({
        role: "system",
        content: local.currentSystemRoleSettings,
      });
    }
    messages.push(...local.messageList);
    if (local.textAreaValue) {
      messages.push({
        role: "user",
        content: local.textAreaValue,
      });
    }
    if (local.currentAssistantMessage) {
      messages.push({
        role: "assistant",
        content: local.currentAssistantMessage,
      });
    }
    return getTokensUsage(tiktoken, messages);
  });

  return (
    <div>
      <textarea
        disabled={true}
        placeholder="..."
        autocomplete="off"
        rows="1"
        class="gen-textarea"
        value={`补全: ${getTokensUsageMemo().completion_tokens} | 提示: ${
          getTokensUsageMemo().prompt_tokens
        }`}
      />
    </div>
  );
};
