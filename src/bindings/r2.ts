// R2 binding helpers

export async function r2Put(
  bucket: R2Bucket,
  key: string,
  body: ArrayBuffer | ReadableStream,
  options?: R2PutOptions,
): Promise<R2Object> {
  return bucket.put(key, body, options);
}

export async function r2Get(bucket: R2Bucket, key: string): Promise<R2ObjectBody | null> {
  return bucket.get(key);
}

export async function r2Head(bucket: R2Bucket, key: string): Promise<R2Object | null> {
  return bucket.head(key);
}

export async function r2Delete(bucket: R2Bucket, key: string): Promise<void> {
  await bucket.delete(key);
}

export async function r2List(bucket: R2Bucket, prefix: string): Promise<R2Objects> {
  return bucket.list({ prefix });
}
