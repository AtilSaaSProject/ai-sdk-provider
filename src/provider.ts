import { loadApiKey, withoutTrailingSlash } from "@ai-sdk/provider-utils";
import { ChatLanguageModel } from "./chat-language-model";
import type {
  ChatModelId,
  ChatSettings,
} from "./chat-settings";
import { CompletionLanguageModel } from "./completion-language-model";
import type {
  CompletionModelId,
  CompletionSettings,
} from "./completion-settings";

export interface Provider {
  (
    modelId: "google-studio/gemini-1.5-flash",
    settings?: CompletionSettings
  ): CompletionLanguageModel;
  (
    modelId: ChatModelId,
    settings?: ChatSettings
  ): ChatLanguageModel;

  languageModel(
    modelId: "google-studio/gemini-1.5-flash",
    settings?: CompletionSettings
  ): CompletionLanguageModel;
  languageModel(
    modelId: ChatModelId,
    settings?: ChatSettings
  ): ChatLanguageModel;

  /**
Creates an  chat model for text generation.
   */
  chat(
    modelId: ChatModelId,
    settings?: ChatSettings
  ): ChatLanguageModel;

  /**
Creates an  completion model for text generation.
   */
  completion(
    modelId: CompletionModelId,
    settings?: CompletionSettings
  ): CompletionLanguageModel;
}

export interface ProviderSettings {
  /**
Base URL for the  API calls.
     */
  baseURL?: string;

  /**
@deprecated Use `baseURL` instead.
     */
  baseUrl?: string;

  /**
API key for authenticating requests.
     */
  apiKey?: string;

  /**
Custom headers to include in the requests.
     */
  headers?: Record<string, string>;

  /**
 compatibility mode. Should be set to `strict` when using the  API,
and `compatible` when using 3rd party providers. In `compatible` mode, newer
information such as streamOptions are not being sent. Defaults to 'compatible'.
   */
  compatibility?: "strict" | "compatible";

  /**
Custom fetch implementation. You can use it as a middleware to intercept requests,
or to provide a custom fetch implementation for e.g. testing.
    */
  fetch?: typeof fetch;

  /**
A JSON object to send as the request body to access  features & upstream provider features.
  */
  extraBody?: Record<string, unknown>;
}

/**
Create an  provider instance.
 */
export function create(
  options: ProviderSettings = {}
): Provider {
  const baseURL =
    withoutTrailingSlash(options.baseURL ?? options.baseUrl) ??
    "http://localhost:8080/api/v1";

  // we default to compatible, because strict breaks providers like Groq:
  const compatibility = options.compatibility ?? "compatible";

  const getHeaders = () => ({
    Authorization: `Bearer ${loadApiKey({
      apiKey: options.apiKey,
      environmentVariableName: "API_KEY",
      description: "",
    })}`,
    ...options.headers,
  });

  const createChatModel = (
    modelId: ChatModelId,
    settings: ChatSettings = {}
  ) =>
    new ChatLanguageModel(modelId, settings, {
      provider: ".chat",
      url: ({ path }) => `${baseURL}${path}`,
      headers: getHeaders,
      compatibility,
      fetch: options.fetch,
      extraBody: options.extraBody,
    });

  const createCompletionModel = (
    modelId: CompletionModelId,
    settings: CompletionSettings = {}
  ) =>
    new CompletionLanguageModel(modelId, settings, {
      provider: ".completion",
      url: ({ path }) => `${baseURL}${path}`,
      headers: getHeaders,
      compatibility,
      fetch: options.fetch,
      extraBody: options.extraBody,
    });

  const createLanguageModel = (
    modelId: ChatModelId | CompletionModelId,
    settings?: ChatSettings | CompletionSettings
  ) => {
    if (new.target) {
      throw new Error(
        "The  model function cannot be called with the new keyword."
      );
    }

    if (modelId === "google-studio/gemini-1.5-flash") {
      return createCompletionModel(
        modelId,
        settings as CompletionSettings
      );
    }

    return createChatModel(modelId, settings as ChatSettings);
  };

  const provider = function (
    modelId: ChatModelId | CompletionModelId,
    settings?: ChatSettings | CompletionSettings
  ) {
    return createLanguageModel(modelId, settings);
  };

  provider.languageModel = createLanguageModel;
  provider.chat = createChatModel;
  provider.completion = createCompletionModel;

  return provider as Provider;
}

/**
Default  provider instance. It uses 'strict' compatibility mode.
 */
export const provider = create({
  compatibility: "strict", // strict for  API
});
