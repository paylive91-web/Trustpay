import { test } from "node:test";
import assert from "node:assert/strict";
import {
  api, registerUser, adminLogin, setUserBalance, getUser,
  insertSellChunk, setOrderConfirmDeadline, findDisputeForOrder,
  highValueRowsForOrder, freshUsername, freshPhone,
  TINY_PNG, TINY_PDF, uniqueImg,
} from "./helpers.js";

// ─── AUTH: register-with-username + login by either identifier ──────────────

test("auth: register requires username + phone + password", async () => {
  const r1 = await api("/auth/register", { method: "POST", body: { username: "ab", phone: "9876543210", password: "test1234" } });
  assert.equal(r1.status, 400, "username too short rejected");
  const r2 = await api("/auth/register", { method: "POST", body: { username: freshUsername(), phone: "12345", password: "test1234" } });
  assert.equal(r2.status, 400, "bad phone rejected");
});

test("auth: register then login by username AND by phone", async () => {
  const u = await registerUser("auth");
  const byUser = await api("/auth/login", { method: "POST", body: { identifier: u.username, password: u.password } });
  assert.equal(byUser.status, 200, `username login: ${JSON.stringify(byUser.data)}`);
  assert.equal(byUser.data.user.id, u.id);
  const byPhone = await api("/auth/login", { method: "POST", body: { identifier: u.phone, password: u.password } });
  assert.equal(byPhone.status, 200, `phone login: ${JSON.stringify(byPhone.data)}`);
  assert.equal(byPhone.data.user.id, u.id);
  // Legacy { phone } and { username } fields also work
  const legacy = await api("/auth/login", { method: "POST", body: { username: u.phone, password: u.password } });
  assert.equal(legacy.status, 200);
});

test("auth: duplicate username and duplicate phone both rejected", async () => {
  const u = await registerUser("dup");
  const dupUser = await api("/auth/register", { method: "POST", body: { username: u.username, phone: freshPhone(), password: "test1234" } });
  assert.equal(dupUser.status, 400);
  const dupPhone = await api("/auth/register", { method: "POST", body: { username: freshUsername(), phone: u.phone, password: "test1234" } });
  assert.equal(dupPhone.status, 400);
});

// ─── HELD-BALANCE math: lock / cancel / settle ──────────────────────────────

test("held-balance: lock moves balance->heldBalance and stores per-order heldAmount", async () => {
  const seller = await registerUser("sel");
  const buyer = await registerUser("buy");
  await setUserBalance(seller.id, 600);
  const chunkId = await insertSellChunk(seller.id, 200);

  const r = await api(`/p2p/lock/${chunkId}`, { method: "POST", token: buyer.token });
  assert.equal(r.status, 200, `lock: ${JSON.stringify(r.data)}`);

  const s = await getUser(seller.id);
  assert.equal(parseFloat(s.balance), 400, "seller balance debited 200");
  assert.equal(parseFloat(s.heldBalance), 200, "seller heldBalance credited 200");

  const ordersAfter = await api("/p2p/my-buy", { token: buyer.token });
  assert.equal(ordersAfter.data.id, chunkId);
});

test("held-balance: cancel restores balance and zeroes hold", async () => {
  const seller = await registerUser("selc");
  const buyer = await registerUser("buyc");
  await setUserBalance(seller.id, 500);
  const chunkId = await insertSellChunk(seller.id, 150);
  await api(`/p2p/lock/${chunkId}`, { method: "POST", token: buyer.token });
  const r = await api(`/p2p/cancel/${chunkId}`, { method: "POST", token: buyer.token });
  assert.equal(r.status, 200);
  const s = await getUser(seller.id);
  assert.equal(parseFloat(s.balance), 500, "balance restored");
  assert.equal(parseFloat(s.heldBalance), 0, "hold released");
});

