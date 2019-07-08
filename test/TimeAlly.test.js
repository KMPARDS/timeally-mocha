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
  it('initiates ganache and generates a bunch of demo accounts', async() => {
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

    assert.ok(eraSwapInstance.address, 'conract address not present');
  });

  it('gives first account 91,00,00,000 ES balance', async() => {
    const balanceOfDeployer = await eraSwapInstance.balanceOf(accounts[0]);

    assert.ok(
      balanceOfDeployer.eq(ethers.utils.parseEther('910000000')),
      'deployer did not get 910000000 ES'
    );
  });

  it('mou() time machine is present', async() => {
    try {
      const mou = await eraSwapInstance.mou();
      assert.ok(mou.gt(0), 'mou() time machine not giving non zero time stamp');
    } catch (e) {
      assert(false, 'mou() method is not present in era swap contract');
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

    assert.ok(nrtManagerInstance.address, 'conract address not present');
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

    assert.ok(timeAllyInstance.address, 'conract address not present');
  });

  it('deploys Staking from the first account', async() => {
    const stakingContract = new ethers.ContractFactory(
      stakingJSON.abi,
      stakingJSON.evm.bytecode.object,
      provider.getSigner(accounts[0])
    );
    stakingInstance = await stakingContract.deploy(timeAllyInstance.address);

    assert.ok(stakingInstance.address, 'conract address not present');
  });

  it('deploys LoanAndRefund from the first account', async() => {
    const loanAndRefundContract = new ethers.ContractFactory(
      loanAndRefundJSON.abi,
      loanAndRefundJSON.evm.bytecode.object,
      provider.getSigner(accounts[0])
    );
    loanAndRefundInstance = await loanAndRefundContract.deploy(timeAllyInstance.address, eraSwapInstance.address);

    assert.ok(loanAndRefundInstance.address, 'conract address not present');
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

    assert.ok(output[0].eq(args._planPeriod), 'plan period not matching');
    assert.ok(output[1].eq(args._loanInterestRate), 'loan interest rate not matching');
    assert.ok(output[2].eq(args._loanPeriod), 'loan period not matching');
    assert.ok(output[3].eq(args._refundWeeks), 'refund weeks not matching');
  });
});


