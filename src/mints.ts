import { StaticJsonRpcProvider } from '@ethersproject/providers';
import Decimal from 'decimal.js';
import * as ethers from 'ethers';
import fs from 'fs';
import _ from 'lodash';
import retry from 'async-retry';

Decimal.set({ toExpPos: 100 });

const provider = new StaticJsonRpcProvider('https://rpc.ankr.com/bsc');

const abi = [
  'function balanceOf(address) public view returns (uint256)',
  'function userInfo(address) public view returns (uint256, uint256, uint256, uint256)',
];

const truthToken = '0x55a633B3FCe52144222e468a326105Aa617CC1cc';
const stakingContractAddrs = [
  '0xcf8a986a9a7a57A3Daa0085E83DD2B2af5d9B372', // 7
  '0x66AaeB0044A5a5084e1F5aB08B05e2f413415288', // 30
  '0x509865d9a76cdd310651bbcebcae08c69f3357b9', // 90
  '0x7058903eb501b62be4a7add0b7ab906ec5e14ef8', // 180
  '0xc5359c9a55bc5af6781a02677e61beca0254e9a6', // 365
];

const truthContract = new ethers.Contract(truthToken, abi, provider);
const stakingContracts = stakingContractAddrs.map(
  (contract) => new ethers.Contract(contract, abi, provider)
);

const currentlyNeeded = new Decimal(2000).mul(1e18);
const presaleNFTcost = new Decimal(2000).mul(1e18);

(async () => {
  const data = fs.readFileSync('./wallets.txt', {
    encoding: 'utf8',
    flag: 'r',
  });

  let totalEligibleFor = 0;
  let totalPresaleToMint = 0;
  const donations = data.trim().split('\n');
  for (const line of donations) {
    const [address, strBalance] = line.split(' ');
    if (!address || !strBalance) {
      console.log('THIS IS ODD');
      continue;
    }

    const presaleAmount = new Decimal(strBalance.toString());
    const eligibleFor = presaleAmount
      .dividedToIntegerBy(presaleNFTcost)
      .toNumber();
    totalEligibleFor += eligibleFor;

    // Fetch balance & query staking contracts
    const accountBalance = await getBalance(address);
    const stakingBalance = await getStakingBalance(address);
    const balanceAndStaking = accountBalance.plus(stakingBalance);
    const numReceiving = Math.min(
      eligibleFor,
      balanceAndStaking.dividedToIntegerBy(currentlyNeeded).toNumber()
    );
    totalPresaleToMint += numReceiving;

    if (numReceiving > 0) {
      console.log(
        address,
        presaleAmount.div(1e18).toNumber(),
        accountBalance.div(1e18).toNumber(),
        stakingBalance.div(1e18).toNumber(),
        balanceAndStaking.div(1e18).toNumber(),
        eligibleFor,
        numReceiving
      );
    }
  }

  console.log(`Wallets in presale:`, donations.length);
  console.log('Total NFTs eligible:', totalEligibleFor.toString());
  console.log('Total NFTs to be minted:', totalPresaleToMint.toString());
})();

async function getBalance(address: string) {
  const result = await retry(() =>
    truthContract['balanceOf(address)'](address)
  );
  return new Decimal(result.toString());
}

async function getStakingBalance(address: string) {
  const staking = await Promise.all(
    stakingContracts.map((contract) =>
      retry(() => contract['userInfo(address)'](address))
    )
  );
  return staking.reduce((acc, cur) => {
    const [, , totalStaked, totalWithdrawn] = cur;
    const actual = new Decimal(totalStaked.toString())
      .minus(totalWithdrawn.toString())
      .div(0.99);
    return acc.plus(actual);
  }, new Decimal(0));
}
