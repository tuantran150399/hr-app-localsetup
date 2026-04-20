declare const BASE = "http://localhost:3000/api/v1";
declare function req<T = any>(method: string, path: string, body?: unknown, token?: string): Promise<T>;
declare function pass(msg: string): void;
declare function fail(msg: string, err?: unknown): void;
declare function main(): Promise<void>;
