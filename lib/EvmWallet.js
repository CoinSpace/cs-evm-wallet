import * as errors from './errors.js';
import { bytesToHex } from '@noble/hashes/utils';
import { getMessage } from 'eip-712';
import { Address, Transaction } from 'micro-eth-signer';
import { Amount, CsWallet } from '@coinspace/cs-common';

import { add0x, hexToBytes } from 'micro-eth-signer';
// eslint-disable-next-line camelcase
import { keccak_256 } from '@noble/hashes/sha3';
import { secp256k1 } from '@noble/curves/secp256k1';
import { concatBytes, utf8ToBytes } from '@noble/hashes/utils';

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
  #minStakeAmount = 100000000000000000n; // 0.1 ETH
  #minUnstakeAmount = 2n;
  #staked = 0n;

  // memorized functions
  #getGasPrice;
  #getGasFees;
  #getAdditionalFee;
  #prepareImport;
  #prepareStake;
  #prepareUnstake;
  #prepareClaim;

  get isImportSupported() {
    return true;
  }

  get isGasLimitSupported() {
    return true;
  }

  get isUnaliasSupported() {
    return true;
  }

  get isStakingSupported() {
    return this.crypto._id === 'ethereum@ethereum';
  }

  get gasLimit() {
    return this.#gasLimit;
  }

  get gasLimitSmartContract() {
    return 500_000n;
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

  get dummyExchangeDepositAddress() {
    return '0x7fe33da42015b2876e16a3d5b3cd34a0b7c80874';
  }

  get isWalletConnectSupported() {
    return this.crypto.type === 'coin';
  }

  get chainId() {
    return `eip155:${this.#network.chainId}`;
  }

  get accountId() {
    return `${this.chainId}:${this.address}`;
  }

  constructor(options = {}) {
    super(options);

    this.#api = new API(this);
    this.#network = networks[options.development ? 'testnet' : 'mainnet'][options.crypto.platform];

    this.#gasLimit = this.crypto.type === 'token'
      ? BigInt(this.#network.gasLimitToken || 200000n)
      : BigInt(this.#network.gasLimitCoin || 21000n);
    this.#getGasPrice = this.memoize(this._getGasPrice);
    this.#getGasFees = this.memoize(this._getGasFees);
    this.#getAdditionalFee = this.memoize(this._getAdditionalFee);
    this.#prepareImport = this.memoize(this._prepareImport);
    this.#prepareStake = this.memoize(this._prepareStake);
    this.#prepareUnstake = this.memoize(this._prepareUnstake);
    this.#prepareClaim = this.memoize(this._prepareClaim);

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
    this.memoizeClear(this.#getAdditionalFee);
    this.memoizeClear(this.#prepareImport);
    this.memoizeClear(this.#prepareStake);
    this.memoizeClear(this.#prepareUnstake);
    this.memoizeClear(this.#prepareClaim);
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
    if (this.platform._id === 'ethereum@optimism') {
      const { maxFeePerGas } = await this.#getGasFees();
      const additionalFee = await this.#getAdditionalFee();
      const fee = gasLimit * maxFeePerGas;
      if (this.development) console.log({ fee, additionalFee });
      return fee + additionalFee;
    }
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

  async _getAdditionalFee() {
    return this.#api.getAdditionalFee(this.crypto.type === 'token');
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
        throw new errors.InsufficientCoinForTransactionFeeError(new Amount(fee, this.platform.decimals));
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
      if (!balance) return 0n;
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
    const signedTx = transaction.sign(privateKey);

    const id = await this.#api.sendTransaction(signedTx.hex);
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
    return id;
  }

  async eth_sendTransaction(data, seed) {
    const nonce = await this.#api.txsCount(this.#address);
    const value = data.value ? BigInt(data.value) : 0n;
    const transaction = new Transaction({
      from: data.from,
      to: data.to,
      value,
      data: data.data,
      nonce,
      gasLimit: data.gas ? BigInt(data.gas) : this.gasLimitSmartContract,
      ...(await this.#getGasParams()),
      chainId: this.#network.chainId,
    });

    const privateKey = utils.privateKeyFromMasterSeed(seed, this.settings.bip44, this.crypto.platform);
    const signedTx = transaction.sign(privateKey);

    const id = await this.#api.sendTransaction(signedTx.hex);
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
    return id;
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

    const signedTx = transaction.sign(privateKey);
    const id = await this.#api.sendTransaction(signedTx.hex);
    if (this.crypto.type === 'coin') {
      this.#coinBalance += sendable;
      this.storage.set('balance', this.#coinBalance.toString());
    }
    if (this.crypto.type === 'token') {
      this.#tokenBalance += sendable;
      this.storage.set('balance', this.#tokenBalance.toString());
    }
    await this.storage.save();
    return id;
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
    const signedTx = transaction.sign(privateKey);
    const fee = signedTx.fee - tx.fee.value;

    const id = await this.#api.sendTransaction(signedTx.hex);

    this.#coinBalance -= fee;
    this.storage.set('balance', this.#coinBalance.toString());
    await this.storage.save();
    return id;
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
      const minimum = this.#dustThreshold + (this.crypto.type === 'coin' ? fee : 0n);
      throw new errors.SmallAmountError(new Amount(minimum, this.crypto.decimals));
    }

    let coinBalance;
    if (this.crypto.type === 'token') {
      const { balance, confirmedBalance } = await this.#api.coinBalance(address, this.#network.minConf);
      coinBalance = utils.minBigInt(balance, confirmedBalance);
      if (fee > coinBalance) {
        throw new errors.InsufficientCoinForTransactionFeeError(new Amount(fee, this.platform.decimals));
      }
    }
    return {
      value,
      fee,
      sendable,
      from: address,
    };
  }

  async _prepareStake({ amount }) {
    return this.#api.stake(this.#address, amount);
  }

  async _prepareUnstake({ amount }) {
    return this.#api.unstake(this.#address, amount);
  }

  async _prepareClaim() {
    return this.#api.claim(this.#address);
  }

  signMessage(msg, privateKey, extraEntropy = undefined) {
    const hash = keccak_256(msg);
    if (typeof privateKey === 'string') {
      privateKey = hexToBytes(privateKey);
    }
    const sig = secp256k1.sign(hash, privateKey, { extraEntropy });
    const end = sig.recovery === 0 ? '1b' : '1c';
    return add0x(sig.toCompactHex() + end);
  }

  async eth_signTypedData(data, seed) {
    if (typeof data === 'string') {
      data = JSON.parse(data);
    }
    const message = getMessage(data, false);
    const privateKey = utils.privateKeyFromMasterSeed(seed, this.settings.bip44, this.crypto.platform);
    const signature = this.signMessage(message, privateKey);
    return signature;
  }

  async eth_sign(msg, seed) {
    if (typeof msg === 'string') {
      if (msg.startsWith('0x')) {
        msg = hexToBytes(msg);
      } else {
        msg = utf8ToBytes(msg);
      }
    }
    const message = concatBytes(
      utf8ToBytes('\x19Ethereum Signed Message:\n'),
      utf8ToBytes(`${msg.length}`),
      msg
    );
    const privateKey = utils.privateKeyFromMasterSeed(seed, this.settings.bip44, this.crypto.platform);
    const signature = this.signMessage(message, privateKey);
    return signature;
  }

  async staking() {
    const { staked, apr, minStakeAmount } = await this.#api.staking(this.#address);
    this.#minStakeAmount = minStakeAmount;
    this.#staked = staked;
    return {
      staked: new Amount(staked, this.crypto.decimals),
      apr,
    };
  }

  async pendingRequests() {
    const { staking, unstaking, readyForClaim } = await this.#api.pendingRequests(this.#address);
    return {
      staking: new Amount(staking, this.crypto.decimals),
      unstaking: new Amount(unstaking, this.crypto.decimals),
      readyForClaim: new Amount(readyForClaim, this.crypto.decimals),
    };
  }

  async validateStakeAmount({ amount }) {
    const { value } = amount;
    const gasLimit = this.gasLimitSmartContract;
    const address = this.dummyExchangeDepositAddress;
    if (value < this.#minStakeAmount) {
      throw new errors.SmallAmountError(new Amount(this.#minStakeAmount, this.crypto.decimals));
    }
    await this.validateAmount({ gasLimit, address, amount });
  }

  async estimateStake({ amount }) {
    const { to } = await this.#prepareStake({ amount });
    const gasLimit = this.gasLimitSmartContract;
    const fee = await this.estimateTransactionFee({ gasLimit, address: to, amount });
    return { to, fee };
  }

  async estimateStakeMaxAmount() {
    const gasLimit = this.gasLimitSmartContract;
    const address = this.dummyExchangeDepositAddress;
    return this.estimateMaxAmount({ gasLimit, address });
  }

  async stake({ amount }, seed) {
    const { to, data } = await this.#prepareStake({ amount });
    const id = await this.eth_sendTransaction({
      from: this.#address,
      to,
      value: amount.value,
      data,
    }, seed);
    return id;
  }

  async validateUnstakeAmount({ amount }) {
    const gasLimit = this.gasLimitSmartContract;
    const address = this.dummyExchangeDepositAddress;
    super.validateAmount({ gasLimit, address, amount });
    const { value } = amount;
    if (value < this.#minUnstakeAmount) {
      throw new errors.SmallAmountError(new Amount(this.#minUnstakeAmount, this.crypto.decimals));
    }
    const fee = await this.#getMinerFee(gasLimit);
    if (fee > this.#coinBalance) {
      throw new errors.InsufficientCoinForTransactionFeeError(new Amount(fee, this.crypto.decimals));
    }
    if (amount.value > this.#staked) {
      throw new errors.BigAmountError(new Amount(this.#staked, this.crypto.decimals));
    }
    return true;
  }

  async estimateUnstake({ amount }) {
    const { to } = await this.#prepareUnstake({ amount });
    const gasLimit = this.gasLimitSmartContract;
    const fee = await this.estimateTransactionFee({ gasLimit, address: to, amount });
    return fee;
  }

  async estimateUnstakeMaxAmount() {
    return new Amount(this.#staked, this.crypto.decimals);
  }

  async unstake({ amount }, seed) {
    const { to, data } = await this.#prepareUnstake({ amount });
    const id = await this.eth_sendTransaction({
      from: this.#address,
      to,
      data,
    }, seed);
    return id;
  }

  async validateClaim() {
    const gasLimit = this.gasLimitSmartContract;
    const fee = await this.#getMinerFee(gasLimit);
    if (fee > this.#coinBalance) {
      throw new errors.InsufficientCoinForTransactionFeeError(new Amount(fee, this.crypto.decimals));
    }
    return true;
  }

  async estimateClaim() {
    const { to } = await this.#prepareClaim();
    const gasLimit = this.gasLimitSmartContract;
    const amount = new Amount(0, this.crypto.decimals);
    const fee = await this.estimateTransactionFee({ gasLimit, address: to, amount });
    return fee;
  }

  async claim(seed) {
    const { to, data } = await this.#prepareClaim();
    const id = await this.eth_sendTransaction({
      from: this.#address,
      to,
      data,
    }, seed);
    return id;
  }
}
