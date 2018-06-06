'use strict';
const fs = require('fs');
const path = require('path');
const serverlessFolder = '.serverless';

class ServerlessProjectUtils {
    constructor(serverless, options) {
        this.serverless = serverless;
        this.commands = {
            'export-config': {
                usage: 'Exports the computed serverless config to .json files',
                lifecycleEvents: ['environment']
            }
        };

        this.hooks = {
            'export:environment': this.exportEnvironment.bind(this)
        };
    }

    exportEnvironment() {
        const slsFolder = path.join(this.serverless.config.servicePath, serverlessFolder);
        if (!fs.existsSync(slsFolder)) fs.mkdirSync(slsFolder);
        fs.writeFileSync(`${slsFolder}/environment.json`, JSON.stringify(this.serverless.service.provider.environment || {}, 'utf8'));
    }
}

module.exports = ServerlessProjectUtils;