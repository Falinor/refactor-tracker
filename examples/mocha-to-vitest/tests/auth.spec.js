const { expect } = require('chai');
const { authenticate } = require('../src/auth');

describe('authenticate', () => {
  it('returns a token for valid credentials', async () => {
    const token = await authenticate('user', 'pass');
    expect(token).to.be.a('string');
  });

  it('throws on bad credentials', async () => {
    try {
      await authenticate('user', 'wrong');
    } catch (err) {
      expect(err.message).to.equal('invalid');
    }
  });
});
