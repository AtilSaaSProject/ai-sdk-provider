var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
var __objRest = (source, exclude) => {
  var target = {};
  for (var prop in source)
    if (__hasOwnProp.call(source, prop) && exclude.indexOf(prop) < 0)
      target[prop] = source[prop];
  if (source != null && __getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(source)) {
      if (exclude.indexOf(prop) < 0 && __propIsEnum.call(source, prop))
        target[prop] = source[prop];
    }
  return target;
};

// src/facade.ts
import { loadApiKey, withoutTrailingSlash } from "@ai-sdk/provider-utils";

// src/chat-language-model.ts
import {
  InvalidResponseDataError,
  UnsupportedFunctionalityError
} from "@ai-sdk/provider";
import {
  combineHeaders,
  createEventSourceResponseHandler,
  createJsonResponseHandler,
  generateId,
  isParsableJson,
  postJsonToApi
} from "@ai-sdk/provider-utils";
import { z as z2 } from "zod";

// src/convert-to-chat-messages.ts
import { convertUint8ArrayToBase64 } from "@ai-sdk/provider-utils";
function convertToChatMessages(prompt) {
  var _a;
  const messages = [];
  for (const { role, content } of prompt) {
    switch (role) {
      case "system": {
        messages.push({ role: "system", content });
        break;
      }
      case "user": {
        if (content.length === 1 && ((_a = content[0]) == null ? void 0 : _a.type) === "text") {
          messages.push({ role: "user", content: content[0].text });
          break;
        }
        const contentParts = content.map(
          (part) => {
            var _a2;
            switch (part.type) {
              case "text":
                return {
                  type: "text",
                  text: part.text
                };
              case "image":
                return {
                  type: "image_url",
                  image_url: {
                    url: part.image instanceof URL ? part.image.toString() : `data:${(_a2 = part.mimeType) != null ? _a2 : "image/jpeg"};base64,${convertUint8ArrayToBase64(part.image)}`
                  }
                };
              case "file":
                return {
                  type: "text",
                  text: part.data instanceof URL ? part.data.toString() : part.data
                };
              default: {
                const _exhaustiveCheck = part;
                throw new Error(
                  `Unsupported content part type: ${_exhaustiveCheck}`
                );
              }
            }
          }
        );
        messages.push({
          role: "user",
          content: contentParts
        });
        break;
      }
      case "assistant": {
        let text = "";
        const toolCalls = [];
        for (const part of content) {
          switch (part.type) {
            case "text": {
              text += part.text;
              break;
            }
            case "tool-call": {
              toolCalls.push({
                id: part.toolCallId,
                type: "function",
                function: {
                  name: part.toolName,
                  arguments: JSON.stringify(part.args)
                }
              });
              break;
            }
            default: {
              const _exhaustiveCheck = part;
              throw new Error(`Unsupported part: ${_exhaustiveCheck}`);
            }
          }
        }
        messages.push({
          role: "assistant",
          content: text,
          tool_calls: toolCalls.length > 0 ? toolCalls : void 0
        });
        break;
      }
      case "tool": {
        for (const toolResponse of content) {
          messages.push({
            role: "tool",
            tool_call_id: toolResponse.toolCallId,
            content: JSON.stringify(toolResponse.result)
          });
        }
        break;
      }
      default: {
        const _exhaustiveCheck = role;
        throw new Error(`Unsupported role: ${_exhaustiveCheck}`);
      }
    }
  }
  return messages;
}

// src/map-chat-logprobs.ts
function mapChatLogProbsOutput(logprobs) {
  var _a, _b;
  return (_b = (_a = logprobs == null ? void 0 : logprobs.content) == null ? void 0 : _a.map(({ token, logprob, top_logprobs }) => ({
    token,
    logprob,
    topLogprobs: top_logprobs ? top_logprobs.map(({ token: token2, logprob: logprob2 }) => ({
      token: token2,
      logprob: logprob2
    })) : []
  }))) != null ? _b : void 0;
}

