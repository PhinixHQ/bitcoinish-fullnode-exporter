const axios = require('axios');
const express = require('express');
const app = express();
require('dotenv').config();
const client = require('prom-client');

// URLs
const globalBlockbookEndpoint = process.env.BITCOINISH_BOCKBOOK_ENDPOINT
const bitcoinishFullNodeUrl = process.env.BITCOINISH_FULLNODE_BASE_URL
const bitcoinishJsonrpcToken = process.env.JSON_RPC_TOKEN
// metrics
const bitcoinishGlobalBlockbookUpGauge = new client.Gauge({ name: 'bitcoinish_global_blockbook_up', help: 'if global blockbook is accessible', labelNames: ['coin'] });
const bitcoinishGlobalBlockbookCurrentBlockGauge = new client.Gauge({ name: 'bitcoinish_global_blockbook_current_block', help: 'number of current block on global blockbook', labelNames: ['coin'] });
const bitcoinishGlobalBlockbookLastUpdateGauge = new client.Gauge({ name: 'bitcoinish_global_blockbook_last_update_seconds', help: 'last update from the global blockbook', labelNames: ['coin'] });
const fullnodeUpGauge = new client.Gauge({ name: 'bitcoinish_fullnode_up', help: 'if fullNode is accessible', labelNames: ['coin'] });
const fullnodeCurrentBlockGauge = new client.Gauge({ name: 'bitcoinish_fullnode_current_block', help: 'number of current block', labelNames: ['coin'] });
const fullnodeLastUpdateGauge = new client.Gauge({ name: 'bitcoinish_fullnode_last_update_seconds', help: 'last update from the node', labelNames: ['coin'] });
// get the latest global blockbook block number
async function updatebitcoinishGlobalBlockbookMetrics(){
    try{
        const latestBlock = await axios.get(globalBlockbookEndpoint, {headers: {'user-agent':'phinix'}});
        const coinName = process.env.COIN_NAME;
        bitcoinishGlobalBlockbookUpGauge.set({ coin: coinName } ,1);
        bitcoinishGlobalBlockbookCurrentBlockGauge.set({ coin: coinName } ,latestBlock.data.backend.blocks);
        bitcoinishGlobalBlockbookLastUpdateGauge.set({ coin: coinName } ,Math.floor(Date.now() / 1000));
    }
    catch(err) {
        console.log(err);
        bitcoinishGlobalBlockbookUpGauge.set({ coin: process.env.COIN_NAME} ,0);
    }
}

// get the latest bitcoinishFullnode block number
async function updatebitcoinishFullNodeMetrics(){
    try{
        const bitcoinishAuth = {'Authorization': bitcoinishJsonrpcToken}
        const jsonBody = {"jsonrpc": "1.0", "id": "curltest", "method": "getblockchaininfo", "params": []};
        const bitcoinishFullNOdeLatestBlock = await axios.post(bitcoinishFullNodeUrl,jsonBody, {headers: bitcoinishAuth});
        const coinName = process.env.COIN_NAME;
        fullnodeUpGauge.set({ coin: coinName } ,1);
        fullnodeCurrentBlockGauge.set({ coin: coinName } ,bitcoinishFullNOdeLatestBlock.data.result.blocks);
        fullnodeLastUpdateGauge.set({ coin: coinName } ,Math.floor(Date.now() / 1000));
    }
    catch(err){
        console.log(err);
        fullnodeUpGauge.set({ coin: process.env.COIN_NAME } ,0);
    }
}




// metrics endpoint for prometheus
app.get('/metrics', async (req, res) => {
    metrics = await client.register.metrics();
    return res.status(200).send(metrics);
});

app.listen(process.env.LISTEN_PORT, () => console.log('Server is running and metrics are exposed on http://URL:3000/metrics'));

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function main(){
   while(true){
       await Promise.all([updatebitcoinishGlobalBlockbookMetrics(), updatebitcoinishFullNodeMetrics(), delay(process.env.REFRESH_INTERVAL_MILLISECONDS)]);
   }
}

main();
