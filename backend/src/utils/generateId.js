import { randomUUID } from 'node:crypto';

/** UUID v4. БД також має gen_random_uuid(), але це зручно для коду. */
export function generateId() {
  return randomUUID();
}
