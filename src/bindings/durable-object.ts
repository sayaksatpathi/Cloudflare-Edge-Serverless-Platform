// Durable Object binding helpers

export function getRateLimiterStub(
  namespace: DurableObjectNamespace,
  key: string,
): DurableObjectStub {
  const id = namespace.idFromName(key);
  return namespace.get(id);
}
