const fs = require("node:fs");
const crypto = require("node:crypto");

const [zipPath, outPath] = process.argv.slice(2);
const key = crypto.createPrivateKey(Buffer.from(process.env.CRX_TEST_PEM, "base64"));
const spki = crypto.createPublicKey(key).export({ type: "spki", format: "der" });
const zip = fs.readFileSync(zipPath);

const varint = (n) => {
  const out = [];
  for (; n > 0x7f; n = Math.floor(n / 128)) out.push((n & 0x7f) | 0x80);
  out.push(n);
  return Buffer.from(out);
};
const field = (num, data) => Buffer.concat([varint(num * 8 + 2), varint(data.length), data]);
const u32 = (n) => {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n);
  return b;
};

const signed = field(1, crypto.createHash("sha256").update(spki).digest().subarray(0, 16));
const sig = crypto.sign("sha256", Buffer.concat([Buffer.from("CRX3 SignedData\0"), u32(signed.length), signed, zip]), key);
const header = Buffer.concat([field(2, Buffer.concat([field(1, spki), field(2, sig)])), field(10000, signed)]);
fs.writeFileSync(outPath, Buffer.concat([Buffer.from("Cr24"), u32(3), u32(header.length), header, zip]));
