const assert = require('assert');
const ethers = require('ethers');
const provider = require('../ethers-provider');

const eraSwapTokenJSON = require('../build/Eraswap_0.json');
const nrtManagerJSON = require('../build/NRTManager_0.json');
const timeAllyJSON = require('../build/TimeAlly_0.json');
const stakingJSON = require('../build/Staking_0.json');
const loanAndRefundJSON = require('../build/LoanAndRefund_0.json');


let accounts
, eraSwapInstance
, nrtManagerInstance
, timeAllyInstance
, stakingInstance
, loanAndRefundInstance;

// beforeEach(async() => {
//   console.log(await provider.listAccounts());
// });

describe('Ganache', async() => {
  it('initiates ganache and generates a bunch of accounts', async() => {
    accounts = await provider.listAccounts();

    assert.ok(accounts.length >= 2, 'could not see 2 accounts in the array');
  });
});

describe('Era Swap contract', async() => {
  it('deploys Era Swap token contract from first account', async() => {
    const eraSwapContract = new ethers.ContractFactory(
      eraSwapTokenJSON.abi,
      eraSwapTokenJSON.evm.bytecode.object,
      provider.getSigner(accounts[0])
    );
    eraSwapInstance =  await eraSwapContract.deploy();

    assert.ok(eraSwapInstance.address);
  });

  it('gives first account 91,00,00,000 ES balance', async() => {
    const balanceOfDeployer = await eraSwapInstance.balanceOf(accounts[0]);

    assert.equal(
      balanceOfDeployer.toString(),
      '910000000000000000000000000',
      'deployer did not get 910000000000000000000000000 in ExaES units'
    );
  });

  it('mou() time machine is present', async() => {
    try {
      const mou = await eraSwapInstance.mou();
      assert.ok(mou.toString());
    } catch (e) {
      assert(false);
    }
  });
});

describe('NRT Manager', async() => {
  it('deploys NRT manager from the first account', async() => {
    const nrtManagerContract = new ethers.ContractFactory(
      nrtManagerJSON.abi,
      nrtManagerJSON.evm.bytecode.object,
      provider.getSigner(accounts[0])
    );
    nrtManagerInstance = await nrtManagerContract.deploy(eraSwapInstance.address);

    assert.ok(nrtManagerInstance.address);
  });

  it('invokes AddNRTManager method in the Era Swap Instance from first account', async() => {
    // sends from default accounts[0] used during deploying
    await eraSwapInstance.AddNRTManager(nrtManagerInstance.address);
  });
});


describe('TimeAlly', async() => {
  it('deploys TimeAlly from the first account', async() => {
    const timeAllyContract = new ethers.ContractFactory(
      timeAllyJSON.abi,
      timeAllyJSON.evm.bytecode.object,
      provider.getSigner(accounts[0])
    );
    timeAllyInstance = await timeAllyContract.deploy(eraSwapInstance.address, nrtManagerInstance.address, {gasLimit: 8000000});

    assert.ok(timeAllyInstance.address);
  });

  it('deploys Staking from the first account', async() => {
    const stakingContract = new ethers.ContractFactory(
      stakingJSON.abi,
      stakingJSON.evm.bytecode.object,
      provider.getSigner(accounts[0])
    );
    stakingInstance = await stakingContract.deploy(timeAllyInstance.address);

    assert.ok(stakingInstance.address);
  });

  it('deploys LoanAndRefund from the first account', async() => {
    const loanAndRefundContract = new ethers.ContractFactory(
      loanAndRefundJSON.abi,
      loanAndRefundJSON.evm.bytecode.object,
      provider.getSigner(accounts[0])
    );
    loanAndRefundInstance = await loanAndRefundContract.deploy(timeAllyInstance.address, eraSwapInstance.address);

    assert.ok(loanAndRefundInstance.address);
  });

  // it('does this', async() => {
  //   console.log('first it');
  // });
});




//
// describe('second', async() => {
//   it('does this', async() => {
//     console.log('first it');
//   });
//
//   it('does this', async() => {
//     console.log('first it');
//   });
// });