// src/map-finish-reason.ts
function mapFinishReason(finishReason) {
  switch (finishReason) {
    case "stop":
      return "stop";
    case "length":
      return "length";
    case "content_filter":
      return "content-filter";
    case "function_call":
    case "tool_calls":
      return "tool-calls";
    default:
      return "unknown";
  }
}

// src/error.ts
import { z } from "zod";
import { createJsonErrorResponseHandler } from "@ai-sdk/provider-utils";
var openAIErrorDataSchema = z.object({
  error: z.object({
    message: z.string(),
    type: z.string(),
    param: z.any().nullable(),
    code: z.string().nullable()
  })
});
var FailedResponseHandler = createJsonErrorResponseHandler({
  errorSchema: openAIErrorDataSchema,
  errorToMessage: (data) => data.error.message
});

// src/chat-language-model.ts
function isFunctionTool(tool) {
  return "parameters" in tool;
}
var ChatLanguageModel = class {
  constructor(modelId, settings, config) {
    this.specificationVersion = "v1";
    this.defaultObjectGenerationMode = "tool";
    this.modelId = modelId;
    this.settings = settings;
    this.config = config;
  }
  get provider() {
    return this.config.provider;
  }
  getArgs({
    mode,
    prompt,
    maxTokens,
    temperature,
    topP,
    frequencyPenalty,
    presencePenalty,
    seed
  }) {
    const type = mode.type;
    const baseArgs = __spreadValues({
      // model id:
      model: this.modelId,
      // model specific settings:
      logit_bias: this.settings.logitBias,
      logprobs: this.settings.logprobs === true || typeof this.settings.logprobs === "number" ? true : void 0,
      top_logprobs: typeof this.settings.logprobs === "number" ? this.settings.logprobs : typeof this.settings.logprobs === "boolean" ? this.settings.logprobs ? 0 : void 0 : void 0,
      user: this.settings.user,
      parallel_tool_calls: this.settings.parallelToolCalls,
      // standardized settings:
      max_tokens: maxTokens,
      temperature,
      top_p: topP,
      frequency_penalty: frequencyPenalty,
      presence_penalty: presencePenalty,
      seed,
      // messages:
      messages: convertToChatMessages(prompt)
    }, this.config.extraBody);
    switch (type) {
      case "regular": {
        return __spreadValues(__spreadValues({}, baseArgs), prepareToolsAndToolChoice(mode));
      }
      case "object-json": {
        return __spreadProps(__spreadValues({}, baseArgs), {
          response_format: { type: "json_object" }
        });
      }
      case "object-tool": {
        return __spreadProps(__spreadValues({}, baseArgs), {
          tool_choice: { type: "function", function: { name: mode.tool.name } },
          tools: [
            {
              type: "function",
              function: {
                name: mode.tool.name,
                description: mode.tool.description,
                parameters: mode.tool.parameters
              }
            }
          ]
        });
      }
      // Handle all non-text types with a single default case
      default: {
        const _exhaustiveCheck = type;
        throw new UnsupportedFunctionalityError({
          functionality: `${_exhaustiveCheck} mode`
        });
      }
    }
  }
  async doGenerate(options) {
    var _b, _c;
    const args = this.getArgs(options);
    const { responseHeaders, value: response } = await postJsonToApi({
      url: this.config.url({
        path: "/chat/completions",
        modelId: this.modelId
      }),
      headers: combineHeaders(this.config.headers(), options.headers),
      body: args,
      failedResponseHandler: FailedResponseHandler,
      successfulResponseHandler: createJsonResponseHandler(
        openAIChatResponseSchema
      ),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch
    });
    const _a = args, { messages: rawPrompt } = _a, rawSettings = __objRest(_a, ["messages"]);
    const choice = response.choices[0];
    if (choice == null) {
      throw new Error("No choice in response");
    }
    return {
      text: (_b = choice.message.content) != null ? _b : void 0,
      toolCalls: (_c = choice.message.tool_calls) == null ? void 0 : _c.map((toolCall) => {
        var _a2;
        return {
          toolCallType: "function",
          toolCallId: (_a2 = toolCall.id) != null ? _a2 : generateId(),
          toolName: toolCall.function.name,
          args: toolCall.function.arguments
        };
      }),
      finishReason: mapFinishReason(choice.finish_reason),
      usage: {
        promptTokens: response.usage.prompt_tokens,
        completionTokens: response.usage.completion_tokens
      },
      rawCall: { rawPrompt, rawSettings },
      rawResponse: { headers: responseHeaders },
      warnings: [],
      logprobs: mapChatLogProbsOutput(choice.logprobs)
    };
  }
  async doStream(options) {
    const args = this.getArgs(options);
    const { responseHeaders, value: response } = await postJsonToApi({
      url: this.config.url({
        path: "/chat/completions",
        modelId: this.modelId
      }),
      headers: combineHeaders(this.config.headers(), options.headers),
      body: __spreadProps(__spreadValues({}, args), {
        stream: true,
        // only include stream_options when in strict compatibility mode:
        stream_options: this.config.compatibility === "strict" ? { include_usage: true } : void 0
      }),
      failedResponseHandler: FailedResponseHandler,
      successfulResponseHandler: createEventSourceResponseHandler(
        ChatChunkSchema
      ),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch
    });
    const _a = args, { messages: rawPrompt } = _a, rawSettings = __objRest(_a, ["messages"]);
    const toolCalls = [];
    let finishReason = "other";
    let usage = {
      promptTokens: Number.NaN,
      completionTokens: Number.NaN
    };
    let logprobs;
    return {
      stream: response.pipeThrough(
        new TransformStream({
          transform(chunk, controller) {
            var _a2, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l;
            if (!chunk.success) {
              finishReason = "error";
              controller.enqueue({ type: "error", error: chunk.error });
              return;
            }
            const value = chunk.value;
            if ("error" in value) {
              finishReason = "error";
              controller.enqueue({ type: "error", error: value.error });
              return;
            }
            if (value.usage != null) {
              usage = {
                promptTokens: value.usage.prompt_tokens,
                completionTokens: value.usage.completion_tokens
              };
            }
            const choice = value.choices[0];
            if ((choice == null ? void 0 : choice.finish_reason) != null) {
              finishReason = mapFinishReason(choice.finish_reason);
            }
            if ((choice == null ? void 0 : choice.delta) == null) {
              return;
            }
            const delta = choice.delta;
            if (delta.content != null) {
              controller.enqueue({
                type: "text-delta",
                textDelta: delta.content
              });
            }
            const mappedLogprobs = mapChatLogProbsOutput(
              choice == null ? void 0 : choice.logprobs
            );
            if (mappedLogprobs == null ? void 0 : mappedLogprobs.length) {
              if (logprobs === void 0) logprobs = [];
              logprobs.push(...mappedLogprobs);
            }
            if (delta.tool_calls != null) {
              for (const toolCallDelta of delta.tool_calls) {
                const index = toolCallDelta.index;
                if (toolCalls[index] == null) {
                  if (toolCallDelta.type !== "function") {
                    throw new InvalidResponseDataError({
                      data: toolCallDelta,
                      message: `Expected 'function' type.`
                    });
                  }
                  if (toolCallDelta.id == null) {
                    throw new InvalidResponseDataError({
                      data: toolCallDelta,
                      message: `Expected 'id' to be a string.`
                    });
                  }
                  if (((_a2 = toolCallDelta.function) == null ? void 0 : _a2.name) == null) {
                    throw new InvalidResponseDataError({
                      data: toolCallDelta,
                      message: `Expected 'function.name' to be a string.`
                    });
                  }
                  toolCalls[index] = {
                    id: toolCallDelta.id,
                    type: "function",
                    function: {
                      name: toolCallDelta.function.name,
                      arguments: (_b = toolCallDelta.function.arguments) != null ? _b : ""
                    }
                  };
                  const toolCall2 = toolCalls[index];
                  if (toolCall2 == null) {
                    throw new Error("Tool call is missing");
                  }
                  if (((_c = toolCall2.function) == null ? void 0 : _c.name) != null && ((_d = toolCall2.function) == null ? void 0 : _d.arguments) != null && isParsableJson(toolCall2.function.arguments)) {
                    controller.enqueue({
                      type: "tool-call-delta",
                      toolCallType: "function",
                      toolCallId: toolCall2.id,
                      toolName: toolCall2.function.name,
                      argsTextDelta: toolCall2.function.arguments
                    });
                    controller.enqueue({
                      type: "tool-call",
                      toolCallType: "function",
                      toolCallId: (_e = toolCall2.id) != null ? _e : generateId(),
                      toolName: toolCall2.function.name,
                      args: toolCall2.function.arguments
                    });
                  }
                  continue;
                }
                const toolCall = toolCalls[index];
                if (toolCall == null) {
                  throw new Error("Tool call is missing");
                }
                if (((_f = toolCallDelta.function) == null ? void 0 : _f.arguments) != null) {
                  toolCall.function.arguments += (_h = (_g = toolCallDelta.function) == null ? void 0 : _g.arguments) != null ? _h : "";
                }
                controller.enqueue({
                  type: "tool-call-delta",
                  toolCallType: "function",
                  toolCallId: toolCall.id,
                  toolName: toolCall.function.name,
                  argsTextDelta: (_i = toolCallDelta.function.arguments) != null ? _i : ""
                });
                if (((_j = toolCall.function) == null ? void 0 : _j.name) != null && ((_k = toolCall.function) == null ? void 0 : _k.arguments) != null && isParsableJson(toolCall.function.arguments)) {
                  controller.enqueue({
                    type: "tool-call",
                    toolCallType: "function",
                    toolCallId: (_l = toolCall.id) != null ? _l : generateId(),
                    toolName: toolCall.function.name,
                    args: toolCall.function.arguments
                  });
                }
              }
            }
          },
          flush(controller) {
            controller.enqueue({
              type: "finish",
              finishReason,
              logprobs,
              usage
            });
          }
        })
      ),
      rawCall: { rawPrompt, rawSettings },
      rawResponse: { headers: responseHeaders },
      warnings: []
    };
  }
};
var openAIChatResponseSchema = z2.object({
  choices: z2.array(
    z2.object({
      message: z2.object({
        role: z2.literal("assistant"),
        content: z2.string().nullable().optional(),
        tool_calls: z2.array(
          z2.object({
            id: z2.string().optional().nullable(),
            type: z2.literal("function"),
            function: z2.object({
              name: z2.string(),
              arguments: z2.string()
            })
          })
        ).optional()
      }),
      index: z2.number(),
      logprobs: z2.object({
        content: z2.array(
          z2.object({
            token: z2.string(),
            logprob: z2.number(),
            top_logprobs: z2.array(
              z2.object({
                token: z2.string(),
                logprob: z2.number()
              })
            )
          })
        ).nullable()
      }).nullable().optional(),
      finish_reason: z2.string().optional().nullable()
    })
  ),
  usage: z2.object({
    prompt_tokens: z2.number(),
    completion_tokens: z2.number()
  })
});
var ChatChunkSchema = z2.union([
  z2.object({
    choices: z2.array(
      z2.object({
        delta: z2.object({
          role: z2.enum(["assistant"]).optional(),
          content: z2.string().nullish(),
          tool_calls: z2.array(
            z2.object({
              index: z2.number(),
              id: z2.string().nullish(),
              type: z2.literal("function").optional(),
              function: z2.object({
                name: z2.string().nullish(),
                arguments: z2.string().nullish()
              })
            })
          ).nullish()
        }).nullish(),
        logprobs: z2.object({
          content: z2.array(
            z2.object({
              token: z2.string(),
              logprob: z2.number(),
              top_logprobs: z2.array(
                z2.object({
                  token: z2.string(),
                  logprob: z2.number()
                })
              )
            })
          ).nullable()
        }).nullish(),
        finish_reason: z2.string().nullable().optional(),
        index: z2.number()
      })
    ),
    usage: z2.object({
      prompt_tokens: z2.number(),
      completion_tokens: z2.number()
    }).nullish()
  }),
  openAIErrorDataSchema
]);
function prepareToolsAndToolChoice(mode) {
  var _a;
  const tools = ((_a = mode.tools) == null ? void 0 : _a.length) ? mode.tools : void 0;
  if (tools == null) {
    return { tools: void 0, tool_choice: void 0 };
  }
  const mappedTools = tools.map((tool) => {
    if (isFunctionTool(tool)) {
      return {
        type: "function",
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters
        }
      };
    } else {
      return {
        type: "function",
        function: {
          name: tool.name
        }
      };
    }
  });
  const toolChoice = mode.toolChoice;
  if (toolChoice == null) {
    return { tools: mappedTools, tool_choice: void 0 };
  }
  const type = toolChoice.type;
  switch (type) {
    case "auto":
    case "none":
    case "required":
      return { tools: mappedTools, tool_choice: type };
    case "tool":
      return {
        tools: mappedTools,
        tool_choice: {
          type: "function",
          function: {
            name: toolChoice.toolName
          }
        }
      };
    default: {
      const _exhaustiveCheck = type;
      throw new Error(`Unsupported tool choice type: ${_exhaustiveCheck}`);
    }
  }
}

