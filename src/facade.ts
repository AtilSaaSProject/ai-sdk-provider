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
import type { ProviderSettings } from "./provider";

/**
@deprecated Use `create` instead.
 */
export class AIProvider {
  /**
Use a different URL prefix for API calls, e.g. to use proxy servers.
The default prefix is `https://.ai/api/v1`.
   */
  readonly baseURL: string;

  /**
API key that is being send using the `Authorization` header.
It defaults to the `_API_KEY` environment variable.
 */
  readonly apiKey?: string;

  /**
Custom headers to include in the requests.
   */
  readonly headers?: Record<string, string>;

  /**
   * Creates a new  provider instance.
   */
  constructor(options: ProviderSettings = {}) {
    this.baseURL =
      withoutTrailingSlash(options.baseURL ?? options.baseUrl) ??
      "http://localhost:8080/api/v1";
    this.apiKey = options.apiKey;
    this.headers = options.headers;
  }

  private get baseConfig() {
    return {
      baseURL: this.baseURL,
      headers: () => ({
        Authorization: `Bearer ${loadApiKey({
          apiKey: this.apiKey,
          environmentVariableName: "API_KEY",
          description: "",
        })}`,
        ...this.headers,
      }),
    };
  }

  chat(modelId: ChatModelId, settings: ChatSettings = {}) {
    return new ChatLanguageModel(modelId, settings, {
      provider: "ai.chat",
      ...this.baseConfig,
      compatibility: "strict",
      url: ({ path }) => `${this.baseURL}${path}`,
    });
  }

  completion(
    modelId: CompletionModelId,
    settings: CompletionSettings = {}
  ) {
    return new CompletionLanguageModel(modelId, settings, {
      provider: "ai.completion",
      ...this.baseConfig,
      compatibility: "strict",
      url: ({ path }) => `${this.baseURL}${path}`,
    });
  }
}
