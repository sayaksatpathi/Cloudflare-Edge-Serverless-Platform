// Queue binding helpers

import type { QueueMessage } from '../types';

export async function enqueueJob(queue: Queue, message: QueueMessage): Promise<void> {
  await queue.send(message);
}

export async function enqueueBatch(queue: Queue, messages: QueueMessage[]): Promise<void> {
  await queue.sendBatch(messages.map((m) => ({ body: m })));
}
