'use strict';
const fs = require('fs');
const path = require('path');
const serverlessFolder = '.serverless';
const cronstrue = require('cronstrue');
const moment = require('moment');

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

    scheduleToEnglish(scheduleConfig) {
        let rateInEnglishUtc = '';
        let rateInEnglishLocal = '';

        if (scheduleConfig.rate.startsWith('cron')) {
            let cronExpression = scheduleConfig.rate.replace(/^cron\((.*?)\)/g, '$1')
            let cronParts = cronExpression.split(' ');
            if (cronParts.length !== 6) throw new Error('Cron expression should contain 6 parts. See https://docs.aws.amazon.com/lambda/latest/dg/tutorial-scheduled-events-schedule-expressions.html')
            let cronExpressionLocal = [
                ...cronParts.slice(0, 1),
                moment().utc().hours(cronParts[1]).minutes(0).local().hours(),
                ...cronParts.slice(2)
            ].join(' ');

            rateInEnglishUtc = 'cron-' + cronstrue.toString(`0 ${cronExpression}`).replace(',', '');
            rateInEnglishLocal = 'cron-' + cronstrue.toString(`0 ${cronExpressionLocal}`).replace(',', '');
        } else if (scheduleConfig.rate.startsWith('rate')) {
            rateInEnglishUtc = rateInEnglishLocal = 'rate-' + scheduleConfig.rate.replace(/^rate\((.*?)\)/g, '$1');
        } else return scheduleConfig;

        return {
            ...scheduleConfig,
            meta: {
                utc: rateInEnglishUtc.replace(/\(|\)|\s+/g, '-').replace(/(^\/|(\/|-)$)/g, '') + '-UTC',
                local: rateInEnglishLocal.replace(/\(|\)|\s+/g, '-').replace(/(^\/|(\/|-)$)/g, '') + '-LOCAL',
            }
        }
    }


    exportJson() {
        const slsFolder = path.join(this.serverless.config.servicePath, serverlessFolder);
        if (!fs.existsSync(slsFolder)) fs.mkdirSync(slsFolder);
        let serverlessService = {
            ...this.serverless.service,
            functions: Object.keys(this.serverless.service.functions).reduce((updatedFunctions, name) => {
                let func = this.serverless.service.functions[name];
                updatedFunctions[name] = {
                    ...func,
                    events: func.events.map(e => {
                        return e.schedule ? {
                            ...e,
                            schedule: this.scheduleToEnglish(typeof e.schedule === 'string' ? {
                                rate: e.schedule,
                                enabled: true
                            } : e.schedule)
                        } : e;
                    })
                };
                return updatedFunctions
            }, {}),
            serverless: undefined
        };

        fs.writeFileSync(`${slsFolder}/serverless.json`, JSON.stringify(serverlessService), 'utf8');
    }
}

module.exports = ServerlessProjectUtils;