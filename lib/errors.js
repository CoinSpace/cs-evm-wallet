export * from '@coinspace/cs-common/errors';

export class GasLimitError extends TypeError {
  name = 'GasLimitError';
}

export class SmallGasLimitError extends GasLimitError {
  name = 'SmallGasLimitError';
  constructor(value, options) {
    super('Small gas limit', options);
    this.value = value;
  }
}

export class BigGasLimitError extends GasLimitError {
  name = 'BigGasLimitError';
  constructor(value, options) {
    super('Big gas limit', options);
    this.value = value;
  }
}
