
import { env } from 'node:process';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: env.ANTHROPIC_API_KEY
});

interface Message {
  id: string;
  type: 'text' | 'code' | 'suggestion' | 'explanation' | 'error';
  content: string;
  codeLanguage?: string;
  fileName?: string;
}

export async function handleQuery(query: string, currentFile: string | null): Promise<Message> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('NEED_NEW_API_KEY');
  }

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-opus-20240229',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `${query}${currentFile ? `\n\nContext: Currently editing ${currentFile}` : ''}`
      }]
    });

    return {
      id: Date.now().toString(),
      type: 'text',
      content: response.content[0].text || 'No response received from AI'
    };
  } catch (error: any) {
    console.error('Error querying Claude:', error);
    
    if (error.status === 401 || error.status === 403 || 
        (error.status === 400 && error.error?.error?.message?.includes('credit balance'))) {
      throw new Error('NEED_NEW_API_KEY');
    }
    
    if (error.status === 429) {
      return {
        id: Date.now().toString(),
        type: 'error',
        content: 'Rate limit reached. Please wait a moment before trying again.'
      };
    }

    return {
      id: Date.now().toString(),
      type: 'error',
      content: 'Failed to get response from AI. Please try again later.'
    };
  }
}
