import { env } from 'node:process';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: env.ANTHROPIC_API_KEY
});

interface Message {
  id: string;
  type: 'text' | 'code' | 'suggestion' | 'explanation';
  content: string;
  codeLanguage?: string;
  fileName?: string;
}

export async function analyzeCode(code: string, fileName: string): Promise<Message> {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-opus-20240229',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `Analyze this code and provide suggestions for improvements:
        
        File: ${fileName}
        
        ${code}`
      }]
    });

    return {
      id: Date.now().toString(),
      type: 'suggestion',
      content: response.content[0].text,
      fileName,
      codeLanguage: fileName.split('.').pop() || 'text'
    };
  } catch (error) {
    console.error('Error analyzing code with Claude:', error);
    throw error;
  }
}

export async function handleQuery(query: string, currentFile: string | null): Promise<Message> {
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
  } catch (error) {
    console.error('Error querying Claude:', error);
    
    // Handle specific API errors
    if (error.status === 400 && error.error?.error?.message?.includes('credit balance')) {
      return {
        id: Date.now().toString(),
        type: 'error',
        content: 'The AI service is currently unavailable due to account limits. Please try again later.'
      };
    } else if (error.status === 401 || error.status === 403) {
      return {
        id: Date.now().toString(),
        type: 'error',
        content: 'Authentication error with the AI service. Please check your API key configuration.'
      };
    }
    
    // Generic error fallback
    return {
      id: Date.now().toString(),
      type: 'error',
      content: 'Failed to get response from AI. Please try again later.'
    };
  }
}
