/**
 * UUID v5 inline: `crypto.subtle` is asynchronous and Node's `crypto` is Node
 * only, and id derivation has to be synchronous and portable.
 */
import { bytesOfUuid } from "./bytes-of-uuid";
import { formatUuid } from "./format-uuid";
import { sha1 } from "./sha1";
import { utf8 } from "./utf8";

/** Compatible with `uuid`'s `v5`. */
export function uuidV5(name: string, namespace: string): string {
  const namespaceBytes = bytesOfUuid(namespace);
  const nameBytes = utf8(name);
  const input = new Uint8Array(namespaceBytes.length + nameBytes.length);

  input.set(namespaceBytes);
  input.set(nameBytes, namespaceBytes.length);

  const hash = sha1(input);

  // Version 5 in the high nibble of byte 6, RFC 4122 variant in byte 8.
  hash[6] = ((hash[6] ?? 0) & 0x0f) | 0x50;
  hash[8] = ((hash[8] ?? 0) & 0x3f) | 0x80;

  return formatUuid(hash);
}
