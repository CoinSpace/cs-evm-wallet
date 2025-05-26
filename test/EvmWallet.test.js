/* eslint-disable max-len */
import { Buffer } from 'node:buffer';
import assert from 'node:assert/strict';

import { Amount } from '@coinspace/cs-common';
import Wallet from '@coinspace/cs-evm-wallet';
import fs from 'fs/promises';
import sinon from 'sinon';

import utils from './utils.js';

// either dismiss upset disease clump hazard paddle twist fetch tissue hello buyer
const RANDOM_SEED = Buffer.from('3e818cec5efc7505369fae3f162af61130b673fa9b40e5955d5cde22a85afa03748d074356a281a5fc1dbd0b721357c56095a54de8d4bc6ecaa288f300776ae4', 'hex');
const RANDOM_PUBLIC_KEY = {
  settings: {
    bip44: "m/44'/60'/0'",
  },
  data: '0xfaAd0567f7a6CD4a583F49967D21A07af8f0B4B6',
};

const WALLET_ADDRESS = '0xfaAd0567f7a6CD4a583F49967D21A07af8f0B4B6';
const TOKEN_ADDRESS = '0xdac17f958d2ee523a2206206994597c13d831ec7';
const DESTIONATION_ADDRESS = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
const IMPORT_PRIVATE_KEY = 'd1c8e18ef9265b8e58c1d66318fd2a8366839960b71afab031ef0c3ceb324e8d';
const IMPORT_ADDRESS = '0x840f6500ee60c0acfb13cd40cbeba501d7226fda';

const TRANSACTIONS = JSON.parse(await fs.readFile('./test/fixtures/transactions.json'));
const TOKEN_TRANSACTIONS = JSON.parse(await fs.readFile('./test/fixtures/tokenTransactions.json'));
const TYPED_DATA = JSON.parse(await fs.readFile('./test/fixtures/TypedData.json'));

const ethereumATethereum = {
  _id: 'ethereum@ethereum',
  asset: 'ethereum',
  platform: 'ethereum',
  type: 'coin',
  name: 'Ethereum',
  symbol: 'ETH',
  decimals: 18,
};

