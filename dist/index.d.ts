import { LanguageModelV1 } from '@ai-sdk/provider';
export { LanguageModelV1 } from '@ai-sdk/provider';

type ChatModelId = string;
interface ChatSettings {
    /**
  Modify the likelihood of specified tokens appearing in the completion.
  
  Accepts a JSON object that maps tokens (specified by their token ID in
  the GPT tokenizer) to an associated bias value from -100 to 100. You
  can use this tokenizer tool to convert text to token IDs. Mathematically,
  the bias is added to the logits generated by the model prior to sampling.
  The exact effect will vary per model, but values between -1 and 1 should
  decrease or increase likelihood of selection; values like -100 or 100
  should result in a ban or exclusive selection of the relevant token.
  
  As an example, you can pass {"50256": -100} to prevent the <|endoftext|>
  token from being generated.
  */
    logitBias?: Record<number, number>;
    /**
  Return the log probabilities of the tokens. Including logprobs will increase
  the response size and can slow down response times. However, it can
  be useful to better understand how the model is behaving.
  
  Setting to true will return the log probabilities of the tokens that
  were generated.
  
  Setting to a number will return the log probabilities of the top n
  tokens that were generated.
  */
    logprobs?: boolean | number;
    /**
  Whether to enable parallel function calling during tool use. Default to true.
     */
    parallelToolCalls?: boolean;
    /**
  A unique identifier representing your end-user, which can help  to
  monitor and detect abuse. Learn more.
  */
    user?: string;
}

type ChatConfig = {
    provider: string;
    compatibility: "strict" | "compatible";
    headers: () => Record<string, string | undefined>;
    url: (options: {
        modelId: string;
        path: string;
    }) => string;
    fetch?: typeof fetch;
    extraBody?: Record<string, unknown>;
};
declare class ChatLanguageModel implements LanguageModelV1 {
    readonly specificationVersion = "v1";
    readonly defaultObjectGenerationMode = "tool";
    readonly modelId: ChatModelId;
    readonly settings: ChatSettings;
    private readonly config;
    constructor(modelId: ChatModelId, settings: ChatSettings, config: ChatConfig);
    get provider(): string;
    private getArgs;
    doGenerate(options: Parameters<LanguageModelV1["doGenerate"]>[0]): Promise<Awaited<ReturnType<LanguageModelV1["doGenerate"]>>>;
    doStream(options: Parameters<LanguageModelV1["doStream"]>[0]): Promise<Awaited<ReturnType<LanguageModelV1["doStream"]>>>;
}

type CompletionModelId = string & {};
interface CompletionSettings {
    /**
  Echo back the prompt in addition to the completion.
     */
    echo?: boolean;
    /**
  Modify the likelihood of specified tokens appearing in the completion.
  
  Accepts a JSON object that maps tokens (specified by their token ID in
  the GPT tokenizer) to an associated bias value from -100 to 100. You
  can use this tokenizer tool to convert text to token IDs. Mathematically,
  the bias is added to the logits generated by the model prior to sampling.
  The exact effect will vary per model, but values between -1 and 1 should
  decrease or increase likelihood of selection; values like -100 or 100
  should result in a ban or exclusive selection of the relevant token.
  
  As an example, you can pass {"50256": -100} to prevent the <|endoftext|>
  token from being generated.
     */
    logitBias?: Record<number, number>;
    /**
  Return the log probabilities of the tokens. Including logprobs will increase
  the response size and can slow down response times. However, it can
  be useful to better understand how the model is behaving.
  
  Setting to true will return the log probabilities of the tokens that
  were generated.
  
  Setting to a number will return the log probabilities of the top n
  tokens that were generated.
     */
    logprobs?: boolean | number;
    /**
  The suffix that comes after a completion of inserted text.
     */
    suffix?: string;
    /**
  A unique identifier representing your end-user, which can help  to
  monitor and detect abuse. Learn more.
     */
    user?: string;
}

type CompletionConfig = {
    provider: string;
    compatibility: "strict" | "compatible";
    headers: () => Record<string, string | undefined>;
    url: (options: {
        modelId: string;
        path: string;
    }) => string;
    fetch?: typeof fetch;
    extraBody?: Record<string, unknown>;
};
declare class CompletionLanguageModel implements LanguageModelV1 {
    readonly specificationVersion = "v1";
    readonly defaultObjectGenerationMode: undefined;
    readonly modelId: CompletionModelId;
    readonly settings: CompletionSettings;
    private readonly config;
    constructor(modelId: CompletionModelId, settings: CompletionSettings, config: CompletionConfig);
    get provider(): string;
    private getArgs;
    doGenerate(options: Parameters<LanguageModelV1["doGenerate"]>[0]): Promise<Awaited<ReturnType<LanguageModelV1["doGenerate"]>>>;
    doStream(options: Parameters<LanguageModelV1["doStream"]>[0]): Promise<Awaited<ReturnType<LanguageModelV1["doStream"]>>>;
}

interface Provider {
    (modelId: "google-studio/gemini-1.5-flash", settings?: CompletionSettings): CompletionLanguageModel;
    (modelId: ChatModelId, settings?: ChatSettings): ChatLanguageModel;
    languageModel(modelId: "google-studio/gemini-1.5-flash", settings?: CompletionSettings): CompletionLanguageModel;
    languageModel(modelId: ChatModelId, settings?: ChatSettings): ChatLanguageModel;
    /**
  Creates an  chat model for text generation.
     */
    chat(modelId: ChatModelId, settings?: ChatSettings): ChatLanguageModel;
    /**
  Creates an  completion model for text generation.
     */
    completion(modelId: CompletionModelId, settings?: CompletionSettings): CompletionLanguageModel;
}
interface ProviderSettings {
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
declare function create(options?: ProviderSettings): Provider;
/**
Default  provider instance. It uses 'strict' compatibility mode.
 */
declare const provider: Provider;

/**
@deprecated Use `create` instead.
 */
declare class AIProvider {
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
    constructor(options?: ProviderSettings);
    private get baseConfig();
    chat(modelId: ChatModelId, settings?: ChatSettings): ChatLanguageModel;
    completion(modelId: CompletionModelId, settings?: CompletionSettings): CompletionLanguageModel;
}

type LanguageModel = LanguageModelV1;

export { AIProvider, type LanguageModel, type Provider, type ProviderSettings, create, provider };