// KV binding helpers

export async function kvGet<T>(kv: KVNamespace, key: string): Promise<T | null> {
  const value = await kv.get(key, 'json');
  return value as T | null;
}

export async function kvGetText(kv: KVNamespace, key: string): Promise<string | null> {
  return kv.get(key, 'text');
}

export async function kvPut<T>(
  kv: KVNamespace,
  key: string,
  value: T,
  options?: KVNamespacePutOptions,
): Promise<void> {
  await kv.put(key, JSON.stringify(value), options);
}

export async function kvPutText(
  kv: KVNamespace,
  key: string,
  value: string,
  options?: KVNamespacePutOptions,
): Promise<void> {
  await kv.put(key, value, options);
}

export async function kvDelete(kv: KVNamespace, key: string): Promise<void> {
  await kv.delete(key);
}

export async function kvList(kv: KVNamespace, prefix: string): Promise<string[]> {
  const result = await kv.list({ prefix });
  return result.keys.map((k) => k.name);
}
