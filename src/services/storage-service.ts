// Storage service — feature flag and admin storage operations via KV

import { kvGet, kvPut, kvDelete, kvList } from '../bindings/kv';
import { KV_KEYS } from '../config';
import type { FeatureFlag, Env } from '../types';

export async function getFeatureFlag(env: Env, flagName: string): Promise<FeatureFlag> {
  const key = KV_KEYS.featureFlag(flagName);
  const stored = await kvGet<FeatureFlag>(env.KV, key);
  return stored ?? { name: flagName, enabled: false };
}

export async function setFeatureFlag(env: Env, flag: FeatureFlag): Promise<void> {
  const key = KV_KEYS.featureFlag(flag.name);
  await kvPut(env.KV, key, { ...flag, updated_at: new Date().toISOString() });
}

export async function listFeatureFlags(env: Env): Promise<FeatureFlag[]> {
  const keys = await kvList(env.KV, 'feature_flags:');
  const flags: FeatureFlag[] = [];
  for (const key of keys) {
    const flagName = key.replace('feature_flags:', '');
    const flag = await getFeatureFlag(env, flagName);
    flags.push(flag);
  }
  return flags;
}

export async function deleteFeatureFlag(env: Env, flagName: string): Promise<void> {
  const key = KV_KEYS.featureFlag(flagName);
  await kvDelete(env.KV, key);
}

export async function isMaintenanceMode(env: Env): Promise<boolean> {
  const flag = await getFeatureFlag(env, 'maintenance_mode');
  return flag.enabled;
}
