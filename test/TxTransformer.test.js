import { Transaction } from '@coinspace/cs-common';
import assert from 'assert/strict';
import fs from 'fs/promises';

import TxTransformer from '../lib/TxTransformer.js';
import Wallet from '../index.js';

import networks from '../lib/networks.js';
import utils from './utils.js';

const network = networks.testnet.ethereum;
const TRANSACTIONS = JSON.parse(await fs.readFile('./test/fixtures/transactions.json')).txs;
const TOKEN_TRANSACTIONS = JSON.parse(await fs.readFile('./test/fixtures/tokenTransactions.json')).txs;

const RANDOM_PUBLIC_KEY = {
  settings: {
    bip44: "m/44'/60'/0'",
  },
  data: '0xfaAd0567f7a6CD4a583F49967D21A07af8f0B4B6',
};

const ethereumATethereum = {
  _id: 'ethereum@ethereum',
  asset: 'ethereum',
  platform: 'ethereum',
  type: 'coin',
  name: 'Ethereum',
  symbol: 'ETH',
  decimals: 18,
};

const tetherATsolana = {
  _id: 'tether@ethereum',
  platform: 'ethereum',
  type: 'token',
  address: '0xdac17f958d2ee523a2206206994597c13d831ec7',
  name: 'Tether',
  symbol: 'USDT',
  decimals: 6,
};

let defaultOptionsCoin;
let defaultOptionsToken;