// src/completion-language-model.ts
import {
  UnsupportedFunctionalityError as UnsupportedFunctionalityError3
} from "@ai-sdk/provider";
import {
  combineHeaders as combineHeaders2,
  createEventSourceResponseHandler as createEventSourceResponseHandler2,
  createJsonResponseHandler as createJsonResponseHandler2,
  postJsonToApi as postJsonToApi2
} from "@ai-sdk/provider-utils";
import { z as z3 } from "zod";

// src/convert-to-completion-prompt.ts
import {
  InvalidPromptError,
  UnsupportedFunctionalityError as UnsupportedFunctionalityError2
} from "@ai-sdk/provider";
function convertToCompletionPrompt({
  prompt,
  inputFormat,
  user = "user",
  assistant = "assistant"
}) {
  if (inputFormat === "prompt" && prompt.length === 1 && prompt[0] && prompt[0].role === "user" && prompt[0].content.length === 1 && prompt[0].content[0] && prompt[0].content[0].type === "text") {
    return { prompt: prompt[0].content[0].text };
  }
  let text = "";
  if (prompt[0] && prompt[0].role === "system") {
    text += `${prompt[0].content}

`;
    prompt = prompt.slice(1);
  }
  for (const { role, content } of prompt) {
    switch (role) {
      case "system": {
        throw new InvalidPromptError({
          message: "Unexpected system message in prompt: ${content}",
          prompt
        });
      }
      case "user": {
        const userMessage = content.map((part) => {
          switch (part.type) {
            case "text": {
              return part.text;
            }
            case "image": {
              throw new UnsupportedFunctionalityError2({
                functionality: "images"
              });
            }
            case "file": {
              throw new UnsupportedFunctionalityError2({
                functionality: "file attachments"
              });
            }
            default: {
              const _exhaustiveCheck = part;
              throw new Error(`Unsupported content type: ${_exhaustiveCheck}`);
            }
          }
        }).join("");
        text += `${user}:
${userMessage}

`;
        break;
      }
      case "assistant": {
        const assistantMessage = content.map((part) => {
          switch (part.type) {
            case "text": {
              return part.text;
            }
            case "tool-call": {
              throw new UnsupportedFunctionalityError2({
                functionality: "tool-call messages"
              });
            }
            default: {
              const _exhaustiveCheck = part;
              throw new Error(`Unsupported content type: ${_exhaustiveCheck}`);
            }
          }
        }).join("");
        text += `${assistant}:
${assistantMessage}

`;
        break;
      }
      case "tool": {
        throw new UnsupportedFunctionalityError2({
          functionality: "tool messages"
        });
      }
      default: {
        const _exhaustiveCheck = role;
        throw new Error(`Unsupported role: ${_exhaustiveCheck}`);
      }
    }
  }
  text += `${assistant}:
`;
  return {
    prompt: text,
    stopSequences: [`
${user}:`]
  };
}

