import assert from "node:assert/strict";
import { inspectStickerImage, validateStickerImage } from "../lib/sticker-validation.ts";

function bytes(parts: number[]) { return Uint8Array.from(parts).buffer; }

const png = new Uint8Array(24); png.set([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10]); png.set([0, 0, 1, 0], 16); png.set([0, 0, 0, 128], 20);
assert.deepEqual(inspectStickerImage(png.buffer), { mimeType: "image/png", width: 256, height: 128, extension: "png" });

const gif = new Uint8Array(10); gif.set([..."GIF89a"].map((character) => character.charCodeAt(0))); gif.set([32, 0, 16, 0], 6);
assert.deepEqual(inspectStickerImage(gif.buffer), { mimeType: "image/gif", width: 32, height: 16, extension: "gif" });

const jpeg = bytes([0xff, 0xd8, 0xff, 0xc0, 0, 17, 8, 0, 32, 0, 48, 3, 1, 17, 0, 2, 17, 0, 3, 17, 0]);
assert.deepEqual(inspectStickerImage(jpeg), { mimeType: "image/jpeg", width: 48, height: 32, extension: "jpg" });
assert.throws(() => inspectStickerImage(bytes([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])));
assert.throws(() => validateStickerImage({ mimeType: "image/png", width: 5000, height: 5000, extension: "png" }, 24_000_000));
console.log("sticker validation tests passed");
