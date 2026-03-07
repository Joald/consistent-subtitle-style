/**
 * Compile-time constants injected by esbuild (see esbuild.config.js `define`).
 * TypeScript sees these as declared globals; esbuild replaces them with
 * boolean literals before bundling so dead-code elimination removes any
 * `if (__DEV__) { ... }` branches in production.
 */
declare const __DEV__: boolean;
declare const DEBUG: boolean;
