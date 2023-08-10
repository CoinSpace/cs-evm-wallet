export * from '@coinspace/cs-common/errors';

export class GasLimitError extends TypeError {
  name = 'GasLimitError';
  constructor(message, options) {
    super(message || 'Invalid gas limit', options);
  }
}
