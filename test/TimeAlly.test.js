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

let eraSwapInstance2, timeAllyInstance2;

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
      _loanInterestRate: 1,
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

    //checking if allowance is successfully given to timeally
    const allowance = await eraSwapInstance.allowance(accounts[1], timeAllyInstance.address);
    assert.equal(allowance.toString(), ethers.utils.parseEther('10000'));
  });

  it('second account invokes createContract method in TimeAlly to stake ES for himself/herself', async() => {
    // // building tx object
    // const data = timeAllyInstance.interface.functions.createContract.encode([
    //   accounts[1],
    //   0,
    //   ethers.utils.parseEther('10000') // parsing ES to exaES
    // ]);
    //
    // const unsignedTx = {
    //   to: timeAllyInstance.address,
    //   //nonce:,
    //   gasLimit: 1000000,
    //   gasPrice: ethers.utils.parseUnits('1', 'gwei'),
    //   data,
    //   value: 0
    // }
    //
    // const signer = provider.getSigner(accounts[1]);
    //
    // const response = await signer.sendTransaction(unsignedTx);
    // assert.ok(response.hash);
    // //await provider.getTransaction(response.hash)
    //
    // //checking if contract was created successfully
    // const calltx = {
    //   to: timeAllyInstance.address,
    //   data: timeAllyInstance.interface.functions.viewContract.encode([0])
    // };
    // const contract = await signer.call(calltx);

    const signer2 = provider.getSigner(accounts[1]);

    // //cloning eraSwapInstance with signer for second account
    // const eraSwapInstance2 = new ethers.Contract(eraSwapInstance.address, eraSwapTokenJSON.abi, signer2)

    //cloning timeAllyInstance with signer for second address
    timeAllyInstance2 = new ethers.Contract(timeAllyInstance.address, timeAllyJSON.abi, signer2);

    const response =await timeAllyInstance2.createContract(accounts[1], 0, ethers.utils.parseEther('10000'));
    assert.ok(response.hash);

    const contract = await timeAllyInstance2.viewContract(0);
    //`console.log(contract)
    assert.equal(contract[3], accounts[1]);

    const stakes = await timeAllyInstance2.viewUserStakes(0);
    // console.log(stakes[1].toString());
    assert.equal(stakes[1].toString(), ethers.utils.parseEther('10000'));
  });

  it('balance of second account is decreased by 10000 ES and it goes to TimeAlly', async() => {
    const balanceOfSecond = await eraSwapInstance.balanceOf(accounts[1]);

    assert.equal(
      balanceOfSecond.toString(),
      ethers.utils.parseEther('0').toString(),
      'second account amount did not decrease'
    );

    const balanceOfTimeAlly = await eraSwapInstance.balanceOf(timeAllyInstance.address);

    assert.equal(
      balanceOfTimeAlly.toString(),
      ethers.utils.parseEther('10000').toString(),
      'timeally did not get user staking'
    );
  });

  it('second account needs 4000 ES urgently and takes loan over his/her prestaked contract of 10000 ES', async() => {

    await timeAllyInstance2.takeLoan(0, ethers.utils.parseEther('4000'));

    // checking if loan of 4000 ES is credited to second account
    const balanceOfSecond = await eraSwapInstance.balanceOf(accounts[1]);

    assert.equal(
      balanceOfSecond.toString(),
      ethers.utils.parseEther('4000').toString(),
      'second account amount did not receive loan amount'
    );

    // checking if contract status is 2
    const contract = await timeAllyInstance2.viewContract(0);
    assert.equal(contract[0].toString(), '2');
  });

  it('repay loan 4000 ES deducts 1% more, i.e. 4040 ES', async() => {

    // checking loanRepaymentAmount should be 4040 ES
    const loanRepaymentAmount = await timeAllyInstance2.loanRepaymentAmount(0);
    assert.equal(loanRepaymentAmount.toString(), ethers.utils.parseEther('4040').toString(), 'loanRepaymentAmount missmatch with loan rate 1%');

    // second account has 4000 ES, sending 40 ES from first account to second account
    await eraSwapInstance.transfer(accounts[1], ethers.utils.parseEther('40'));

    // creating eraSwapInstance2 with signer of second account
    const signer2 = provider.getSigner(accounts[1]);
    eraSwapInstance2 = new ethers.Contract(eraSwapInstance.address, eraSwapTokenJSON.abi, signer2);

    const balanceOfSecond = await eraSwapInstance.balanceOf(accounts[1]);

    // giving allowance of 4040 from second account to timeAlly
    await eraSwapInstance2.approve(timeAllyInstance.address, ethers.utils.parseEther('4040'));

    await timeAllyInstance2.rePayLoan(0);

    assert.equal(
      balanceOfSecond.sub(await eraSwapInstance.balanceOf(accounts[1])).toString(),
      ethers.utils.parseEther('4040').toString(),
      'amount deducted does not equal 101% of loan value'
    );

    // checking if contract status is 1
    const contract = await timeAllyInstance2.viewContract(0);
    assert.equal(contract[0].toString(), '1');
  });

  it('second account can transfer ownership to third account and back to second account', async() => {
    // second account transfers ownership of contract id 0 to third account
    await timeAllyInstance2.transferOwnership(0, accounts[2]);

    // creating timeAllyInstance3 with signer of third account
    const signer3 = provider.getSigner(accounts[2]);
    const timeAllyInstance3 = new ethers.Contract(timeAllyInstance.address, timeAllyJSON.abi, signer3);

    const contract = await timeAllyInstance3.viewContract(0);
    assert.equal(contract[3], accounts[2]);

    // transfering it back to second acconut
    await timeAllyInstance3.transferOwnership(0, accounts[1]);
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
