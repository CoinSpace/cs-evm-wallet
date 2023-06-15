import { Transaction } from '@coinspace/cs-common';

export default class EvmTransaction extends Transaction {
  constructor(options) {
    super(options);
    this.network = options.network;
    this.gasLimit = options.gasLimit;
    this.gasPrice = options.gasPrice;
    this.maxFeePerGas = options.maxFeePerGas;
    this.maxPriorityFeePerGas = options.maxPriorityFeePerGas;
    this.nonce = options.nonce;
    this.input = options.input;
  }

  get url() {
    return this.network.txUrl.replace('${txId}', this.id);
  }
}