test("held-balance: settle on seller confirm credits buyer and clears seller hold", async () => {
  const seller = await registerUser("sels");
  const buyer = await registerUser("buys");
  await setUserBalance(seller.id, 1000);
  const chunkId = await insertSellChunk(seller.id, 300);
  await api(`/p2p/lock/${chunkId}`, { method: "POST", token: buyer.token });
  const submit = await api(`/p2p/submit/${chunkId}`, {
    method: "POST", token: buyer.token,
    body: { utrNumber: "UTR" + Math.floor(Math.random() * 1e10), screenshotUrl: uniqueImg(), recordingUrl: uniqueImg() },
  });
  assert.equal(submit.status, 200, `submit: ${JSON.stringify(submit.data)}`);

  // Seller confirms settlement.
  const conf = await api(`/p2p/confirm/${chunkId}`, { method: "POST", token: seller.token });
  assert.equal(conf.status, 200, `confirm: ${JSON.stringify(conf.data)}`);

  const s = await getUser(seller.id);
  assert.equal(parseFloat(s.balance), 700, "seller balance net -300");
  assert.equal(parseFloat(s.heldBalance), 0, "seller hold cleared");
  const b = await getUser(buyer.id);
  // 5% reward at 300 = 15; total credit 315
  assert.equal(parseFloat(b.balance), 315, "buyer credited amount + reward");
});

// ─── SINGLE-ACTIVE-BUY enforcement ──────────────────────────────────────────

test("single-active-buy: second lock rejected while first is active", async () => {
  const seller = await registerUser("selx");
  const buyer = await registerUser("buyx");
  await setUserBalance(seller.id, 1000);
  const c1 = await insertSellChunk(seller.id, 100);
  const c2 = await insertSellChunk(seller.id, 100);
  const a = await api(`/p2p/lock/${c1}`, { method: "POST", token: buyer.token });
  assert.equal(a.status, 200);
  const b = await api(`/p2p/lock/${c2}`, { method: "POST", token: buyer.token });
  assert.equal(b.status, 400, "should reject second active buy");
  assert.match(JSON.stringify(b.data), /active buy/i);
});

// ─── HIGH-VALUE tier logging on settlement ─────────────────────────────────

test("high-value: settlement >= ₹5000 logs 'warn' tier", async () => {
  const seller = await registerUser("hvw");
  const buyer = await registerUser("hvwb");
  await setUserBalance(seller.id, 7000);
  const chunkId = await insertSellChunk(seller.id, 6000);
  await api(`/p2p/lock/${chunkId}`, { method: "POST", token: buyer.token });
  await api(`/p2p/submit/${chunkId}`, {
    method: "POST", token: buyer.token,
    body: { utrNumber: "UTRHV" + Math.floor(Math.random() * 1e10), screenshotUrl: uniqueImg(), recordingUrl: uniqueImg() },
  });
  await api(`/p2p/confirm/${chunkId}`, { method: "POST", token: seller.token });
  const rows = await highValueRowsForOrder(chunkId);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].tier, "warn");
  assert.equal(rows[0].userId, buyer.id);
  assert.equal(parseFloat(rows[0].amount), 6000);
});

test("high-value: settlement >= ₹10000 logs 'critical' tier", async () => {
  const seller = await registerUser("hvc");
  const buyer = await registerUser("hvcb");
  await setUserBalance(seller.id, 12000);
  const chunkId = await insertSellChunk(seller.id, 11000);
  await api(`/p2p/lock/${chunkId}`, { method: "POST", token: buyer.token });
  await api(`/p2p/submit/${chunkId}`, {
    method: "POST", token: buyer.token,
    body: { utrNumber: "UTRC" + Math.floor(Math.random() * 1e10), screenshotUrl: uniqueImg(), recordingUrl: uniqueImg() },
  });
  await api(`/p2p/confirm/${chunkId}`, { method: "POST", token: seller.token });
  const rows = await highValueRowsForOrder(chunkId);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].tier, "critical");
});

