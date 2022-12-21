import { StaticJsonRpcProvider } from '@ethersproject/providers';
import { ethers } from 'ethers';
import _ from 'lodash';

// donors[address] => balance
// allDonors() => all
import abi from './abi.json';

const CONTRACT = '0x9485aaf0b27bcf9ef9450c3a1969098d82ac8d7a';

const provider = new StaticJsonRpcProvider('https://rpc.ankr.com/bsc');
const contract = new ethers.Contract(CONTRACT, abi, provider);

(async () => {
  const donors = await contract['allDonors()']();

  for (const donor of donors) {
    const b = await contract['donors'](donor);
    console.log(donor, b.toString());
  }
})();
