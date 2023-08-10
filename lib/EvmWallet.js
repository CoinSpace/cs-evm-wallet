import * as errors from './errors.js';
import { bytesToHex } from '@noble/hashes/utils';
import { Address, Transaction } from 'micro-eth-signer';
import { Amount, CsWallet } from '@coinspace/cs-common';

import API from './API.js';
import TxTransformer from './TxTransformer.js';
import networks from './networks.js';
import utils from './utils.js';

export default class EvmWallet extends CsWallet {
  #api;
  #network;

  #address;
  #addressCheckSum;
  #coinBalance = 0n;
  #coinBalanceConfirmed = 0n;
  #tokenBalance = 0n;
  #tokenBalanceConfirmed = 0n;
  #dustThreshold = 1n;
  #txTransformer;
  #transactions = new Map();

  #gasLimit;

  // memorized functions
  #getGasPrice;
  #getGasFees;
  #prepareImport;

  get isImportSupported() {
    return true;
  }

  get isGasLimitSupported() {
    return true;
  }

  get isUnaliasSupported() {
    return true;
  }

  get gasLimit() {
    return this.#gasLimit;
  }

  get balance() {
    if (this.crypto.type === 'coin') {
      return new Amount(this.#coinBalance, this.crypto.decimals);
    }
    if (this.crypto.type === 'token') {
      return new Amount(this.#tokenBalance, this.crypto.decimals);
    }
    throw new errors.InternalWalletError('Unsupported crypto type');
  }

  get tokenUrl() {
    if (this.crypto.type === 'token') {
      return this.#network.tokenUrl.replace('${tokenAddress}', this.crypto.address);
    }
    return undefined;
  }

  get address() {
    return this.#addressCheckSum;
  }

  get defaultSettings() {
    const network = networks[this.development ? 'testnet' : 'mainnet'][this.crypto.platform];
    return {
      bip44: network.bip44,
    };
  }

  get isSettingsSupported() {
    return this.crypto.type === 'coin';
  }

  constructor(options = {}) {
    super(options);

    this.#api = new API(this);
    this.#network = networks[options.development ? 'testnet' : 'mainnet'][options.crypto.platform];

    this.#gasLimit = this.crypto.type === 'token' ? 200000n : 21000n;
    this.#getGasPrice = this.memoize(this._getGasPrice);
    this.#getGasFees = this.memoize(this._getGasFees);
    this.#prepareImport = this.memoize(this._prepareImport);

    this.#txTransformer = new TxTransformer({
      wallet: this,
      network: this.#network,
    });
  }

  async create(seed) {
    this.typeSeed(seed);
    this.state = CsWallet.STATE_INITIALIZING;
    const privateKey = utils.privateKeyFromMasterSeed(seed, this.settings.bip44, this.crypto.platform);
    this.#addressCheckSum = Address.fromPrivateKey(privateKey);
    this.#address = this.#addressCheckSum.toLowerCase();

    this.#init();
    this.state = CsWallet.STATE_INITIALIZED;
  }

  async open(publicKey) {
    this.typePublicKey(publicKey);
    this.state = CsWallet.STATE_INITIALIZING;

    if (publicKey.settings.bip44 === this.settings.bip44) {
      this.#addressCheckSum = publicKey.data;
      this.#address = this.#addressCheckSum.toLowerCase();
      this.#init();
      this.state = CsWallet.STATE_INITIALIZED;
    } else {
      this.state = CsWallet.STATE_NEED_INITIALIZATION;
    }
  }

