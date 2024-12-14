import { EventEmitter } from "events";
import { OpenAI } from "openai";
import type { Message } from "../types";

const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY_AIDEVSPHERE;
const MODEL_NAME = "ibm/granite-34b-code-instruct";

// Create an event emitter for streaming responses
export const aiEventEmitter = new EventEmitter();

let client: OpenAI | null = null;

function initializeClient() {
  if (!NVIDIA_API_KEY) {
    console.error("NVIDIA_API_KEY_AIDEVSPHERE is not set in environment variables");
    throw new Error("NEED_NEW_API_KEY");
  }

  if (!client) {
    client = new OpenAI({
      baseURL: "https://integrate.api.nvidia.com/v1",
      apiKey: NVIDIA_API_KEY,
    });
    console.log("NVIDIA API client initialized successfully");
  }

  return client;
}

export async function handleQuery(
  query: string,
  currentFile: string | null,
): Promise<Message> {
  try {
    const apiClient = initializeClient();
    console.log("Creating completion with NVIDIA API...");
    
    const promptText = `${query}${currentFile ? `\n\nContext: Currently editing ${currentFile}` : ""}`;

    const completion = await apiClient.chat.completions.create({
      model: MODEL_NAME,
      messages: [{ role: "user", content: promptText }],
      temperature: 0.5,
      top_p: 1,
      max_tokens: 1024,
      stream: true,
    });

    let fullResponse = "";
    console.log("Starting to stream response...");

    try {
      for await (const chunk of completion) {
        if (chunk.choices[0]?.delta?.content) {
          const content = chunk.choices[0].delta.content;
          fullResponse += content;

          const message: Message = {
            id: Date.now().toString(),
            type: "text",
            content: content,
          };

          aiEventEmitter.emit("message", message);
        }
      }

      const finalMessage: Message = {
        id: Date.now().toString(),
        type: "text",
        content: fullResponse,
      };
      
      aiEventEmitter.emit("message", finalMessage);
      return finalMessage;

    } catch (streamError) {
      console.error('Streaming error:', streamError);
      const errorMessage: Message = {
        id: Date.now().toString(),
        type: "error",
        content: "Stream interrupted. Please try again.",
      };
      aiEventEmitter.emit("error", errorMessage);
      return errorMessage;
    }

  } catch (error: any) {
    console.error("Error querying NVIDIA API:", error);

    if (error.response?.status === 401 || error.response?.status === 403) {
      console.error("Authentication error with NVIDIA API");
      throw new Error("NEED_NEW_API_KEY");
    }

    if (error.response?.status === 429) {
      const message: Message = {
        id: Date.now().toString(),
        type: "error",
        content: "Rate limit exceeded. Please wait a moment before trying again.",
      };
      aiEventEmitter.emit("error", message);
      return message;
    }

    const errorMessage: Message = {
      id: Date.now().toString(),
      type: "error",
      content: error.message || "Failed to get response from AI. Please try again later.",
    };
    aiEventEmitter.emit("error", errorMessage);
    return errorMessage;
  }
}
