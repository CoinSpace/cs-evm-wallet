import { Amount } from '@coinspace/cs-common';

import EvmTransaction from './EvmTransaction.js';
import utils from './utils.js';

export default class TxTransformer {
  #network;
  #wallet;

  constructor({ wallet, network } = {}) {
    this.#wallet = wallet;
    this.#network = network;
  }

  transformTxs(txs) {
    return txs.map((tx) => {
      return this.transformTx(tx);
    });
  }

  transformTx(tx) {
    const isToken = !!tx.token;
    const incoming = tx.to === this.#wallet.address.toLowerCase() && tx.from !== tx.to;
    const gasLimit = tx.gas && BigInt(tx.gas);
    const gasUsed = tx.gasUsed && BigInt(tx.gasUsed);
    const gasPrice = tx.gasPrice && BigInt(tx.gasPrice);
    const maxFeePerGas = tx.maxFeePerGas && BigInt(tx.maxFeePerGas);
    const maxPriorityFeePerGas = tx.maxPriorityFeePerGas && BigInt(tx.maxPriorityFeePerGas);

    let status;
    if (tx.confirmations < this.#network.minConf) {
      status = EvmTransaction.STATUS_PENDING;
    } else {
      status = isToken
        ? EvmTransaction.STATUS_SUCCESS
        : (tx.status === null || tx.status) ? EvmTransaction.STATUS_SUCCESS : EvmTransaction.STATUS_FAILED;
    }

    let rbf = !incoming && tx.confirmations === 0;
    if (rbf) {
      const rbfGasPrice = utils.multiplyGasPrice((gasPrice || maxFeePerGas), this.#network.rbfFactor);
      rbf = rbfGasPrice < BigInt(this.#network.maxGasPrice);
    }

    const fee = isToken
      ? new Amount(0n, this.#wallet.platform.decimals)
      : new Amount((gasUsed || gasLimit) * (gasPrice || maxFeePerGas), this.#wallet.crypto.decimals);

    return new EvmTransaction({
      type: EvmTransaction.TYPE_TRANSFER,
      status,
      id: isToken ? tx.txId : tx._id,
      to: tx.to,
      from: tx.from,
      amount: new Amount(tx.value, this.#wallet.crypto.decimals),
      incoming,
      fee,
      timestamp: new Date(tx.timestamp * 1000),
      confirmations: tx.confirmations,
      minConfirmations: this.#network.minConf,
      development: this.#wallet.development,
      network: this.#network,
      rbf,
      gasLimit,
      gasPrice,
      maxFeePerGas,
      maxPriorityFeePerGas,
      nonce: tx.nonce,
      input: tx.input,
    });
  }
}
