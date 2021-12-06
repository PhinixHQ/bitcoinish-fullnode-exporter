const axios = require('axios');
const express = require('express');
const app = express();
require('dotenv').config();
const client = require('prom-client');
axios.defaults.timeout = parseInt(process.env.AXIOS_TIMEOUT);
const Sentry = require('@sentry/node');

// Sentry
Sentry.init({ dsn: process.env.SENTRY_DSN });
Sentry.configureScope(scope => {
    scope.setTag('coin', process.env.COIN_NAME);
  });
// URLs
const globalBlockbookEndpoint = process.env.GLOBAL_BLOCKBOOK_ENDPOINT
const FullNodeUrl = process.env.FULLNODE_BASE_URL
const JsonRpcToken = process.env.JSON_RPC_TOKEN
// metrics
const GlobalBlockbookUpGauge = new client.Gauge({ name: 'global_blockbook_up', help: 'if global blockbook is accessible', labelNames: ['coin'] });
const GlobalBlockbookCurrentBlockGauge = new client.Gauge({ name: 'global_blockbook_current_block', help: 'number of current block on global blockbook', labelNames: ['coin'] });
const GlobalBlockbookLastUpdateGauge = new client.Gauge({ name: 'global_blockbook_last_update_seconds', help: 'last update from the global blockbook', labelNames: ['coin'] });
const fullnodeUpGauge = new client.Gauge({ name: 'fullnode_up', help: 'if fullNode is accessible', labelNames: ['coin'] });
const fullnodeCurrentBlockGauge = new client.Gauge({ name: 'fullnode_current_block', help: 'number of current block', labelNames: ['coin'] });
const fullnodeLastUpdateGauge = new client.Gauge({ name: 'fullnode_last_update_seconds', help: 'last update from the node', labelNames: ['coin'] });
// get the latest global blockbook block number
async function updateGlobalBlockbookMetrics(){
    try{
        console.log('starting getgloballatestBlock');
        const latestBlock = await axios.get(globalBlockbookEndpoint, {headers: {'user-agent':'phinix'}});
        console.log('done getgloballatestBlock');
        console.log('//////////////////////////');
        const coinName = process.env.COIN_NAME;
        GlobalBlockbookUpGauge.set({ coin: coinName } ,1);
        GlobalBlockbookCurrentBlockGauge.set({ coin: coinName } ,latestBlock.data.backend.blocks);
        GlobalBlockbookLastUpdateGauge.set({ coin: coinName } ,Math.floor(Date.now() / 1000));
    }
    catch(err) {
        Sentry.captureException(err);
        console.log(err);
        console.log('error on getgloballatestBlock');
        GlobalBlockbookUpGauge.set({ coin: process.env.COIN_NAME} ,0);
    }
}

// get the latest bitcoinishFullnode block number
async function updateFullNodeMetrics(){
    try{
        const bitcoinishAuth = {'Authorization': JsonRpcToken}
        const jsonBody = {"jsonrpc": "1.0", "id": "curltest", "method": "getblockchaininfo", "params": []};
        console.log('starting getFullNodelatestBlock');
        const FullNOdeLatestBlock = await axios.post(FullNodeUrl,jsonBody, {headers: bitcoinishAuth});
        console.log('done getFullNodelatestBlock');
        console.log('/////////////////////////////');
        const coinName = process.env.COIN_NAME;
        fullnodeUpGauge.set({ coin: coinName } ,1);
        fullnodeCurrentBlockGauge.set({ coin: coinName } ,FullNOdeLatestBlock.data.result.blocks);
        fullnodeLastUpdateGauge.set({ coin: coinName } ,Math.floor(Date.now() / 1000));
    }
    catch(err){
        Sentry.captureException(err);
        console.log(err);
        console.log('error on getFullNodelatestBlock');
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
       await Promise.all([updateGlobalBlockbookMetrics(), updateFullNodeMetrics(), delay(process.env.REFRESH_INTERVAL_MILLISECONDS)]);
   }
}

main();
