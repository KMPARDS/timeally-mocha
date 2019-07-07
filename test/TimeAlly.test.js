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

describe('Ganache Setup', async() => {
  it('initiates ganache and generates a bunch of accounts', async() => {
    accounts = await provider.listAccounts();

    assert.ok(accounts.length >= 2, 'could not see 2 accounts in the array');
  });
});

describe('Era Swap Setup', async() => {
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
      ethers.utils.parseEther('910000000').toString(),
      'deployer did not get 910000000 ES'
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

describe('NRT Manager Setup', async() => {
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


describe('TimeAlly Setup', async() => {
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

  it('invokes setaddress method in TimeAlly from first account', async() => {
    await timeAllyInstance.setaddress(stakingInstance.address, loanAndRefundInstance.address);

    const stakingAddressInTimeAlly = await timeAllyInstance.staking();
    const loanRefundAddressInTimeAlly = await timeAllyInstance.loanAndRefund();

    assert.equal(stakingAddressInTimeAlly, stakingInstance.address, 'stakingAddressInTimeAlly does not match actual staking address');
    assert.equal(loanRefundAddressInTimeAlly, loanAndRefundInstance.address, 'loanRefundAddressInTimeAlly does not match actual loanAndRefund address');
  });

  it('invokes Update Addresses in NRT Manager from first account', async() => {
    await nrtManagerInstance.UpdateAddresses([
      "0x0000000000000000000000000000000000000000",
      "0x0000000000000000000000000000000000000000",
      "0x0000000000000000000000000000000000000000",
      "0x0000000000000000000000000000000000000000",
      "0x0000000000000000000000000000000000000000",
      "0x0000000000000000000000000000000000000000",
      "0x0000000000000000000000000000000000000000",
      "0x0000000000000000000000000000000000000000",
      timeAllyInstance.address
    ]);

    // checking if timeAlly address is set in NRT manager
    const timeAllyAddressInNRTManager = await nrtManagerInstance.TimeAlly();

    assert.equal(timeAllyAddressInNRTManager, timeAllyInstance.address, 'timeAllyAddressInNRTManager does not match actual timeAlly address');
  });

  it('invokes createPlan function in TimeAlly to create first plan from first account', async() => {
    const args = {
      _planPeriod: 31104000,
      _loanInterestRate: 5,
      _loanPeriod: 5184000,
      _refundWeeks: 6
    };

    await timeAllyInstance.createPlan(
      args._planPeriod,
      args._loanInterestRate,
      args._loanPeriod,
      args._refundWeeks
    );

    // checking if the plan is actually created
    const output = await timeAllyInstance.plans(0);

    assert.equal(output[0].toString(), args._planPeriod);
    assert.equal(output[1].toString(), args._loanInterestRate);
    assert.equal(output[2].toString(), args._loanPeriod);
    assert.equal(output[3].toString(), args._refundWeeks);
  });
});


describe('User stakes', async() => {
  it('first account sends 10000 ES to second account', async() => {
    await eraSwapInstance.transfer(accounts[1], ethers.utils.parseEther('10000'));

    const balanceOfSecond = await eraSwapInstance.balanceOf(accounts[1]);

    assert.equal(balanceOfSecond.toString(), ethers.utils.parseEther('10000').toString());
  });

  it('second account gives allowance of 10000 ES to timeAlly', async() => {
    // building tx object
    const data = eraSwapInstance.interface.functions.approve.encode([
      timeAllyInstance.address,
      ethers.utils.parseEther('10000')
    ]);

    const unsignedTx = {
      to: eraSwapInstance.address,
      //nonce:,
      gasLimit: 50000,
      gasPrice: ethers.utils.parseUnits('1', 'gwei'),
      data,
      value: 0
    }

    const signer = provider.getSigner(accounts[1]);

    const response = await signer.sendTransaction(unsignedTx);
    //await provider.getTransaction(response.hash)

    //checking allowance
    const allowance = await eraSwapInstance.allowance(accounts[1], timeAllyInstance.address);
    //console.log(allowance.toString());
    assert.equal(allowance.toString(), ethers.utils.parseEther('10000'));
  });
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