const tetherATethereum = {
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

describe('EvmWallet.js', () => {
  beforeEach(() => {
    defaultOptionsCoin = utils.getDefaultOptionsCoin(ethereumATethereum);
    defaultOptionsToken = utils.getDefaultOptionsToken(tetherATethereum, ethereumATethereum);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('constructor', () => {
    it('create wallet instance (coin)', () => {
      const wallet = new Wallet({
        ...defaultOptionsCoin,
      });
      assert.equal(wallet.state, Wallet.STATE_CREATED);
      assert.equal(wallet.gasLimit, 21000n);
    });

    it('create wallet instance (token)', () => {
      const wallet = new Wallet({
        ...defaultOptionsToken,
      });
      assert.equal(wallet.state, Wallet.STATE_CREATED);
      assert.equal(wallet.gasLimit, 200000n);
      assert.equal(wallet.tokenUrl, 'https://holesky.etherscan.io/token/0xdac17f958d2ee523a2206206994597c13d831ec7');
    });

    it('wallet should have tokenUrl static method', () => {
      const url = Wallet.tokenUrl('ethereum', '0xdac17f958d2ee523a2206206994597c13d831ec7', false);
      assert.equal(url, 'https://etherscan.io/token/0xdac17f958d2ee523a2206206994597c13d831ec7');
    });
  });

  describe('create wallet', () => {
    it('should create new wallet with seed (coin)', async () => {
      const wallet = new Wallet({
        ...defaultOptionsCoin,
      });
      await wallet.create(RANDOM_SEED);
      assert.equal(wallet.state, Wallet.STATE_INITIALIZED);
      assert.equal(wallet.address, WALLET_ADDRESS);
    });

    it('should create new wallet with seed (token)', async () => {
      const wallet = new Wallet({
        ...defaultOptionsToken,
      });
      await wallet.create(RANDOM_SEED);
      assert.equal(wallet.state, Wallet.STATE_INITIALIZED);
      assert.equal(wallet.address, WALLET_ADDRESS);
    });

    it('should fails without seed', async () => {
      const wallet = new Wallet({
        ...defaultOptionsCoin,
      });
      await assert.rejects(async () => {
        await wallet.create();
      }, {
        name: 'TypeError',
        message: 'seed must be an instance of Uint8Array or Buffer, undefined provided',
      });
    });
  });

  describe('open wallet', () => {
    it('should open wallet with public key (coin)', async () => {
      const wallet = new Wallet({
        ...defaultOptionsCoin,
      });
      await wallet.open(RANDOM_PUBLIC_KEY);
      assert.equal(wallet.state, Wallet.STATE_INITIALIZED);
      assert.equal(wallet.address, WALLET_ADDRESS);
    });

    it('should open wallet with public key (token)', async () => {
      const wallet = new Wallet({
        ...defaultOptionsToken,
      });
      await wallet.open(RANDOM_PUBLIC_KEY);
      assert.equal(wallet.state, Wallet.STATE_INITIALIZED);
      assert.equal(wallet.address, WALLET_ADDRESS);
    });

    it('should fails without public key', async () => {
      const wallet = new Wallet({
        ...defaultOptionsCoin,
      });
      await assert.rejects(async () => {
        await wallet.open();
      }, {
        name: 'TypeError',
        message: 'publicKey must be an instance of Object with data property',
      });
    });
  });

  describe('storage', () => {
    it('should load initial balance from storage (coin)', async () => {
      sinon.stub(defaultOptionsCoin.storage, 'get')
        .withArgs('balance').returns('1234567890');
      const wallet = new Wallet({
        ...defaultOptionsCoin,
      });
      await wallet.open(RANDOM_PUBLIC_KEY);
      assert.equal(wallet.balance.value, 1234567890n);
    });

    it('should load initial balance from storage (token)', async () => {
      sinon.stub(defaultOptionsToken.storage, 'get')
        .withArgs('balance').returns('1234567890');
      const wallet = new Wallet({
        ...defaultOptionsToken,
      });
      await wallet.open(RANDOM_PUBLIC_KEY);
      assert.equal(wallet.balance.value, 1234567890n);
    });
  });

  describe('load', () => {
    it('should load wallet (coin)', async () => {
      const request = sinon.stub(defaultOptionsCoin, 'request');
      utils.stubCoinBalance(request, WALLET_ADDRESS, { balance: '1000000000000000000', confirmedBalance: '2000000000000000000' });
      const storage = sinon.mock(defaultOptionsCoin.storage);
      storage.expects('set').once().withArgs('balance', '1000000000000000000');
      storage.expects('save').once();
      const wallet = new Wallet({
        ...defaultOptionsCoin,
      });
      await wallet.open(RANDOM_PUBLIC_KEY);
      await wallet.load();
      assert.equal(wallet.state, Wallet.STATE_LOADED);
      assert.equal(wallet.balance.value, 1_000000000000000000n);
      storage.verify();
    });

    it('should load wallet (token)', async () => {
      const request = sinon.stub(defaultOptionsToken, 'request');
      utils.stubCoinBalance(request, WALLET_ADDRESS, { balance: '1000000000000000000', confirmedBalance: '2000000000000000000' });
      utils.stubTokenBalance(request, TOKEN_ADDRESS, WALLET_ADDRESS, { balance: '100000000', confirmedBalance: '200000000' });
      const storage = sinon.mock(defaultOptionsToken.storage);
      storage.expects('set').once().withArgs('balance', '100000000');
      storage.expects('save').once();
      const wallet = new Wallet({
        ...defaultOptionsToken,
      });
      await wallet.open(RANDOM_PUBLIC_KEY);
      await wallet.load();
      assert.equal(wallet.state, Wallet.STATE_LOADED);
      assert.equal(wallet.balance.value, 100_000000n);
      storage.verify();
    });

    it('should set STATE_ERROR on error', async () => {
      sinon.stub(defaultOptionsCoin, 'request')
        .withArgs(sinon.match.any).rejects();
      const wallet = new Wallet({
        ...defaultOptionsCoin,
      });
      await wallet.open(RANDOM_PUBLIC_KEY);
      await assert.rejects(async () => {
        await wallet.load();
      });
      assert.equal(wallet.state, Wallet.STATE_ERROR);
    });
  });

  describe('getPublicKey', () => {
    it('should export public key', async () => {
      const wallet = new Wallet({
        ...defaultOptionsCoin,
      });
      await wallet.create(RANDOM_SEED);
      const publicKey = wallet.getPublicKey();
      assert.deepEqual(publicKey, RANDOM_PUBLIC_KEY);
    });

    it('public key is valid', async () => {
      const wallet = new Wallet({
        ...defaultOptionsCoin,
      });
      await wallet.create(RANDOM_SEED);
      const publicKey = wallet.getPublicKey();
      const secondWalet = new Wallet({
        ...defaultOptionsCoin,
      });
      secondWalet.open(publicKey);
      assert.equal(wallet.address, secondWalet.address);
    });
  });

  describe('getPrivateKey', () => {
    it('should export private key', async () => {
      const wallet = new Wallet({
        ...defaultOptionsCoin,
      });
      await wallet.create(RANDOM_SEED);
      const privateKey = wallet.getPrivateKey(RANDOM_SEED);
      assert.deepEqual(privateKey, [{
        address: WALLET_ADDRESS,
        privatekey: 'b7a4e7a53423da805be2d25cfa4dd5be9af329f3cad872a020864ec0cdf5f78c',
      }]);
    });
  });

  describe('validators', () => {
    describe('validateGasLimit', () => {
      let wallet;
      beforeEach(async () => {
        const request = sinon.stub(defaultOptionsCoin, 'request');
        utils.stubCoinBalance(request, WALLET_ADDRESS, { balance: '1000000000000000000', confirmedBalance: '2000000000000000000' });
        wallet = new Wallet({
          ...defaultOptionsCoin,
        });
        await wallet.open(RANDOM_PUBLIC_KEY);
        await wallet.load();
      });

      it('valid gas limit', async () => {
        assert.ok(await wallet.validateGasLimit({ gasLimit: 100500n }));
      });

      it('invalid gas limit', async () => {
        await assert.rejects(async () => {
          await wallet.validateGasLimit({ gasLimit: 0n });
        }, {
          name: 'GasLimitError',
          message: 'Invalid gas limit',
        });
      });
    });

    describe('validateAddress', () => {
      let wallet;
      beforeEach(async () => {
        const request = sinon.stub(defaultOptionsCoin, 'request');
        utils.stubCoinBalance(request, WALLET_ADDRESS, { balance: '1000000000000000000', confirmedBalance: '2000000000000000000' });
        wallet = new Wallet({
          ...defaultOptionsCoin,
        });
        await wallet.open(RANDOM_PUBLIC_KEY);
        await wallet.load();
      });

      it('valid address', async () => {
        assert.ok(await wallet.validateAddress({ address: DESTIONATION_ADDRESS }));
      });

      it('invalid address', async () => {
        await assert.rejects(async () => {
          await wallet.validateAddress({ address: '123' });
        }, {
          name: 'InvalidAddressError',
          message: 'Invalid address "123"',
        });
      });

      it('own address', async () => {
        await assert.rejects(async () => {
          await wallet.validateAddress({ address: WALLET_ADDRESS });
        }, {
          name: 'DestinationEqualsSourceError',
          message: 'Destination address equals source address',
        });
      });
    });

    describe('validateAmount (coin)', () => {
      let wallet;
      beforeEach(async () => {
        const request = sinon.stub(defaultOptionsCoin, 'request');
        utils.stubCoinBalance(request, WALLET_ADDRESS, { balance: '3000000000000000000', confirmedBalance: '2000000000000000000' });
        utils.stubGasFees(request, { maxFeePerGas: '30000000000', maxPriorityFeePerGas: '1000000000' });
        wallet = new Wallet({
          ...defaultOptionsCoin,
        });
        await wallet.open(RANDOM_PUBLIC_KEY);
        await wallet.load();
      });

      it('should be valid amount', async () => {
        const valid = await wallet.validateAmount({
          gasLimit: wallet.gasLimit,
          address: DESTIONATION_ADDRESS,
          amount: new Amount(1_000000000000000000n, wallet.crypto.decimals),
        });
        assert.ok(valid);
      });

      it('throw on small amount', async () => {
        await assert.rejects(async () => {
          await wallet.validateAmount({
            gasLimit: wallet.gasLimit,
            address: DESTIONATION_ADDRESS,
            amount: new Amount(0n, wallet.crypto.decimals),
          });
        }, {
          name: 'SmallAmountError',
          message: 'Small amount',
          amount: new Amount(1n, wallet.crypto.decimals),
        });
      });

      it('throw on big amount', async () => {
        await assert.rejects(async () => {
          await wallet.validateAmount({
            gasLimit: wallet.gasLimit,
            address: DESTIONATION_ADDRESS,
            amount: new Amount(4_000000000000000000n, wallet.crypto.decimals),
          });
        }, {
          name: 'BigAmountError',
          message: 'Big amount',
          amount: new Amount(1_999370000000000000n, wallet.crypto.decimals),
        });
      });

      it('throw on big amount (pending funds)', async () => {
        await assert.rejects(async () => {
          await wallet.validateAmount({
            gasLimit: wallet.gasLimit,
            address: DESTIONATION_ADDRESS,
            amount: new Amount(2_000000000000000000n, wallet.crypto.decimals),
          });
        }, {
          name: 'BigAmountConfirmationPendingError',
          message: 'Big amount, confirmation pending',
          amount: new Amount(1_999370000000000000n, wallet.crypto.decimals),
        });
      });
    });

    describe('validateAmount (token)', () => {
      let wallet;
      let request;
      beforeEach(async () => {
        request = sinon.stub(defaultOptionsToken, 'request');
        utils.stubCoinBalance(request, WALLET_ADDRESS, { balance: '2000000000000000000', confirmedBalance: '3000000000000000000' });
        utils.stubTokenBalance(request, TOKEN_ADDRESS, WALLET_ADDRESS, { balance: '2000000', confirmedBalance: '3000000' });
        utils.stubGasFees(request, { maxFeePerGas: '30000000000', maxPriorityFeePerGas: '1000000000' });
        wallet = new Wallet({
          ...defaultOptionsToken,
        });
        await wallet.open(RANDOM_PUBLIC_KEY);
        await wallet.load();
      });

      it('should be valid amount', async () => {
        const valid = await wallet.validateAmount({
          gasLimit: wallet.gasLimit,
          address: DESTIONATION_ADDRESS,
          amount: new Amount(2_000000n, wallet.crypto.decimals),
        });
        assert.ok(valid);
      });

      it('throw on small amount', async () => {
        await assert.rejects(async () => {
          await wallet.validateAmount({
            gasLimit: wallet.gasLimit,
            address: DESTIONATION_ADDRESS,
            amount: new Amount(0n, wallet.crypto.decimals),
          });
        }, {
          name: 'SmallAmountError',
          message: 'Small amount',
          amount: new Amount(1n, wallet.crypto.decimals),
        });
      });

      it('throw coin balance less then fee', async () => {
        utils.stubCoinBalance(request, WALLET_ADDRESS, { balance: '0', confirmedBalance: '0' });
        await wallet.load();
        await assert.rejects(async () => {
          await wallet.validateAmount({
            gasLimit: wallet.gasLimit,
            address: DESTIONATION_ADDRESS,
            amount: new Amount(2_000000n, wallet.crypto.decimals),
          });
        }, {
          name: 'InsufficientCoinForTransactionFeeError',
          message: 'Insufficient funds to pay the transaction fee',
          amount: new Amount(6000000_000000000n, wallet.platform.decimals),
        });
      });

      it('throw on big amount', async () => {
        await assert.rejects(async () => {
          await wallet.validateAmount({
            gasLimit: wallet.gasLimit,
            address: DESTIONATION_ADDRESS,
            amount: new Amount(3_000000n, wallet.crypto.decimals),
          });
        }, {
          name: 'BigAmountError',
          message: 'Big amount',
          amount: new Amount(2_000000n, wallet.crypto.decimals),
        });
      });
    });
  });

  describe('estimateImport', () => {
    it('works (coin)', async () => {
      const request = sinon.stub(defaultOptionsCoin, 'request');
      utils.stubCoinBalance(request, WALLET_ADDRESS, { balance: '2000000000000000000', confirmedBalance: '3000000000000000000' });
      utils.stubGasFees(request, { maxFeePerGas: '30000000000', maxPriorityFeePerGas: '1000000000' });

      const wallet = new Wallet({
        ...defaultOptionsCoin,
      });
      await wallet.open(RANDOM_PUBLIC_KEY);
      await wallet.load();

      utils.stubCoinBalance(request, IMPORT_ADDRESS, { balance: '1000000000000000000', confirmedBalance: '1000000000000000000' });

      const amount = await wallet.estimateImport({ privateKey: IMPORT_PRIVATE_KEY });
      assert.deepEqual(amount, new Amount(999370000000000000n, wallet.crypto.decimals));
    });

    it('works (token)', async () => {
      const request = sinon.stub(defaultOptionsToken, 'request');
      utils.stubTokenBalance(request, TOKEN_ADDRESS, WALLET_ADDRESS, { balance: '0', confirmedBalance: '0' });
      utils.stubCoinBalance(request, WALLET_ADDRESS, { balance: '0', confirmedBalance: '0' });
      utils.stubGasFees(request, { maxFeePerGas: '30000000000', maxPriorityFeePerGas: '1000000000' });

      const wallet = new Wallet({
        ...defaultOptionsToken,
      });
      await wallet.open(RANDOM_PUBLIC_KEY);
      await wallet.load();

      utils.stubTokenBalance(request, TOKEN_ADDRESS, IMPORT_ADDRESS, { balance: '1000000', confirmedBalance: '1000000' });
      utils.stubCoinBalance(request, IMPORT_ADDRESS, { balance: '1000000000000000000', confirmedBalance: '1000000000000000000' });

      const amount = await wallet.estimateImport({ privateKey: IMPORT_PRIVATE_KEY });
      assert.deepEqual(amount, new Amount(1000000n, wallet.crypto.decimals));
    });

    it('rejects own private key', async () => {
      const request = sinon.stub(defaultOptionsCoin, 'request');
      utils.stubCoinBalance(request, WALLET_ADDRESS, { balance: '2000000000000000000', confirmedBalance: '3000000000000000000' });
      utils.stubTxsCount(request, WALLET_ADDRESS, 10);
      utils.stubGasFees(request, { maxFeePerGas: '30000000000', maxPriorityFeePerGas: '1000000000' });

      const wallet = new Wallet({
        ...defaultOptionsCoin,
      });
      await wallet.open(RANDOM_PUBLIC_KEY);
      await wallet.load();

      await assert.rejects(async () => {
        await wallet.estimateImport({ privateKey: 'b7a4e7a53423da805be2d25cfa4dd5be9af329f3cad872a020864ec0cdf5f78c' });
      }, {
        name: 'DestinationEqualsSourceError',
        message: 'Destination address equals source address',
      });
    });

    it('throw error on invalid private key', async () => {
      const request = sinon.stub(defaultOptionsCoin, 'request');
      utils.stubCoinBalance(request, WALLET_ADDRESS, { balance: '2000000000000000000', confirmedBalance: '3000000000000000000' });
      utils.stubGasFees(request, { maxFeePerGas: '30000000000', maxPriorityFeePerGas: '1000000000' });

      const wallet = new Wallet({
        ...defaultOptionsCoin,
      });
      await wallet.open(RANDOM_PUBLIC_KEY);
      await wallet.load();

      utils.stubCoinBalance(request, IMPORT_ADDRESS, { balance: '1000000000000000000', confirmedBalance: '1000000000000000000' });

      await assert.rejects(async () => {
        await wallet.estimateImport({ privateKey: '123' });
      }, {
        name: 'InvalidPrivateKeyError',
        message: 'Invalid private key',
      });
    });

    it('throw error on empty private key', async () => {
      const request = sinon.stub(defaultOptionsCoin, 'request');
      utils.stubCoinBalance(request, WALLET_ADDRESS, { balance: '2000000000000000000', confirmedBalance: '3000000000000000000' });
      utils.stubGasFees(request, { maxFeePerGas: '30000000000', maxPriorityFeePerGas: '1000000000' });

      const wallet = new Wallet({
        ...defaultOptionsCoin,
      });
      await wallet.open(RANDOM_PUBLIC_KEY);
      await wallet.load();

      utils.stubCoinBalance(request, IMPORT_ADDRESS, { balance: '0', confirmedBalance: '0' });

      await assert.rejects(async () => {
        await wallet.estimateImport({ privateKey: IMPORT_PRIVATE_KEY });
      }, {
        name: 'SmallAmountError',
        message: 'Small amount',
        amount: new Amount(630000000000001n, wallet.crypto.decimals),
      });
    });

    it('throw error on not enough coins for token transfer', async () => {
      const request = sinon.stub(defaultOptionsToken, 'request');
      utils.stubTokenBalance(request, TOKEN_ADDRESS, WALLET_ADDRESS, { balance: '0', confirmedBalance: '0' });
      utils.stubCoinBalance(request, WALLET_ADDRESS, { balance: '0', confirmedBalance: '0' });
      utils.stubGasFees(request, { maxFeePerGas: '30000000000', maxPriorityFeePerGas: '1000000000' });

      const wallet = new Wallet({
        ...defaultOptionsToken,
      });
      await wallet.open(RANDOM_PUBLIC_KEY);
      await wallet.load();

      utils.stubTokenBalance(request, TOKEN_ADDRESS, IMPORT_ADDRESS, { balance: '1000000', confirmedBalance: '1000000' });
      utils.stubCoinBalance(request, IMPORT_ADDRESS, { balance: '0', confirmedBalance: '0' });

      await assert.rejects(async () => {
        await wallet.estimateImport({ privateKey: IMPORT_PRIVATE_KEY });
      }, {
        name: 'InsufficientCoinForTransactionFeeError',
        message: 'Insufficient funds to pay the transaction fee',
      });
    });
  });

  describe('estimateMaxAmount', () => {
    it('should correct estimate max amount (coin)', async () => {
      const request = sinon.stub(defaultOptionsCoin, 'request');
      utils.stubCoinBalance(request, WALLET_ADDRESS, { balance: '2000000000000000000', confirmedBalance: '3000000000000000000' });
      utils.stubGasFees(request, { maxFeePerGas: '30000000000', maxPriorityFeePerGas: '1000000000' });
      const wallet = new Wallet({
        ...defaultOptionsCoin,
      });
      await wallet.open(RANDOM_PUBLIC_KEY);
      await wallet.load();

      const maxAmount = await wallet.estimateMaxAmount({ gasLimit: wallet.gasLimit, address: DESTIONATION_ADDRESS });
      assert.equal(maxAmount.value, 1_999370000000000000n);
    });

    it('should correct estimate max amount (token)', async () => {
      const request = sinon.stub(defaultOptionsToken, 'request');
      utils.stubCoinBalance(request, WALLET_ADDRESS, { balance: '2000000000000000000', confirmedBalance: '3000000000000000000' });
      utils.stubTokenBalance(request, TOKEN_ADDRESS, WALLET_ADDRESS, { balance: '2000000', confirmedBalance: '3000000' });
      utils.stubGasFees(request, { maxFeePerGas: '30000000000', maxPriorityFeePerGas: '1000000000' });
      const wallet = new Wallet({
        ...defaultOptionsToken,
      });
      await wallet.open(RANDOM_PUBLIC_KEY);
      await wallet.load();

      const maxAmount = await wallet.estimateMaxAmount({ gasLimit: wallet.gasLimit, address: DESTIONATION_ADDRESS });
      assert.equal(maxAmount.value, 2_000000n);
    });
  });

  describe('estimateTransactionFee', () => {
    it('should estimate transaction fee (coin)', async () => {
      const request = sinon.stub(defaultOptionsCoin, 'request');
      utils.stubCoinBalance(request, WALLET_ADDRESS, { balance: '2000000000000000000', confirmedBalance: '3000000000000000000' });
      utils.stubGasFees(request, { maxFeePerGas: '30000000000', maxPriorityFeePerGas: '1000000000' });
      const wallet = new Wallet({
        ...defaultOptionsCoin,
      });
      await wallet.open(RANDOM_PUBLIC_KEY);
      await wallet.load();
      const fee = await wallet.estimateTransactionFee({
        gasLimit: wallet.gasLimit,
        address: DESTIONATION_ADDRESS,
        amount: new Amount(2_000000000n, wallet.crypto.decimals),
      });
      assert.deepEqual(fee, new Amount(630000_000000000n, wallet.crypto.decimals));
    });

    it('should estimate transaction fee (token)', async () => {
      const request = sinon.stub(defaultOptionsToken, 'request');
      utils.stubCoinBalance(request, WALLET_ADDRESS, { balance: '2000000000000000000', confirmedBalance: '3000000000000000000' });
      utils.stubTokenBalance(request, TOKEN_ADDRESS, WALLET_ADDRESS, { balance: '2000000', confirmedBalance: '3000000' });
      utils.stubGasFees(request, { maxFeePerGas: '30000000000', maxPriorityFeePerGas: '1000000000' });
      const wallet = new Wallet({
        ...defaultOptionsToken,
      });
      await wallet.open(RANDOM_PUBLIC_KEY);
      await wallet.load();
      const fee = await wallet.estimateTransactionFee({
        gasLimit: wallet.gasLimit,
        address: DESTIONATION_ADDRESS,
        amount: new Amount(2_000000000n, wallet.crypto.decimals),
      });
      assert.deepEqual(fee, new Amount(6000000_000000000n, wallet.platform.decimals));
    });
  });

  describe('createTransaction', () => {
    it('should create valid transaction (Ethereum coin)', async () => {
      const request = sinon.stub(defaultOptionsCoin, 'request');
      utils.stubCoinBalance(request, WALLET_ADDRESS, { balance: '2000000000000000000', confirmedBalance: '3000000000000000000' });
      utils.stubTxsCount(request, WALLET_ADDRESS, 10);
      utils.stubGasFees(request, { maxFeePerGas: '30000000000', maxPriorityFeePerGas: '1000000000' });
      utils.stubTransactionSend(request, '1234', '0x02f8758242680a843b9aca008506fc23ac0082520894c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2880de0b6b3a764000080c001a04d19ab019b1a9ac70c26c32cc2b83bd9d65b2b3c3ed3e68bead499c509b481caa01222b1a3b8bf218db5f1329709b5731079b53570279c0c12561f9298ee9705e8');

      const wallet = new Wallet({
        ...defaultOptionsCoin,
      });
      await wallet.open(RANDOM_PUBLIC_KEY);
      await wallet.load();

      const id = await wallet.createTransaction({
        gasLimit: wallet.gasLimit,
        address: DESTIONATION_ADDRESS,
        amount: new Amount(1_000000000000000000n, wallet.crypto.decimals),
      }, RANDOM_SEED, false);
      assert.equal(wallet.balance.value, 999370000000000000n);
      assert.equal(id, '1234');
    });

    it('should create valid transaction (Ethereum token)', async () => {
      const request = sinon.stub(defaultOptionsToken, 'request');
      utils.stubCoinBalance(request, WALLET_ADDRESS, { balance: '2000000000000000000', confirmedBalance: '3000000000000000000' });
      utils.stubTokenBalance(request, TOKEN_ADDRESS, WALLET_ADDRESS, { balance: '2000000', confirmedBalance: '2000000' });
      utils.stubTxsCount(request, WALLET_ADDRESS, 10);
      utils.stubGasFees(request, { maxFeePerGas: '30000000000', maxPriorityFeePerGas: '1000000000' });
      utils.stubTransactionSend(request, '1234', '0x02f8b38242680a843b9aca008506fc23ac0083030d4094dac17f958d2ee523a2206206994597c13d831ec780b844a9059cbb000000000000000000000000c02aaa39b223fe8d0a0e5c4f27ead9083c756cc200000000000000000000000000000000000000000000000000000000000f4240c080a0ab76b8a31bf32d88a5c64f4f7fd0fe36112ed67dc2a222c8eff3534ae525570fa0185412310af12c771e7b474e158208a45f5a58f5088925389ccec4bd8df10936');

      const wallet = new Wallet({
        ...defaultOptionsToken,
      });
      await wallet.open(RANDOM_PUBLIC_KEY);
      await wallet.load();

      const id = await wallet.createTransaction({
        gasLimit: wallet.gasLimit,
        address: DESTIONATION_ADDRESS,
        amount: new Amount(1_000000n, wallet.crypto.decimals),
      }, RANDOM_SEED, false);
      assert.equal(wallet.balance.value, 1_000000n);
      assert.equal(id, '1234');
    });

    it('should create valid transaction (Ethereum Classic coin)', async () => {
      const request = sinon.stub(defaultOptionsCoin, 'request');
      utils.stubCoinBalance(request, WALLET_ADDRESS, { balance: '2000000000000000000', confirmedBalance: '3000000000000000000' }, 120);
      utils.stubTxsCount(request, WALLET_ADDRESS, 10);
      utils.stubGasPrice(request, { price: '1000000000' });
      utils.stubTransactionSend(request, '1234', '0xf86c0a843b9aca0082520894c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2880de0b6b3a76400008081a2a091f3f81e93451abea429dc9578387f6781834129cf27d8508ccf71d8db21ab80a01faa40558e6fd4c7c9d493f16c9f6878cc0cb2eb7c3b59c0569caaac03d82564');

      const wallet = new Wallet({
        ...defaultOptionsCoin,
        crypto: {
          ...ethereumATethereum,
          platform: 'ethereum-classic',
        },
      });
      await wallet.open(RANDOM_PUBLIC_KEY);
      await wallet.load();

      const id = await wallet.createTransaction({
        gasLimit: wallet.gasLimit,
        address: DESTIONATION_ADDRESS,
        amount: new Amount(1_000000000000000000n, wallet.crypto.decimals),
      }, RANDOM_SEED, false);
      assert.equal(wallet.balance.value, 999979000000000000n);
      assert.equal(id, '1234');
    });

    it('should create valid transaction (Ethereum Classic token)', async () => {
      const request = sinon.stub(defaultOptionsToken, 'request');
      utils.stubCoinBalance(request, WALLET_ADDRESS, { balance: '2000000000000000000', confirmedBalance: '3000000000000000000' }, 120);
      utils.stubTokenBalance(request, TOKEN_ADDRESS, WALLET_ADDRESS, { balance: '2000000', confirmedBalance: '2000000' }, 120);
      utils.stubTxsCount(request, WALLET_ADDRESS, 10);
      utils.stubGasPrice(request, { price: '1000000000' });
      utils.stubTransactionSend(request, '1234', '0xf8aa0a843b9aca0083030d4094dac17f958d2ee523a2206206994597c13d831ec780b844a9059cbb000000000000000000000000c02aaa39b223fe8d0a0e5c4f27ead9083c756cc200000000000000000000000000000000000000000000000000000000000f424081a1a02eb1af532e3c040f81582b19ea7be687d6a3ead10c82eeba77209379f782af01a04ad362a0db1edf922b1133c22af1ddec2e749318bd8c829e29f8f59442466900');

      const wallet = new Wallet({
        ...defaultOptionsToken,
        crypto: {
          ...tetherATethereum,
          platform: 'ethereum-classic',
        },
      });
      await wallet.open(RANDOM_PUBLIC_KEY);
      await wallet.load();

      const id = await wallet.createTransaction({
        gasLimit: wallet.gasLimit,
        address: DESTIONATION_ADDRESS,
        amount: new Amount(1_000000n, wallet.crypto.decimals),
      }, RANDOM_SEED, false);
      assert.equal(wallet.balance.value, 1_000000n);
      assert.equal(id, '1234');
    });

    it('should create valid transaction (Optimism coin)', async () => {
      const request = sinon.stub(defaultOptionsCoin, 'request');
      utils.stubCoinBalance(request, WALLET_ADDRESS, { balance: '2000000000000000000', confirmedBalance: '3000000000000000000' });
      utils.stubTxsCount(request, WALLET_ADDRESS, 10);
      utils.stubGasFees(request, { maxFeePerGas: '30000000000', maxPriorityFeePerGas: '1000000000' });
      utils.stubTransactionSend(request, '1234', '0x02f87683aa37dc0a843b9aca008506fc23ac0082520894c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2880de0b6b3a764000080c080a022fa90a9e2d73b8797064fb46a8fb1e179e7a7bddabd23bc35c10ca074e82313a03c5fa37bbaa1f850c49bd425743a23ea7dacec74c92aabf9fb4407f2a82280c7');

      const wallet = new Wallet({
        ...defaultOptionsCoin,
        crypto: {
          ...ethereumATethereum,
          platform: 'optimism',
        },
      });
      await wallet.open(RANDOM_PUBLIC_KEY);
      await wallet.load();

      const id = await wallet.createTransaction({
        gasLimit: wallet.gasLimit,
        address: DESTIONATION_ADDRESS,
        amount: new Amount(1_000000000000000000n, wallet.crypto.decimals),
      }, RANDOM_SEED, false);
      assert.equal(wallet.balance.value, 999370000000000000n);
      assert.equal(id, '1234');
    });

    it('should create valid transaction (Optimism token)', async () => {
      const request = sinon.stub(defaultOptionsToken, 'request');
      utils.stubCoinBalance(request, WALLET_ADDRESS, { balance: '2000000000000000000', confirmedBalance: '3000000000000000000' });
      utils.stubTokenBalance(request, TOKEN_ADDRESS, WALLET_ADDRESS, { balance: '2000000', confirmedBalance: '2000000' });
      utils.stubTxsCount(request, WALLET_ADDRESS, 10);
      utils.stubGasFees(request, { maxFeePerGas: '30000000000', maxPriorityFeePerGas: '1000000000' });
      utils.stubTransactionSend(request, '1234', '0x02f8b483aa37dc0a843b9aca008506fc23ac0083030d4094dac17f958d2ee523a2206206994597c13d831ec780b844a9059cbb000000000000000000000000c02aaa39b223fe8d0a0e5c4f27ead9083c756cc200000000000000000000000000000000000000000000000000000000000f4240c080a03780366ded5d50c7b9529b4e8249df1c8470b74ba93a6b6929b12446958ede36a06ffc4213390b15e359690cf7ff96d99cca91e57821a5ead53fd90e54777dba58');

      const wallet = new Wallet({
        ...defaultOptionsToken,
        crypto: {
          ...tetherATethereum,
          platform: 'optimism',
        },
      });
      await wallet.open(RANDOM_PUBLIC_KEY);
      await wallet.load();

      const id = await wallet.createTransaction({
        gasLimit: wallet.gasLimit,
        address: DESTIONATION_ADDRESS,
        amount: new Amount(1_000000n, wallet.crypto.decimals),
      }, RANDOM_SEED, false);
      assert.equal(wallet.balance.value, 1_000000n);
      assert.equal(id, '1234');
    });

    it('should create valid transaction (Arbitrum coin)', async () => {
      const request = sinon.stub(defaultOptionsCoin, 'request');
      utils.stubCoinBalance(request, WALLET_ADDRESS, { balance: '2000000000000000000', confirmedBalance: '3000000000000000000' });
      utils.stubTxsCount(request, WALLET_ADDRESS, 10);
      utils.stubGasFees(request, { maxFeePerGas: '30000000000', maxPriorityFeePerGas: '1000000000' });
      utils.stubTransactionSend(request, '1234', '0x02f87783066eee0a843b9aca008506fc23ac00830f424094c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2880de0b6b3a764000080c080a0948bf33d6628862819ad4f64a3bd9724a755e17a71e92820789d0b1b64e7d0faa06c24206f8755d798266a3060fa6179d8076cc298af8a5b8523a332caf5720c40');

      const wallet = new Wallet({
        ...defaultOptionsCoin,
        crypto: {
          ...ethereumATethereum,
          platform: 'arbitrum',
        },
      });
      await wallet.open(RANDOM_PUBLIC_KEY);
      await wallet.load();

      const id = await wallet.createTransaction({
        gasLimit: wallet.gasLimit,
        address: DESTIONATION_ADDRESS,
        amount: new Amount(1_000000000000000000n, wallet.crypto.decimals),
      }, RANDOM_SEED, false);
      assert.equal(wallet.balance.value, 970000000000000000n);
      assert.equal(id, '1234');
    });

    it('should create valid transaction (Arbitrum token)', async () => {
      const request = sinon.stub(defaultOptionsToken, 'request');
      utils.stubCoinBalance(request, WALLET_ADDRESS, { balance: '2000000000000000000', confirmedBalance: '3000000000000000000' });
      utils.stubTokenBalance(request, TOKEN_ADDRESS, WALLET_ADDRESS, { balance: '2000000', confirmedBalance: '2000000' });
      utils.stubTxsCount(request, WALLET_ADDRESS, 10);
      utils.stubGasFees(request, { maxFeePerGas: '30000000000', maxPriorityFeePerGas: '1000000000' });
      utils.stubTransactionSend(request, '1234', '0x02f8b483066eee0a843b9aca008506fc23ac00831e848094dac17f958d2ee523a2206206994597c13d831ec780b844a9059cbb000000000000000000000000c02aaa39b223fe8d0a0e5c4f27ead9083c756cc200000000000000000000000000000000000000000000000000000000000f4240c001a060cf7018c1b53f200c4807c1898c1fe310b38282527f72674bba6a8e2b0455d9a05704169f09f85bb584697384429857f4b5a49efacffeaf721fe077dd4144c694');

      const wallet = new Wallet({
        ...defaultOptionsToken,
        crypto: {
          ...tetherATethereum,
          platform: 'arbitrum',
        },
      });
      await wallet.open(RANDOM_PUBLIC_KEY);
      await wallet.load();

      const id = await wallet.createTransaction({
        gasLimit: wallet.gasLimit,
        address: DESTIONATION_ADDRESS,
        amount: new Amount(1_000000n, wallet.crypto.decimals),
      }, RANDOM_SEED, false);
      assert.equal(wallet.balance.value, 1_000000n);
      assert.equal(id, '1234');
    });
  });

  describe('createImport', () => {
    it('should support import', () => {
      const wallet = new Wallet({
        ...defaultOptionsCoin,
      });
      assert.ok(wallet.isImportSupported);
    });

    it('works (coin)', async () => {
      const request = sinon.stub(defaultOptionsCoin, 'request');
      utils.stubCoinBalance(request, WALLET_ADDRESS, { balance: '0', confirmedBalance: '0' });
      utils.stubGasFees(request, { maxFeePerGas: '30000000000', maxPriorityFeePerGas: '1000000000' });

      const wallet = new Wallet({
        ...defaultOptionsCoin,
      });
      await wallet.open(RANDOM_PUBLIC_KEY);
      await wallet.load();

      utils.stubCoinBalance(request, IMPORT_ADDRESS, { balance: '1000000000000000000', confirmedBalance: '1000000000000000000' });
      utils.stubTxsCount(request, IMPORT_ADDRESS, 10);
      utils.stubTransactionSend(request, '1234', '0x02f8758242680a843b9aca008506fc23ac0082520894faad0567f7a6cd4a583f49967d21a07af8f0b4b6880dde79b8592ea00080c001a0e50ad0d3071d65a3b58c83b68f505940eeac69aa83f48bb589723ee26f94b069a035729cf37e169b50bc5a76e6be80a75c33d0da5dead471f936fce1b5f7bb4271');

      assert.equal(wallet.balance.value, 0n);
      const estimate = await wallet.estimateImport({ privateKey: IMPORT_PRIVATE_KEY });
      const id = await wallet.createImport({ privateKey: IMPORT_PRIVATE_KEY }, false);

      assert.equal(wallet.balance.value, estimate.value);
      assert.equal(wallet.balance.value, 999370000000000000n);
      assert.equal(id, '1234');
    });

    it('works (token)', async () => {
      const request = sinon.stub(defaultOptionsToken, 'request');
      utils.stubTokenBalance(request, TOKEN_ADDRESS, WALLET_ADDRESS, { balance: '0', confirmedBalance: '0' });
      utils.stubCoinBalance(request, WALLET_ADDRESS, { balance: '0', confirmedBalance: '0' });
      utils.stubGasFees(request, { maxFeePerGas: '30000000000', maxPriorityFeePerGas: '1000000000' });

      const wallet = new Wallet({
        ...defaultOptionsToken,
      });
      await wallet.open(RANDOM_PUBLIC_KEY);
      await wallet.load();

      utils.stubTokenBalance(request, TOKEN_ADDRESS, IMPORT_ADDRESS, { balance: '1000000', confirmedBalance: '1000000' });
      utils.stubCoinBalance(request, IMPORT_ADDRESS, { balance: '1000000000000000000', confirmedBalance: '1000000000000000000' });
      utils.stubTxsCount(request, IMPORT_ADDRESS, 10);
      utils.stubTransactionSend(request, '1234', '0x02f8b38242680a843b9aca008506fc23ac0083030d4094dac17f958d2ee523a2206206994597c13d831ec780b844a9059cbb000000000000000000000000faad0567f7a6cd4a583f49967d21a07af8f0b4b600000000000000000000000000000000000000000000000000000000000f4240c080a0f796549f0bf2954ed134d4b5853620a4c65589f76d2f26d843bca4f45929ff28a04a6f02a1a0f6af1ca1cad7ece1ca6952415937dad87022362e482c6ee338a517');

      assert.equal(wallet.balance.value, 0n);
      const estimate = await wallet.estimateImport({ privateKey: IMPORT_PRIVATE_KEY });
      const id = await wallet.createImport({ privateKey: IMPORT_PRIVATE_KEY }, false);

      assert.equal(wallet.balance.value, estimate.value);
      assert.equal(wallet.balance.value, 1000000n);
      assert.equal(id, '1234');
    });
  });

  describe('loadTransactions', () => {
    it('should load transactions (coin)', async () => {
      const request = sinon.stub(defaultOptionsCoin, 'request');
      utils.stubCoinBalance(request, WALLET_ADDRESS, { balance: '2000000000000000000', confirmedBalance: '3000000000000000000' });
      utils.stubTransactions(request, WALLET_ADDRESS, TRANSACTIONS);
      utils.stubGasFees(request, { maxFeePerGas: '30000000000', maxPriorityFeePerGas: '1000000000' });
      const wallet = new Wallet({
        ...defaultOptionsCoin,
      });
      await wallet.open(RANDOM_PUBLIC_KEY);
      await wallet.load();

      const res = await wallet.loadTransactions();
      assert.strictEqual(res.hasMore, false);
      assert.strictEqual(res.transactions.length, 7);
      assert.strictEqual(res.cursor, 1);
    });

    it('should load transactions (token)', async () => {
      const request = sinon.stub(defaultOptionsToken, 'request');
      utils.stubCoinBalance(request, WALLET_ADDRESS, { balance: '2000000000000000000', confirmedBalance: '3000000000000000000' });
      utils.stubTokenBalance(request, TOKEN_ADDRESS, WALLET_ADDRESS, { balance: '2000000', confirmedBalance: '2000000' });
      utils.stubTokenTransactions(request, TOKEN_ADDRESS, WALLET_ADDRESS, TOKEN_TRANSACTIONS);
      utils.stubGasFees(request, { maxFeePerGas: '30000000000', maxPriorityFeePerGas: '1000000000' });
      const wallet = new Wallet({
        ...defaultOptionsToken,
      });
      await wallet.open(RANDOM_PUBLIC_KEY);
      await wallet.load();

      const res = await wallet.loadTransactions();
      assert.strictEqual(res.hasMore, true);
      assert.strictEqual(res.transactions.length, 5);
      assert.strictEqual(res.cursor, 2);
    });
  });

  describe('estimateReplacement', () => {
    let wallet;
    let txs;
    beforeEach(async () => {
      const request = sinon.stub(defaultOptionsCoin, 'request');
      utils.stubCoinBalance(request, WALLET_ADDRESS, { balance: '2000000000000000000', confirmedBalance: '3000000000000000000' });
      utils.stubTransactions(request, WALLET_ADDRESS, TRANSACTIONS);
      utils.stubGasFees(request, { maxFeePerGas: '30000000000', maxPriorityFeePerGas: '1000000000' });
      wallet = new Wallet({
        ...defaultOptionsCoin,
      });
      await wallet.open(RANDOM_PUBLIC_KEY);
      await wallet.load();
      txs = (await wallet.loadTransactions()).transactions;
    });

    it('works', async () => {
      const estimate = await wallet.estimateReplacement(txs[0]);
      assert.equal(estimate.percent, 0.2);
      assert.equal(estimate.fee.value, 105000000000000n);
    });

    it('works (legacy tx)', async () => {
      const estimate = await wallet.estimateReplacement(txs[1]);
      assert.equal(estimate.percent, 0.2);
      assert.equal(estimate.fee.value, 105000000000000n);
    });

    it('throw error not enough funds', async () => {
      await assert.rejects(async () => {
        const tx = txs[0];
        sinon.stub(tx, 'gasLimit').get(() => 1000000000n);
        await wallet.estimateReplacement(tx);
      }, {
        name: 'BigAmountError',
        message: 'Big amount',
      });
    });
  });

  describe('createReplacementTransaction', () => {
    let wallet;
    let txs;
    beforeEach(async () => {
      const request = sinon.stub(defaultOptionsCoin, 'request');
      utils.stubCoinBalance(request, WALLET_ADDRESS, { balance: '2000000000000000000', confirmedBalance: '3000000000000000000' });
      utils.stubTransactions(request, WALLET_ADDRESS, TRANSACTIONS);
      utils.stubGasFees(request, { maxFeePerGas: '30000000000', maxPriorityFeePerGas: '1000000000' });
      utils.stubTransactionSend(request, '1234');
      wallet = new Wallet({
        ...defaultOptionsCoin,
      });
      await wallet.open(RANDOM_PUBLIC_KEY);
      await wallet.load();
      txs = (await wallet.loadTransactions()).transactions;
    });

    it('replace tx (coin)', async () => {
      const before = wallet.balance.value;
      const id = await wallet.createReplacementTransaction(txs[0], RANDOM_SEED);
      const after = wallet.balance.value;
      assert.equal(before - after, 105000000000000n);
      assert.equal(after, 1_999895000000000000n);
      assert.equal(id, '1234');
    });

    it('replace tx (coin) - legacy', async () => {
      const before = wallet.balance.value;
      const id = await wallet.createReplacementTransaction(txs[1], RANDOM_SEED);
      const after = wallet.balance.value;
      assert.equal(before - after, 105000000000000n);
      assert.equal(after, 1_999895000000000000n);
      assert.equal(id, '1234');
    });

    it('replace tx (token)', async () => {
      const before = wallet.balance.value;
      const id = await wallet.createReplacementTransaction(txs[2], RANDOM_SEED);
      const after = wallet.balance.value;
      assert.equal(before - after, 1000000000000000n);
      assert.equal(after, 1999000000000000000n);
      assert.equal(id, '1234');
    });

    it('replace tx (token) - legacy', async () => {
      const before = wallet.balance.value;
      const id = await wallet.createReplacementTransaction(txs[3], RANDOM_SEED);
      const after = wallet.balance.value;
      assert.equal(before - after, 1000000000000000n);
      assert.equal(after, 1999000000000000000n);
      assert.equal(id, '1234');
    });
  });

  describe('messenger', () => {
    it('should sign hex message', async () => {
      const wallet = new Wallet({
        ...defaultOptionsCoin,
      });
      const msg = '0x74657374';
      const sig = '0xf1f81e723c5779754de71610734e8b7e9cea40c1420b87c3bd4b2cbdcd44a85a0bc3bffb7e6c5be7301ead3844e5134d1b706c0fff8fa9bcbab74a5b63c26bd21b';
      assert.equal(await wallet.eth_sign(msg, RANDOM_SEED, false), sig);
    });

    it('should sign utf8 message', async () => {
      const wallet = new Wallet({
        ...defaultOptionsCoin,
      });
      const msg = 'test';
      const sig = '0xf1f81e723c5779754de71610734e8b7e9cea40c1420b87c3bd4b2cbdcd44a85a0bc3bffb7e6c5be7301ead3844e5134d1b706c0fff8fa9bcbab74a5b63c26bd21b';
      assert.equal(await wallet.eth_sign(msg, RANDOM_SEED, false), sig);
    });

    it('should sign TypedData', async () => {
      const wallet = new Wallet({
        ...defaultOptionsCoin,
      });
      const sig = '0xccc50f41fb89447eb1964c2deb51ba5182a1afe15d0b44dea690c3161d4d84854f939d20fa29c2112cc1f5c8232719dd5e139335b92935dfa880cf8f8312034b1b';
      assert.equal(await wallet.eth_signTypedData(TYPED_DATA, RANDOM_SEED, false), sig);
    });
  });

  describe('staking', () => {

    let wallet;
    let request;

    beforeEach(async () => {
      request = sinon.stub(defaultOptionsCoin, 'request');
      utils.stubCoinBalance(request, WALLET_ADDRESS, { balance: '3000000000000000000', confirmedBalance: '2000000000000000000' });
      utils.stubTransactions(request, WALLET_ADDRESS, TRANSACTIONS);
      utils.stubGasFees(request, { maxFeePerGas: '30000000000', maxPriorityFeePerGas: '1000000000' });
      utils.stubTransactionSend(request, '1234');
      utils.stubTxsCount(request, WALLET_ADDRESS, 10);
      wallet = new Wallet({
        ...defaultOptionsCoin,
      });
      await wallet.open(RANDOM_PUBLIC_KEY);
      await wallet.load();
    });

    it('should support staking', () => {
      assert.ok(wallet.isStakingSupported);
    });

    describe('staking', () => {
      it('should load staking data', async () => {
        utils.stubStaking(request, WALLET_ADDRESS, {
          staked: '2000000000000000000',
          apr: 0.4,
          minStakeAmount: '100000000000000000',
        });
        const data = await wallet.staking();
        assert.equal(data.staked.value, 2000000000000000000n);
        assert.equal(data.apr, 0.4);
      });
    });

    describe('pendingRequests', () => {
      it('should load pendingRequests data', async () => {
        utils.stubPendingRequests(request, WALLET_ADDRESS, {
          staking: '3000000000000000000',
          unstaking: '2000000000000000000',
          readyForClaim: '1000000000000000000',
        });
        const data = await wallet.pendingRequests();
        assert.equal(data.staking.value, 3000000000000000000n);
        assert.equal(data.unstaking.value, 2000000000000000000n);
        assert.equal(data.readyForClaim.value, 1000000000000000000n);
      });
    });

    describe('validateStakeAmount', () => {
      it('should be valid amount', async () => {
        const valid = await wallet.validateStakeAmount({
          amount: new Amount(1_000000000000000000n, wallet.crypto.decimals),
        });
        assert.ok(valid);
      });

      it('throw on small amount', async () => {
        await assert.rejects(async () => {
          await wallet.validateStakeAmount({
            amount: new Amount(100000000000n, wallet.crypto.decimals),
          });
        }, {
          name: 'SmallAmountError',
          message: 'Small amount',
          amount: new Amount(100000000000000000n, wallet.crypto.decimals),
        });
      });

      it('throw on big amount', async () => {
        await assert.rejects(async () => {
          await wallet.validateStakeAmount({
            amount: new Amount(10_000000000000000000n, wallet.crypto.decimals),
          });
        }, {
          name: 'BigAmountError',
          message: 'Big amount',
          amount: new Amount(1_985000000000000000n, wallet.crypto.decimals),
        });
      });

      it('throw on big amount (pending funds)', async () => {
        await assert.rejects(async () => {
          await wallet.validateStakeAmount({
            amount: new Amount(2_500000000000000000n, wallet.crypto.decimals),
          });
        }, {
          name: 'BigAmountConfirmationPendingError',
          message: 'Big amount, confirmation pending',
          amount: new Amount(1_985000000000000000n, wallet.crypto.decimals),
        });
      });

      it('throw coin balance less then fee', async () => {
        utils.stubCoinBalance(request, WALLET_ADDRESS, { balance: '0', confirmedBalance: '0' });
        await wallet.load();
        await assert.rejects(async () => {
          await wallet.validateStakeAmount({
            amount: new Amount(1_000000000000000000n, wallet.crypto.decimals),
          });
        }, {
          name: 'InsufficientCoinForTransactionFeeError',
          message: 'Insufficient funds to pay the transaction fee',
          amount: new Amount(15000000000000000n, wallet.platform.decimals),
        });
      });
    });

    describe('estimateStake', () => {
      it('should estimate stake', async () => {
        const amount = new Amount(1_000000000000000000n, wallet.crypto.decimals);
        utils.stubStake(request, WALLET_ADDRESS, amount, {
          data: '0x3a29dbae0000000000000000000000000000000000000000000000000000000000000000',
          to: '0xAFA848357154a6a624686b348303EF9a13F63264',
        });
        const estimate = await wallet.estimateStake({
          amount,
        });
        assert.deepEqual(estimate.fee, new Amount(15000000000000000n, wallet.crypto.decimals));
        assert.equal(estimate.to, '0xAFA848357154a6a624686b348303EF9a13F63264');
      });
    });

    describe('estimateStakeMaxAmount', () => {
      it('should estimate stake max amount', async () => {
        const maxAmount = await wallet.estimateStakeMaxAmount();
        assert.equal(maxAmount.value, 1_985000000000000000n);
      });
    });

    describe('stake', () => {
      it('works', async () => {
        const amount = new Amount(1_000000000000000000n, wallet.crypto.decimals);
        utils.stubStake(request, WALLET_ADDRESS, amount, {
          data: '0x3a29dbae0000000000000000000000000000000000000000000000000000000000000000',
          to: '0xAFA848357154a6a624686b348303EF9a13F63264',
        });
        const balance = wallet.balance.value;
        const { fee } = await wallet.estimateStake({
          amount,
        });
        const id = await wallet.stake({ amount }, RANDOM_SEED);
        assert.equal(wallet.balance.value, (balance - fee.value - amount.value));
        assert.equal(wallet.balance.value, 1985000000000000000n);
        assert.equal(id, '1234');
      });
    });

    describe('validateUnstakeAmount', () => {

      beforeEach(async () => {
        utils.stubStaking(request, WALLET_ADDRESS, {
          staked: '2000000000000000000',
          apr: 0.4,
          minStakeAmount: '100000000000000000',
        });
        await wallet.staking();
      });

      it('should be valid amount', async () => {
        const valid = await wallet.validateUnstakeAmount({
          amount: new Amount(1_000000000000000000n, wallet.crypto.decimals),
        });
        assert.ok(valid);
      });

      it('throw on small amount', async () => {
        await assert.rejects(async () => {
          await wallet.validateUnstakeAmount({
            amount: new Amount(1n, wallet.crypto.decimals),
          });
        }, {
          name: 'SmallAmountError',
          message: 'Small amount',
          amount: new Amount(2n, wallet.crypto.decimals),
        });
      });

      it('throw on big amount', async () => {
        await assert.rejects(async () => {
          await wallet.validateUnstakeAmount({
            amount: new Amount(10_000000000000000000n, wallet.crypto.decimals),
          });
        }, {
          name: 'BigAmountError',
          message: 'Big amount',
          amount: new Amount(2_000000000000000000n, wallet.crypto.decimals),
        });
      });

      it('throw coin balance less then fee', async () => {
        utils.stubCoinBalance(request, WALLET_ADDRESS, { balance: '0', confirmedBalance: '0' });
        await wallet.load();
        await assert.rejects(async () => {
          await wallet.validateUnstakeAmount({
            amount: new Amount(1_000000000000000000n, wallet.crypto.decimals),
          });
        }, {
          name: 'InsufficientCoinForTransactionFeeError',
          message: 'Insufficient funds to pay the transaction fee',
          amount: new Amount(15000000000000000n, wallet.platform.decimals),
        });
      });
    });

    describe('estimateUnstake', () => {
      it('should estimate unstake', async () => {
        utils.stubStaking(request, WALLET_ADDRESS, {
          staked: '2000000000000000000',
          apr: 0.4,
          minStakeAmount: '100000000000000000',
        });
        await wallet.staking();

        const amount = new Amount(1_000000000000000000n, wallet.crypto.decimals);
        utils.stubUnstake(request, WALLET_ADDRESS, amount, {
          to: '0xAFA848357154a6a624686b348303EF9a13F63264',
          data: '0x76ec871c00000000000000000000000000000000000000000000000000000002540be40000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
        });
        const fee = await wallet.estimateUnstake({
          amount,
        });
        assert.deepEqual(fee, new Amount(15000000000000000n, wallet.crypto.decimals));
      });
    });

    describe('estimateUnstakeMaxAmount', () => {
      it('should estimate unstake max amount', async () => {
        utils.stubStaking(request, WALLET_ADDRESS, {
          staked: '2000000000000000000',
          apr: 0.4,
          minStakeAmount: '100000000000000000',
        });
        await wallet.staking();

        const maxAmount = await wallet.estimateUnstakeMaxAmount();
        assert.equal(maxAmount.value, 2_000000000000000000n);
      });
    });

    describe('unstake', () => {
      it('works', async () => {
        utils.stubStaking(request, WALLET_ADDRESS, {
          staked: '2000000000000000000',
          apr: 0.4,
          minStakeAmount: '100000000000000000',
        });
        await wallet.staking();
        const amount = new Amount(1_000000000000000000n, wallet.crypto.decimals);
        utils.stubUnstake(request, WALLET_ADDRESS, amount, {
          to: '0xAFA848357154a6a624686b348303EF9a13F63264',
          data: '0x76ec871c00000000000000000000000000000000000000000000000000000002540be40000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
        });
        const balance = wallet.balance.value;
        const fee = await wallet.estimateUnstake({
          amount,
        });
        const id = await wallet.unstake({ amount }, RANDOM_SEED);
        assert.equal(wallet.balance.value, (balance - fee.value));
        assert.equal(wallet.balance.value, 2_985000000000000000n);
        assert.equal(id, '1234');
      });
    });

    describe('validateClaim', () => {

      it('should be valid', async () => {
        const valid = await wallet.validateClaim();
        assert.ok(valid);
      });

      it('throw coin balance less then fee', async () => {
        utils.stubCoinBalance(request, WALLET_ADDRESS, { balance: '0', confirmedBalance: '0' });
        await wallet.load();
        await assert.rejects(async () => {
          await wallet.validateClaim();
        }, {
          name: 'InsufficientCoinForTransactionFeeError',
          message: 'Insufficient funds to pay the transaction fee',
          amount: new Amount(15000000000000000n, wallet.platform.decimals),
        });
      });
    });

    describe('estimateClaim', () => {
      it('should estimate claim', async () => {
        utils.stubClaim(request, WALLET_ADDRESS, {
          to: '0x624087DD1904ab122A32878Ce9e933C7071F53B9',
          data: '0x33986ffa',
        });
        const fee = await wallet.estimateClaim();
        assert.deepEqual(fee, new Amount(15000000000000000n, wallet.crypto.decimals));
      });
    });

    describe('claim', () => {
      it('works', async () => {
        utils.stubClaim(request, WALLET_ADDRESS, {
          to: '0x624087DD1904ab122A32878Ce9e933C7071F53B9',
          data: '0x33986ffa',
        });
        const balance = wallet.balance.value;
        const fee = await wallet.estimateClaim();
        const id = await wallet.claim(RANDOM_SEED);
        assert.equal(wallet.balance.value, (balance - fee.value));
        assert.equal(wallet.balance.value, 2_985000000000000000n);
        assert.equal(id, '1234');
      });
    });
  });
});