test("high-value: admin /admin/high-value lists logged event with filter", async () => {
  const admin = await adminLogin();
  const seller = await registerUser("hva");
  const buyer = await registerUser("hvab");
  await setUserBalance(seller.id, 9000);
  const chunkId = await insertSellChunk(seller.id, 8000);
  await api(`/p2p/lock/${chunkId}`, { method: "POST", token: buyer.token });
  await api(`/p2p/submit/${chunkId}`, {
    method: "POST", token: buyer.token,
    body: { utrNumber: "UTRA" + Math.floor(Math.random() * 1e10), screenshotUrl: uniqueImg(), recordingUrl: uniqueImg() },
  });
  await api(`/p2p/confirm/${chunkId}`, { method: "POST", token: seller.token });

  interface HighValueRow { orderId: number; tier: string; amount?: string }
  const list = await api(`/admin/high-value?tier=warn`, { token: admin.token });
  assert.equal(list.status, 200);
  assert.ok(Array.isArray(list.data));
  const rows = list.data as HighValueRow[];
  const found = rows.find((r) => r.orderId === chunkId);
  assert.ok(found, "high-value event surfaced via admin list");
  assert.equal(found!.tier, "warn");
});

// ─── DISPUTE proof upload ──────────────────────────────────────────────────

test("dispute proof: buyer upload rejects non-image/pdf and accepts valid PNG", async () => {
  const seller = await registerUser("dpsl");
  const buyer = await registerUser("dpbu");
  await setUserBalance(seller.id, 800);
  const chunkId = await insertSellChunk(seller.id, 250);
  await api(`/p2p/lock/${chunkId}`, { method: "POST", token: buyer.token });
  await api(`/p2p/submit/${chunkId}`, {
    method: "POST", token: buyer.token,
    body: { utrNumber: "UTRDP" + Math.floor(Math.random() * 1e10), screenshotUrl: uniqueImg(), recordingUrl: uniqueImg() },
  });
  // Seller raises dispute
  const disp = await api(`/p2p/dispute/${chunkId}`, { method: "POST", token: seller.token, body: { reason: "no payment" } });
  assert.equal(disp.status, 200);
  const d = await findDisputeForOrder(chunkId);
  assert.ok(d, "dispute row exists");

  // Bad mime rejected
  const bad = await api(`/disputes/buyer-proof/${d!.id}`, {
    method: "POST", token: buyer.token,
    body: { bankStatementUrl: "data:text/plain;base64,aGVsbG8=" },
  });
  assert.equal(bad.status, 400);

  // Wrong user rejected (seller can't post buyer-proof)
  const wrongUser = await api(`/disputes/buyer-proof/${d!.id}`, {
    method: "POST", token: seller.token,
    body: { bankStatementUrl: TINY_PNG },
  });
  assert.equal(wrongUser.status, 400);

  // Valid PNG accepted
  const ok = await api(`/disputes/buyer-proof/${d!.id}`, {
    method: "POST", token: buyer.token, body: { bankStatementUrl: TINY_PNG },
  });
  assert.equal(ok.status, 200, `proof upload: ${JSON.stringify(ok.data)}`);

  // PDF also accepted for buyer bank statement
  const pdfOk = await api(`/disputes/buyer-proof/${d!.id}`, {
    method: "POST", token: buyer.token, body: { bankStatementUrl: TINY_PDF },
  });
  assert.equal(pdfOk.status, 200);

  const updated = await findDisputeForOrder(chunkId);
  assert.ok(updated!.buyerProofAt, "buyerProofAt timestamp recorded");
  assert.ok(updated!.buyerBankStatementUrl, "stored proof URL");
});