// src/map-completion-logprobs.ts
function mapCompletionLogProbs(logprobs) {
  return logprobs == null ? void 0 : logprobs.tokens.map((token, index) => {
    var _a, _b;
    return {
      token,
      logprob: (_a = logprobs.token_logprobs[index]) != null ? _a : 0,
      topLogprobs: logprobs.top_logprobs ? Object.entries((_b = logprobs.top_logprobs[index]) != null ? _b : {}).map(
        ([token2, logprob]) => ({
          token: token2,
          logprob
        })
      ) : []
    };
  });
}

// src/completion-language-model.ts
var CompletionLanguageModel = class {
  constructor(modelId, settings, config) {
    this.specificationVersion = "v1";
    this.defaultObjectGenerationMode = void 0;
    this.modelId = modelId;
    this.settings = settings;
    this.config = config;
  }
  get provider() {
    return this.config.provider;
  }
  getArgs({
    mode,
    inputFormat,
    prompt,
    maxTokens,
    temperature,
    topP,
    frequencyPenalty,
    presencePenalty,
    seed
  }) {
    var _a;
    const type = mode.type;
    const { prompt: completionPrompt, stopSequences } = convertToCompletionPrompt({ prompt, inputFormat });
    const baseArgs = __spreadValues({
      // model id:
      model: this.modelId,
      // model specific settings:
      echo: this.settings.echo,
      logit_bias: this.settings.logitBias,
      logprobs: typeof this.settings.logprobs === "number" ? this.settings.logprobs : typeof this.settings.logprobs === "boolean" ? this.settings.logprobs ? 0 : void 0 : void 0,
      suffix: this.settings.suffix,
      user: this.settings.user,
      // standardized settings:
      max_tokens: maxTokens,
      temperature,
      top_p: topP,
      frequency_penalty: frequencyPenalty,
      presence_penalty: presencePenalty,
      seed,
      // prompt:
      prompt: completionPrompt,
      // stop sequences:
      stop: stopSequences
    }, this.config.extraBody);
    switch (type) {
      case "regular": {
        if ((_a = mode.tools) == null ? void 0 : _a.length) {
          throw new UnsupportedFunctionalityError3({
            functionality: "tools"
          });
        }
        if (mode.toolChoice) {
          throw new UnsupportedFunctionalityError3({
            functionality: "toolChoice"
          });
        }
        return baseArgs;
      }
      case "object-json": {
        throw new UnsupportedFunctionalityError3({
          functionality: "object-json mode"
        });
      }
      case "object-tool": {
        throw new UnsupportedFunctionalityError3({
          functionality: "object-tool mode"
        });
      }
      // Handle all non-text types with a single default case
      default: {
        const _exhaustiveCheck = type;
        throw new UnsupportedFunctionalityError3({
          functionality: `${_exhaustiveCheck} mode`
        });
      }
    }
  }
  async doGenerate(options) {
    const args = this.getArgs(options);
    const { responseHeaders, value: response } = await postJsonToApi2({
      url: this.config.url({
        path: "/completions",
        modelId: this.modelId
      }),
      headers: combineHeaders2(this.config.headers(), options.headers),
      body: args,
      failedResponseHandler: FailedResponseHandler,
      successfulResponseHandler: createJsonResponseHandler2(
        openAICompletionResponseSchema
      ),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch
    });
    const _a = args, { prompt: rawPrompt } = _a, rawSettings = __objRest(_a, ["prompt"]);
    const choice = response.choices[0];
    if (!choice) {
      throw new Error("No choice in  completion response");
    }
    return {
      text: choice.text,
      usage: {
        promptTokens: response.usage.prompt_tokens,
        completionTokens: response.usage.completion_tokens
      },
      finishReason: mapFinishReason(choice.finish_reason),
      logprobs: mapCompletionLogProbs(choice.logprobs),
      rawCall: { rawPrompt, rawSettings },
      rawResponse: { headers: responseHeaders },
      warnings: []
    };
  }
  async doStream(options) {
    const args = this.getArgs(options);
    const { responseHeaders, value: response } = await postJsonToApi2({
      url: this.config.url({
        path: "/completions",
        modelId: this.modelId
      }),
      headers: combineHeaders2(this.config.headers(), options.headers),
      body: __spreadProps(__spreadValues({}, this.getArgs(options)), {
        stream: true,
        // only include stream_options when in strict compatibility mode:
        stream_options: this.config.compatibility === "strict" ? { include_usage: true } : void 0
      }),
      failedResponseHandler: FailedResponseHandler,
      successfulResponseHandler: createEventSourceResponseHandler2(
        CompletionChunkSchema
      ),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch
    });
    const _a = args, { prompt: rawPrompt } = _a, rawSettings = __objRest(_a, ["prompt"]);
    let finishReason = "other";
    let usage = {
      promptTokens: Number.NaN,
      completionTokens: Number.NaN
    };
    let logprobs;
    return {
      stream: response.pipeThrough(
        new TransformStream({
          transform(chunk, controller) {
            if (!chunk.success) {
              finishReason = "error";
              controller.enqueue({ type: "error", error: chunk.error });
              return;
            }
            const value = chunk.value;
            if ("error" in value) {
              finishReason = "error";
              controller.enqueue({ type: "error", error: value.error });
              return;
            }
            if (value.usage != null) {
              usage = {
                promptTokens: value.usage.prompt_tokens,
                completionTokens: value.usage.completion_tokens
              };
            }
            const choice = value.choices[0];
            if ((choice == null ? void 0 : choice.finish_reason) != null) {
              finishReason = mapFinishReason(choice.finish_reason);
            }
            if ((choice == null ? void 0 : choice.text) != null) {
              controller.enqueue({
                type: "text-delta",
                textDelta: choice.text
              });
            }
            const mappedLogprobs = mapCompletionLogProbs(
              choice == null ? void 0 : choice.logprobs
            );
            if (mappedLogprobs == null ? void 0 : mappedLogprobs.length) {
              if (logprobs === void 0) logprobs = [];
              logprobs.push(...mappedLogprobs);
            }
          },
          flush(controller) {
            controller.enqueue({
              type: "finish",
              finishReason,
              logprobs,
              usage
            });
          }
        })
      ),
      rawCall: { rawPrompt, rawSettings },
      rawResponse: { headers: responseHeaders },
      warnings: []
    };
  }
};
var openAICompletionResponseSchema = z3.object({
  choices: z3.array(
    z3.object({
      text: z3.string(),
      finish_reason: z3.string(),
      logprobs: z3.object({
        tokens: z3.array(z3.string()),
        token_logprobs: z3.array(z3.number()),
        top_logprobs: z3.array(z3.record(z3.string(), z3.number())).nullable()
      }).nullable().optional()
    })
  ),
  usage: z3.object({
    prompt_tokens: z3.number(),
    completion_tokens: z3.number()
  })
});
var CompletionChunkSchema = z3.union([
  z3.object({
    choices: z3.array(
      z3.object({
        text: z3.string(),
        finish_reason: z3.string().nullish(),
        index: z3.number(),
        logprobs: z3.object({
          tokens: z3.array(z3.string()),
          token_logprobs: z3.array(z3.number()),
          top_logprobs: z3.array(z3.record(z3.string(), z3.number())).nullable()
        }).nullable().optional()
      })
    ),
    usage: z3.object({
      prompt_tokens: z3.number(),
      completion_tokens: z3.number()
    }).optional().nullable()
  }),
  openAIErrorDataSchema
]);

