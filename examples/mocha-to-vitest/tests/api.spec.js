const { expect } = require('chai');
const sinon = require('sinon');
const { fetchUser } = require('../src/api');

describe('fetchUser', () => {
  it('calls the right endpoint', async () => {
    const stub = sinon.stub(global, 'fetch').resolves({ json: () => ({ id: '1' }) });
    const user = await fetchUser('1');
    expect(user.id).to.equal('1');
    expect(stub.calledWith('/users/1')).to.be.true;
    stub.restore();
  });
});
