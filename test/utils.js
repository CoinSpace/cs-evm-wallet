import sinon from 'sinon';

function stubCoinBalance(request, address, { balance, confirmedBalance }) {
  request.withArgs({
    seed: 'device',
    method: 'GET',
    url: `api/v1/addr/${address.toLowerCase()}/balance`,
    baseURL: 'node',
    headers: sinon.match.object,
    params: { confirmations: 12 },
  }).resolves({ balance, confirmedBalance });
}

function stubTokenBalance(request, token, address, { balance, confirmedBalance }) {
  request.withArgs({
    seed: 'device',
    method: 'GET',
    url: `api/v1/token/${token.toLowerCase()}/${address.toLowerCase()}/balance`,
    baseURL: 'node',
    headers: sinon.match.object,
    params: { confirmations: 12 },
  }).resolves({ balance, confirmedBalance });
}

function stubGasFees(request, { maxFeePerGas, maxPriorityFeePerGas }) {
  request.withArgs({
    seed: 'device',
    method: 'GET',
    url: 'api/v1/gasFees',
    baseURL: 'node',
    headers: sinon.match.object,
  }).resolves({ maxFeePerGas, maxPriorityFeePerGas });
}

function stubTxsCount(request, address, count) {
  request.withArgs({
    seed: 'device',
    method: 'GET',
    url: `api/v1/addr/${address.toLowerCase()}/txsCount`,
    baseURL: 'node',
    headers: sinon.match.object,
  }).resolves({ count });
}

function stubTransactionSend(request, txId) {
  request.withArgs(sinon.match((value) => {
    return value?.url === 'api/v1/tx/send';
  })).resolves({ txId });
}

function stubTransactions(request, address, data) {
  request.withArgs({
    seed: 'device',
    method: 'GET',
    url: `api/v1/addr/${address.toLowerCase()}/txs`,
    baseURL: 'node',
    headers: sinon.match.object,
    params: { cursor: 1 },
  }).resolves(data);
}

function stubTokenTransactions(request, token, address, data) {
  request.withArgs({
    seed: 'device',
    method: 'GET',
    url: `api/v1/token/${token.toLowerCase()}/${address.toLowerCase()}/txs`,
    baseURL: 'node',
    headers: sinon.match.object,
    params: { cursor: 1 },
  }).resolves(data);
}

function getDefaultOptionsCoin(crypto) {
  return {
    crypto,
    platform: crypto,
    cache: { get() {}, set() {} },
    settings: { bip44: "m/44'/60'/0'" },
    account: {
      market: {
        getPrice() { return 1723.03; },
      },
    },
    request(...args) { console.log(args); },
    apiNode: 'node',
    storage: { get() {}, set() {}, save() {} },
    development: true,
  };
}

function getDefaultOptionsToken(crypto, platform) {
  return {
    crypto,
    platform,
    cache: { get() {}, set() {} },
    settings: { bip44: "m/44'/60'/0'" },
    account: {
      market: {
        getPrice() { return 1; },
      },
    },
    request(...args) { console.log(args); },
    apiNode: 'node',
    storage: { get() {}, set() {}, save() {} },
    development: true,
  };
}

export default {
  stubCoinBalance,
  stubTokenBalance,
  stubGasFees,
  stubTxsCount,
  stubTransactionSend,
  stubTransactions,
  stubTokenTransactions,
  getDefaultOptionsCoin,
  getDefaultOptionsToken,
};
