export {};

declare global {
  interface Window {
    ymaps?: unknown; // или any, если нужно проще
  }
}