// src/facade.ts
var AIProvider = class {
  /**
   * Creates a new  provider instance.
   */
  constructor(options = {}) {
    var _a, _b;
    this.baseURL = (_b = withoutTrailingSlash((_a = options.baseURL) != null ? _a : options.baseUrl)) != null ? _b : "http://localhost:8080/api/v1";
    this.apiKey = options.apiKey;
    this.headers = options.headers;
  }
  get baseConfig() {
    return {
      baseURL: this.baseURL,
      headers: () => __spreadValues({
        Authorization: `Bearer ${loadApiKey({
          apiKey: this.apiKey,
          environmentVariableName: "API_KEY",
          description: ""
        })}`
      }, this.headers)
    };
  }
  chat(modelId, settings = {}) {
    return new ChatLanguageModel(modelId, settings, __spreadProps(__spreadValues({
      provider: "ai.chat"
    }, this.baseConfig), {
      compatibility: "strict",
      url: ({ path }) => `${this.baseURL}${path}`
    }));
  }
  completion(modelId, settings = {}) {
    return new CompletionLanguageModel(modelId, settings, __spreadProps(__spreadValues({
      provider: "ai.completion"
    }, this.baseConfig), {
      compatibility: "strict",
      url: ({ path }) => `${this.baseURL}${path}`
    }));
  }
};

