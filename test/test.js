'use strict';

/* global describe it beforeEach afterEach */
const fs = require('fs');
const path = require('path');
const moment = require('moment');
const chai = require('chai');
const sinon = require('sinon');
const Serverless = require('serverless');
const ServerlessProjectUtils = require('../src');


const assert = chai.assert;
const serverlessFolder = path.join(__dirname, '.serverless');

describe('index.js', () => {

    let sandbox;
    let serverless;

    beforeEach(() => {
        sandbox = sinon.sandbox.create();
        serverless = new Serverless({servicePath: __dirname});

        return serverless.init()
            .then(() => {
                serverless.pluginManager.addPlugin(ServerlessProjectUtils);
            });
    });

    afterEach((done) => {
        sandbox.restore();
        done();
    });

    describe('when export command is ran', () => {
        beforeEach(() => {
            serverless.processedInput = {
                commands: ['export'],
                options: {stage: undefined, region: undefined}
            };
            return serverless.run();
        });

        after(() => {
            process.exit(0);
        });

        it('should create a serverless.json', () => {
            assert.isTrue(fs.existsSync(`${serverlessFolder}/serverless.json`));
            const serverlessYaml = require(`${serverlessFolder}/serverless.json`);

            assert.equal(serverlessYaml.serviceObject.name, 'panda');
            assert.equal(serverlessYaml.provider.environment.NODE_ENV, 'dev');
            assert.equal(serverlessYaml.provider.environment.SERVICE_NAME, 'panda');

            assert.equal(serverlessYaml.functions.create.environment.NODE_ENV, 'test');
        });

        it('should convert schedule:string into an object', () => {
            assert.isTrue(fs.existsSync(`${serverlessFolder}/serverless.json`));
            const serverlessYaml = require(`${serverlessFolder}/serverless.json`);

            assert.isObject(serverlessYaml.functions.referentialIntegrity.events[0].schedule);
        });

        it('should add english descriptions to schedule events with cron expression', () => {
            assert.isTrue(fs.existsSync(`${serverlessFolder}/serverless.json`));
            const serverlessYaml = require(`${serverlessFolder}/serverless.json`);

            let schedule1 = serverlessYaml.functions.referentialIntegrity.events[0].schedule;

            assert.isObject(schedule1);
            assert.equal(schedule1.meta.utc, 'rate-1-day-UTC');
            assert.equal(schedule1.meta.local, 'rate-1-day-LOCAL');

            let schedule2 = serverlessYaml.functions.referentialIntegrity.events[1].schedule;

            let [hourUtc, meridiemUtc] = moment().utc().hours(10).minutes(0).format('hh A').split(' ');
            let [hourLocal, meridiemLocal] = moment().utc().hours(10).minutes(0).local().format('hh A').split(' ');

            assert.isObject(schedule2);
            assert.equal(schedule2.meta.utc, `cron-At-${hourUtc}:00-${meridiemUtc}-UTC`);
            assert.equal(schedule2.meta.local, `cron-At-${hourLocal}:00-${meridiemLocal}-LOCAL`);
        });
    });
});