  #init() {
    if (this.crypto.type === 'coin') {
      this.#coinBalance = BigInt(this.storage.get('balance') || 0);
    }
    if (this.crypto.type === 'token') {
      this.#tokenBalance = BigInt(this.storage.get('balance') || 0);
    }
  }

  async load() {
    this.state = CsWallet.STATE_LOADING;
    try {
      const { balance, confirmedBalance } = await this.#getCoinBalance();
      this.#coinBalance = balance;
      this.#coinBalanceConfirmed = confirmedBalance;

      if (this.crypto.type === 'coin') {
        this.storage.set('balance', this.#coinBalance.toString());
      }
      if (this.crypto.type === 'token') {
        const { balance, confirmedBalance } = await this.#getTokenBalance();
        this.#tokenBalance = balance;
        this.#tokenBalanceConfirmed = confirmedBalance;
        this.storage.set('balance', this.#tokenBalance.toString());
      }
      await this.storage.save();
      this.state = CsWallet.STATE_LOADED;
    } catch (err) {
      this.state = CsWallet.STATE_ERROR;
      throw err;
    }
  }

  async cleanup() {
    await super.cleanup();
    this.memoizeClear(this.#getGasPrice);
    this.memoizeClear(this.#getGasFees);
    this.memoizeClear(this.#prepareImport);
  }

  getPublicKey() {
    return {
      settings: this.settings,
      data: this.#addressCheckSum,
    };
  }

  getPrivateKey(seed) {
    this.typeSeed(seed);
    const privateKey = utils.privateKeyFromMasterSeed(seed, this.settings.bip44, this.crypto.platform);
    return [{
      address: this.#addressCheckSum,
      privatekey: bytesToHex(privateKey),
    }];
  }

  async #getCoinBalance() {
    return this.#api.coinBalance(this.#address, this.#network.minConf);
  }

  async #getTokenBalance() {
    return this.#api.tokenBalance(this.crypto.address, this.#address, this.#network.minConf);
  }

  async #getMinerFee(gasLimit) {
    if (this.#network.eip1559) {
      const { maxFeePerGas } = await this.#getGasFees();
      return gasLimit * maxFeePerGas;
    } else {
      const gasPrice = await this.#getGasPrice();
      return gasLimit * gasPrice;
    }
  }

  async _getGasPrice() {
    return this.#api.gasPrice();
  }

  async _getGasFees() {
    return this.#api.gasFees();
  }

  async validateAddress({ address }) {
    super.validateAddress({ address });
    address = address.toLowerCase();
    utils.validateAddress(address);
    if (address === this.#address) {
      throw new errors.DestinationEqualsSourceError();
    }
    return true;
  }

  async validateGasLimit({ gasLimit }) {
    super.validateGasLimit({ gasLimit });
    if (gasLimit <= 0n) {
      throw new errors.GasLimitError();
    }
    return true;
  }

  async validateAmount({ gasLimit, address, amount }) {
    super.validateAmount({ gasLimit, address, amount });
    const { value } = amount;

    if (value < this.#dustThreshold) {
      throw new errors.SmallAmountError(new Amount(this.#dustThreshold, this.crypto.decimals));
    }
    if (this.crypto.type === 'token') {
      const fee = await this.#getMinerFee(gasLimit);
      if (fee > this.#coinBalance) {
        throw new errors.InsufficientCoinForTokenTransactionError(new Amount(fee, this.platform.decimals));
      }
    }
    const maxAmount = await this.#estimateMaxAmount({ gasLimit });
    if (value > maxAmount) {
      const unconfirmedMaxAmount = await this.#estimateMaxAmount({ gasLimit, unconfirmed: true });
      if (value < unconfirmedMaxAmount) {
        throw new errors.BigAmountConfirmationPendingError(new Amount(maxAmount, this.crypto.decimals));
      } else {
        throw new errors.BigAmountError(new Amount(maxAmount, this.crypto.decimals));
      }
    }
    return true;
  }

  async estimateTransactionFee({ gasLimit, address, amount }) {
    super.estimateTransactionFee({ gasLimit, address, amount });
    const fee = await this.#getMinerFee(gasLimit);
    return new Amount(fee, this.crypto.type === 'coin' ? this.crypto.decimals : this.platform.decimals);
  }

  async #estimateMaxAmount({ gasLimit, unconfirmed = false }) {
    if (this.crypto.type === 'coin') {
      const balance = unconfirmed ? this.#coinBalance : utils.minBigInt(this.#coinBalance, this.#coinBalanceConfirmed);
      const minerFee = await this.#getMinerFee(gasLimit);
      if (balance < minerFee) {
        return 0n;
      }
      return balance - minerFee;
    }
    if (this.crypto.type === 'token') {
      if (unconfirmed) return this.#tokenBalance;
      return utils.minBigInt(this.#tokenBalance, this.#tokenBalanceConfirmed);
    }
  }

  async estimateMaxAmount({ gasLimit, address }) {
    super.estimateMaxAmount({ gasLimit, address });
    const maxAmount = await this.#estimateMaxAmount({ gasLimit });
    return new Amount(maxAmount, this.crypto.decimals);
  }

  async #getGasParams() {
    if (this.#network.eip1559) {
      return this.#getGasFees();
    } else {
      const gasPrice = await this.#getGasPrice();
      return { gasPrice };
    }
  }

  async createTransaction({ gasLimit, address, amount }, seed) {
    super.createTransaction({ gasLimit, address, amount }, seed);
    const { value } = amount;
    address = address.toLowerCase();

    const nonce = await this.#api.txsCount(this.#address);
    const transaction = this.crypto.type === 'coin'
      ? new Transaction({
        to: address,
        value,
        nonce,
        gasLimit,
        ...(await this.#getGasParams()),
        chainId: this.#network.chainId,
      })
      : new Transaction({
        to: this.crypto.address,
        value: 0n,
        data: utils.tokenTransferData(address, value),
        nonce,
        gasLimit,
        ...(await this.#getGasParams()),
        chainId: this.#network.chainId,
      });

    const privateKey = utils.privateKeyFromMasterSeed(seed, this.settings.bip44, this.crypto.platform);
    const signedTx = await transaction.sign(privateKey);

    await this.#api.sendTransaction(signedTx.hex);
    if (this.crypto.type === 'coin') {
      this.#coinBalance -= value + signedTx.fee;
      this.storage.set('balance', this.#coinBalance.toString());
    }
    if (this.crypto.type === 'token') {
      this.#coinBalance -= signedTx.fee;
      this.#tokenBalance -= value;
      this.storage.set('balance', this.#tokenBalance.toString());
    }
    await this.storage.save();
  }

  async estimateImport({ privateKey }) {
    super.estimateImport();
    const { sendable } = await this.#prepareImport({ privateKey });
    return new Amount(sendable, this.crypto.decimals);
  }

  async createImport({ privateKey }) {
    super.createImport();
    const { sendable, from } = await this.#prepareImport({ privateKey });

    const nonce = await this.#api.txsCount(from);
    const transaction = this.crypto.type === 'coin'
      ? new Transaction({
        to: this.#address,
        value: sendable,
        nonce,
        gasLimit: this.#gasLimit,
        ...(await this.#getGasParams()),
        chainId: this.#network.chainId,
      })
      : new Transaction({
        to: this.crypto.address,
        value: 0n,
        data: utils.tokenTransferData(this.#address, sendable),
        nonce,
        gasLimit: this.#gasLimit,
        ...(await this.#getGasParams()),
        chainId: this.#network.chainId,
      });

    const signedTx = await transaction.sign(privateKey);
    await this.#api.sendTransaction(signedTx.hex);
    if (this.crypto.type === 'coin') {
      this.#coinBalance += sendable;
      this.storage.set('balance', this.#coinBalance.toString());
    }
    if (this.crypto.type === 'token') {
      this.#tokenBalance += sendable;
      this.storage.set('balance', this.#tokenBalance.toString());
    }
    await this.storage.save();
  }

  async estimateReplacement(tx) {
    super.estimateReplacement(tx);
    const rbfGasPrice = utils.multiplyGasPrice((tx.gasPrice || tx.maxFeePerGas), this.#network.rbfFactor);
    const fee = rbfGasPrice * tx.gasLimit - tx.fee.value;
    const balance = utils.minBigInt(this.#coinBalance, this.#coinBalanceConfirmed);
    if ((balance - fee) < 0n) {
      throw new errors.BigAmountError();
    }
    return {
      percent: Number((this.#network.rbfFactor - 1).toFixed(2)),
      fee: new Amount(fee, this.crypto.type === 'coin' ? this.crypto.decimals : this.platform.decimals),
    };
  }

  async createReplacementTransaction(tx, seed) {
    super.createReplacementTransaction(tx, seed);
    const transaction = new Transaction({
      to: tx.to,
      value: tx.amount.value,
      nonce: tx.nonce,
      data: tx.input,
      gasLimit: tx.gasLimit,
      ...tx.maxFeePerGas ? {
        maxFeePerGas: utils.multiplyGasPrice(tx.maxFeePerGas, this.#network.rbfFactor),
        maxPriorityFeePerGas: utils.multiplyGasPrice(tx.maxPriorityFeePerGas, this.#network.rbfFactor),
      } : {
        gasPrice: utils.multiplyGasPrice(tx.gasPrice, this.#network.rbfFactor),
      },
      chainId: this.#network.chainId,
    });

    const privateKey = utils.privateKeyFromMasterSeed(seed, this.settings.bip44, this.crypto.platform);
    const signedTx = await transaction.sign(privateKey);
    const fee = signedTx.fee - tx.fee.value;

    await this.#api.sendTransaction(signedTx.hex);

    this.#coinBalance -= fee;
    this.storage.set('balance', this.#coinBalance.toString());
    await this.storage.save();
  }

  async loadTransactions({ cursor } = {}) {
    if (!cursor) {
      this.#transactions.clear();
    }
    const res = this.crypto.type === 'coin'
      ? await this.#api.loadTransactions(this.#address, cursor)
      : await this.#api.loadTokenTransactions(this.crypto.address, this.#address, cursor);

    const transactions = this.#txTransformer.transformTxs(res.txs);
    for (const transaction of transactions) {
      this.#transactions.set(transaction.id, transaction);
    }
    return {
      transactions,
      hasMore: res.hasMore,
      cursor: res.cursor,
    };
  }

  async loadTransaction(id) {
    if (this.#transactions.has(id)) {
      return this.#transactions.get(id);
    } else {
      try {
        return this.#txTransformer.transformTx(await this.#api.loadTransaction(id));
      } catch (err) {
        return;
      }
    }
  }

  async _prepareImport({ privateKey }) {
    let address;
    try {
      address = Address.fromPrivateKey(privateKey).toLowerCase();
    } catch (err) {
      throw new errors.InvalidPrivateKeyError(undefined, { cause: err });
    }
    if (address === this.#address) {
      throw new errors.DestinationEqualsSourceError();
    }
    const [{ balance, confirmedBalance }, fee] = await Promise.all([
      this.crypto.type === 'coin'
        ? this.#api.coinBalance(address, this.#network.minConf)
        : this.#api.tokenBalance(this.crypto.address, address, this.#network.minConf),
      this.#getMinerFee(this.#gasLimit),
    ]);
    const value = utils.minBigInt(balance, confirmedBalance);
    const sendable = this.crypto.type === 'coin' ? value - fee : value;

    if (sendable < this.#dustThreshold) {
      throw new errors.SmallAmountError(new Amount(this.#dustThreshold, this.crypto.decimals));
    }

    let coinBalance;
    if (this.crypto.type === 'token') {
      const { balance, confirmedBalance } = await this.#api.coinBalance(address, this.#network.minConf);
      coinBalance = utils.minBigInt(balance, confirmedBalance);
      if (fee > coinBalance) {
        throw new errors.InsufficientCoinForTokenTransactionError(new Amount(fee, this.platform.decimals));
      }
    }
    return {
      value,
      fee,
      sendable,
      from: address,
    };
  }
}