describe('User stakes', async() => {
  it('first account sends 10000 ES to second account', async() => {
    await eraSwapInstance.transfer(accounts[1], ethers.utils.parseEther('10000'));

    const balanceOfSecond = await eraSwapInstance.balanceOf(accounts[1]);

    assert.ok(balanceOfSecond.eq(ethers.utils.parseEther('10000')), 'second user not got balance');
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
    assert.ok(allowance.eq(ethers.utils.parseEther('10000')), 'enuf allowance was not given to timeally');
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

    const response = await timeAllyInstance2.createContract(accounts[1], 0, ethers.utils.parseEther('10000'));
    assert.ok(response.hash, 'did not get tx receipt');

    const contract = await timeAllyInstance2.viewContract(0);
    //`console.log(contract)
    assert.equal(contract[3], accounts[1], 'owner of contract missmatch');

    const stakes = await timeAllyInstance2.viewUserStakes(0);
    // console.log(stakes[1].toString());
    assert.ok(stakes[1].eq(ethers.utils.parseEther('10000')), 'staking amount missmatch');
  });

  it('balance of second account is decreased by 10000 ES and it goes to TimeAlly', async() => {
    const balanceOfSecond = await eraSwapInstance.balanceOf(accounts[1]);

    assert.ok(
      balanceOfSecond.eq(ethers.utils.parseEther('0')),
      'second account amount did not decrease'
    );

    const balanceOfTimeAlly = await eraSwapInstance.balanceOf(timeAllyInstance.address);

    assert.ok(
      balanceOfTimeAlly.eq(ethers.utils.parseEther('10000')),
      'timeally did not get user staking'
    );
  });

  it('second account needs 4000 ES urgently and takes loan over his/her prestaked contract of 10000 ES', async() => {

    await timeAllyInstance2.takeLoan(0, ethers.utils.parseEther('4000'));

    // checking if loan of 4000 ES is credited to second account
    const balanceOfSecond = await eraSwapInstance.balanceOf(accounts[1]);

    assert.ok(
      balanceOfSecond.eq(ethers.utils.parseEther('4000')),
      'second account amount did not receive loan amount'
    );

    // checking if contract status is 2
    const contract = await timeAllyInstance2.viewContract(0);
    assert.ok(contract[0].eq(2), 'contract status is not 2');
  });

  it('repay loan 4000 ES deducts 1% more, i.e. 4040 ES', async() => {

    // checking loanRepaymentAmount should be 4040 ES
    const loanRepaymentAmount = await timeAllyInstance2.loanRepaymentAmount(0);
    assert.ok(loanRepaymentAmount.eq(ethers.utils.parseEther('4040')), 'loanRepaymentAmount missmatch with loan rate 1%');

    // second account has 4000 ES, sending 40 ES from first account to second account
    await eraSwapInstance.transfer(accounts[1], ethers.utils.parseEther('40'));

    // creating eraSwapInstance2 with signer of second account
    const signer2 = provider.getSigner(accounts[1]);
    eraSwapInstance2 = new ethers.Contract(eraSwapInstance.address, eraSwapTokenJSON.abi, signer2);

    const balanceOfSecond = await eraSwapInstance.balanceOf(accounts[1]);

    // giving allowance of 4040 from second account to timeAlly
    await eraSwapInstance2.approve(timeAllyInstance.address, ethers.utils.parseEther('4040'));

    await timeAllyInstance2.rePayLoan(0);

    assert.ok(
      balanceOfSecond.sub(await eraSwapInstance.balanceOf(accounts[1])).eq(ethers.utils.parseEther('4040')),
      'amount deducted does not equal 101% of loan value'
    );

    // checking if contract status is 1
    const contract = await timeAllyInstance2.viewContract(0);
    assert.ok(contract[0].eq('1'), 'contract status is not 1');
  });

  it('second account can transfer ownership to third account and back to second account', async() => {
    // second account transfers ownership of contract id 0 to third account
    await timeAllyInstance2.transferOwnership(0, accounts[2]);

    // creating timeAllyInstance3 with signer of third account
    const signer3 = provider.getSigner(accounts[2]);
    const timeAllyInstance3 = new ethers.Contract(timeAllyInstance.address, timeAllyJSON.abi, signer3);

    const contract = await timeAllyInstance3.viewContract(0);
    assert.equal(contract[3], accounts[2], 'contract owner missmatch');

    // transfering it back to second acconut
    await timeAllyInstance3.transferOwnership(0, accounts[1]);
  });
});

describe('monthlyMasterHandler in TimeAlly', async() => {
  it('time travelling to the future by 1 month using mou() time machine', async() => {
    const currentTime = await eraSwapInstance.mou();
    const depth = 32 * 24 * 60 * 60; // adding 1 to offset as in contract require s
    await eraSwapInstance.goToFuture(depth);
    const currentTimeAfterComingOutFromTimeMachine = await eraSwapInstance.mou();

    assert.ok(
      currentTimeAfterComingOutFromTimeMachine.sub(currentTime).gte(depth),
      'time travel did not happen successfully'
    );
  });

  it('invoking MonthlyNRTRelease in NRT contract and checking if TimeAlly receives any ES', async() => {
    const timeAllyBalance = await eraSwapInstance.balanceOf(timeAllyInstance.address);
    await nrtManagerInstance.MonthlyNRTRelease();
    const timeAllyBalanceNew = await eraSwapInstance.balanceOf(timeAllyInstance.address);

    assert.ok(timeAllyBalanceNew.gt(timeAllyBalance), 'Time ally did not get NRT');
  });

  it('invoking monthlyMasterHandler Step 0', async() => {
    await timeAllyInstance.monthlyMasterHandler(1);
  });

  it('invoking monthlyMasterHandler Step 1', async() => {
    await timeAllyInstance.monthlyMasterHandler(1);
  });

  it('invoking monthlyMasterHandler Step 2', async() => {
    await timeAllyInstance.monthlyMasterHandler(1);
  });

  it('invoking monthlyMasterHandler Step 3', async() => {
    await timeAllyInstance.monthlyMasterHandler(1);
  });

  it('invoking monthlyMasterHandler Step 4', async() => {
    await timeAllyInstance.monthlyMasterHandler(1);
  });
});