// src/provider.ts
import { loadApiKey as loadApiKey2, withoutTrailingSlash as withoutTrailingSlash2 } from "@ai-sdk/provider-utils";
function create(options = {}) {
  var _a, _b, _c;
  const baseURL = (_b = withoutTrailingSlash2((_a = options.baseURL) != null ? _a : options.baseUrl)) != null ? _b : "http://localhost:8080/api/v1";
  const compatibility = (_c = options.compatibility) != null ? _c : "compatible";
  const getHeaders = () => __spreadValues({
    Authorization: `Bearer ${loadApiKey2({
      apiKey: options.apiKey,
      environmentVariableName: "API_KEY",
      description: ""
    })}`
  }, options.headers);
  const createChatModel = (modelId, settings = {}) => new ChatLanguageModel(modelId, settings, {
    provider: "ai.chat",
    url: ({ path }) => `${baseURL}${path}`,
    headers: getHeaders,
    compatibility,
    fetch: options.fetch,
    extraBody: options.extraBody
  });
  const createCompletionModel = (modelId, settings = {}) => new CompletionLanguageModel(modelId, settings, {
    provider: "ai.completion",
    url: ({ path }) => `${baseURL}${path}`,
    headers: getHeaders,
    compatibility,
    fetch: options.fetch,
    extraBody: options.extraBody
  });
  const createLanguageModel = (modelId, settings) => {
    if (new.target) {
      throw new Error(
        "The  model function cannot be called with the new keyword."
      );
    }
    return createChatModel(modelId, settings);
  };
  const provider2 = function(modelId, settings) {
    return createLanguageModel(modelId, settings);
  };
  provider2.languageModel = createLanguageModel;
  provider2.chat = createChatModel;
  provider2.completion = createCompletionModel;
  return provider2;
}
var provider = create({
  compatibility: "strict"
  // strict for  API
});
export {
  AIProvider,
  create,
  provider
};
//# sourceMappingURL=index.mjs.map