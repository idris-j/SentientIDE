import { env } from 'node:process';
import { Message } from '../types';

const NVIDIA_API_KEY = env.NVIDIA_API_KEY;
const MODEL_NAME = 'playground_llama2_70b';

export async function handleQuery(query: string, currentFile: string | null): Promise<Message> {
  if (!NVIDIA_API_KEY) {
    throw new Error('NEED_NEW_API_KEY');
  }

  try {
    const endpoint = process.env.NVIDIA_ENDPOINT || 'https://api.nvidia.com/v1/models';
    const headers = {
      'Authorization': `Bearer ${NVIDIA_API_KEY}`,
      'Content-Type': 'application/json'
    };

    const promptText = `${query}${currentFile ? `\n\nContext: Currently editing ${currentFile}` : ''}`;
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: MODEL_NAME,
        messages: [{
          role: 'user',
          content: promptText
        }],
        max_tokens: 1024,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error('NEED_NEW_API_KEY');
      }
      if (response.status === 429) {
        return {
          id: Date.now().toString(),
          type: 'error',
          content: 'Rate limit reached. Please wait a moment before trying again.'
        };
      }
      throw new Error(`NVIDIA API error: ${response.statusText}`);
    }

    const data = await response.json();
    
    return {
      id: Date.now().toString(),
      type: 'text',
      content: data.choices[0].message.content || 'No response received from AI'
    };
  } catch (error: any) {
    console.error('Error querying NVIDIA API:', error);
    
    if (error.message === 'NEED_NEW_API_KEY') {
      throw error;
    }

    return {
      id: Date.now().toString(),
      type: 'error',
      content: 'Failed to get response from AI. Please try again later.'
    };
  }
}