describe('TxTransformer.js', () => {
  beforeEach(() => {
    defaultOptionsCoin = utils.getDefaultOptionsCoin(ethereumATethereum);
    defaultOptionsToken = utils.getDefaultOptionsToken(tetherATsolana, ethereumATethereum);
  });

  describe('transformTx (coin)', () => {
    let wallet;
    beforeEach(async () => {
      wallet = new Wallet({ ...defaultOptionsCoin });
      await wallet.open(RANDOM_PUBLIC_KEY);
    });

    it('incoming tx (pending)', async () => {
      const txTransformer = new TxTransformer({ wallet, network });
      const tx = txTransformer.transformTx(TRANSACTIONS[0]);
      assert.equal(tx.status, Transaction.STATUS_PENDING);
      assert.equal(tx.incoming, true);
      assert.equal(tx.rbf, false);
      assert.equal(tx.fee.value, 525000000000000n);
      assert.equal(tx.amount.value, 1000000000000n);
      assert.equal(tx.confirmations, 0);
      assert.equal(tx.from, '0x6b175474e89094c44da98b954eedeac495271d0f');
      assert.equal(tx.to, '0xfaad0567f7a6cd4a583f49967d21a07af8f0b4b6');
    });

    it('incoming tx (pending) - legacy', async () => {
      const txTransformer = new TxTransformer({ wallet, network });
      const tx = txTransformer.transformTx(TRANSACTIONS[1]);
      assert.equal(tx.status, Transaction.STATUS_PENDING);
      assert.equal(tx.incoming, true);
      assert.equal(tx.rbf, false);
      assert.equal(tx.fee.value, 525000000000000n);
      assert.equal(tx.amount.value, 1000000000000n);
      assert.equal(tx.confirmations, 0);
      assert.equal(tx.from, '0x6b175474e89094c44da98b954eedeac495271d0f');
      assert.equal(tx.to, '0xfaad0567f7a6cd4a583f49967d21a07af8f0b4b6');
    });

    it('incoming tx (confirmed)', async () => {
      const txTransformer = new TxTransformer({ wallet, network });
      const tx = txTransformer.transformTx(TRANSACTIONS[4]);
      assert.equal(tx.status, Transaction.STATUS_SUCCESS);
      assert.equal(tx.incoming, true);
      assert.equal(tx.rbf, false);
      assert.equal(tx.fee.value, 1959183634939154n);
      assert.equal(tx.amount.value, 1000n);
      assert.equal(tx.confirmations, 330548);
      assert.equal(tx.from, '0x6b175474e89094c44da98b954eedeac495271d0f');
      assert.equal(tx.to, '0xfaad0567f7a6cd4a583f49967d21a07af8f0b4b6');
    });

    it('outgoing tx (pending)', async () => {
      const txTransformer = new TxTransformer({ wallet, network });
      const tx = txTransformer.transformTx(TRANSACTIONS[2]);
      assert.equal(tx.status, Transaction.STATUS_PENDING);
      assert.equal(tx.incoming, false);
      assert.equal(tx.rbf, true);
      assert.equal(tx.fee.value, 5000000000000000n);
      assert.equal(tx.amount.value, 2000n);
      assert.equal(tx.confirmations, 0);
      assert.equal(tx.from, '0xfaad0567f7a6cd4a583f49967d21a07af8f0b4b6');
      assert.equal(tx.to, '0xdac17f958d2ee523a2206206994597c13d831ec7');
    });

    it('outgoing tx (pending) - legacy', async () => {
      const txTransformer = new TxTransformer({ wallet, network });
      const tx = txTransformer.transformTx(TRANSACTIONS[2]);
      assert.equal(tx.status, Transaction.STATUS_PENDING);
      assert.equal(tx.incoming, false);
      assert.equal(tx.rbf, true);
      assert.equal(tx.fee.value, 5000000000000000n);
      assert.equal(tx.amount.value, 2000n);
      assert.equal(tx.confirmations, 0);
      assert.equal(tx.from, '0xfaad0567f7a6cd4a583f49967d21a07af8f0b4b6');
      assert.equal(tx.to, '0xdac17f958d2ee523a2206206994597c13d831ec7');
    });

    it('outgoing tx (confirmed)', async () => {
      const txTransformer = new TxTransformer({ wallet, network });
      const tx = txTransformer.transformTx(TRANSACTIONS[6]);
      assert.equal(tx.status, Transaction.STATUS_SUCCESS);
      assert.equal(tx.incoming, false);
      assert.equal(tx.rbf, false);
      assert.equal(tx.fee.value, 903000000000000n);
      assert.equal(tx.amount.value, 5764100000000000n);
      assert.equal(tx.confirmations, 330629);
      assert.equal(tx.from, '0xfaad0567f7a6cd4a583f49967d21a07af8f0b4b6');
      assert.equal(tx.to, '0x4e5b2e1dc63f6b91cb6cd759936495434c7e972f');
    });

    it('outgoing tx (confirmed, but failed)', async () => {
      const txTransformer = new TxTransformer({ wallet, network });
      const tx = txTransformer.transformTx(TRANSACTIONS[5]);
      assert.equal(tx.status, Transaction.STATUS_FAILED);
      assert.equal(tx.incoming, false);
      assert.equal(tx.rbf, false);
      assert.equal(tx.fee.value, 1374474564480000n);
      assert.equal(tx.amount.value, 0n);
      assert.equal(tx.confirmations, 330587);
      assert.equal(tx.from, '0xfaad0567f7a6cd4a583f49967d21a07af8f0b4b6');
      assert.equal(tx.to, '0x6b175474e89094c44da98b954eedeac495271d0f');
    });
  });

  describe('transformTx (token)', () => {
    let wallet;
    beforeEach(async () => {
      wallet = new Wallet({ ...defaultOptionsToken });
      await wallet.open(RANDOM_PUBLIC_KEY);
    });

    it('incoming tx (confirmed)', async () => {
      const txTransformer = new TxTransformer({ wallet, network });
      const tx = txTransformer.transformTx(TOKEN_TRANSACTIONS[0]);
      assert.equal(tx.status, Transaction.STATUS_SUCCESS);
      assert.equal(tx.incoming, true);
      assert.equal(tx.rbf, false);
      assert.equal(tx.fee.value, 0n);
      assert.equal(tx.amount.value, 27063317196060000000000n);
      assert.equal(tx.confirmations, 221939);
      assert.equal(tx.from, '0xc0da5b1113d4de22fd50ccfc94e255cb13da0c9c');
      assert.equal(tx.to, '0xfaad0567f7a6cd4a583f49967d21a07af8f0b4b6');
    });

    it('outgoing tx (confirmed)', async () => {
      const txTransformer = new TxTransformer({ wallet, network });
      const tx = txTransformer.transformTx(TOKEN_TRANSACTIONS[1]);
      assert.equal(tx.status, Transaction.STATUS_SUCCESS);
      assert.equal(tx.incoming, false);
      assert.equal(tx.rbf, false);
      assert.equal(tx.fee.value, 0n);
      assert.equal(tx.amount.value, 396000000000000000000n);
      assert.equal(tx.confirmations, 237211);
      assert.equal(tx.from, '0xfaad0567f7a6cd4a583f49967d21a07af8f0b4b6');
      assert.equal(tx.to, '0xc0da5b1113d4de22fd50ccfc94e255cb13da0c9c');
    });
  });
});
