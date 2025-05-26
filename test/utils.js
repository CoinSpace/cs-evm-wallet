import sinon from 'sinon';

function stubCoinBalance(request, address, { balance, confirmedBalance }, confirmations = 12) {
  request.withArgs({
    seed: 'device',
    method: 'GET',
    url: `api/v1/addr/${address.toLowerCase()}/balance`,
    baseURL: 'node',
    headers: sinon.match.object,
    params: { confirmations },
  }).resolves({ balance, confirmedBalance });
}

function stubTokenBalance(request, token, address, { balance, confirmedBalance }, confirmations = 12) {
  request.withArgs({
    seed: 'device',
    method: 'GET',
    url: `api/v1/token/${token.toLowerCase()}/${address.toLowerCase()}/balance`,
    baseURL: 'node',
    headers: sinon.match.object,
    params: { confirmations },
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

function stubGasPrice(request, { price }) {
  request.withArgs({
    seed: 'device',
    method: 'GET',
    url: 'api/v1/gasPrice',
    baseURL: 'node',
    headers: sinon.match.object,
  }).resolves({ price });
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

function stubTransactionSend(request, txId, txData) {
  request.withArgs({
    seed: 'device',
    method: 'POST',
    url: 'api/v1/tx/send',
    baseURL: 'node',
    headers: sinon.match.object,
    data: { rawtx: txData ? txData : sinon.match.string },
  }).resolves({ txId });
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

function stubStaking(request, address, data) {
  request.withArgs({
    seed: 'device',
    method: 'GET',
    url: `api/v1/addr/${address.toLowerCase()}/staking`,
    baseURL: 'node',
    headers: sinon.match.object,
  }).resolves(data);
}

function stubPendingRequests(request, address, data) {
  request.withArgs({
    seed: 'device',
    method: 'GET',
    url: `api/v1/addr/${address.toLowerCase()}/pendingRequests`,
    baseURL: 'node',
    headers: sinon.match.object,
  }).resolves(data);
}

function stubStake(request, address, amount, data) {
  request.withArgs({
    seed: 'device',
    method: 'GET',
    url: `api/v1/addr/${address.toLowerCase()}/stake`,
    baseURL: 'node',
    headers: sinon.match.object,
    params: { amount },
  }).resolves(data);
}

function stubUnstake(request, address, amount, data) {
  request.withArgs({
    seed: 'device',
    method: 'GET',
    url: `api/v1/addr/${address.toLowerCase()}/unstake`,
    baseURL: 'node',
    headers: sinon.match.object,
    params: { amount },
  }).resolves(data);
}

function stubClaim(request, address, data) {
  request.withArgs({
    seed: 'device',
    method: 'GET',
    url: `api/v1/addr/${address.toLowerCase()}/claim`,
    baseURL: 'node',
    headers: sinon.match.object,
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
  stubGasPrice,
  stubTxsCount,
  stubTransactionSend,
  stubTransactions,
  stubTokenTransactions,
  stubStaking,
  stubPendingRequests,
  stubStake,
  stubUnstake,
  stubClaim,
  getDefaultOptionsCoin,
  getDefaultOptionsToken,
};