test("dispute proof: seller upload requires all three proofs and validates each", async () => {
  const seller = await registerUser("dps2");
  const buyer = await registerUser("dpb2");
  await setUserBalance(seller.id, 800);
  const chunkId = await insertSellChunk(seller.id, 250);
  await api(`/p2p/lock/${chunkId}`, { method: "POST", token: buyer.token });
  await api(`/p2p/submit/${chunkId}`, {
    method: "POST", token: buyer.token,
    body: { utrNumber: "UTRSL" + Math.floor(Math.random() * 1e10), screenshotUrl: uniqueImg(), recordingUrl: uniqueImg() },
  });
  await api(`/p2p/dispute/${chunkId}`, { method: "POST", token: seller.token, body: { reason: "no payment" } });
  const d = await findDisputeForOrder(chunkId);

  // Missing field
  const missing = await api(`/disputes/seller-proof/${d!.id}`, {
    method: "POST", token: seller.token,
    body: { bankStatementUrl: TINY_PNG, recordingUrl: TINY_PNG },
  });
  assert.equal(missing.status, 400);

  // recordingUrl is image-only — PDF rejected for that field
  const wrongMime = await api(`/disputes/seller-proof/${d!.id}`, {
    method: "POST", token: seller.token,
    body: { bankStatementUrl: TINY_PNG, recordingUrl: TINY_PDF, lastTxnScreenshotUrl: TINY_PNG },
  });
  assert.equal(wrongMime.status, 400);

  // All valid
  const ok = await api(`/disputes/seller-proof/${d!.id}`, {
    method: "POST", token: seller.token,
    body: { bankStatementUrl: TINY_PNG, recordingUrl: TINY_PNG, lastTxnScreenshotUrl: TINY_PNG },
  });
  assert.equal(ok.status, 200);
  const updated = await findDisputeForOrder(chunkId);
  assert.ok(updated!.sellerProofAt);
});

test("dispute: lock blocked while user has open dispute", async () => {
  const seller = await registerUser("ds1");
  const buyer = await registerUser("db1");
  await setUserBalance(seller.id, 600);
  const c = await insertSellChunk(seller.id, 150);
  await api(`/p2p/lock/${c}`, { method: "POST", token: buyer.token });
  await api(`/p2p/submit/${c}`, {
    method: "POST", token: buyer.token,
    body: { utrNumber: "UTRBL" + Math.floor(Math.random() * 1e10), screenshotUrl: uniqueImg(), recordingUrl: uniqueImg() },
  });
  await api(`/p2p/dispute/${c}`, { method: "POST", token: seller.token, body: { reason: "no payment" } });

  // Buyer now has open dispute → fresh lock attempt rejected
  const c2 = await insertSellChunk(seller.id, 100);
  const blocked = await api(`/p2p/lock/${c2}`, { method: "POST", token: buyer.token });
  assert.equal(blocked.status, 403);
  assert.match(JSON.stringify(blocked.data), /open dispute/i);
});

// ─── FRAUD RULE TOGGLES ─────────────────────────────────────────────────────

test("fraud-rules: list, toggle off+on, validate, and require admin", async () => {
  const admin = await adminLogin();
  // List endpoint requires admin
  const noAuth = await api("/admin/fraud-rules");
  assert.equal(noAuth.status, 401);

  const listed = await api("/admin/fraud-rules", { token: admin.token });
  assert.equal(listed.status, 200);
  assert.ok(Array.isArray(listed.data) && listed.data.length >= 28, `expected 28+ rules, got ${listed.data?.length}`);
  const sample = listed.data.find((r: any) => r.rule === "duplicate_utr");
  assert.ok(sample, "duplicate_utr rule must be in canonical list");
  assert.equal(typeof sample.enabled, "boolean");

  // Unknown rule rejected
  const bad = await api("/admin/fraud-rules/toggle", {
    method: "POST", token: admin.token, body: { rule: "does_not_exist", enabled: false },
  });
  assert.equal(bad.status, 400);

  // Bad payload rejected
  const badBody = await api("/admin/fraud-rules/toggle", {
    method: "POST", token: admin.token, body: { rule: "duplicate_utr" },
  });
  assert.equal(badBody.status, 400);

  // Toggle off persists
  const off = await api("/admin/fraud-rules/toggle", {
    method: "POST", token: admin.token, body: { rule: "duplicate_utr", enabled: false },
  });
  assert.equal(off.status, 200);
  // Cache TTL is 5s; wait so the next read sees the new value.
  await new Promise((r) => setTimeout(r, 5500));
  const after = await api("/admin/fraud-rules", { token: admin.token });
  const dup = after.data.find((r: any) => r.rule === "duplicate_utr");
  assert.equal(dup.enabled, false);

  // Toggle back on (cleanup so no other test is affected)
  const on = await api("/admin/fraud-rules/toggle", {
    method: "POST", token: admin.token, body: { rule: "duplicate_utr", enabled: true },
  });
  assert.equal(on.status, 200);
});
