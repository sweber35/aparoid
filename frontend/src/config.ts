// Auto-generated config file with API URLs from ProcessingStack
// This file is updated automatically during deployment

// API Configuration
export const API_CONFIG = {
  replayStub: 'https://mjln8hcpo5.execute-api.us-east-1.amazonaws.com/prod/',
  replayData: 'https://7htcacf9v4.execute-api.us-east-1.amazonaws.com/prod/',
  replayTag: 'https://0pfg8h7p4d.execute-api.us-east-1.amazonaws.com/prod/',
  timeout: 30000,
};

// API client for making requests to the Lambda functions
export class ApiClient {
  private timeout: number;

  constructor(timeout = API_CONFIG.timeout) {
    this.timeout = timeout;
  }

  async request(url: string, options: RequestInit = {}): Promise<any> {
    const config: RequestInit = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    if (options.body) {
      config.body = options.body;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(url, {
        ...config,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  // Replay Stub API - Process SLP replay files
  async processReplay(replayData: any) {
    return this.request(API_CONFIG.replayStub, {
      body: JSON.stringify({
        action: 'process_replay',
        data: replayData,
      }),
    });
  }

  // Replay Data API - Query replay data
  async queryReplayData(query: string) {
    return this.request(API_CONFIG.replayData, {
      body: JSON.stringify({
        action: 'query_data',
        query: query,
      }),
    });
  }

  // Replay Tag API - Get tags for a replay
  async getTags(replayId: string) {
    return this.request(API_CONFIG.replayTag, {
      body: JSON.stringify({
        action: 'get_tags',
        replayId: replayId,
      }),
    });
  }

  // Replay Tag API - Add a tag to a replay
  async addTag(replayId: string, tag: { name: string; value?: string }) {
    return this.request(API_CONFIG.replayTag, {
      body: JSON.stringify({
        action: 'add_tag',
        replayId: replayId,
        tag: tag,
      }),
    });
  }

  // Replay Tag API - Remove a tag from a replay
  async removeTag(replayId: string, tagId: string) {
    return this.request(API_CONFIG.replayTag, {
      body: JSON.stringify({
        action: 'remove_tag',
        replayId: replayId,
        tagId: tagId,
      }),
    });
  }
}

// Create a singleton instance
export const apiClient = new ApiClient();

