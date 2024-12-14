import { env } from "node:process";
import { Message } from "../types";
import { OpenAI } from "openai";
import EventEmitter from "events";

const NVIDIA_API_KEY = env.NVIDIA_API_KEY;
const MODEL_NAME = "ibm/granite-34b-code-instruct";

// Create an event emitter for streaming responses
export const aiEventEmitter = new EventEmitter();

const client = new OpenAI({
  baseURL: "https://integrate.api.nvidia.com/v1",
  apiKey: NVIDIA_API_KEY || "",
});

export async function handleQuery(
  query: string,
  currentFile: string | null,
): Promise<Message> {
  if (!NVIDIA_API_KEY) {
    console.error("NVIDIA API key is not set");
    throw new Error("NEED_NEW_API_KEY");
  }

  try {
    console.log("Creating completion with NVIDIA API...");
    const promptText = `${query}${currentFile ? `\n\nContext: Currently editing ${currentFile}` : ""}`;

    const completion = await client.chat.completions.create({
      model: MODEL_NAME,
      messages: [
        {
          role: "user",
          content: promptText,
        },
      ],
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

          // Emit the chunk through the event emitter
          const message: Message = {
            id: Date.now().toString(),
            type: "text",
            content: content,
          };

          aiEventEmitter.emit("message", message);
        }
      }
    } catch (streamError) {
      console.error("Error during streaming:", streamError);
      aiEventEmitter.emit("error", {
        id: Date.now().toString(),
        type: "error",
        content: "Stream interrupted. Please try again.",
      });
      throw streamError;
    }

    console.log("Stream completed successfully");
    return {
      id: Date.now().toString(),
      type: "text",
      content: fullResponse || "No response received from AI",
    };
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

    // Log the full error for debugging
    console.error("Detailed error:", JSON.stringify(error, null, 2));

    const errorMessage: Message = {
      id: Date.now().toString(),
      type: "error",
      content: "Failed to get response from AI. Please try again later.",
    };
    aiEventEmitter.emit("error", errorMessage);
    return errorMessage;
  }
}