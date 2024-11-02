import axios, {
  type AxiosInstance,
  type AxiosResponse,
  type AxiosError,
} from "axios";

interface RateLimitConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

class RateLimitedAxios {
  private instance: AxiosInstance;
  private config: RateLimitConfig;

  constructor(config: Partial<RateLimitConfig> = {}) {
    this.config = {
      maxRetries: config.maxRetries ?? 3,
      baseDelayMs: config.baseDelayMs ?? 1000,
      maxDelayMs: config.maxDelayMs ?? 10000,
    };

    this.instance = axios.create({
      headers: {
        "Content-Type": "application/json",
      },
    });

    this.setupInterceptors();
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private getRateLimitDelay(headers: Record<string, string>): number | null {
    // Check common rate limit headers
    const resetTime =
      headers["x-ratelimit-reset"] ||
      headers["retry-after"] ||
      headers["x-retry-after"];

    if (resetTime) {
      // If it's a timestamp
      if (resetTime.length > 5) {
        const resetDate = new Date(Number(resetTime) * 1000);
        return Math.max(0, resetDate.getTime() - Date.now());
      }
      // If it's seconds
      return Number(resetTime) * 1000;
    }

    return null;
  }

  private calculateBackoffDelay(retryCount: number): number {
    const delay = Math.min(
      this.config.maxDelayMs,
      this.config.baseDelayMs * 2 ** retryCount
    );

    // Add some jitter to prevent thundering herd
    return delay + Math.random() * 100;
  }

  private setupInterceptors(): void {
    try {
      this.instance.interceptors.response.use(
        (response: AxiosResponse) => response,
        async (error: AxiosError) => {
          // biome-ignore lint/suspicious/noExplicitAny: <explanation>
          const retryCount = (error.config as any).__retryCount || 0;

          // Check if we should retry (rate limit or server error)
          if (
            retryCount < this.config.maxRetries &&
            (error.response?.status === 429 ||
              (error.response?.status ?? 0) >= 500)
          ) {
            // biome-ignore lint/suspicious/noExplicitAny: <explanation>
            (error.config as any).__retryCount = retryCount + 1;

            // Calculate delay based on rate limit headers or exponential backoff
            const rateLimitDelay = error.response?.headers
              ? this.getRateLimitDelay(
                  error.response.headers as Record<string, string>
                )
              : null;

            const delay =
              rateLimitDelay ?? this.calculateBackoffDelay(retryCount);

            // Log retry attempt (you might want to use proper logging in production)
            console.log(
              `Retrying request after ${delay}ms (attempt ${retryCount + 1}/${
                this.config.maxRetries
              })`
            );

            // Wait for the calculated delay
            await this.sleep(delay);

            // Retry the request
            // @ts-expect-error
            return this.instance(error.config);
          }

          return Promise.reject(error);
        }
      );
    } catch (error) {
      console.log(`An error occurred while setting up interceptors: ${error}`);
    }
  }

  // Expose the axios instance methods
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  public get<T = any>(url: string, config?: any): Promise<AxiosResponse<T>> {
    return this.instance.get(url, config);
  }

  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  public post<T = any>(
    url: string,
    data?: any,
    config?: any
  ): Promise<AxiosResponse<T>> {
    return this.instance.post(url, data, config);
  }

  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  public put<T = any>(
    url: string,
    data?: any,
    config?: any
  ): Promise<AxiosResponse<T>> {
    return this.instance.put(url, data, config);
  }

  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  public delete<T = any>(url: string, config?: any): Promise<AxiosResponse<T>> {
    return this.instance.delete(url, config);
  }
}

const anisync = new RateLimitedAxios({
  maxRetries: 5,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
});

export default anisync;
