import 'axios';

declare module 'axios' {
  export interface AxiosRequestConfig {
    skipAuthError?: boolean;
  }
}
