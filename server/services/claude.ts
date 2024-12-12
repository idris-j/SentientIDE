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
  // Check if API key is configured
  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      id: Date.now().toString(),
      type: 'error',
      content: 'Anthropic API key is not configured. Please check your environment variables.'
    };
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
  } catch (error: any) { // Using any here because Anthropic's error types are not fully defined
    console.error('Error querying Claude:', error);
    
    // Handle specific API errors
    if (error.status === 400) {
      if (error.error?.error?.message?.includes('credit balance')) {
        console.log('Credit balance error detected, asking for API key');
        // Trigger API key request
        throw new Error('NEED_NEW_API_KEY');
      }
      return {
        id: Date.now().toString(),
        type: 'error',
        content: 'Invalid request to AI service. Please try a different query.'
      };
    } else if (error.status === 401 || error.status === 403) {
      console.log('Authentication error detected, asking for API key');
      throw new Error('NEED_NEW_API_KEY');
    } else if (error.status === 429) {
      return {
        id: Date.now().toString(),
        type: 'error',
        content: 'Rate limit reached. Please wait a moment before trying again.'
      };
    } else if (error.status >= 500) {
      return {
        id: Date.now().toString(),
        type: 'error',
        content: 'AI service is experiencing issues. Please try again later.'
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
