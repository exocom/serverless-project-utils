'use strict';
const fs = require('fs');
const path = require('path');
const serverlessFolder = '.serverless';

class ServerlessProjectUtils {
    constructor(serverless, options) {
        this.serverless = serverless;
        this.commands = {
            'export': {
                usage: 'Exports the computed serverless yaml to json',
                lifecycleEvents: ['json']
            }
        };

        this.hooks = {
            'export:json': this.exportJson.bind(this)
        };
    }

    exportJson() {
        const slsFolder = path.join(this.serverless.config.servicePath, serverlessFolder);
        if (!fs.existsSync(slsFolder)) fs.mkdirSync(slsFolder);
        fs.writeFileSync(`${slsFolder}/serverless.json`, JSON.stringify({
            ...this.serverless.service,
            serverless: undefined
        }), 'utf8');
    }
}

module.exports = ServerlessProjectUtils;