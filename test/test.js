const http = require('http');
const Serverless = require('serverless');
const ServerlessProjectUtils = require('../src');

serverless = new Serverless();

const server = http.createServer((req, res) => {
    console.log("LOCAL SERVER", req.url, req.method);
    res.end();
});
server.listen(3000);

return serverless.init().then(() => {
    serverless.config.servicePath = __dirname;

    const serverlessProjectUtils = new ServerlessProjectUtils(serverless, {
        target: 'http://localhost:3000'
    });
    serverlessProjectUtils.hooks['proxy:loadRoutes']();
    server.close();
});