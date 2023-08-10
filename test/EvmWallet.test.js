/* eslint-disable max-len */
import { Amount } from '@coinspace/cs-common';
import Wallet from '@coinspace/cs-evm-wallet';
import assert from 'assert/strict';
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
      assert.equal(wallet.tokenUrl, 'https://sepolia.etherscan.io/token/0xdac17f958d2ee523a2206206994597c13d831ec7');
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
      const request = sinon.stub(defaultOptionsCoin.account, 'request');
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
      const request = sinon.stub(defaultOptionsToken.account, 'request');
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
      const wallet = new Wallet({
        ...defaultOptionsCoin,
      });
      await wallet.open(RANDOM_PUBLIC_KEY);
      sinon.stub(defaultOptionsCoin.account, 'request');
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
        const request = sinon.stub(defaultOptionsCoin.account, 'request');
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
        const request = sinon.stub(defaultOptionsCoin.account, 'request');
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
        const request = sinon.stub(defaultOptionsCoin.account, 'request');
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
        request = sinon.stub(defaultOptionsToken.account, 'request');
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
          name: 'InsufficientCoinForTokenTransactionError',
          message: 'Insufficient funds for token transaction',
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
      const request = sinon.stub(defaultOptionsCoin.account, 'request');
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
      const request = sinon.stub(defaultOptionsToken.account, 'request');
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
      const request = sinon.stub(defaultOptionsCoin.account, 'request');
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
      const request = sinon.stub(defaultOptionsCoin.account, 'request');
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
      const request = sinon.stub(defaultOptionsCoin.account, 'request');
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
      });
    });

    it('throw error on not enough coins for token transfer', async () => {
      const request = sinon.stub(defaultOptionsToken.account, 'request');
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
        name: 'InsufficientCoinForTokenTransactionError',
        message: 'Insufficient funds for token transaction',
      });
    });
  });

  describe('estimateMaxAmount', () => {
    it('should correct estimate max amount (coin)', async () => {
      const request = sinon.stub(defaultOptionsCoin.account, 'request');
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
      const request = sinon.stub(defaultOptionsToken.account, 'request');
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
      const request = sinon.stub(defaultOptionsCoin.account, 'request');
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
      const request = sinon.stub(defaultOptionsToken.account, 'request');
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
    it('should create valid transaction (coin)', async () => {
      const request = sinon.stub(defaultOptionsCoin.account, 'request');
      utils.stubCoinBalance(request, WALLET_ADDRESS, { balance: '2000000000000000000', confirmedBalance: '3000000000000000000' });
      utils.stubTxsCount(request, WALLET_ADDRESS, 10);
      utils.stubGasFees(request, { maxFeePerGas: '30000000000', maxPriorityFeePerGas: '1000000000' });
      utils.stubTransactionSend(request);

      const wallet = new Wallet({
        ...defaultOptionsCoin,
      });
      await wallet.open(RANDOM_PUBLIC_KEY);
      await wallet.load();

      await wallet.createTransaction({
        gasLimit: wallet.gasLimit,
        address: DESTIONATION_ADDRESS,
        amount: new Amount(1_000000000000000000n, wallet.crypto.decimals),
      }, RANDOM_SEED);
      assert.equal(wallet.balance.value, 999370000000000000n);
    });

    it('should create valid transaction (token)', async () => {
      const request = sinon.stub(defaultOptionsToken.account, 'request');
      utils.stubCoinBalance(request, WALLET_ADDRESS, { balance: '2000000000000000000', confirmedBalance: '3000000000000000000' });
      utils.stubTokenBalance(request, TOKEN_ADDRESS, WALLET_ADDRESS, { balance: '2000000', confirmedBalance: '2000000' });
      utils.stubTxsCount(request, WALLET_ADDRESS, 10);
      utils.stubGasFees(request, { maxFeePerGas: '30000000000', maxPriorityFeePerGas: '1000000000' });
      utils.stubTransactionSend(request);

      const wallet = new Wallet({
        ...defaultOptionsToken,
      });
      await wallet.open(RANDOM_PUBLIC_KEY);
      await wallet.load();

      await wallet.createTransaction({
        gasLimit: wallet.gasLimit,
        address: DESTIONATION_ADDRESS,
        amount: new Amount(1_000000n, wallet.crypto.decimals),
      }, RANDOM_SEED);
      assert.equal(wallet.balance.value, 1_000000n);
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
      const request = sinon.stub(defaultOptionsCoin.account, 'request');
      utils.stubCoinBalance(request, WALLET_ADDRESS, { balance: '0', confirmedBalance: '0' });
      utils.stubGasFees(request, { maxFeePerGas: '30000000000', maxPriorityFeePerGas: '1000000000' });

      const wallet = new Wallet({
        ...defaultOptionsCoin,
      });
      await wallet.open(RANDOM_PUBLIC_KEY);
      await wallet.load();

      utils.stubCoinBalance(request, IMPORT_ADDRESS, { balance: '1000000000000000000', confirmedBalance: '1000000000000000000' });
      utils.stubTxsCount(request, IMPORT_ADDRESS, 10);
      utils.stubTransactionSend(request);

      assert.equal(wallet.balance.value, 0n);
      const estimate = await wallet.estimateImport({ privateKey: IMPORT_PRIVATE_KEY });
      await wallet.createImport({ privateKey: IMPORT_PRIVATE_KEY });

      assert.equal(wallet.balance.value, estimate.value);
      assert.equal(wallet.balance.value, 999370000000000000n);
    });

    it('works (token)', async () => {
      const request = sinon.stub(defaultOptionsToken.account, 'request');
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
      utils.stubTransactionSend(request);

      assert.equal(wallet.balance.value, 0n);
      const estimate = await wallet.estimateImport({ privateKey: IMPORT_PRIVATE_KEY });
      await wallet.createImport({ privateKey: IMPORT_PRIVATE_KEY });

      assert.equal(wallet.balance.value, estimate.value);
      assert.equal(wallet.balance.value, 1000000n);
    });
  });

  describe('loadTransactions', () => {
    it('should load transactions (coin)', async () => {
      const request = sinon.stub(defaultOptionsCoin.account, 'request');
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
      const request = sinon.stub(defaultOptionsToken.account, 'request');
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
      const request = sinon.stub(defaultOptionsCoin.account, 'request');
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
      const request = sinon.stub(defaultOptionsCoin.account, 'request');
      utils.stubCoinBalance(request, WALLET_ADDRESS, { balance: '2000000000000000000', confirmedBalance: '3000000000000000000' });
      utils.stubTransactions(request, WALLET_ADDRESS, TRANSACTIONS);
      utils.stubGasFees(request, { maxFeePerGas: '30000000000', maxPriorityFeePerGas: '1000000000' });
      utils.stubTransactionSend(request);
      wallet = new Wallet({
        ...defaultOptionsCoin,
      });
      await wallet.open(RANDOM_PUBLIC_KEY);
      await wallet.load();
      txs = (await wallet.loadTransactions()).transactions;
    });

    it('replace tx (coin)', async () => {
      const before = wallet.balance.value;
      await wallet.createReplacementTransaction(txs[0], RANDOM_SEED);
      const after = wallet.balance.value;
      assert.equal(before - after, 105000000000000n);
      assert.equal(after, 1_999895000000000000n);
    });

    it('replace tx (coin) - legacy', async () => {
      const before = wallet.balance.value;
      await wallet.createReplacementTransaction(txs[1], RANDOM_SEED);
      const after = wallet.balance.value;
      assert.equal(before - after, 105000000000000n);
      assert.equal(after, 1_999895000000000000n);
    });

    it('replace tx (token)', async () => {
      const before = wallet.balance.value;
      await wallet.createReplacementTransaction(txs[2], RANDOM_SEED);
      const after = wallet.balance.value;
      assert.equal(before - after, 1000000000000000n);
      assert.equal(after, 1999000000000000000n);
    });

    it('replace tx (token) - legacy', async () => {
      const before = wallet.balance.value;
      await wallet.createReplacementTransaction(txs[3], RANDOM_SEED);
      const after = wallet.balance.value;
      assert.equal(before - after, 1000000000000000n);
      assert.equal(after, 1999000000000000000n);
    });
  });
});
