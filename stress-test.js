const ethers = require('ethers');
const ganache = require('ganache-cli');
//const provider = numberOfAccounts => new ethers.providers.Web3Provider(ganache.provider({ gasLimit: 8000000, accounts: numberOfAccounts || 5 }));

const provider = new ethers.providers.Web3Provider(ganache.provider({ gasLimit: 80000000, total_accounts: 101 }) );

const eraSwapTokenJSON = require('./build/Eraswap_0.json');
const nrtManagerJSON = require('./build/NRTManager_0.json');
const timeAllyJSON = require('./build/TimeAlly_0.json');
const stakingJSON = require('./build/Staking_0.json');
const loanAndRefundJSON = require('./build/LoanAndRefund_0.json');

let accounts
, eraSwapInstance = []
, nrtManagerInstance
, timeAllyInstance = []
, stakingInstance
, loanAndRefundInstance;

(async() => {
  accounts = await provider.listAccounts();
  console.log(accounts.length);

  console.log('\nDeploying eraSwapInstance...');
  eraSwapInstance[0] = await (new ethers.ContractFactory(
    eraSwapTokenJSON.abi,
    eraSwapTokenJSON.evm.bytecode.object,
    provider.getSigner(accounts[0])
  )).deploy();
  console.log('done');

  console.log('\nDeploying nrtManagerInstance...');
  nrtManagerInstance = await (new ethers.ContractFactory(
    nrtManagerJSON.abi,
    nrtManagerJSON.evm.bytecode.object,
    provider.getSigner(accounts[0])
  )).deploy(eraSwapInstance[0].address);
  await eraSwapInstance[0].AddNRTManager(nrtManagerInstance.address);
  console.log('done');

  console.log('\nDeploying timeAllyInstance...');
  timeAllyInstance[0] = await (new ethers.ContractFactory(
    timeAllyJSON.abi,
    timeAllyJSON.evm.bytecode.object,
    provider.getSigner(accounts[0])
  )).deploy(eraSwapInstance[0].address, nrtManagerInstance.address, {gasLimit: 8000000});
  console.log('done');

  console.log('\nDeploying stakingInstance...');
  stakingInstance = await (new ethers.ContractFactory(
    stakingJSON.abi,
    stakingJSON.evm.bytecode.object,
    provider.getSigner(accounts[0])
  )).deploy(timeAllyInstance[0].address);
  console.log('done');

  console.log('\nDeploying loanAndRefundInstance...');
  loanAndRefundInstance = await (new ethers.ContractFactory(
    loanAndRefundJSON.abi,
    loanAndRefundJSON.evm.bytecode.object,
    provider.getSigner(accounts[0])
  )).deploy(timeAllyInstance[0].address, eraSwapInstance[0].address);
  console.log('done');

  console.log('\nConfiguring TimeAlly...')
  await timeAllyInstance[0].setaddress(stakingInstance.address, loanAndRefundInstance.address);

  await nrtManagerInstance.UpdateAddresses([
    "0x0000000000000000000000000000000000000000",
    "0x0000000000000000000000000000000000000000",
    "0x0000000000000000000000000000000000000000",
    "0x0000000000000000000000000000000000000000",
    "0x0000000000000000000000000000000000000000",
    "0x0000000000000000000000000000000000000000",
    "0x0000000000000000000000000000000000000000",
    "0x0000000000000000000000000000000000000000",
    timeAllyInstance[0].address
  ]);

  await timeAllyInstance[0].createPlan(
    31104000,
    1,
    5184000,
    6
  );
  console.log('done');




  // console.log('\nSending 500 ES to 100 addresses from owner address...');
  // const promiseArray = [];
  // for(let i = 1; i <= 100; i++) {
  //   promiseArray.push(
  //     (async()=>{
  //       await eraSwapInstance[0].transfer(accounts[i], ethers.utils.parseEther('500'));
  //     })()
  //   );
  // }
  // await Promise.all(promiseArray);
  // console.log('done');
  //
  //
  // console.log('\nGiving 500 ES allowance to TimeAlly from these 100 address...');
  // const promiseArray2 = [];
  // for(let i = 1; i <= 100; i++) {
  //   promiseArray2.push(
  //     (async()=>{
  //       eraSwapInstance[i] = new ethers.Contract(
  //         eraSwapInstance[0].address,
  //         eraSwapTokenJSON.abi,
  //         provider.getSigner(accounts[i])
  //       );
  //       await eraSwapInstance[i].approve(accounts[i], ethers.utils.parseEther('500'));
  //     })()
  //   );
  // }
  // await Promise.all(promiseArray2);
  // console.log('done');

  //const no = 10;

  const estimateBatchCreation = async no => {
    //console.log(`\nFirst account approving 500 * ${no} ES to timeAlly`);
    await eraSwapInstance[0].approve(timeAllyInstance[0].address, ethers.utils.parseEther('50000'));
    //console.log('done');

    //console.log(`\nEstimating gas createContractsByBatch in TimeAlly for ${no} addresses`);
    const args = {
      batchlength: no,
      planid: 0,
      contractOwner: accounts.slice(1),
      amount: Array(no).fill(500),
      total: no * 500
    };

    //console.log(Object.values(args));

    console.log(`Gas required for ${no} contract creations:`,(await timeAllyInstance[0].estimate.createContractsByBatch(
      ...Object.values(args)
    )).toNumber());

    // await timeAllyInstance[0].createContractsByBatch(
    //   ...Object.values(args)
    // );
    //console.log('done')
  }




  console.log(`\nEstimating gas createContractsByBatch in TimeAlly for 1 to 100 addresses`);
  for(let i = 1; i <= 100; i++) {
    await estimateBatchCreation(i);
  }
  console.log('done');
})();
