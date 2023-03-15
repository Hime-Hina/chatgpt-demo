import type { ChatMessage } from "@/types";
import {
  createSignal,
  Index,
  Show,
  onMount,
  onCleanup,
  createMemo,
} from "solid-js";
import IconClear from "./icons/Clear";
import MessageItem from "./MessageItem";
import SystemRoleSettings from "./SystemRoleSettings";
import { generateSignature } from "@/utils/auth";
import { useThrottleFn } from "solidjs-use";
import { encoding_for_model } from "@dqbd/tiktoken";
import { getTokensUsage } from "@/utils/tokensUsage";

export default () => {
  let inputRef: HTMLTextAreaElement;
  const [currentSystemRoleSettings, setCurrentSystemRoleSettings] =
    createSignal("");
  const [systemRoleEditing, setSystemRoleEditing] = createSignal(false);
  const [messageList, setMessageList] = createSignal<ChatMessage[]>([]);
  const [currentAssistantMessage, setCurrentAssistantMessage] =
    createSignal("");
  const [loading, setLoading] = createSignal(false);
  const [controller, setController] = createSignal<AbortController>();
  const [temperature, setTemperature] = createSignal(60);
  const [inputValue, setInputValue] = createSignal("");
  const tiktoken = encoding_for_model("gpt-3.5-turbo");

  onMount(async () => {
    try {
      const messageListStorage = localStorage.getItem("messageList");
      const systemRoleSettingsStorage =
        localStorage.getItem("systemRoleSettings");
      const temperatureStorage = localStorage.getItem("temperature");
      if (messageListStorage) {
        setMessageList(JSON.parse(messageListStorage));
      }
      if (systemRoleSettingsStorage) {
        setCurrentSystemRoleSettings(systemRoleSettingsStorage);
      }
      if (temperatureStorage) {
        setTemperature(parseFloat(temperatureStorage));
        console.log(`LocalStorage temperature: ${temperatureStorage}`);
      }
    } catch (err) {
      console.error(err);
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    onCleanup(() => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      tiktoken.free();
    });
  });

  const getTokensUsageMemo = createMemo(() => {
    const messages: ChatMessage[] = [];
    if (currentSystemRoleSettings()) {
      messages.push({
        role: "system",
        content: currentSystemRoleSettings(),
      });
    }
    messages.push(...messageList());
    if (inputValue()) {
      messages.push({
        role: "user",
        content: inputValue(),
      });
    }
    // When archiveCurrentMessage is called, setMessageList will be called first,
    // then this memo will be called. So assistant message is already archived in messageList.
    // In order to prevent assistant message from being pushed into messages twice, we need to check it.
    // Maybe there is a better way to do this.
    const lastMessage = messages[messages.length - 1];
    const isAssistantMessageArchived =
      lastMessage !== undefined &&
      lastMessage.role === "assistant" &&
      lastMessage.content === currentAssistantMessage();
    if (currentAssistantMessage() && !isAssistantMessageArchived) {
      messages.push({
        role: "assistant",
        content: currentAssistantMessage(),
      });
    }
    console.log(messages);
    return getTokensUsage(tiktoken, messages);
  });

  const handleBeforeUnload = () => {
    localStorage.setItem("messageList", JSON.stringify(messageList()));
    localStorage.setItem("systemRoleSettings", currentSystemRoleSettings());
    localStorage.setItem("temperature", temperature().toString());
  };

  const handleButtonClick = async () => {
    const inputValue = inputRef.value;
    if (!inputValue) {
      return;
    }
    // @ts-ignore
    if (window?.umami) umami.trackEvent("chat_generate");
    inputRef.value = "";
    setMessageList([
      ...messageList(),
      {
        role: "user",
        content: inputValue,
      },
    ]);
    requestWithLatestMessage();
  };

  const smoothToBottom = useThrottleFn(
    () => {
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    },
    300,
    false,
    true
  );

  const requestWithLatestMessage = async () => {
    setLoading(true);
    setCurrentAssistantMessage("");
    const storagePassword = localStorage.getItem("pass");
    try {
      const controller = new AbortController();
      setController(controller);
      const requestMessageList = [...messageList()];
      if (currentSystemRoleSettings()) {
        requestMessageList.unshift({
          role: "system",
          content: currentSystemRoleSettings(),
        });
      }
      const timestamp = Date.now();
      const response = await fetch("/api/generate", {
        method: "POST",
        body: JSON.stringify({
          messages: requestMessageList,
          time: timestamp,
          pass: storagePassword,
          sign: await generateSignature({
            t: timestamp,
            m:
              requestMessageList?.[requestMessageList.length - 1]?.content ||
              "",
          }),
          temperature: temperature() / 100.0,
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(response.statusText);
      }
      const data = response.body;
      if (!data) {
        throw new Error("No data");
      }
      const reader = data.getReader();
      const decoder = new TextDecoder("utf-8");
      let done = false;

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        if (value) {
          let char = decoder.decode(value);
          if (char === "\n" && currentAssistantMessage().endsWith("\n")) {
            continue;
          }
          if (char) {
            setCurrentAssistantMessage(currentAssistantMessage() + char);
          }
          smoothToBottom();
        }
        done = readerDone;
      }
    } catch (e) {
      console.error(e);
      setLoading(false);
      setController(undefined);
      return;
    }
    archiveCurrentMessage();
  };

  const archiveCurrentMessage = () => {
    if (currentAssistantMessage()) {
      setMessageList([
        ...messageList(),
        {
          role: "assistant",
          content: currentAssistantMessage(),
        },
      ]);
      setCurrentAssistantMessage("");
      setLoading(false);
      setController(undefined);
      inputRef.focus();
    }
  };

  const clear = () => {
    inputRef.value = "";
    inputRef.style.height = "auto";
    setInputValue(inputRef.value);
    setMessageList([]);
    setCurrentAssistantMessage("");
    setCurrentSystemRoleSettings("");
  };

  const stopStreamFetch = () => {
    const c: AbortController | undefined = controller();
    if (c !== undefined) {
      c.abort();
      archiveCurrentMessage();
    }
  };

  const retryLastFetch = () => {
    if (messageList().length > 0) {
      const lastMessage = messageList()[messageList().length - 1];
      if (lastMessage.role === "assistant") {
        setMessageList(messageList().slice(0, -1));
      }
      requestWithLatestMessage();
    }
  };

  const handleKeydown = (e: KeyboardEvent) => {
    if (e.isComposing || e.shiftKey) {
      return;
    }
    if (e.key === "Enter") {
      handleButtonClick();
    }
  };

  return (
    <div my-6>
      <SystemRoleSettings
        canEdit={() => messageList().length === 0}
        systemRoleEditing={systemRoleEditing}
        setSystemRoleEditing={setSystemRoleEditing}
        currentSystemRoleSettings={currentSystemRoleSettings}
        setCurrentSystemRoleSettings={setCurrentSystemRoleSettings}
      />
      <Index each={messageList()}>
        {(message, index) => (
          <MessageItem
            role={message().role}
            message={message().content}
            showRetry={() => !loading() && index === messageList().length - 1}
            onRetry={retryLastFetch}
          />
        )}
      </Index>
      {currentAssistantMessage() && (
        <MessageItem role="assistant" message={currentAssistantMessage} />
      )}
      <div>
        <textarea
          disabled={true}
          placeholder="..."
          autocomplete="off"
          rows="1"
          class="gen-textarea"
          value={`completion_tokens: ${
            getTokensUsageMemo().completion_tokens
          } prompt_tokens: ${
            getTokensUsageMemo().prompt_tokens
          } total_tokens: ${getTokensUsageMemo().total_tokens}`}
        />
      </div>
      <Show
        when={!loading()}
        fallback={() => (
          <div class="gen-cb-wrapper">
            <span>AI 正在组织语言……</span>
            <div class="gen-cb-stop" onClick={stopStreamFetch}>
              别说了！
            </div>
          </div>
        )}
      >
        <div class="gen-text-wrapper" class:op-50={systemRoleEditing()}>
          <textarea
            ref={inputRef!}
            disabled={systemRoleEditing()}
            onKeyDown={handleKeydown}
            placeholder="有什么想说的吗？"
            autocomplete="off"
            autofocus
            onInput={() => {
              inputRef.style.height = "auto";
              inputRef.style.height = inputRef.scrollHeight + "px";
              setInputValue(inputRef.value);
            }}
            rows="1"
            class="gen-textarea"
          />
          <button
            title="发送"
            onClick={handleButtonClick}
            disabled={systemRoleEditing()}
            gen-slate-btn
          >
            <div class="i-carbon:send-filled text-5" />
          </button>
          <button
            title="清除记录"
            onClick={clear}
            disabled={systemRoleEditing()}
            gen-slate-btn
          >
            <IconClear />
          </button>
        </div>
      </Show>
      <div>
        <div class="flex flex-row justify-center">
          <label for="temperature-range">
            发言随机程度：
            <input
              type="range"
              id="temperature-range"
              class="mx-2 rounded-sm bg-(slate op-15) resize-none base-focus placeholder:op-50 dark:(placeholder:op-30) scroll-pa-8px"
              min={0}
              max={200}
              value={temperature()}
              placeholder="温度"
              onInput={(e) =>
                setTemperature(parseFloat((e.target as HTMLInputElement).value))
              }
            />
            <input
              type="number"
              id="temperature-number"
              class="mx-1 rounded-sm bg-(slate op-15) resize-none base-focus placeholder:op-50 dark:(placeholder:op-30) scroll-pa-8px"
              min={0}
              max={2}
              step={0.01}
              minLength={3}
              value={temperature() / 100}
              placeholder="温度"
              onChange={(e) =>
                setTemperature(
                  100 * parseFloat((e.target as HTMLInputElement).value)
                )
              }
            />
          </label>
        </div>
      </div>
    </div>
  );
};
