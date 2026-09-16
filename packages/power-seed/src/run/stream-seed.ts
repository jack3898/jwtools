import { sha1 } from "../crypto/sha1";
import { utf8 } from "../crypto/utf8";

/**
 * Hashed directly rather than through `uuidV5`, since a custom `id` may pair
 * with a namespace that is not a uuid.
 */
export function streamSeed(
  seed: number,
  target: string,
  namespace: string,
): number {
  const digest = sha1(utf8(`${seed}:${target}:${namespace}`));

  return new DataView(digest.buffer, digest.byteOffset).getUint32(0);
}
