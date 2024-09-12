import utils from './utils.js';

export default class API {
  #wallet;
  constructor(wallet) {
    this.#wallet = wallet;
  }

  async coinBalance(address, confirmations) {
    utils.validateAddress(address);
    const { balance, confirmedBalance } = await this.#wallet.requestNode({
      url: `api/v1/addr/${address}/balance`,
      method: 'GET',
      params: { confirmations },
    });
    return {
      balance: BigInt(balance),
      confirmedBalance: BigInt(confirmedBalance),
    };
  }

  async tokenBalance(token, address, confirmations) {
    utils.validateAddress(token);
    utils.validateAddress(address);
    const { balance, confirmedBalance } = await this.#wallet.requestNode({
      url: `api/v1/token/${token}/${address}/balance`,
      method: 'GET',
      params: { confirmations },
    });
    return {
      balance: BigInt(balance),
      confirmedBalance: BigInt(confirmedBalance),
    };
  }

  async txsCount(address) {
    utils.validateAddress(address);
    const { count } = await this.#wallet.requestNode({
      url: `api/v1/addr/${address}/txsCount`,
      method: 'GET',
    });
    return BigInt(count);
  }

  async gasPrice() {
    const { price } = await this.#wallet.requestNode({
      url: 'api/v1/gasPrice',
      method: 'GET',
    });
    return BigInt(price);
  }

  async gasFees() {
    const { maxFeePerGas, maxPriorityFeePerGas } = await this.#wallet.requestNode({
      url: 'api/v1/gasFees',
      method: 'GET',
    });
    return {
      maxFeePerGas: BigInt(maxFeePerGas),
      maxPriorityFeePerGas: BigInt(maxPriorityFeePerGas),
    };
  }

  async getAdditionalFee(token = false) {
    const fee = await this.#wallet.requestNode({
      url: 'api/v1/estimateAdditionalFee',
      params: {
        token,
      },
      method: 'GET',
    });
    return BigInt(fee);
  }

  async sendTransaction(rawtx) {
    const { txId } = await this.#wallet.requestNode({
      url: 'api/v1/tx/send',
      method: 'POST',
      data: {
        rawtx,
      },
    });
    return txId;
  }

  async loadTransactions(address, cursor = 1) {
    utils.validateAddress(address);
    const { txs, limit } = await this.#wallet.requestNode({
      url: `api/v1/addr/${address}/txs`,
      method: 'GET',
      params: { cursor },
    });
    const hasMore = txs.length >= limit;
    if (hasMore) cursor++;
    return {
      txs,
      hasMore,
      cursor,
    };
  }

  async loadTokenTransactions(token, address, cursor = 1) {
    const { txs, limit } = await this.#wallet.requestNode({
      url: `api/v1/token/${token}/${address}/txs`,
      method: 'GET',
      params: { cursor },
    });
    const hasMore = txs.length >= limit;
    if (hasMore) cursor++;
    return {
      txs,
      hasMore,
      cursor,
    };
  }

  async loadTransaction(id) {
    const tx = await this.#wallet.requestNode({
      url: `api/v1/tx/${id}`,
      method: 'GET',
    });
    return tx;
  }

  async staking(address) {
    utils.validateAddress(address);
    const { staked, apr, minStakeAmount } = await this.#wallet.requestNode({
      url: `api/v1/addr/${address}/staking`,
      method: 'GET',
    });
    return {
      staked: BigInt(staked),
      apr,
      minStakeAmount: BigInt(minStakeAmount),
    };
  }

  async pendingRequests(address) {
    utils.validateAddress(address);
    const { staking, unstaking, readyForClaim } = await this.#wallet.requestNode({
      url: `api/v1/addr/${address}/pendingRequests`,
      method: 'GET',
    });
    return {
      staking: BigInt(staking),
      unstaking: BigInt(unstaking),
      readyForClaim: BigInt(readyForClaim),
    };
  }

  async stake(address, amount) {
    utils.validateAddress(address);
    const { data, to } = await this.#wallet.requestNode({
      url: `api/v1/addr/${address}/stake`,
      params: {
        amount,
      },
      method: 'GET',
    });
    return { to, data };
  }

  async unstake(address, amount) {
    utils.validateAddress(address);
    const { data, to } = await this.#wallet.requestNode({
      url: `api/v1/addr/${address}/unstake`,
      params: {
        amount,
      },
      method: 'GET',
    });
    return { to, data };
  }

  async claim(address) {
    utils.validateAddress(address);
    const { data, to } = await this.#wallet.requestNode({
      url: `api/v1/addr/${address}/claim`,
      method: 'GET',
    });
    return { to, data };
  }
}
