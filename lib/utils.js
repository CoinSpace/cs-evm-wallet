import * as errors from './errors.js';
import { HDKey } from '@scure/bip32';
import { utils as commonUtils } from '@coinspace/cs-common';
import { hmac } from '@noble/hashes/hmac';
import { sha512 } from '@noble/hashes/sha512';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils';

const MASTER_SECRET = utf8ToBytes('Bitcoin seed');

// var transferTokenHash = ethUtil.keccak('transfer(address,uint256)').toString('hex').substr(0, 8);
const transferTokenHash = 'a9059cbb';

function privateKeyFromMasterSeed(masterSeed, path, platform) {
  const legacyM = ['ethereum-classic', 'ethereum'].includes(platform);
  const seed = (path === 'm' && legacyM) ? utf8ToBytes(bytesToHex(masterSeed)) : masterSeed;
  const I = hmac(sha512, MASTER_SECRET, seed);
  return new HDKey({
    chainCode: I.slice(32),
    privateKey: I.slice(0, 32),
  }).derive(path).privateKey;
}

function validateAddress(address) {
  if (!/^(0x)[0-9a-f]{40}$/.test(address)) {
    throw new errors.InvalidAddressError(address);
  }
}

function tokenTransferData(address, value) {
  let data = '0x' + transferTokenHash;
  data += address.substr(2).padStart(64, '0');
  data += value.toString(16).padStart(64, '0');
  return data;
}

function minBigInt(a, b) {
  return a < b ? a : b;
}

function multiplyGasPrice(gasPrice, rbfFactor) {
  const value = commonUtils.multiplyAtom(gasPrice, rbfFactor);
  if (value === gasPrice) return value + 1n;
  return value;
}

export default {
  privateKeyFromMasterSeed,
  validateAddress,
  tokenTransferData,
  minBigInt,
  multiplyGasPrice,
};
