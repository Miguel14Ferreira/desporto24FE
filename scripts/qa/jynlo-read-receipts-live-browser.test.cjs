'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { receiptCovers } = require('./jynlo-read-receipts-live-browser.cjs');

test('a message is unread until the confirmed recipient cursor covers its server ID', () => {
  assert.equal(receiptCovers({ peerUsername:'jynloteste02',lastReadMessageId:40 },
    'jynloteste02',41),false);
  assert.equal(receiptCovers({ peerUsername:'jynloteste02',lastReadMessageId:41 },
    'jynloteste02',41),true);
  assert.equal(receiptCovers({ peerUsername:'JYNLOTESTE02',lastReadMessageId:42 },
    'jynloteste02',41),true);
});

test('a different account or malformed receipt is never treated as read', () => {
  for (const receipt of [
    {peerUsername:'jynloteste01',lastReadMessageId:999},
    {peerUsername:'jynloteste02',lastReadMessageId:-1},
    {peerUsername:'jynloteste02',lastReadMessageId:41.5},
    {peerUsername:'jynloteste02',lastReadMessageId:'999'},
    null
  ]) assert.throws(() => receiptCovers(receipt,'jynloteste02',41));
  for (const id of [0,-5,3.5]) assert.throws(() => receiptCovers({
    peerUsername:'jynloteste02',lastReadMessageId:45
  },'jynloteste02',id));
});
